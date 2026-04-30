const { Pool } = require('pg');

const _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const OPT_OUT_KEYWORDS = /\b(stop|unsubscribe|quit|cancel|end|optout|opt[ -]out)\b/i;

const _ready = (async () => {
  await _pool.query(`
    CREATE TABLE IF NOT EXISTS optouts (
      contact_id   TEXT PRIMARY KEY,
      opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Variant column added April 2026 to support per-variant opt-out tracking.
  // Nullable because (a) historical rows pre-date this column and (b) some
  // opt-outs (carrier STOP that lands before any contact record exists) may
  // have no known variant. The backfill below recovers variant for historical
  // rows where the contact still exists in the contacts table.
  await _pool.query(`ALTER TABLE optouts ADD COLUMN IF NOT EXISTS variant VARCHAR(1)`);
})().catch(err => console.error('[Optouts] Bootstrap error:', err.message));

async function isOptedOut(contactId) {
  await _ready;
  const id = String(contactId);
  const { rows } = await _pool.query('SELECT 1 FROM optouts WHERE contact_id = $1', [id]);
  return rows.length > 0;
}

async function add(contactId, variant) {
  await _ready;
  const id = String(contactId);
  const v = (variant && /^[A-E]$/.test(String(variant).toUpperCase()))
    ? String(variant).toUpperCase()
    : null;
  // ON CONFLICT: if the row already exists but has no variant recorded and
  // we now know one, write it. Otherwise leave the original row untouched.
  const result = await _pool.query(
    `INSERT INTO optouts (contact_id, variant) VALUES ($1, $2)
       ON CONFLICT (contact_id) DO UPDATE
         SET variant = COALESCE(optouts.variant, EXCLUDED.variant)`,
    [id, v]
  );
  return result.rowCount > 0;
}

async function getAll() {
  await _ready;
  const { rows } = await _pool.query('SELECT contact_id FROM optouts ORDER BY opted_out_at ASC');
  return rows.map(r => r.contact_id);
}

// Returns a Set<string> of all opted-out contact_ids — used for fast membership
// checks when iterating contact lists (mirrors the brain.getBookedContactIds()
// pattern used by the variants endpoint).
async function getAllSet() {
  await _ready;
  const { rows } = await _pool.query('SELECT contact_id FROM optouts');
  return new Set(rows.map(r => r.contact_id));
}

// One-time historical backfill: for any opt-out row missing a variant,
// recover it from the contacts table if the contact still exists and has
// a variant assigned. Idempotent — safe to call on every boot.
async function backfillVariants() {
  await _ready;
  try {
    const result = await _pool.query(`
      UPDATE optouts o
         SET variant = c.variant
        FROM contacts c
       WHERE o.contact_id = c.contact_id
         AND o.variant IS NULL
         AND c.variant IS NOT NULL
    `);
    if (result.rowCount > 0) {
      console.log(`[Optouts] Backfilled variant for ${result.rowCount} historical opt-out(s)`);
    }
    return result.rowCount;
  } catch (err) {
    console.error('[Optouts] Backfill error:', err.message);
    return 0;
  }
}

function isOptOutKeyword(text) {
  return OPT_OUT_KEYWORDS.test((text || '').trim());
}

module.exports = { isOptedOut, add, getAll, getAllSet, backfillVariants, isOptOutKeyword };
