/**
 * variant-builder.js — Structured Variant Builder (Tasks #113 + #114).
 *
 * STEP SCHEMA
 * -----------
 * A Variant is { id, name, steps: Step[] }.
 *   id     — single uppercase letter or short slug ('A', 'B', 'NEW1') used
 *            when looking up which prompt to send to a contact.
 *   name   — human-readable display name shown in the admin UI.
 *   steps  — ordered array of Step objects.
 *
 * A Step is { type, text?, terminal? }.
 *   type     — 'text' | 'practice_detection' | 'vsl_send'
 *   text     — required for type='text'; the message copy the AI must send.
 *   terminal — null | 'booked' | 'declined'. When set, the compiler appends
 *              [BOOKED] or [DECLINED] to that step's instructions so the
 *              server's existing marker logic kicks in.
 *
 * Persisted under the `structuredVariants` key in data/prompts.json so it
 * lives alongside the existing raw prompt overrides without needing a new
 * file or DB table.
 */

const fs = require('fs');
const path = require('path');
const industry = require('./industry');

const FILE = path.join(__dirname, 'data', 'prompts.json');

// ─── Persistence helpers ──────────────────────────────────────────────────────

function _loadAll() {
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch { return {}; }
}

function _saveAll(data) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function listVariants() {
  const all = _loadAll();
  return Array.isArray(all.structuredVariants) ? all.structuredVariants : [];
}

function getVariant(id) {
  return listVariants().find(v => v.id === id) || null;
}

function _writeVariants(arr) {
  const all = _loadAll();
  all.structuredVariants = arr;
  _saveAll(all);
  return arr;
}

function _validate(variant) {
  if (!variant || typeof variant !== 'object') throw new Error('variant must be an object');
  if (!variant.id || !/^[A-Za-z0-9_-]{1,16}$/.test(variant.id)) throw new Error('id must be 1-16 alphanumeric chars (A-Z, 0-9, _ or -)');
  if (!variant.name || typeof variant.name !== 'string') throw new Error('name is required');
  if (!Array.isArray(variant.steps)) throw new Error('steps must be an array');
  if (variant.steps.length === 0) throw new Error('variant must have at least one step');
  if (variant.steps.length > 30) throw new Error('variant cannot exceed 30 steps');
  const VALID_TYPES = ['text', 'practice_detection', 'vsl_send'];
  const VALID_TERMINALS = [null, 'booked', 'declined'];
  variant.steps.forEach((s, i) => {
    if (!s || !VALID_TYPES.includes(s.type)) throw new Error(`step ${i + 1}: type must be one of ${VALID_TYPES.join(', ')}`);
    if (s.type === 'text' && (typeof s.text !== 'string' || !s.text.trim())) throw new Error(`step ${i + 1}: text steps require non-empty text`);
    const t = s.terminal === undefined ? null : s.terminal;
    if (!VALID_TERMINALS.includes(t)) throw new Error(`step ${i + 1}: terminal must be null, 'booked', or 'declined'`);
  });
}

function createVariant(variant) {
  _validate(variant);
  const arr = listVariants();
  if (arr.some(v => v.id === variant.id)) throw new Error(`variant id "${variant.id}" already exists`);
  arr.push({ id: variant.id, name: variant.name, steps: variant.steps });
  return _writeVariants(arr);
}

function updateVariant(id, updates) {
  const arr = listVariants();
  const idx = arr.findIndex(v => v.id === id);
  if (idx === -1) throw new Error(`variant "${id}" not found`);
  const merged = { ...arr[idx], ...updates, id };
  _validate(merged);
  arr[idx] = merged;
  return _writeVariants(arr);
}

function deleteVariant(id) {
  const arr = listVariants().filter(v => v.id !== id);
  return _writeVariants(arr);
}

// ─── Compiler ─────────────────────────────────────────────────────────────────

const SHARED_OUTPUT_RULES = `CRITICAL OUTPUT RULES — apply to every reply you generate:
- Return ONLY the message text the prospect will receive. No labels, no preamble, no markdown, no quotes around the message.
- Always start your reply with the hidden step marker [STEP:N] for the step you are currently on. The system strips it before sending.
- One question per message. Wait for their reply before advancing.
- Substitute [first name] with the prospect's actual first name (PROSPECT FIRST NAME in the system context).
- If the prospect goes off-script, briefly acknowledge what they said (1 short sentence) then bridge back to the next scripted question.
- If the prospect uses a TCPA opt-out keyword (STOP, QUIT, END, CANCEL, OPTOUT, UNSUBSCRIBE) or aggressively tells you to leave them alone, immediately fire your final-step decline handler with [DECLINED] and stop.
- Never invent statistics, competitor names, or numbers. Only use values that appear in LIVE RESEARCH DATA / SCAN RESULTS in your context block.

MARKER PROTOCOL (the system reads these silently and strips them before delivery):
- [STEP:N]                                — REQUIRED on every reply, indicates the current step.
- [PRACTICE_DETECTED:Name|Street|City]    — emit silently the moment the prospect gives their business name + address. Triggers the background research scan.
- [BOOKED]                                — fire when the prospect agrees to book / requests the video / asks for a human handoff.
- [DECLINED]                              — fire when the prospect firmly declines or hits an opt-out keyword.`;

const PRACTICE_DETECTION_INSTRUCTION = `(PRACTICE DETECTION STEP)
The prospect just gave you their business name and street. In your reply:
1. Send a brief holding message confirming you got it (e.g. "Got it — pulling that up now.").
2. Silently emit [PRACTICE_DETECTED:BusinessName|Street|City] in the same reply (the system strips it before sending). Use the city from PROSPECT CITY in your context if available; if not, omit the third pipe segment.
3. Do NOT ask another question. The system will take over the listing-confirmation loop and resume the script automatically once research data is back.`;

function _vslLine(step, vslUrl) {
  const link = vslUrl || '{{vslUrl}}';
  if (step.text && step.text.trim()) {
    // Author-supplied copy — append the link if the author didn't already.
    return step.text.includes(link) ? step.text : `${step.text.trim()}\nLink: ${link}`;
  }
  return `Send the video link the prospect was promised. Use this exact URL: ${link}`;
}

/**
 * Compile a structured variant into the full prompt string the AI receives.
 * Prepends the industry system context (if configured) + shared output rules,
 * then numbers each step [STEP:N] with type-specific instructions.
 */
function compileVariant(variant) {
  if (!variant || !Array.isArray(variant.steps)) return '';
  const industryBlock = industry.buildSystemContext();
  const cfg = industry.load();
  const vslUrl = cfg.vslUrl || '';

  const parts = [];
  if (industryBlock) parts.push(industryBlock);
  parts.push(SHARED_OUTPUT_RULES);
  parts.push('━━━ CONVERSATION FLOW ━━━');
  parts.push(`Variant: ${variant.name} (id: ${variant.id})`);
  parts.push('Run these steps in order. Each step is one outbound message. Wait for the prospect to reply before advancing.');
  parts.push('');

  variant.steps.forEach((step, i) => {
    const n = i + 1;
    let body;
    if (step.type === 'text') {
      body = `STEP ${n}:\nSend exactly:\n${(step.text || '').trim()}\n[STEP:${n}]`;
    } else if (step.type === 'practice_detection') {
      body = `STEP ${n}:\n${PRACTICE_DETECTION_INSTRUCTION}\n[STEP:${n}]`;
    } else if (step.type === 'vsl_send') {
      body = `STEP ${n} (VIDEO SEND — final delivery):\n${_vslLine(step, vslUrl)}\n[STEP:${n}]`;
    } else {
      body = `STEP ${n}: (unknown step type "${step.type}" — ignored)`;
    }
    if (step.terminal === 'booked') body += ' [BOOKED]';
    if (step.terminal === 'declined') body += ' [DECLINED]';
    parts.push(body);
    parts.push('');
  });

  // Run interpolation so {{tokens}} from author-supplied step text get filled.
  return industry.interpolate(parts.join('\n'));
}

module.exports = {
  listVariants,
  getVariant,
  createVariant,
  updateVariant,
  deleteVariant,
  compileVariant,
  SHARED_OUTPUT_RULES
};
