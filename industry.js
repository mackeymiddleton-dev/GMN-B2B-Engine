/**
 * industry.js — White-label industry configuration.
 *
 * Stores the industry-specific "system context" that gets injected into every
 * prompt. This is the layer that lets the same codebase serve audiologists,
 * dentists, restaurants, real-estate agents, gyms, etc. without code changes.
 *
 * Stored in data/industry.json. Editable via /admin/setup.
 *
 * Tokens exposed for prompt interpolation:
 *   {{industryName}}        — e.g. "audiology", "dental", "real estate"
 *   {{audienceDescriptor}}  — e.g. "audiology practice owners", "dental clinic owners"
 *   {{businessNoun}}        — e.g. "practice", "clinic", "agency", "restaurant"
 *   {{customerNoun}}        — e.g. "patient", "client", "customer", "guest"
 *   {{brandName}}           — e.g. "Ampify AI"
 *   {{brandPersona}}        — e.g. "Sidney"
 *   {{productDescription}}  — paragraph describing what your product does
 *   {{painPoints}}          — bullet list of pain points the AI references
 *   {{valueProps}}          — bullet list of value props / outcomes
 *   {{vslUrl}}              — final video / booking link
 *   {{ctaLine}}             — final-step CTA line
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'industry.json');

const DEFAULTS = {
  industryName:        '',
  audienceDescriptor:  '',
  businessNoun:        'business',
  customerNoun:        'customer',
  brandName:           '',
  brandPersona:        '',
  productDescription:  '',
  painPoints:          '',
  valueProps:          '',
  vslUrl:              '',
  ctaLine:             '',
  // Free-text "extra system context" the user can dump anything else into.
  extraContext:        ''
};

function ensureDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  try {
    ensureDir();
    if (!fs.existsSync(FILE)) return { ...DEFAULTS };
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(data) {
  ensureDir();
  const merged = { ...DEFAULTS, ...data };
  fs.writeFileSync(FILE, JSON.stringify(merged, null, 2));
  return merged;
}

function get(key) {
  const all = load();
  return key ? all[key] : all;
}

function set(updates) {
  const current = load();
  return save({ ...current, ...updates });
}

function isConfigured() {
  const cur = load();
  return !!(cur.industryName && cur.brandName && cur.audienceDescriptor);
}

/**
 * Interpolate {{tokens}} in a string using the current industry config.
 * Unknown tokens are left intact so prompts can use other placeholders too
 * (e.g. {{firstName}}, [first name]) that the AI/runtime substitutes later.
 */
function interpolate(text) {
  if (!text || typeof text !== 'string') return text;
  const cfg = load();
  return text.replace(/\{\{(\w+)\}\}/g, (m, key) =>
    cfg[key] !== undefined && cfg[key] !== null ? String(cfg[key]) : m
  );
}

/**
 * Build the "Industry System Context" block that gets prepended to every
 * compiled variant. This is the AI's grounding in what your product is and
 * who the prospect is. Returns an empty string if no industry is configured.
 */
function buildSystemContext() {
  const c = load();
  if (!c.industryName && !c.brandName) return '';
  const lines = ['━━━ INDUSTRY CONTEXT ━━━'];
  if (c.brandName)          lines.push(`Brand: ${c.brandName}`);
  if (c.brandPersona)       lines.push(`Persona: ${c.brandPersona} (the human name you sign your messages as)`);
  if (c.industryName)       lines.push(`Industry: ${c.industryName}`);
  if (c.audienceDescriptor) lines.push(`Audience: ${c.audienceDescriptor}`);
  if (c.businessNoun)       lines.push(`Business noun: "${c.businessNoun}" (use this word when referring to their business)`);
  if (c.customerNoun)       lines.push(`Customer noun: "${c.customerNoun}" (use this word when referring to the people they serve)`);
  if (c.productDescription) lines.push('', 'WHAT YOUR PRODUCT DOES:', c.productDescription);
  if (c.painPoints)         lines.push('', 'PAIN POINTS THIS AUDIENCE FEELS:', c.painPoints);
  if (c.valueProps)         lines.push('', 'OUTCOMES YOU DELIVER:', c.valueProps);
  if (c.extraContext)       lines.push('', 'ADDITIONAL CONTEXT:', c.extraContext);
  return lines.join('\n');
}

module.exports = { load, save, get, set, isConfigured, interpolate, buildSystemContext, DEFAULTS };
