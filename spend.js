'use strict';

/**
 * spend.js
 *
 * Tracks Claude API costs per contact and enforces a $1 spend cap.
 * Callers: followups.js, enrollment.js, server.js (handleInbound)
 *
 * Usage:
 *   const spend = require('./spend');
 *
 *   // Before any Claude call for a contact:
 *   if (spend.isAtLimit(contactId)) { skip; }
 *
 *   // After a successful Claude response:
 *   spend.track(contactId, model, response.usage);
 *   // returns { cost, limitHit } — limitHit = true means contact just crossed $1
 */

const fs   = require('fs');
const path = require('path');

// Avoid circular dep: require conversations lazily inside functions
function convo() { return require('./conversations'); }

// ─── Event callbacks ─────────────────────────────────────────────────────────

const _limitHitCallbacks = [];
function onLimitHit(cb) { _limitHitCallbacks.push(cb); }

// ─── Pricing ──────────────────────────────────────────────────────────────────

const SPEND_LIMIT = 1.00; // $1 per contact

const PRICE = {
  opus:   { input: 15,  output: 75  },   // claude-opus-*
  sonnet: { input:  3,  output: 15  },   // everything else (claude-sonnet-*, default)
};

function calcCost(model, inputTokens, outputTokens) {
  const m = (model || '').toLowerCase();
  const p = m.includes('opus') ? PRICE.opus : PRICE.sonnet;
  return ((inputTokens || 0) * p.input + (outputTokens || 0) * p.output) / 1_000_000;
}

// ─── Limit check (sync) ───────────────────────────────────────────────────────

function isAtLimit(contactId) {
  if (!contactId) return false;
  const c = convo().get(contactId);
  if (!c) return false;
  return c.apiSpendLimitReached === true || (c.totalApiSpend || 0) >= SPEND_LIMIT;
}

// ─── Spend logger ─────────────────────────────────────────────────────────────

const LOG_FILE = path.join(__dirname, 'data', 'spend-limit-reached.json');

function _appendLog(entry) {
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let log = [];
    if (fs.existsSync(LOG_FILE)) {
      try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch {}
    }
    // Overwrite existing entry for same contactId so it stays current
    log = log.filter(e => e.contactId !== entry.contactId);
    log.push({ ...entry, loggedAt: Date.now() });
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  } catch (err) {
    console.error('[Spend] Log write error:', err.message);
  }
}

function getLimitLog() {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  } catch { return []; }
}

// ─── Track spend (call AFTER a successful Claude response) ───────────────────

/**
 * Track API cost for a contact.
 * @param {string} contactId
 * @param {string} model  — Claude model string
 * @param {object} usage  — { input_tokens, output_tokens } from response.usage
 * @returns {{ cost: number, limitHit: boolean }}
 */
function track(contactId, model, usage) {
  if (!contactId || !usage) return { cost: 0, limitHit: false };

  const cost = calcCost(model, usage.input_tokens, usage.output_tokens);
  if (cost <= 0) return { cost: 0, limitHit: false };

  const c = convo().get(contactId);
  if (!c) return { cost, limitHit: false };

  const prev     = c.totalApiSpend || 0;
  const newTotal = prev + cost;
  const limitHit = newTotal >= SPEND_LIMIT && !c.apiSpendLimitReached;

  if (limitHit) {
    convo().update(contactId, { totalApiSpend: newTotal, apiSpendLimitReached: true });
    _appendLog({
      contactId,
      practiceName:  c.practiceName || null,
      firstName:     c.firstName    || null,
      totalApiSpend: newTotal,
      lastMessageAt: c.lastMessageAt
    });
    console.warn(`[Spend] ⚠ Contact ${contactId} (${c.firstName || '?'}) hit $1 limit — total $${newTotal.toFixed(4)}`);
    _limitHitCallbacks.forEach(cb => { try { cb(contactId); } catch {} });
  } else {
    convo().update(contactId, { totalApiSpend: newTotal });
  }

  return { cost, limitHit };
}

// ─── Reset limit (admin override) ────────────────────────────────────────────

function resetLimit(contactId) {
  if (!contactId) return false;
  const c = convo().get(contactId);
  if (!c) return false;
  convo().update(contactId, { apiSpendLimitReached: false });
  // Remove from log
  try {
    let log = getLimitLog().filter(e => e.contactId !== contactId);
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  } catch {}
  console.log(`[Spend] Limit reset for ${contactId} (${c.firstName || '?'}) — total spend remains $${(c.totalApiSpend || 0).toFixed(4)}`);
  return true;
}

module.exports = { isAtLimit, track, calcCost, resetLimit, getLimitLog, onLimitHit, SPEND_LIMIT };
