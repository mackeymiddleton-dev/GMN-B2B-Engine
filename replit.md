# Powered Up AI — Project Notes

## What This Is

GHL-integrated AI sales assistant for audiology practices. Node/Express backend, PostgreSQL database, Claude (claude-sonnet) for AI, GHL webhooks for contact management.

Admin dashboard lives at `/admin?key=YOUR_ADMIN_KEY`.

---

## Dev Mode (Local UI Testing)

### What it does
Setting `DEV_MODE=true` in your local environment puts the server into a safe testing mode:
- **Scheduler is disabled** — no automatic follow-up jobs fire from your local instance. Production keeps running normally.
- **GHL sends are stubbed** — no real SMS or emails go out, no matter what you click. The console logs what *would* have been sent.
- **Dev banner shows** — a bright orange bar across the top of the admin dashboard confirms you're in dev mode.
- **Real production data is visible** — when `PROD_DATABASE_URL` is also set as a Replit secret, the local server connects to the LIVE production database instead of the empty workspace database. The admin UI shows actual contacts, conversations, and stats in real time.

### How to enable it locally
1. Add `DEV_MODE=true` to your `.env` file (the one in the project root, never committed).
2. Add the production database connection string as a Replit secret named `PROD_DATABASE_URL` (find it in Deployments → your live deployment → Database tab). This is workspace-only — never put it in deployment secrets.
3. Restart the workflow. You'll see two confirmation lines in the console:
   ```
   [DB] DEV_MODE — DATABASE_URL routed to PROD_DATABASE_URL (local server now uses the LIVE production database)
   ╔══════════════════════════════════════════════════╗
   ║  DEV MODE — scheduler + GHL sends are disabled   ║
   ╚══════════════════════════════════════════════════╝
   ```

### Safety guards
- The `PROD_DATABASE_URL` override is hard-gated on `DEV_MODE === 'true'`. If `PROD_DATABASE_URL` somehow ends up in deployment secrets, production logs a warning and ignores it.
- Even though you're connected to the live database, no SMS/email goes out (the GHL wrappers are stubbed) and the scheduler doesn't fire follow-ups from your local instance. **You can still write to the database, though** — clicking "enroll lead" or sending a test reply WILL change real production data. Be deliberate.
- **Never set `DEV_MODE=true` in the Replit Secrets/deployment environment.** It should only exist in your local `.env`.

### What you can safely do in dev mode
- Design and test any admin UI changes
- Add new panels, graphs, stats
- Test AI prompt changes (Claude is called, response is shown in console, but nothing sends)
- Click any admin button without risk

### Preview pane
The Replit preview pane (`/`) redirects directly to `/admin`. Add `?key=YOUR_ADMIN_KEY` to the URL and bookmark it.

---

## Architecture

- `server.js` — all API endpoints, admin dashboard HTML/JS/CSS
- `ghl.js` — GHL API wrapper (sendMessage, sendEmail, fetchContact, fetchContactsByTag)
- `conversations.js` — in-memory + DB contact state (contactMap)
- `followups.js` — job scheduler, silence checks, hook/nurture sends
- `brain.js` — stats, variant analytics, outbound/inbound recording
- `prompts.js` — DB-backed prompt storage, variant picking (A/B/C)
- `enrollment.js` — AI-powered conversation history analysis for re-enrollment
- `spend.js` — per-contact Claude API spend tracking
- `optouts.js` — opt-out keyword detection and blocklist
- `outbound-lock.js` — race-condition guard for SEND→PERSIST window (see below)

## Race-Condition Protection (outbound-lock.js)

**The bug:** Every outbound message is sent then persisted (`ghl.sendMessage` → `conversations.addExchange`). If a fast prospect replies between those two steps, the inbound webhook reads stale state and Claude regenerates the same message — duplicate sends.

**The fix:** Every outbound flow acquires a per-contactId lock around its SEND→PERSIST critical section. `handleInbound` calls `await outboundLock.waitForSettle(contactId)` at the very top before reading any state. Concurrent outbounds for the same contact chain via `Promise.all` so an inbound waits for ALL in-flight outbounds, not just the latest. Stuck locks self-clear on 60s timeout to prevent recurring delays.

**Wrapped flows** (any change must preserve these): `generateAndSendOpener`, `generateAndSendAiReply`, `sendScanVisibilityMessage`, `handleConfirmationReply`, `handleRetryName` (all in server.js); `sendHook1Static`, `sendFollowUp` (followups.js).

## Database
PostgreSQL (Neon). The deployed app uses `DATABASE_URL`. The local workspace gets its own empty Replit-provided database by default; in dev mode (with `PROD_DATABASE_URL` set) the local server is routed to the live production DB instead. Tables include: `contacts`, `brain_messages`, `winning_patterns`, `funnel_snapshots`, `followup_jobs`, `ai_prompts`, `exchanges`, `optouts`.

## Key Environment Variables
- `ADMIN_KEY` — protects all `/admin/*` routes and API endpoints
- `GHL_API_KEY` — GHL API access
- `GHL_LOCATION_ID` — GHL location identifier
- `GHL_WEBHOOK_SECRET` — (optional) validates incoming GHL webhook signatures
- `ANTHROPIC_API_KEY` — Claude API access
- `DATABASE_URL` — PostgreSQL connection string
- `DEV_MODE` — set to `true` locally only to enable safe dev mode
