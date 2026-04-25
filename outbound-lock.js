// ─── Outbound Message Lock ────────────────────────────────────────────────────
// Race-condition guard for the SEND→PERSIST window in every outbound flow.
//
// THE PROBLEM:
// Every outbound message is "sent then persisted":
//   1. Generate text (Claude or template)
//   2. await ghl.sendMessage(contactId, text)        ← message lands on phone
//   3. conversations.addExchange(contactId, …)        ← local state updated
// If the prospect replies between steps 2 and 3 (a fast responder on a hot lead
// can do this in <1s), the inbound webhook arrives at our server while local
// state still says "no outbound has been sent." The handler then reads stale
// state, asks Claude to "begin from step 0", and Claude re-sends the opener —
// the user sees the same message twice.
//
// THE FIX:
// Every outbound flow acquires a lock on the contactId before sending and
// releases it after persisting. The inbound webhook handler awaits the lock
// (with a sane timeout) at the top of handleInbound so it never reads state
// in the middle of a SEND→PERSIST window.
//
// CONCURRENT OUTBOUND CHAINING:
// If two outbound flows for the same contact overlap (e.g. a scheduled
// follow-up fires at the exact instant a manual send is triggered), the
// second acquire() chains its promise into the existing entry rather than
// overwriting. waitForSettle() then waits for ALL in-flight outbounds to
// finish, not just the most recent. This means a single inbound is
// guaranteed to see post-persist state from every concurrent outbound.
//
// USAGE:
//
//   // In an outbound flow:
//   const lock = outboundLock.acquire(contactId);
//   try {
//     await ghl.sendMessage(contactId, text);
//     conversations.addExchange(contactId, { ... });
//   } finally {
//     lock.release();
//   }
//
//   // In handleInbound, before reading any state:
//   await outboundLock.waitForSettle(contactId);

const _locks = new Map(); // contactId → Promise (resolves when ALL in-flight outbounds for this contact have settled)

// 60s is comfortably above worst-case pre-send latency:
//   • Claude sonnet-4-6 generation: 2-8s typical, ~15s p99
//   • GHL fetchMessages: 0.5-3s
//   • Google Places lookup: 0.5-2s
//   • ghl.sendMessage: 0.3-1s
// Total worst case is well under 30s. Setting 60s ensures the timeout only
// fires for genuinely stuck flows (process-level bug or unresolved promise),
// never for legitimate slow-but-working paths. If timeout DOES fire we self-
// heal by clearing the stale entry — at the cost of one possibly-stale
// inbound read. This is the conservative trade-off: extreme latency is rare
// and the worst outcome is one duplicate message under that pathological case
// rather than permanent system degradation.
const DEFAULT_TIMEOUT_MS = 60000;

function acquire(contactId) {
  if (!contactId) {
    return { release: () => {} };
  }

  // Each acquire creates its own resolve-on-release promise.
  let resolveFn;
  const myPromise = new Promise(resolve => { resolveFn = resolve; });

  // If a prior outbound is still in-flight for this contact, chain so the
  // map's entry tracks "all in-flight outbounds settled" rather than just
  // the latest. This prevents an inbound from racing past an older still-
  // in-flight send when a newer acquire happens to overlap.
  const prior = _locks.get(contactId);
  const chain = prior
    ? Promise.all([prior, myPromise]).then(() => {})
    : myPromise;
  _locks.set(contactId, chain);

  // Clean up the map entry once the entire chain settles, but only if no
  // newer acquire has chained on top of us in the meantime.
  chain.then(() => {
    if (_locks.get(contactId) === chain) {
      _locks.delete(contactId);
    }
  });

  return {
    release: () => {
      resolveFn();
    }
  };
}

async function waitForSettle(contactId, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!contactId) return false;
  const inflight = _locks.get(contactId);
  if (!inflight) return false;
  console.log(`[OutboundLock] Inbound for ${contactId} waiting for in-flight outbound to settle (timeout ${timeoutMs}ms)`);
  let timedOut = false;
  const start = Date.now();
  await Promise.race([
    inflight,
    new Promise(resolve => setTimeout(() => { timedOut = true; resolve(); }, timeoutMs))
  ]);
  const waited = Date.now() - start;
  if (timedOut) {
    // CRITICAL: a stuck lock would impose recurring 15s delays on every
    // future inbound for this contact. Clear it so the system self-heals
    // (we accept the consistency risk on this one inbound — the alternative
    // is permanent degradation for the contact).
    console.error(`[OutboundLock] CRITICAL: Timed out waiting on ${contactId} after ${waited}ms — clearing stale lock to prevent recurring delays`);
    if (_locks.get(contactId) === inflight) {
      _locks.delete(contactId);
    }
  } else {
    console.log(`[OutboundLock] Outbound for ${contactId} settled after ${waited}ms — inbound proceeding`);
  }
  return true;
}

function inProgress(contactId) {
  return contactId ? _locks.has(contactId) : false;
}

// For tests / introspection only
function _activeCount() {
  return _locks.size;
}

module.exports = { acquire, waitForSettle, inProgress, _activeCount };
