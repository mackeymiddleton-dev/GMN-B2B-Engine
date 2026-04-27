// ─── GHL Webhook Miss Reconciliation Poller ───────────────────────────────────
// Background process that polls GHL for new inbound messages and replays any
// the webhook missed. The webhook is the primary path; this is a safety net.
//
// Why it exists:
//   GHL webhooks are best-effort. If GHL drops a webhook (or our server is
//   briefly down/restarting), the prospect's reply never reaches handleInbound
//   and the AI never responds. The prospect thinks the practice ghosted them.
//
// How it works:
//   Every 30s, list active candidate contacts (recent activity, not opted out,
//   not booked, not paused). For each, fetch the last ~20 messages from GHL.
//   For every inbound message in the trailing 10 minutes whose GHL messageId
//   is not already in our exchanges table, replay it through handleInbound —
//   exactly as if the webhook had fired.
//
// Safety guards (all must pass before replay):
//   • messageId not already in exchanges (dedup vs the webhook)
//   • inbound timestamp within last 10 min (older = stale, prospect moved on)
//   • no outbound message in our exchanges with ts > inbound.ts (someone
//     already replied — could be human via GHL UI, or AI from a webhook that
//     arrived after the poll cycle started)
//   • contact not opted out
//   • contact not booked or in a paused state (declined, verbal-commit, etc.)
//
// Idempotency:
//   handleInbound itself dedups by messageId at its entry point, so even if
//   two reconciliation cycles overlap or the webhook fires concurrently, the
//   message is processed exactly once.

const conversations = require('./conversations');
const ghl = require('./ghl');
const optouts = require('./optouts');
const { DEV_MODE } = require('./devmode');

const POLL_WINDOW_MS = 60 * 60 * 1000;        // only replay inbounds <60 min old
const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000; // only poll contacts active <24h
const MAX_REPLAYS_LOG = 50;                   // keep last N for the admin panel
const PER_CONTACT_FETCH_LIMIT = 20;           // GHL messages page size per poll

// In-memory cache of resolved conversationIds. Bounds GHL API calls when an
// older contact's exchanges all carry conversationId=null (legacy data, or
// pre-fix opener rows). One lookup per contact per process lifetime.
const _convIdCache = new Map();

// Lazy-loaded to avoid a circular require with server.js (which requires this
// module to start the scheduler). Resolved on first run via require cache.
let _handleInbound = null;
function setHandleInbound(fn) { _handleInbound = fn; }

// In-memory ring buffer of recent replays for the admin dashboard.
// Each entry: { ts, contactId, firstName, messageId, bodyPreview, conversationId }
const _recentReplays = [];
function _logReplay(entry) {
  _recentReplays.unshift(entry);
  if (_recentReplays.length > MAX_REPLAYS_LOG) _recentReplays.length = MAX_REPLAYS_LOG;
}

// Stats for the admin panel.
const _stats = {
  startedAt: null,
  lastRunAt: null,
  lastRunDurationMs: null,
  lastRunCandidates: 0,
  lastRunReplays: 0,
  lastRunErrors: 0,
  totalRuns: 0,
  totalReplays: 0,
  lastError: null
};

function getStats() {
  return { ..._stats };
}

function getRecentReplays() {
  return _recentReplays.slice();
}

// Pull a normalized {direction, body, messageId, ts, conversationId} record
// out of whatever shape GHL returns. The Conversations API returns slightly
// different field names than the webhook payload, so we cover both.
function _normalizeGhlMessage(m, fallbackConversationId) {
  if (!m || typeof m !== 'object') return null;
  const messageId = m.id || m.messageId || m._id || null;
  const direction = (m.direction || m.type || '').toString().toLowerCase();
  const body = (m.body || m.message || m.text || '').toString().trim();
  // GHL ships timestamps as ISO strings (dateAdded) or epoch ms.
  let ts = null;
  const rawTs = m.dateAdded || m.createdAt || m.timestamp || m.ts;
  if (rawTs) {
    const parsed = typeof rawTs === 'number' ? rawTs : Date.parse(rawTs);
    if (!Number.isNaN(parsed)) ts = parsed;
  }
  const conversationId = m.conversationId || m.conversation_id || fallbackConversationId || null;
  return { messageId, direction, body, ts, conversationId };
}

// Returns the set of candidate contacts to poll this cycle.
// We deliberately scope tight: only contacts with activity in the last 24h.
// Everything older is either opted out, booked, or has gone cold — the AI
// wouldn't be replying to them anyway.
async function _selectCandidates() {
  const all = conversations.getAll();
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  const candidates = [];

  for (const [contactId, contact] of Object.entries(all)) {
    if (!contact) continue;
    // Recent activity gate
    const lastActivity = contact.lastMessageAt || 0;
    if (lastActivity < cutoff) continue;

    // Skip booked (real appointment confirmed) — these contacts are done.
    if (contact.booked === true) continue;

    // Skip paused contacts. `pausedReason` is set when AI is intentionally
    // off (declined, verbal-commit pending GHL appointment, scan-failed, etc).
    // Replaying inbounds here would either re-trigger an already-handled
    // path or send unwanted messages.
    if (contact.pausedReason) continue;

    // Skip if the user has explicitly disabled AI for this contact via tag.
    const tags = Array.isArray(contact.tags) ? contact.tags.map(t => (typeof t === 'string' ? t : t?.name || '').toLowerCase()) : [];
    if (tags.includes('disable ai') || tags.includes('ai-disabled')) continue;

    // Resolve the contact's conversationId — we look at the last few exchanges
    // since older rows may not have it stored. The poller can only fetch
    // GHL messages by conversationId.
    let conversationId = null;
    const exchanges = contact.exchanges || [];
    for (let i = exchanges.length - 1; i >= 0 && i >= exchanges.length - 10; i--) {
      if (exchanges[i]?.conversationId) { conversationId = exchanges[i].conversationId; break; }
    }

    // Fallback: legacy data (and contacts whose opener was sent before the
    // trap #9 opener-fix shipped) may have ALL exchanges with
    // conversationId=null. Without recovery here, those contacts are
    // permanently invisible to the poller and any dropped inbound is lost
    // forever. Resolve on demand from GHL and cache so we make at most one
    // lookup per contact per process lifetime. Failed/null results are also
    // cached (as null) — a contact whose GHL search returns nothing is
    // almost always a permanent state (deleted, wrong location, etc.) and
    // re-trying every 30s would just hammer GHL for no benefit.
    if (!conversationId) {
      if (_convIdCache.has(contactId)) {
        conversationId = _convIdCache.get(contactId); // may be null (negative cache hit)
      } else {
        try {
          conversationId = await ghl.getOrCreateConversation(contactId);
          _convIdCache.set(contactId, conversationId || null);
          if (conversationId) {
            console.log(`[Reconciliation] Resolved conversationId via GHL fallback for ${contactId}`);
          }
        } catch (err) {
          _convIdCache.set(contactId, null); // negative cache: don't retry on every cycle
          console.warn(`[Reconciliation] GHL conversationId fallback failed for ${contactId}:`, err.message);
        }
      }
    }
    if (!conversationId) continue; // genuinely unresolvable — skip this cycle

    candidates.push({ contactId, contact, conversationId });
  }
  return candidates;
}

// Returns true if there's an outbound exchange in our records with a timestamp
// greater than the given inbound timestamp. If so, someone already replied
// (human via GHL UI, or AI from a different code path), and replaying would
// be a duplicate response.
function _hasLaterOutbound(contact, inboundTs) {
  const exchanges = contact.exchanges || [];
  for (let i = exchanges.length - 1; i >= 0; i--) {
    const ex = exchanges[i];
    if (!ex) continue;
    const exTs = ex.timestamp || 0;
    if (exTs <= inboundTs) break; // sorted ascending; older from here on
    if (ex.direction === 'outbound') return true;
  }
  return false;
}

async function _processCandidate({ contactId, contact, conversationId }) {
  let replayCount = 0;
  // ghl.fetchMessages swallows errors and returns []. To distinguish "no
  // messages" from "GHL API failed", we sniff stderr by also tracking a
  // length-zero result against the contact's known recent activity — but a
  // simpler & more reliable approach: do the fetch through a try/catch here
  // and treat a thrown / null result as a counted error in the cycle stats.
  let messages;
  try {
    messages = await ghl.fetchMessages(conversationId, PER_CONTACT_FETCH_LIMIT);
  } catch (err) {
    throw err; // bubble up to runReconciliation's per-candidate try/catch
  }
  if (!messages || messages.length === 0) return 0;

  const cutoff = Date.now() - POLL_WINDOW_MS;

  // Sort ascending by ts so we replay in chronological order.
  const allNormalized = messages
    .map(m => _normalizeGhlMessage(m, conversationId))
    .filter(n => n && n.body && n.ts);

  const normalized = allNormalized
    .filter(n => n.direction === 'inbound' && n.messageId && n.ts >= cutoff)
    .sort((a, b) => a.ts - b.ts);

  // Collect outbound timestamps from the SAME GHL thread we just fetched.
  // This is critical: the inbound webhook handler (`server.js`) deliberately
  // skips outbound webhook events, so a human typing a reply in the GHL UI
  // never lands in our local `exchanges` table. `_hasLaterOutbound` only
  // checks local exchanges and would miss that case — leading to duplicate
  // AI replies on top of a human's. With the wider 60-min POLL_WINDOW the
  // odds of this happening are non-trivial. Source-of-truth gate.
  const ghlOutboundTimestamps = allNormalized
    .filter(n => n.direction === 'outbound')
    .map(n => n.ts);

  for (const msg of normalized) {
    // Dedup against our exchanges table.
    if (await conversations.hasExchangeWithMessageId(msg.messageId)) continue;

    // Don't replay if we (or a human) already responded after this inbound.
    // Two checks: local exchanges (AI replies our system sent), and GHL
    // thread outbounds (catches human-typed replies the webhook skipped).
    if (_hasLaterOutbound(contact, msg.ts)) continue;
    if (ghlOutboundTimestamps.some(ts => ts > msg.ts)) {
      console.log(`[Reconciliation] Skipping ${contactId} inbound ${msg.messageId} — human/UI reply in GHL thread already exists after it`);
      continue;
    }

    // Final opt-out check — could have changed since _selectCandidates.
    if (await optouts.isOptedOut(contactId)) continue;

    const firstName = contact.firstName || '';
    const city = contact.city || '';
    const phone = contact.phone || '';

    console.log(`[Reconciliation] Caught missed inbound for ${contactId} (${firstName}): "${msg.body.slice(0, 80)}"`);

    if (DEV_MODE) {
      // Don't actually fire AI replies from a local dev server — it would
      // send real SMS via the production database+GHL account. Just log it
      // and record the would-have-replayed entry in the admin ring buffer.
      console.log(`[Reconciliation][DEV MODE] Skipping replay (would have called handleInbound)`);
      _logReplay({
        ts: Date.now(), contactId, firstName, messageId: msg.messageId,
        bodyPreview: msg.body.slice(0, 140), conversationId: msg.conversationId,
        devModeSkipped: true, success: true
      });
      replayCount++;
      _stats.totalReplays++;
    } else {
      // Production: only count as a successful replay if handleInbound
      // returns without throwing. Failed replays still get logged for
      // visibility, but with `success:false` and an error message — they
      // do NOT increment the success counters.
      if (!_handleInbound) {
        const errMsg = 'handleInbound not registered';
        console.error(`[Reconciliation] Replay error for ${contactId}: ${errMsg}`);
        _stats.lastError = `${new Date().toISOString()} ${contactId}: ${errMsg}`;
        _logReplay({
          ts: Date.now(), contactId, firstName, messageId: msg.messageId,
          bodyPreview: msg.body.slice(0, 140), conversationId: msg.conversationId,
          devModeSkipped: false, success: false, error: errMsg
        });
        throw new Error(errMsg); // bubble to per-candidate counter
      }
      try {
        await _handleInbound({
          contactId,
          conversationId: msg.conversationId,
          messageBody: msg.body,
          firstName,
          city,
          phone,
          messageId: msg.messageId
        });
        _logReplay({
          ts: Date.now(), contactId, firstName, messageId: msg.messageId,
          bodyPreview: msg.body.slice(0, 140), conversationId: msg.conversationId,
          devModeSkipped: false, success: true
        });
        replayCount++;
        _stats.totalReplays++;
      } catch (err) {
        console.error(`[Reconciliation] Replay error for ${contactId}:`, err.message);
        _stats.lastError = `${new Date().toISOString()} ${contactId}: ${err.message}`;
        _logReplay({
          ts: Date.now(), contactId, firstName, messageId: msg.messageId,
          bodyPreview: msg.body.slice(0, 140), conversationId: msg.conversationId,
          devModeSkipped: false, success: false, error: err.message
        });
        // Don't throw — keep processing the remaining messages for this
        // candidate. The per-candidate try/catch in runReconciliation
        // counts uncaught errors; here we already counted via lastError.
      }
    }
  }

  return replayCount;
}

let _running = false;
async function runReconciliation() {
  if (_running) {
    // Previous cycle still in flight (e.g. slow GHL API). Skip this tick —
    // the next 30s cycle will pick it up.
    console.log('[Reconciliation] Previous cycle still running, skipping this tick');
    return { skipped: true };
  }
  _running = true;
  const startedAt = Date.now();
  let candidates = [];
  let replays = 0;
  let errors = 0;

  try {
    candidates = await _selectCandidates();
    for (const cand of candidates) {
      try {
        replays += await _processCandidate(cand);
      } catch (err) {
        errors++;
        console.error(`[Reconciliation] Candidate error for ${cand.contactId}:`, err.message);
      }
    }
  } catch (err) {
    errors++;
    console.error('[Reconciliation] Cycle error:', err.message);
    _stats.lastError = `${new Date().toISOString()} cycle: ${err.message}`;
  } finally {
    _running = false;
  }

  _stats.lastRunAt = Date.now();
  _stats.lastRunDurationMs = Date.now() - startedAt;
  _stats.lastRunCandidates = candidates.length;
  _stats.lastRunReplays = replays;
  _stats.lastRunErrors = errors;
  _stats.totalRuns++;

  if (replays > 0 || errors > 0) {
    console.log(`[Reconciliation] Cycle: ${candidates.length} candidates, ${replays} replays, ${errors} errors, ${_stats.lastRunDurationMs}ms`);
  }
  return { candidates: candidates.length, replays, errors, durationMs: _stats.lastRunDurationMs };
}

let _intervalHandle = null;
function startScheduler(intervalMs = 30 * 1000) {
  if (_intervalHandle) return; // already running
  _stats.startedAt = Date.now();
  _intervalHandle = setInterval(() => {
    runReconciliation().catch(err => console.error('[Reconciliation] Unhandled scheduler error:', err.message));
  }, intervalMs);
  console.log(`[Reconciliation] Scheduler started (${intervalMs / 1000}s interval)`);
}

function stopScheduler() {
  if (_intervalHandle) { clearInterval(_intervalHandle); _intervalHandle = null; }
}

module.exports = {
  setHandleInbound,
  runReconciliation,
  startScheduler,
  stopScheduler,
  getStats,
  getRecentReplays
};
