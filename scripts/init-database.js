'use strict';

/**
 * scripts/init-database.js
 *
 * One-time (idempotent) schema bootstrap for a brand-new / empty Postgres DB.
 *
 * The app's modules each lazily run their own `CREATE TABLE IF NOT EXISTS` /
 * `ALTER TABLE ADD COLUMN IF NOT EXISTS` migrations at boot — but on a totally
 * empty database the boot order means several modules try to SELECT from tables
 * that have not been created yet (conversations.js reads `contacts` and
 * `exchanges` before anything creates them), which is what produces the
 * "relation does not exist" errors. This script creates every table the code
 * reads from or writes to, up front, with the exact column shapes the app
 * expects. Safe to run repeatedly: every statement uses IF NOT EXISTS.
 *
 * Usage:  node scripts/init-database.js
 *
 * It reads .env the same way server.js does, then connects via DATABASE_URL.
 * (If PROD_DATABASE_URL is set it mirrors server.js's routing so the schema
 * lands on the same DB the running server uses — see replit.md's PROD_DATABASE_URL
 * note. In the current GMN local setup PROD_DATABASE_URL is unset, so this is a
 * no-op and DATABASE_URL — the Neon connection string — is used directly.)
 */

// ── Load .env (same minimal parser server.js uses) ──────────────────────────
try {
  const _fs = require('fs'), _p = require('path');
  const _env = _fs.readFileSync(_p.join(__dirname, '..', '.env'), 'utf8');
  for (const line of _env.split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim();
  }
} catch {}

// Mirror server.js: if PROD_DATABASE_URL is set, that is the real DB.
if (process.env.PROD_DATABASE_URL && process.env.PROD_DATABASE_URL !== process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;
}

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('[init-database] DATABASE_URL is not set. Add it to .env and re-run.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── Schema statements (run in order; each is independently idempotent) ───────
// Names match what the modules reference. Column types match how the code
// writes/reads each field (millisecond-epoch numbers → BIGINT, JSON blobs →
// JSONB, dollar spend → DOUBLE PRECISION, etc.).
const STATEMENTS = [
  // contacts — the master contact record. Written by conversations.js
  // (_dbUpsertContact), read on boot by conversations.initFromDb. The
  // variant / lead_form / paused_reason columns are also added defensively by
  // conversations.js's ALTER migrations; included here so a fresh DB has them
  // from the start.
  {
    label: 'contacts',
    sql: `
      CREATE TABLE IF NOT EXISTS contacts (
        contact_id              TEXT PRIMARY KEY,
        first_name              TEXT,
        city                    TEXT,
        phone                   TEXT,
        email                   TEXT,
        practice_name           TEXT,
        tags                    JSONB,
        current_step            INTEGER          DEFAULT 0,
        booked                  BOOLEAN          DEFAULT false,
        booked_at               BIGINT,
        last_message_at         BIGINT,
        created_at              BIGINT,
        extra                   JSONB,
        total_api_spend         DOUBLE PRECISION DEFAULT 0,
        api_spend_limit_reached BOOLEAN          DEFAULT false,
        variant                 VARCHAR(1),
        lead_form               TEXT             DEFAULT 'unknown',
        paused_reason           TEXT
      )
    `
  },

  // exchanges — raw per-message conversation log. Written by conversations.js
  // (_dbInsertExchange / tryClaimInbound), read on boot and used by
  // brain.js's exchange-backfill. `id` is auto-assigned (brain.js references
  // e.id::text). `extra` JSONB holds {conversationId, variant, type}.
  {
    label: 'exchanges',
    sql: `
      CREATE TABLE IF NOT EXISTS exchanges (
        id          BIGSERIAL PRIMARY KEY,
        contact_id  TEXT NOT NULL,
        role        TEXT,
        content     TEXT,
        step        INTEGER,
        ts          BIGINT,
        direction   TEXT,
        extra       JSONB,
        message_id  TEXT
      )
    `
  },
  // Partial unique index on message_id — the DB-level half of the inbound
  // dedup story (conversations.js creates this same index on boot). Multiple
  // NULL message_ids are allowed (legacy / outbound rows).
  {
    label: 'exchanges_message_id_unique (index)',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS exchanges_message_id_unique
        ON exchanges (message_id) WHERE message_id IS NOT NULL
    `
  },
  // Non-unique helper index for the per-contact lookups that conversations.js
  // and brain.js do constantly. Not created by the app, but harmless and
  // useful once the table grows.
  {
    label: 'exchanges_contact_id_idx (index)',
    sql: `CREATE INDEX IF NOT EXISTS exchanges_contact_id_idx ON exchanges (contact_id)`
  },

  // brain_messages — analytics ledger of every outbound/inbound message with
  // reply + booking attribution. Created by brain.js's initFromDb; the
  // message_class and lead_form columns are added by its ALTER migrations —
  // included here so a fresh DB has the full shape.
  {
    label: 'brain_messages',
    sql: `
      CREATE TABLE IF NOT EXISTS brain_messages (
        id                  TEXT    PRIMARY KEY,
        contact_id          TEXT    NOT NULL,
        direction           TEXT    NOT NULL,
        body                TEXT,
        stage               TEXT,
        step                INTEGER,
        message_type        TEXT,
        message_class       TEXT,
        position            INTEGER,
        had_enrichment_data BOOLEAN,
        variant             TEXT,
        lead_form           TEXT,
        length_chars        INTEGER,
        timestamp           BIGINT  NOT NULL,
        replied_within_48h  BOOLEAN,
        replied_at          BIGINT,
        booked              BOOLEAN NOT NULL DEFAULT false
      )
    `
  },
  {
    label: 'brain_messages_contact_id_idx (index)',
    sql: `CREATE INDEX IF NOT EXISTS brain_messages_contact_id_idx ON brain_messages (contact_id)`
  },

  // winning_patterns — single-row ('main') JSON blob of the latest pattern
  // analysis. Created by brain.js (_restorePatternsFromDb).
  {
    label: 'winning_patterns',
    sql: `
      CREATE TABLE IF NOT EXISTS winning_patterns (
        key        TEXT    PRIMARY KEY,
        data       TEXT    NOT NULL,
        updated_at BIGINT  NOT NULL DEFAULT 0
      )
    `
  },

  // followup_jobs — the persisted follow-up / silence-check / email job queue.
  // Written and read by followups.js. send_at / sent_at / created_at are
  // millisecond-epoch numbers; context is a JSON blob (carries `error`, hook
  // context, etc.).
  {
    label: 'followup_jobs',
    sql: `
      CREATE TABLE IF NOT EXISTS followup_jobs (
        id         TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL,
        type       TEXT,
        position   INTEGER,
        send_at    BIGINT,
        status     TEXT,
        sent_at    BIGINT,
        created_at BIGINT,
        context    JSONB
      )
    `
  },
  {
    label: 'followup_jobs_status_idx (index)',
    sql: `CREATE INDEX IF NOT EXISTS followup_jobs_status_idx ON followup_jobs (status)`
  },

  // ai_prompts — durable copy of every editable prompt (mirrors data/prompts.json).
  // Created by scripts/add-declined-marker.js; seeded/synced by prompts.js
  // (syncFromDb / syncToDb). updated_at is a millisecond-epoch number.
  {
    label: 'ai_prompts',
    sql: `
      CREATE TABLE IF NOT EXISTS ai_prompts (
        name       TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `
  },

  // optouts — opt-out / suppression list. Created by optouts.js; the variant
  // column is added by its ALTER migration.
  {
    label: 'optouts',
    sql: `
      CREATE TABLE IF NOT EXISTS optouts (
        contact_id   TEXT PRIMARY KEY,
        opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        variant      VARCHAR(1)
      )
    `
  },

  // funnel_snapshots — daily snapshot of the 4 headline funnel metrics, used
  // for week-over-week deltas on the dashboard. Created by server.js on boot.
  {
    label: 'funnel_snapshots',
    sql: `
      CREATE TABLE IF NOT EXISTS funnel_snapshots (
        id                SERIAL PRIMARY KEY,
        taken_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        total_leads       INT NOT NULL,
        replied_once_pct  NUMERIC(6,2) NOT NULL,
        replied_4plus_pct NUMERIC(6,2) NOT NULL,
        booking_rate_pct  NUMERIC(6,2) NOT NULL
      )
    `
  },

  // app_settings — tiny key/value table for state that must survive restarts:
  // the scheduler `paused` flag and the admin `issue_log` blob. Created by
  // followups.js and server.js.
  {
    label: 'app_settings',
    sql: `
      CREATE TABLE IF NOT EXISTS app_settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `
  }
];

function dbHost() {
  const m = (process.env.DATABASE_URL || '').match(/@([^/:]+)/);
  return m ? m[1] : '(unknown)';
}

async function main() {
  console.log(`[init-database] Target DB host: ${dbHost()}`);
  console.log(`[init-database] Applying ${STATEMENTS.length} schema statements...\n`);

  for (const { label, sql } of STATEMENTS) {
    try {
      await pool.query(sql);
      console.log(`  ✓ ${label}`);
    } catch (err) {
      console.error(`  ✗ ${label} — ${err.message}`);
      throw err;
    }
  }

  // Report what now exists.
  const { rows } = await pool.query(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name
  `);
  console.log(`\n[init-database] Done. Tables in public schema (${rows.length}):`);
  for (const r of rows) console.log(`  - ${r.table_name}`);
  console.log('\n[init-database] Safe to re-run anytime — every statement is IF NOT EXISTS.');
}

main()
  .then(() => pool.end())
  .catch(err => {
    console.error('\n[init-database] FAILED:', err.message);
    pool.end();
    process.exit(1);
  });
