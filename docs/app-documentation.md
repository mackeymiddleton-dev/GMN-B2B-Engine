# Powered Up AI — Complete Application Documentation

## What This App Does (In One Paragraph)

Powered Up AI is a sales outreach system targeting audiology practice owners. When a new lead enters a connected CRM (GoHighLevel / GHL), the system automatically sends them scripted SMS messages and emails designed to start a conversation, demonstrate insider knowledge of their business using real Google Maps data, and book a 10-minute Zoom discovery call. Behind the scenes, an AI (Anthropic Claude) handles all the two-way SMS conversation logic. A "learning brain" watches which messages get replied to and which don't, then distills those insights back into future conversations. Admins manage the system through a web dashboard and prompt editor.

---

## Architecture Overview

The app is a single **Node.js/Express server** (`server.js`) that handles:
- Incoming SMS webhooks from GHL
- Outbound SMS and email via GHL
- Google Places research and local visibility scanning
- Conversation state tracking (saved to JSON files on disk)
- Scheduled follow-up jobs (SMS silence checks + email sequences)
- Admin web UI at `/admin`, `/admin/prompts`, `/admin/enroll`

There is no database — all persistent data lives in JSON files in the `data/` folder. There are no React components or build steps; the admin UI is server-rendered HTML strings returned directly from Express routes.

---

## Data Files (The Persistent Layer)

All data is stored as JSON files on disk. Every read or write goes through a load-from-disk/save-to-disk cycle — there is no in-memory cache shared between requests.

| File | Purpose |
|---|---|
| `data/conversations.json` | One record per contact. Stores name, city, phone, email, practice name, street, current conversation step, booked status, research data, scan results, and the full message history (exchanges). |
| `data/followups.json` | Queue of follow-up jobs — both SMS silence-check jobs and email jobs. Each job has a type, status, scheduled send time, contact ID, and position in the sequence. |
| `data/messages.json` | Brain statistics — per-contact outbound/inbound message records, including which step they were sent at and whether the contact replied. |
| `data/winning-patterns.json` | Output of the brain's Claude analysis — descriptions of what message patterns drive replies, stored by conversation stage. Injected into future Claude prompts. |
| `data/prompts.json` | Admin-overridden versions of any prompt. When a prompt is saved through the admin UI it goes here; the app reads this first, falls back to hardcoded defaults. |

---

## Module Breakdown

### `config.js` — Hardcoded Defaults
Holds all the default prompt text and search configuration values:

- **`conversationPrompt`** — The master SMS conversation script (9 steps, detailed below). This is the system prompt given to Claude for every inbound SMS response.
- **`systemPrompt`** — A separate system prompt used only for the GMB (Google My Business) message generator tool — generates one-off cold outreach messages for standalone use.
- **`hookMessages`** — Array of 4 SMS follow-up templates used when a prospect goes silent after the initial message. Written to re-engage with urgency.
- **`nurtureMessages`** — Array of longer SMS templates for bi-weekly nurture after the hook phase ends.
- **`competitorKeyword`** — The Google Places search term used to find nearby competitors (`"audiologist hearing aid"`).
- **`competitorRadius`** — Search radius in meters for competitor lookup (~5 miles = 8000m).
- **`scanKeyword`** — The keyword used for the visibility grid scan (`"audiologist near me"`).
- **`scanRadius`** — Radius in miles for the scan grid (5 miles).
- **`gridSize`** — Number of rows/columns in the scan grid (5×5 = 25 points).

### `prompts.js` — Runtime Prompt Registry
Acts as a layer on top of `config.js`. Provides `get(name)`, `set(name, text)`, `reset(name)`, `listAll()`, and `seed()` functions. On startup, `seed()` writes all default prompts from `config.js` into `data/prompts.json` if they don't already exist. When an admin edits a prompt, the override is saved to `data/prompts.json`. The `get()` function always returns the custom version if one exists, otherwise the default from `config.js`.

The registered prompts are:
- `conversationPrompt` — main SMS conversation script (SMS channel)
- `systemPrompt` — GMB message generator prompt
- `hookMessage1` through `hookMessage4` — SMS silence-check follow-ups
- `nurtureMessage1` onward — bi-weekly SMS nurtures
- `email.system` — system prompt for email generation (returns JSON `{subject, body}`)
- `email.hook` — user prompt template for hook-phase emails (positions 1–4)
- `email.nurture` — user prompt template for nurture-phase emails (positions 5–11)
- `email.monthly` — user prompt template for monthly emails (position 12+)

### `conversations.js` — Contact Record CRUD
Simple file-based key/value store keyed by GHL contact ID. Functions:
- `ensureContact(id, defaults)` — Creates a record if one doesn't exist.
- `get(id)` — Returns one contact record.
- `update(id, updates)` — Merges updates into an existing record.
- `getAll()` — Returns all records (used by admin dashboard).
- `addExchange(id, exchange)` — Appends a message to the `exchanges` array and updates `lastMessageAt`.

A contact record contains: `contactId`, `firstName`, `city`, `phone`, `email`, `tags`, `practiceName`, `practiceStreet`, `practiceCity`, `researchData` (nested object), `scanResults` (nested object), `booked` (boolean), `currentStep` (integer 0–9), `lastMessageAt`, `createdAt`, `exchanges` (array), `confirmationPending` (object or null), `awaitingRetryName` (boolean).

### `sessions.js` — In-Memory Scan/Research Sessions
Simple in-memory Map. Used only for the standalone GMB message generator tool (the web UI at `/`). Has `get`, `set`, and `update` functions. Sessions are not persisted — they survive only as long as the server process is running.

### `ghl.js` — GoHighLevel CRM API
All GHL API calls go through this module. Base URL: `https://services.leadconnectorhq.com`. Uses `GHL_API_KEY` and `GHL_LOCATION_ID` environment variables.

Functions:
- **`sendMessage(contactId, message)`** — Sends an outbound SMS via `POST /conversations/messages`. Creates or retrieves the GHL conversation first.
- **`sendEmail(contactId, subject, body)`** — Looks up the contact's email from GHL first (`GET /contacts/{id}`), then sends via `POST /conversations/messages` with `type: "Email"`.
- **`fetchContact(contactId)`** — Fetches full contact details from GHL including name, city, phone, email, and tags.
- **`fetchContactsByTag(tag)`** — Fetches up to 100 contacts with a given GHL tag. Used by the enrollment runner.
- **`fetchMessages(conversationId)`** — Fetches message history for a conversation (newest first). Used to build context for Claude and for state recovery on server restart.
- **`getOrCreateConversation(contactId)`** — Returns an existing conversation ID or creates a new one.
- **`fetchEmail(contactId)`** — Helper to look up a contact's email address before sending.

### `research.js` — Google Places Enrichment
Runs in the background after a prospect's practice name and city are known. Uses the Google Maps Places API.

The `runResearch(session, practiceName, practiceStreet, city, confirmedPlaceId)` function:
1. Either uses a pre-confirmed Google Places ID (if the prospect verified their listing) or does a text search using `practiceName + practiceStreet + city`.
2. Fetches full place details: rating, review count, photo count, website, opening hours, lat/lng.
3. Calculates a **profile score**: "strong" (≥30 photos), "okay" (≥10), or "weak" (<10).
4. Searches for nearby competitors using the configured keyword and radius.
5. Ranks the prospect by review count against competitors.
6. Gets the 65+ population for the city (from a hardcoded table of ~80 metros, or the US Census ACS5 API as a fallback). Multiplies by 0.33 to estimate the number with hearing loss.
7. Extracts the 2 most recent Google reviews.
8. Finds up to 3 nearby referral sources: ENTs, audiologist referrals, and health insurance offices within 2km.
9. Stores everything in the session and conversation record.

Additional functions:
- **`fetchCompetitorVelocity(researchData, apiKey)`** — Re-checks competitor review counts and returns a string like "Clear Hearing Center gained 12 new reviews since we last checked." Updates baselines after each check.
- **`refreshRecentReviews(placeId, apiKey)`** — Re-fetches the prospect's own most recent Google reviews.
- **`findReferralSources(lat, lng, apiKey)`** — Finds nearby ENTs, audiologists, and health insurance offices.

If no Google Places API key is configured, the module returns hardcoded mock data so the app can be tested without credentials.

### `scanner.js` — Google Maps Visibility Grid
Runs a 5×5 grid of Google Places Nearby Search calls to show where a practice appears (and where it doesn't) across its local area.

The `startScan(session, practiceName, city, keyword)` function:
1. Waits up to 30 seconds for research to complete and provide a lat/lng coordinate.
2. Generates a 5×5 grid of 25 coordinate points spread evenly across a 5-mile radius.
3. Fires all 25 searches in parallel via `Promise.all`.
4. For each grid point, determines the practice's rank in results (or null if not found in top 20).
5. Computes stats: how many points show the practice in top 3, top 10, invisible; which competitor appears most often; average rank where visible.
6. Returns a `scanUrl` link to a visual map at `/scan/{sessionId}`.

Results are stored in the session and in the conversation record so Claude can reference them in the conversation.

### `brain.js` — Learning Brain
Tracks message performance and periodically runs an LLM analysis to identify what's working.

**Recording functions:**
- `recordOutbound(contactId, body, step)` — Stores the message text and step.
- `recordInbound(contactId, body, step)` — Stores an inbound message.
- `recordReply(contactId)` — Marks the most recent outbound for this contact as "replied."
- `recordBooking(contactId)` — Increments booking count.

**Analysis (runs every 72 hours):**
- `runAnalysis()` — Groups all outbound messages by `patternKey` (first 60 characters, lowercased). For each group, calculates sent count, reply count, reply rate, and whether any bookings came from that cluster.
- `runLlmAnalysis(patterns)` — Sends the clusters to Claude Opus with a prompt asking it to identify the 3–5 best-performing patterns and explain why. The analysis is saved to `data/winning-patterns.json`.
- `buildWinningPatternsPrompt(stage)` — Returns a short text block with the winning patterns for the given conversation stage, which gets appended to Claude's system prompt for every inbound message.
- `classifyStage(step)` — Maps the current conversation step (0–9) to a stage name: "opening" (steps 0–2), "discovery" (3–4), "pitch" (5–7), "close" (8–9).

**Stats:**
- `getStats()` — Returns total outbound/inbound/booked/contacts counts, plus per-stage breakdowns of sent/replied/booked.

### `enrollment.js` — Bulk Lead Enrollment
Fetches all GHL contacts with a given tag (default: `"amplify"`) and sends the first SMS message to each one — effectively kicking off the conversation sequence for a batch of leads.

- Supports **dry-run mode** (default: enabled) to preview what would be sent without actually sending.
- Uses a 1.5-second delay between sends to avoid rate limits.
- Skips contacts who are already booked or already have a silence-check job pending.

### `followups.js` — Follow-Up Scheduler
The most complex module. Manages a persistent job queue in `data/followups.json` and runs on a 60-second polling interval.

**Job types:**
- `silence-check` — An SMS follow-up. Fires 5 minutes after an outbound message if no reply has come in.
- `email-hook` — Email at positions 1–4 in the email sequence (hook phase). Uses `email.hook` prompt.
- `email-nurture` — Email at positions 5–11 (nurture phase). Uses `email.nurture` prompt.
- `email-monthly` — Email at positions 12+ (monthly). Uses `email.monthly` prompt.

**SMS send windows (prospect's local time):**
- 7:00am – 8:00am
- 4:00pm – 8:00pm

**Email send windows (prospect's local time):**
- 8:30am – 9:00am
- 12:00pm – 1:00pm

**Timezone estimation** — Uses keyword matching on the city name to assign Pacific, Mountain, Central, or Eastern time. Defaults to Eastern.

**SMS follow-up cadence:**
- Position 1: 5 minutes after initial send (the "silence check")
- Position 2: 2 days later
- Position 3: 2 days after that
- Position 4: 3 days after that
- Positions 5+: Every 3–4 days for 8 weeks (bi-weekly nurtures)
- Position 22+: Every 30 days (monthly nurtures)
- A reply from the prospect cancels all pending SMS jobs (and defers emails by 4 hours)

**Email follow-up cadence:**
- Email 1: At the next email window at least 5 minutes after enrollment
- Email 2–4: Every 2 days (hook phase)
- Email 5–7: Every 3–4 days (nurture phase)
- Email 8+: Every 30 days (monthly phase)
- Emails are deferred 4 hours when a conversation is active (inbound SMS detected)
- Emails stop permanently when: `booked=true` OR the contact has "Disable AI" tag

**Email generation** — Each email is generated by calling Claude with an email-specific system prompt and a user prompt that includes: practice name, city, their Google rating, review count, competitor summary, and recent Google reviews (re-fetched fresh from Places API). Claude returns JSON `{subject, body}` which is parsed and sent via GHL's email API.

**Competitor velocity** is re-checked each time an email is generated (during nurture phase). If a competitor gained reviews, that fact is injected into the email prompt for personalization.

**Stop conditions:**
- `shouldStopEmail(contact)` — Returns true if `booked=true` or contact has "Disable AI" tag.
- `shouldDeferEmail(contact)` — Returns true if the contact messaged in the last 4 hours.

---

## The Conversation System (9-Step SMS Script)

The entire SMS conversation flow is governed by a single long system prompt given to Claude. Claude plays the role of a conversational SDR named "Emma" working for Powered Up AI. The script has 9 steps, and Claude is instructed to embed a hidden `[STEP:N]` marker in every reply so the server can track progress.

**Step 0 — Cold open:** Initial outreach message introducing the concept of "uncaptured revenue" for audiology practices. Asks the prospect their first name (already known from GHL but used to establish rapport).

**Step 1 — Warm up:** Acknowledges their name, builds curiosity about the revenue angle. Asks for the practice name and street address.

**Step 2 — Practice collection:** Processes the practice name + street. Claude embeds a hidden marker: `[PRACTICE_DETECTED:PracticeName|StreetAddress|City]`. The server intercepts this, runs a Google Places lookup to confirm the listing, and asks the prospect to verify: "Found [Name] at [Address] — is that the right one?"

**Step 3 — Bridge:** After research completes, tells the prospect that while they were talking the AI was researching their market. Sets up the reveal in Step 4.

**Step 4 — Data reveal:** Delivers the research findings. Includes: their Google star rating, number of reviews, how they rank against nearby competitors (e.g., "ranked 4th out of 7 practices"), and how many people over 65 live in their area (with the 33% hearing loss estimate). This step is designed to feel like insider knowledge.

**Step 5 — Qualify:** Asks how many new patients they see per month and whether they're doing any active marketing.

**Step 6 — Problem agitation:** Uses their answer to point out the gap — e.g., if they're seeing 10/month but competitors are outranking them on Google.

**Step 7 — The hook:** Ties together the problem (invisible on Google, dormant patient list, expiring insurance benefits, competitors gaining reviews) with the solution concept. Builds urgency.

**Step 8 — Founder pitch:** Introduces Sid (the real founder) as an expert, mentions a specific number of audiology practices worked with, and offers a 10-minute Zoom call to show the full analysis live.

**Step 9 — Booking:** When the prospect agrees to book, Claude sends the Calendly link and confirms the call. Claude also embeds the hidden `[BOOKED]` marker, which the server intercepts to mark the contact as booked and stop all follow-ups.

**Special hidden markers Claude uses:**
- `[STEP:N]` — always present; tells the server what step was just reached
- `[PRACTICE_DETECTED:name|street|city]` — triggers Google Places lookup + address confirmation
- `[BOOKED]` — triggers booking state and stops all follow-up jobs

**Context injected into Claude's system prompt at runtime:**
- Prospect's first name and city
- Current conversation step
- Live research data (rating, reviews, competitor summary, rank)
- Scan results (visibility stats)
- Winning patterns from the learning brain (if any exist for this stage)

---

## The Address Confirmation Flow

When Claude detects a practice name in the conversation, a multi-step verification sequence runs before research begins:

1. Server does a Google Places text search for `practiceName + street + city`.
2. If a result is found, server sends: "Found [Name] at [Address] — is that the right one?"
3. **If prospect says yes** → research and scan start immediately; Step 3 auto-sends when research completes.
4. **If prospect says no** → server asks: "What's the exact name as it appears on Google Maps, and what street is it on?" The contact is marked `awaitingRetryName=true`.
5. **On retry input** → server searches again with the corrected name. If found, sends another confirmation. If not found, skips confirmation and starts research anyway.
6. **Ambiguous reply** → server re-prompts: "Just want to make sure — is that your practice listing? Reply yes or no."

While awaiting confirmation, all inbound messages are handled by the confirmation logic (not Claude), so no tokens are wasted and the conversation doesn't advance prematurely.

---

## The Step 3 Auto-Send

Once research is complete, the system needs to send Step 3 (the bridge message) automatically — the prospect doesn't need to say anything else; the AI just delivers the data reveal unprompted.

The `scheduleStep3AutoSend` function sets a timer that waits for research to finish (polling every 2 seconds, up to 90 seconds). When research is complete, it calls Claude with the full conversation history + research data appended, gets a Step 3 reply, and sends it. The auto-send is cancelled immediately if the prospect sends another SMS before it fires.

---

## State Recovery on Server Restart

On startup, the server reads all active (non-booked, last 30 days) contacts and fetches their GHL conversation histories. It then runs `recoverStateFromHistory`, which scans the most recent outbound message for known text patterns to restore:
- **`awaitingRetryName`** — if the last message asked for the exact name as on Google Maps
- **`confirmationPending`** — if the last message contained "is that the right one? / reply yes or no"
- **`currentStep`** — detected from known scripted phrases at each step

This means the app can survive a server restart mid-conversation without losing track of where the dialogue was.

---

## Inbound SMS Webhook Flow (Step by Step)

1. GHL POSTs to `/webhooks/ghl` with: `contactId`, `conversationId`, `body`, `firstName`, `city`, `phone`.
2. Auth check: if `GHL_WEBHOOK_SECRET` is set, validate it; otherwise allow any request (open mode).
3. The request is added to a per-contact job queue (`enqueueJob`) so simultaneous messages don't create race conditions.
4. The job processor calls `handleInbound`:
   a. Fetches the contact from GHL to get fresh name, city, tags.
   b. Checks for "Disable AI" tag — stops immediately if present.
   c. Creates or updates the local contact record.
   d. Records the inbound message in the brain and cancels all pending follow-up jobs.
   e. Checks if `booked=true` — stops if so.
   f. **If `confirmationPending`** → routes to confirmation handler (not Claude).
   g. **If `awaitingRetryName`** → routes to retry handler (not Claude).
   h. Builds full message history from GHL (preferred) or local exchanges.
   i. Builds the system prompt: base conversation script + name/city/step injection + winning patterns + research data + scan results.
   j. Calls Claude Opus with the messages and system prompt (max 512 tokens).
   k. Strips hidden markers from Claude's reply.
   l. If `[PRACTICE_DETECTED]` found: does Google Places lookup, queues address confirmation message.
   m. If `[BOOKED]` found: marks contact as booked, records booking in brain.
   n. Sends the reply via GHL SMS.
   o. Schedules a new silence-check follow-up.
   p. Sends the address confirmation message if one was queued.

---

## Enrollment Webhook (`/webhooks/ghl/enrolled`)

This endpoint is called by a GHL workflow the moment the static intro SMS is sent to a new lead. It does not wait for a reply — it sets up the lead immediately:

1. Auth: requires `GHL_WEBHOOK_SECRET` OR `ADMIN_KEY` (always fail-closed — no open mode).
2. Extracts contact ID, name, city, phone, email, tags from the payload.
3. Checks for "Disable AI" tag, already-booked status, and existing silence-check jobs.
4. Creates local contact record with email and tags stored.
5. Schedules a 5-minute silence-check SMS job.
6. If the contact has an email address: schedules Email #1 at the next email window (at least 5 minutes out).

---

## Contact-Updated Webhook (`/webhooks/ghl/contact-updated`)

This endpoint fires whenever a GHL contact record is updated — most importantly when a tag is added or removed. It uses the same fail-closed auth as the enrollment webhook.

On receipt:
1. Extracts the contact ID from the payload.
2. If the payload includes a `tags` array, updates the local contact record with the new tags.
3. If the "Disable AI" tag is present, immediately calls both `cancelContactJobs` (SMS jobs) and `cancelEmailJobs` (email jobs) to halt all pending AI outreach for that contact.

This ensures that tagging someone "Disable AI" in GHL stops all outreach right away — even for jobs already queued — without waiting for the next job to fire and hit the at-send-time guard.

---

## Admin Web UI

All admin pages require `?key=YOUR_ADMIN_KEY` in the URL or an `x-admin-key` header.

### `/admin` — Dashboard
Auto-refreshes every 30 seconds. Displays three panels:
- **Brain Stats** — total messages sent, replies received, overall reply rate, contacts tracked, bookings, booking rate, and a per-stage breakdown table.
- **Contacts** — sortable table of all contacts: name, practice, current step, booked/active status, message count, last activity time.
- **Follow-Up Queue** — last 200 jobs, showing type, position, status (pending/sent/cancelled/skipped), and scheduled time. Links to Prompt Editor and Lead Enrollment.

### `/admin/prompts` — Prompt Editor
Lists every registered prompt with:
- **Channel badge** (SMS or Email)
- **Editable textarea** (pre-filled with current value)
- **Save button** — POSTs to `/admin/prompts/:name`
- **Reset to Default button** — POSTs to `/admin/prompts/:name/reset`

Prompts listed: `conversationPrompt`, `systemPrompt`, `hookMessage1`–`hookMessage4`, `nurtureMessage1`+, `email.system`, `email.hook`, `email.nurture`, `email.monthly`.

### `/admin/enroll` — Lead Enrollment UI
A form that lets admins run the bulk enrollment process:
- Input field for the GHL tag to target (default: "amplify")
- **Dry Run** checkbox (default: checked) — previews without sending
- On submit: calls `/api/enroll/run` which fetches contacts by tag and sends or previews the initial SMS

---

## The Standalone GMB Message Generator

The root route `/` serves a separate single-page tool (not used in the SMS bot flow). This was the app's original purpose. It lets users:
1. Enter a practice name and city
2. Optionally search for and confirm the exact Google listing (via `/api/places/search`)
3. Click "Generate" which calls `/api/generate`:
   - Runs research + scan in parallel (up to 90 second wait)
   - Calls Claude with the `systemPrompt` (GMB prompt, not the conversation prompt)
   - Returns a personalized cold outreach message
   - Returns a link to the visibility scan map at `/scan/{sessionId}`

The scan map (`/scan/:sessionId`) is a full-page Leaflet.js map showing 25 colored dots (green = top 3, yellow = 4–10, red = invisible) with click popups showing which businesses ranked at each point.

---

## All External API Calls

| Service | Endpoint | Purpose |
|---|---|---|
| **Anthropic Claude** | `POST /messages` (model: `claude-opus-4-5`) | Generates all SMS replies, email content, and brain analysis |
| **GHL / LeadConnector** | `GET /contacts/{id}` | Fetches contact details (name, tags, email) |
| **GHL / LeadConnector** | `POST /contacts/search` (by tag) | Enrollment: find leads with a given tag |
| **GHL / LeadConnector** | `GET /conversations/search` | Find existing conversation for a contact |
| **GHL / LeadConnector** | `POST /conversations` | Create new GHL conversation |
| **GHL / LeadConnector** | `GET /conversations/{id}/messages` | Fetch message history |
| **GHL / LeadConnector** | `POST /conversations/messages` | Send SMS or Email |
| **Google Places** | `textsearch` | Find practice listing by name+street+city |
| **Google Places** | `nearbysearch` | Scan grid: find practices at each grid point |
| **Google Places** | `details` | Get rating, reviews, photos, hours, address |
| **US Census ACS5** (2022) | `api.census.gov/data/2022/acs/acs5` | 65+ population by county (fallback if city not in lookup table) |

---

## Environment Variables / Secrets

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API authentication |
| `GHL_API_KEY` | Yes | GoHighLevel API authentication |
| `GHL_LOCATION_ID` | Yes | GHL sub-account location identifier |
| `ADMIN_KEY` | Yes | Protects all `/admin` routes and APIs |
| `GHL_WEBHOOK_SECRET` | Recommended | Authenticates enrolled-webhook calls from GHL |
| `GOOGLE_PLACES_KEY` | Recommended | Enables real research + scan (mock data used if absent) |
| `ANTHROPIC_MODEL` | Optional | Override Claude model (default: `claude-opus-4-5`) |
| `APP_URL` | Optional | Public URL used in scan links returned to GHL |
| `PORT` | Optional | HTTP port (default: 5000) |

---

## Startup Sequence

When the server starts:
1. Express server starts on port 5000.
2. `prompts.seed()` — writes default prompts to `data/prompts.json` if they don't already exist.
3. `brain.startScheduledAnalysis()` — kicks off a 72-hour timer to run the learning brain analysis.
4. `followups.startScheduler()` — kicks off a 60-second polling loop to process due follow-up jobs.
5. `bootstrapStateFromGHL()` — runs in the background; fetches GHL message history for all active contacts and patches any missing conversation state.

---

## Key Design Decisions Worth Noting

- **Fail-safe on missing API keys**: The app runs in mock-data mode for research and scanning if `GOOGLE_PLACES_KEY` is absent. Claude calls will still fail without `ANTHROPIC_API_KEY`.
- **No database**: Everything is flat JSON. This works fine at low volume but creates read/write contention under load.
- **Per-contact job queue**: A `Map` of `Promise` chains prevents two simultaneous inbound messages from the same contact causing a race condition in Claude calls.
- **GHL is the source of truth for message history**: The app prefers to build Claude's conversation context from GHL's message history rather than its own local exchange records — this means messages sent from other GHL sources (staff, automations) are included in context.
- **System messages stripped**: GHL injects automated CRM messages (opportunity created, reply STOP to unsubscribe, etc.) which are filtered out before being sent to Claude.
- **Claude must start with a user turn**: The message-building logic enforces Claude's API requirement that the array starts with a `user` role message and ends with a `user` role message.
- **Timezone is estimated, not precise**: The city-to-timezone mapping is keyword-based and defaults to Eastern. No IP geolocation or ZIP code database is used.
- **Emails stop if booked; SMSs cancel on reply**: These are separate stop conditions. An inbound SMS cancels SMS follow-up jobs but only defers (not cancels) email jobs by 4 hours.
- **Disable AI tag cancels everything immediately**: When a contact is tagged "Disable AI" in GHL, the contact-updated webhook fires both SMS and email job cancellation in real time — not just at the next scheduled send.
