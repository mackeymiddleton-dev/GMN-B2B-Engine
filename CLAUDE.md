# GMN Engine — Project Context

## What this project is
This is the internal sales engine for Gym Members Now (GMN), an agency selling marketing and AI implementation services to gym owners and fitness clinic operators. It is being forked from Sidney Kennedy's audiology lead nurture engine and extended to include Patrick Barbour's outbound prospecting workflow (CrewOS).

This is NOT a coaching project, a product, or curriculum. It is internal tooling for GMN's own B2B pipeline.

## Target architecture (the full vision)
A single web app, embedded into a GHL location via a custom menu link, with two modules sharing one database:

1. **Inbound Nurture module** (from Sidney's engine, current codebase)
   - AI conversation engine with A/B/C/D variant testing
   - Variant builder, prompt editor, performance dashboard
   - Follow-up queue, webhook reconciliation poller, spend tracker
   - Existing booking flow with hallucination guards

2. **Outbound Crew module** (modeled after Patrick's CrewOS, built greenfield)
   - CSV ingestion from Outscraper, Apollo, Clay, etc.
   - Scout agent: lead qualification and enrichment
   - Piper agent: push qualified contacts into GHL with custom fields
   - Mira agent: generate personalized websites deployed to Cloudflare Workers
   - Live activity feed and crew status dashboard

3. **Shared infrastructure**
   - Single Postgres DB (Neon)
   - Single Claude API key
   - Single GHL location and API key
   - Combined funnel reporting across both modules

## The handoff between modules
Outbound Crew tags contacts with `gmn-outbound-cold` when Piper pushes them to GHL. The GHL workflow runs Patrick's 3-day cadence (triple-shot opener with personalized website OG preview, voicemail drop, follow-up SMS, meme breakup). When a prospect replies, the Inbound Nurture module's webhook handler takes over the conversation.

## Required reading before any work
ALWAYS read `replit.md` at the start of every session. It contains 53KB of documented bugs, traps, and architectural decisions from Sidney's 460-commit build. Do not propose changes to any of the following without consulting replit.md first:
- Variant prompts (A/B/C/D/E/F/G)
- Admin dashboard template literals in server.js
- Database connection logic (PROD_DATABASE_URL trap)
- Webhook handling and reconciliation poller
- Outbound message locking
- Booking flow and paused_reason classification

## Current state — Phase 1 Day 1
The operator is brand new to Claude Code and Node.js. The codebase has been cloned, dependencies installed via npm, .env configured with:
- Anthropic API key (live, has $20 in credits)
- Neon Postgres connection
- ADMIN_KEY=gmn-local-dev-key-change-me
- DEV_MODE=true (critical safety flag — no real SMS will fire)

GHL_API_KEY and GHL_LOCATION_ID are intentionally blank for now. We are not yet connecting to a real GHL location.

## Phases, in order
**Phase 1 (Weeks 1-3): Fork and refit Sidney's engine for GMN inbound nurture.**
- Get it running locally end-to-end in DEV_MODE (current step)
- Audit and identify vestigial audiology code (DataForSEO scans, practice_detection step, audiology copy)
- Refactor the admin UI out of the server.js mega-template into separated files
- Strip and refit `industry.json` and variant prompts for GMN's B2B fitness audience
- Add GMN-specific dashboard panels: DND/opt-out tracking, close-loop attribution, cost-per-booking
- Build reschedule + no-show handling (Sidney never built this)

**Phase 2 (Weeks 4-6): Build the Outbound Crew module (CrewOS pattern).**
- Greenfield build, modeled after Patrick's architecture
- Three agents (Scout, Piper, Mira) with a job queue
- Cloudflare Workers deployment for personalized websites with OG preview tags
- Integrate into the same web app as a second sidebar tab

**Phase 3 (Week 7): Merge and wire the handoff.**
- Add Outbound Crew as a second tab in the embedded GHL custom menu link
- Wire tag-based handoff to Inbound Nurture
- Single combined dashboard

**Phase 4 (ongoing): Run real campaigns and tune.**

## Known issues visible in the current codebase
- The admin UI has an active bug: "Failed to load stats: escHtml is not defined" on the prompt editor (likely a Trap #2 quote-nesting issue in server.js admin template)
- Variant B is currently disabled despite having the highest P(Best) score (56% confidence as best variant). Re-enable after installing GMN copy.
- The `m.type === 1/2` bug pattern documented in Trap #10 was fixed but the underlying admin template architecture that makes these bugs likely keeps recurring. Major refactor candidate.

## Coding rules specific to this codebase (from replit.md)
- NEVER use contractions ("hasn't", "won't", "I'll") in single-quoted strings inside the admin template literal in server.js. Rephrase to full forms.
- NEVER use backtick template literals inside admin <script> JS helper functions. Use string concatenation only.
- NEVER use `\n` or `\t` inside JS string literals in the admin template — double-escape as `\\n`, `\\t`.
- NEVER use `m.type === 1` or `m.type === 2` as direction detection in GHL message parsing. Use `m.direction` (string) or `m.messageType` (string).
- ALWAYS use `process.env.PROD_DATABASE_URL` in one-off shell scripts, never `DATABASE_URL`. (Note: in our local setup we are using DATABASE_URL pointing to Neon. The PROD_DATABASE_URL trap is for Sidney's Replit-specific deployment context. For us, DATABASE_URL is the production DB.)
- ALWAYS wrap new admin fetch calls in `fetchWithTimeout`.
- ALWAYS strip TCPA opt-out suffix from GHL outbound history, never drop the message.

## What I (the operator) bring to this project
- Deep B2B copywriting and sales messaging experience for the gym/fitness niche
- GoHighLevel workflow and A2P registration knowledge
- Real campaign data from prior GMN runs
- A coaching relationship with Sidney and Patrick (the original builders) — I can ask them direct questions when something needs context

## What I do NOT bring
- Strong JavaScript/Node.js fluency. Explain code changes in plain English when proposing them.
- Knowledge of Sidney's reasoning behind specific prompt choices or Patrick's reasoning behind CrewOS design decisions. When in doubt, preserve their structure and ask before refactoring core logic.

## Tone
Be direct. If I propose something that contradicts replit.md, push back and cite the specific trap. If I'm about to spend money or time on something the codebase already handles, say so. When working through a problem, walk me through the reasoning so I learn — but don't be condescending about it.