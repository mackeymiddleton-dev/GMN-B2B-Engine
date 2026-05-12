# GMN Engine — Phase 1 Work Plan

**Status:** Day 1 complete (environment, DB, server booting clean). Day 2 complete (audit produced, 9 decisions made). This plan covers Day 3 through end of Phase 1.

**Supersedes:** AUDIT.md §7 (refit order) and the open questions at the end of AUDIT.md, which have now been answered.

**Source decisions (Q1–Q9):**
- **Q1** Variant E → kill entirely (no rebuild; Q9 makes branching unnecessary)
- **Q2** Variant count → 2 variants for A/B testing
- **Q3** Local SEO scan → keep + repurpose for gyms
- **Q4** `findReferralSources()` → kill (GMN's referral pitch is internal, not geographic)
- **Q5** GMB One-Shot Generator → repurpose for GMN message drafting
- **Q6** No-show handling → defer to Phase 1.5
- **Q7** Brand naming → "GMN" + persona name TBD (placeholder OK)
- **Q8** Dead artifacts → archive (`git mv` to `archived/`), don't delete
- **Q9** Variant authoring → structured builder only, Claude handles branching in-context

---

## How to use this plan

Each step has: a **goal**, **files touched**, **trap exposure**, **commit message template**, and a **how to verify** check. Work one step at a time. Commit after each step succeeds. Do not start a step until the prior step's verification passes.

When in doubt during a step, re-read AUDIT.md §6 (trap cross-reference) for the file you're touching.

Always run inside the project virtualenv that's been working for you: `npm run dev` in one terminal tab, Claude Code in another. Server auto-restarts on save via `node --watch`.

---

## Step 1 — Pre-flight cleanup (½ day)

**Goal:** Boot fully clean, fix the two known small bugs the audit caught, and archive dead artifacts so the working tree stops being noisy. No new functionality.

**Substeps:**

1.1. **Fix `data/prompts.json`.** Change `{"structuredVariants": "{}"}` to `{"structuredVariants": []}`. The value should be an array, not a string. Currently harmless (guarded by `Array.isArray`), but cleaner to fix now.

1.2. **Fix the `enrollment.js:58` TCPA bug.** `isRealMessage` currently drops any message matching `/reply STOP to unsubscribe/i`. Per CLAUDE.md trap #10 and the coding rules: strip the suffix, keep the body. Pattern is already in place in `server.js buildMessagesFromGhl` — copy that pattern to `enrollment.js`.

1.3. **Archive dead artifacts.** Create `archived/` at project root. `git mv` everything in this list:
   - `attached_assets/` (75 files)
   - `zipFile.zip` (5.4 MB)
   - `rp_B.txt`, `rp_C.txt`, `rp_D.txt`, `rt_C.txt`, `rt_D.txt`, `stress_*.txt`
   - `scripts/fix-variant-b-steps.js`, `scripts/fix-variant-c-steps.js`, `scripts/fix-variant-b-opening-rule.js`, `scripts/move-hearing-aid-q-into-prompts.js`, `scripts/apply-prompt-hardening.js`, `scripts/add-declined-marker.js`, `scripts/sim-roleplay.js`, `scripts/test-off-script-handlers.js`, `scripts/enroll-existing-leads.js`
   - Keep `scripts/init-database.js` and `scripts/prompts-sync-file-to-db.js` (both still useful)

**Files touched:** `data/prompts.json`, `enrollment.js`, project root (file moves).

**Trap exposure:**
- Trap #10 (`enrollment.js` fix) — preserve the existing `m.direction`/`m.messageType` direction logic; *only* change the TCPA-suffix handling.

**Commit:** `git commit -m "Phase 1 Step 1: pre-flight cleanup (structuredVariants fix, TCPA suffix in enrollment.js, archive dead artifacts)"`

**How to verify:**
- `npm run dev` still boots cleanly with the DEV MODE banner
- `git status` is clean
- `ls archived/` shows the moved files
- `grep -n "reply STOP" enrollment.js` shows the strip-not-drop pattern, not the regex drop

---

## Step 2 — `data/industry.json` → GMN/fitness config (½ day, mostly your writing)

**Goal:** Replace the leftover dental test data with real GMN/fitness configuration. Re-grounds every AI prompt instantly via `industry.interpolate`.

**Substeps:**

2.1. Open `data/industry.json` in your editor. Currently:
```json
{
  "industryName": "dental",
  "audienceDescriptor": "dental practices",
  "customerNoun": "patient",
  "brandName": "TestCo",
  "brandPersona": "Sam",
  "productDescription": "We text dormant patients on autopilot.",
  ...
}
```

2.2. Replace every field with real GMN/fitness values. Suggested shape (your actual copy goes here — these are placeholders showing the right *kind* of value):
```json
{
  "industryName": "fitness",
  "audienceDescriptor": "gym owners and fitness-clinic operators",
  "businessNoun": "gym",
  "customerNoun": "member",
  "brandName": "GMN",
  "brandPersona": "Quinn",       // ← placeholder; Q7 — pick your real persona name
  "productDescription": "We help gym owners grow their member base with AI-powered SMS nurture and member referral systems.",
  "painPoints": "- cold leads sitting in your CRM going nowhere\n- happy members not referring their friends\n- front desk drowning in admin instead of selling\n- losing prospects to gyms ranking above you on Google",
  "valueProps": "- 24/7 AI SMS that nurtures every lead until they book\n- member referral systems that turn fans into a growth engine\n- automated front-desk that frees you to coach and grow\n- local search optimization so 'gym near me' finds you first",
  "vslUrl": "https://your-real-gmn-vsl-url.com"
}
```

2.3. Save. Server auto-restarts. **Do not** restart manually — `node --watch` picks it up.

**Files touched:** `data/industry.json` only.

**Trap exposure:**
- AUDIT.md §6 caution: this is the "typo propagates everywhere" file. A misspelling here lands in every AI prompt. Read carefully before saving.

**Commit:** `git commit -m "Phase 1 Step 2: industry.json → GMN/fitness config"`

**How to verify:**
- Server boots clean
- Open `/admin?key=gmn-local-dev-key-change-me` → Industry Setup page → fields show GMN values, not dental
- Open the Playground tab → AI responses (against test input) reference "gym" / "member" / GMN brand, not "patient" / "practice" / TestCo

---

## Step 3 — Strip Variant E entirely (1 day)

**Goal:** Remove the audiology Variant E from all 5 files. This is the single biggest block of live audiology copy in the codebase. Per Q1 + Q9, no replacement infrastructure is needed.

**Substeps (do in this order):**

3.1. **`prompts.js`** — delete:
- `conversationPrompt.E.shared` (lines ~156-208)
- `conversationPrompt.E.opening` (lines ~210-244)
- `conversationPrompt.E.branchA/B/C/D` (lines ~246-417)
- `conversationPrompt.E.enabled` (line 151)
- All `conversationPrompt.E.*` entries in `PROMPT_META` (lines ~62-103)

3.2. **`server.js`** — delete:
- `buildVariantESystemPrompt` function (search for the name)
- `_variantEBranchForStep` function
- Any call sites (search `variantE` in server.js — should be 4-6 references)

3.3. **`followups.js`** — delete:
- The "Variant E Data Payload" job (around line ~1180 per AUDIT)

3.4. **`brain.js`** — change:
- `[...config.SCRIPTED_VARIANTS, 'E']` → `config.SCRIPTED_VARIANTS` (lines 714 and 969)

3.5. **`conversations.js`** — delete:
- The `variantEBranch` field handling (lines 111-114)

3.6. Run `npm run prompts:push` to sync the file-side deletions into the DB. Watch the boot log line: should say "pushed N prompt(s) FILE → DB".

**Files touched:** `prompts.js`, `server.js`, `followups.js`, `brain.js`, `conversations.js`.

**Trap exposure:**
- **Trap #6** — after editing `prompts.js`, must run `npm run prompts:push` or the DB rows for the deleted prompts will keep getting served from cache. *Critical.*
- **Trap #2** (`server.js` editing) — you're deleting functions, not editing template strings, so the contraction/quote-nesting risk is low. But after the edits, run the parse-check from CLAUDE.md if you touched anything inside a `buildXPage()` function.
- **Trap #7** — does not apply here because you're deleting Variant E entirely, not renumbering its steps.

**Commit:** `git commit -m "Phase 1 Step 3: strip Variant E from all 5 files"`

**How to verify:**
- `grep -rn "variantE\|conversationPrompt.E\|VariantE" --include="*.js"` returns nothing (or only comments)
- Server boots clean
- `/admin` dashboard loads with no `escHtml`/template errors related to Variant E references
- Prompt editor at `/admin` no longer shows Variant E entries

---

## Step 4 — Strip remaining audiology strings + kill `findReferralSources` + kill hearing-loss math (1 day)

**Goal:** Mechanical search-and-replace pass for all the audiology strings the audit catalogued in §1, except the Variant E content (already gone in step 3). Plus kill the two pieces the answers explicitly killed: `findReferralSources()` and the 65+/hearing-loss math.

**Substeps:**

4.1. **`prompts.js`** — rewrite (don't delete) these:
- `email.system` (~line 422) — swap to GMN/fitness audience
- `email.hook` (~432) — swap pain triggers
- `email.nurture` (~445) — swap pain triggers
- `brain.analysisPrompt` (~463-480) — rewrite campaign description for GMN's offer

These use tokens (`{{audienceDescriptor}}` etc.) where possible — prefer tokenizing over hardcoded copy.

4.2. **`research.js`** — kill:
- `METRO_65_PLUS` table (lines 3-43)
- `get65PlusEstimate()` function
- `getCensusData()` function (lines 61-111)
- `findReferralSources()` function (lines 209-251)
- `REFERRAL_KEYWORDS` constant
- `populationOver65` and `estimatedHearingLoss` fields in both the mock (line 286-288) and live (line 401-403) `researchData` objects
- Author fallback `'A patient'` → `'A member'` (line 135)
- Mock competitor names "Clear Hearing Center" / "Bay Audiology" / "Advanced Hearing Solutions" → gym names (lines 261-265)
- `competitorSummary` text: "ranked Nth out of X practices" → "ranked Nth out of X gyms" (line 383)

4.3. **`scanner.js`** — swap mock names (lines 270-291) from audiology to gym names.

4.4. **`config.js`** — set:
- `keyword`, `scanKeyword`, `competitorKeyword` → `'gym'` (line 46-48)
- Comment on line 10 — cosmetic, add "gym" to the examples

4.5. **`enrollment.js`** — rewrite:
- `claudeAnalyseConversation()` prompt (lines 79-106) — replace audiology flow description with GMN flow description. Note: depends on what your GMN variants look like in step 5, so this rewrite may need a touch-up later. For now, write it in terms of GMN's actual sales conversation shape (qualifying → pain confirmation → data reveal → close).
- `heuristicAnalysis()` keyword detectors (lines 163-179) — either rip out (rely on Claude analysis alone) or rewrite the keyword fingerprints to match GMN copy. Ripping out is simpler; rewriting is more robust to Claude analysis failures. **Recommendation:** rip out for now, rewrite once you have real GMN conversation data to fingerprint against.

4.6. **`server.js`** — swap user-facing strings (each is a one-line edit, all inside `buildXPage()` template literals):
- Line 269: `sendScanVisibilityMessage` fallback — swap audiology copy to gym
- Line 2046: `/api/generate` user message — swap to gym
- Line 3286: Playground mock — `'Premier Audiology'`, `'Beltone'` → gym names
- Line 6721: "Built exclusively for audiology practices" badge → "GMN internal sales engine" or remove
- Lines 114-115: comments (cosmetic)
- Line 7242: `customerNoun` placeholder → "e.g. member, client, guest"
- Lines 7409-7410: prompt editor token reference → update examples
- Lines 4136, 4304, 4318: brand strings → "GMN" (Q7 placeholder; finalize when persona name is picked)
- Promote `EXAMPLES.gym` to default chip (line ~7289). Keep dental/restaurant/realestate examples as harmless white-label scaffolds.

4.7. **`package.json`** — rename:
- `"name"`: `"powered-up-lead-magnet"` → `"gmn-engine"`
- `"description"`: → `"GMN internal B2B sales engine — inbound nurture + outbound crew"`

**Files touched:** `prompts.js`, `research.js`, `scanner.js`, `config.js`, `enrollment.js`, `server.js`, `package.json`.

**Trap exposure:**
- **Trap #2** (CRITICAL for `server.js` edits) — every string edit inside a `buildXPage()` function must avoid contractions in single-quoted strings, must use `&#39;` not `\'` for apostrophes in HTML attributes, must double-escape any `\n`/`\t` that should appear literally. After each `server.js` edit, run the parse-check from CLAUDE.md / trap #2.
- **Trap #6** — after `prompts.js` edits, run `npm run prompts:push`.
- **Trap #8** — `research.js` shape changes ripple to the `[BOOKED]` guard at `server.js:1626`. You're not changing the *presence* of `researchData`/`scanResults` (you're keeping the pipeline per Q3) — you're just removing fields *within* `researchData` (`populationOver65`, `estimatedHearingLoss`). The guard checks for presence, not shape. *Should* be safe, but verify the guard still passes a `[BOOKED]` end-to-end after the edits.
- **Trap #10** — `enrollment.js` edits: preserve `isInbound` (lines 39-45) exactly. *Only* rewrite the prompt and heuristics; do not touch direction logic.

**Commit (split into ~3 commits for safety):**
- `git commit -m "Phase 1 Step 4a: strip audiology from prompts.js + research.js + scanner.js + config.js"`
- `git commit -m "Phase 1 Step 4b: rewrite enrollment.js analysis prompt + rip heuristics"`
- `git commit -m "Phase 1 Step 4c: swap audiology strings in server.js admin templates + package.json"`

Commit 4c is the riskiest (trap #2 surface). Splitting lets you `git revert` 4c alone if the admin UI breaks.

**How to verify:**
- After 4a: server boots, `grep -rn "audiolog\|hearing\|patient" --include="*.js"` returns only comments / archived files / docs
- After 4b: enrollment flow still works (test in DEV_MODE with a mock enrollment job — instructions in replit.md)
- After 4c: all admin pages render without console errors. Specifically check the prompt editor — the suspected `escHtml is not defined` bug may surface here.
- `grep -rn "populationOver65\|estimatedHearingLoss\|findReferralSources\|METRO_65_PLUS" --include="*.js"` returns nothing
- End-to-end smoke test: trigger a fake `[PRACTICE_DETECTED]` in the Playground → confirm research/scan pipeline runs → confirm `[BOOKED]` guard still works

---

## Step 5 — Build 2 GMN variants in the structured builder (1–2 days, mostly your copywriting)

**Goal:** Author the two GMN conversation variants for A/B testing, per Q2 + Q9. Both linear (no explicit branching — Claude handles it in-context).

**Before you start:** Decide what the two variants are testing. Examples:
- Variant A: pain-point opener vs. Variant B: social-proof opener
- Variant A: short qualifying (3 questions) vs. Variant B: long qualifying (6 questions)
- Variant A: lead with value prop vs. Variant B: lead with curiosity gap

The two variants should be *meaningfully different* so a winner means something. Don't make them near-identical copy tweaks.

**Substeps:**

5.1. Open `/admin/variants` in the browser.

5.2. Build Variant A. Add steps in order:
- Step 1 (`text`): Opening message. Use `{{customerNoun}}`, `{{brandPersona}}`, etc. tokens.
- Step 2 (`text`): Qualifying questions.
- Step 3 (`practice_detection`): Triggers the research/scan pipeline. Step instruction should tell the AI to extract gym name + city/address from the conversation and emit `[PRACTICE_DETECTED:Gym Name|Address|City]`.
- Step 4 (`text`): Data reveal — AI uses `researchData` + `scanResults` to make the local-market pitch.
- Step 5 (`text`): Pain confirmation + objection handling.
- Step 6 (`vsl_send`): Send the VSL.
- Step 7 (`text`): Booking close. **Must include the trap #8 safety blocks** (`NEVER BOOK BEFORE QUALIFYING`, `HOSTILE OPT-OUT → [DECLINED]`).

5.3. Build Variant B following the same step structure but with the differentiating hypothesis you picked.

5.4. Run a few test conversations in the Playground for each variant. Watch for:
- AI emits `[PRACTICE_DETECTED]` in step 3 with the right format
- Research/scan pipeline runs (visible in admin dashboard)
- AI uses the data correctly in step 4
- AI emits `[BOOKED]` only after qualifying (trap #8)
- AI emits `[DECLINED]` on hostile opt-outs (trap #8)

5.5. Update `config.SCRIPTED_VARIANTS` in `config.js` to `['A', 'B']` so the Bayesian P(Best) view has variants to score.

**Files touched:** `data/prompts.json` (via the admin UI's structured builder), `config.js`.

**Trap exposure:**
- **Trap #1** — variants must be deliberately distinct; don't try to "DRY" their shared parts later.
- **Trap #7** — does not apply (structured builder handles step numbering automatically; this is exactly why you picked Q9 → builder).
- **Trap #8** — both variants must carry the safety blocks at the booking step. *Critical.*

**Commit:** `git commit -m "Phase 1 Step 5: build GMN variants A and B in structured builder"`

**How to verify:**
- `/admin/variants` shows both variants
- Each variant runs end-to-end in the Playground without errors
- `data/prompts.json` now has 2 entries in `structuredVariants` array
- Bayesian P(Best) view at `/admin` shows both variants with 0 bookings (real data will populate as campaigns run)

---

## Step 6 — Repurpose GMB One-Shot Generator (½ day)

**Goal:** Per Q5, swap the audiology prompt in `/api/generate` for a GMN message-drafting prompt. Keeps the tool useful for ad-hoc personalized outreach.

**Substeps:**

6.1. **`server.js:2046`** — rewrite the user message template from "Generate a message for this prospect's audiology practice..." to "Generate a message for this prospect's gym/fitness business..."

6.2. **`config.js:57`** (`systemPrompt`) — confirm it uses `{{audienceDescriptor}}` and other tokens. If hardcoded audiology references remain, swap.

6.3. Test by hitting `/api/generate` with a sample gym name + GBP data → confirm the output reads like a real GMN cold message.

**Files touched:** `server.js`, possibly `config.js`.

**Trap exposure:**
- **Trap #2** if the rewrite lands inside a template literal (it shouldn't — line 2046 is in a route handler, not a `buildXPage()`). Verify before editing.

**Commit:** `git commit -m "Phase 1 Step 6: repurpose GMB Generator for GMN message drafting"`

**How to verify:**
- `curl` or Postman call to `/api/generate` returns a GMN-flavored message
- No errors in server log

---

## Step 7 — Admin UI Layer 1 extraction (2–4 days)

**Goal:** Move the 8 `buildXPage()` functions out of `server.js` into a `views/` directory. Drops `server.js` by ~3,700 lines and isolates the trap-#2 surface per page. **Do this *before* adding any new GMN dashboard panels so they land in clean files.**

**Why now:** Your audit-found bug (`escHtml is not defined` on the prompt editor) likely surfaces during this extraction because each page's `<script>` will be in its own file and the missing definition becomes obvious.

**Substeps:**

7.1. Create `views/` directory at project root.

7.2. For each `buildXPage()` function (8 total), cut it verbatim from `server.js`, paste into a new file:
- `views/scan-page.js` ← `buildScanPage`
- `views/admin-dashboard.js` ← `buildAdminDashboardPage`
- `views/prompt-editor.js` ← `buildPromptEditorPage`
- `views/enroll-page.js` ← `buildEnrollPage`
- `views/playground-page.js` ← `buildPlaygroundPage`
- `views/industry-setup.js` ← `buildIndustrySetupPage`
- `views/variant-builder.js` ← `buildVariantBuilderPage`
- `views/setup-guide.js` ← `buildSetupGuidePage`

Each file: `function buildX(...){ return `<!DOCTYPE...` } module.exports = { buildX }`. In `server.js`, replace the function definitions with `const { buildX } = require('./views/x-page')`.

7.3. **Do them one at a time, in commit order.** Easiest first (small pages): `setup-guide.js`, `industry-setup.js`, `scan-page.js`. Hardest last (big pages with deep JS): `admin-dashboard.js`, `prompt-editor.js`, `playground-page.js`. After each extraction, restart the server, open every admin page, confirm nothing broke.

7.4. **Fix the `escHtml` bug.** When you extract `prompt-editor.js`, you'll likely see that it references `escHtml` but doesn't define it (the definition lives in `admin-dashboard.js` at line 4765). Two fixes:
- Define `escHtml` in `prompt-editor.js` too (duplicate the helper)
- Or extract `escHtml` to a `views/helpers.js` and `require` from both

The second is cleaner; the first is faster. Pick fast — you can refactor to helpers later.

7.5. After all 8 extractions, `server.js` should be ~4,000 lines. Verify with `wc -l server.js`.

**Files touched:** `server.js`, new `views/*.js` files (8 of them).

**Trap exposure:**
- **Trap #2** (THE WHOLE POINT) — you're isolating the trap-#2 surface. Run the parse-check from CLAUDE.md after each extraction.
- **Trap #3** — does not apply unless you also add new `fetch()` calls, which you shouldn't be doing here.
- **Trap #6** — does not apply (no prompt edits).

**Commit (one per extraction):**
- `git commit -m "Phase 1 Step 7a: extract buildSetupGuidePage to views/"`
- ...etc.

This gives you 8 commits, one per page. Easy to bisect if something breaks.

**How to verify:**
- After all 8: every admin page loads without errors
- Prompt editor specifically: no `escHtml is not defined` in browser console
- `wc -l server.js` shows ~4,000 lines (down from ~7,747)

---

## Step 8 — Add GMN-specific dashboard panels (1 day)

**Goal:** Add the panels you wanted on the admin dashboard that don't exist in Sidney's version. Per the Phase 1 plan in the handoff doc: DND/opt-out tracking, close-loop attribution, cost-per-booking.

**Substeps:**

8.1. **DND / opt-out tracking panel.** Already have `optouts` table. Just need a new panel that queries it and shows: count of opt-outs, most recent opt-outs, opt-out rate over time. New `/admin/api/optouts` endpoint, new card in `views/admin-dashboard.js`.

8.2. **Close-loop attribution panel.** Track: of the contacts that hit `[BOOKED]`, how many converted to paying GMN clients? This is the metric that closes the loop from outbound → revenue. Requires you to flip `paused_reason` from `booked` to something like `converted` or `lost` manually after each call. Schema add: maybe a `funnel_outcome` column on `contacts`. New panel shows: booked-to-close rate per variant.

8.3. **Cost-per-booking panel.** Already have `total_api_spend` per contact via `spend.js`. Sum total spend / count of bookings = cost per booking. Already mostly tracked; just needs a panel that surfaces it.

**Files touched:** `views/admin-dashboard.js`, `server.js` (new API endpoints), possibly DB migration for `funnel_outcome` column.

**Trap exposure:**
- **Trap #3** — every new `fetch()` in the dashboard must use `fetchWithTimeout`. *Critical.*
- **Trap #2** — same rules apply in `views/admin-dashboard.js` as before. Use HTML entities, double-escape strings, no contractions in single-quoted JS strings.

**Commit:** `git commit -m "Phase 1 Step 8: GMN dashboard panels (DND, attribution, cost-per-booking)"`

**How to verify:**
- All three panels render data
- Console clean
- Fetches use `fetchWithTimeout`

---

## Step 9 — Handoff to Phase 2 (the cutover)

**Goal:** Confirm Phase 1 is done, the engine is GMN-native, and Phase 2 (Outbound Crew greenfield) can begin on this foundation.

**Substeps:**

9.1. End-to-end smoke test: simulate a full conversation in DEV_MODE from cold opener through `[BOOKED]`. Both variants. Confirm research/scan/data reveal works, safety blocks trigger correctly.

9.2. Connect a real GHL location (set `GHL_API_KEY` + `GHL_LOCATION_ID` in `.env`). Disable DEV_MODE (`DEV_MODE=false`). Run a small test campaign (5-10 contacts).

9.3. Write `PHASE_2_PLAN.md` modeled after this one, for the Outbound Crew (CrewOS-style) build.

9.4. Pick the persona name (Q7 final answer) and swap it into `data/industry.json`.

**Files touched:** `.env`, `data/industry.json`, new `PHASE_2_PLAN.md`.

**Commit:** `git commit -m "Phase 1 complete: GMN-native engine ready for live campaigns"`

---

## Deferred to Phase 1.5 (after Phase 2 is underway)

These items are known but not blocking:
- **No-show + reschedule handling** (Q6) — appointment-status webhook, new follow-up cadence
- **Admin UI Layer 3 extraction** (per AUDIT.md §5) — pulling client-side `<script>` blocks into static `.js` files
- **`enrollment.js` heuristics rewrite** with real GMN conversation fingerprints (once you have data)
- **`brain.js STAGE_MAP` rename** — current labels are audiology-script-era; rename once you have a feel for what GMN's stages should be called

---

## Estimated total time

- Step 1: ½ day
- Step 2: ½ day
- Step 3: 1 day
- Step 4: 1 day
- Step 5: 1–2 days (mostly your copywriting)
- Step 6: ½ day
- Step 7: 2–4 days
- Step 8: 1 day
- Step 9: ½ day

**Total: ~9–11 working days.** The handoff doc estimated 3 weeks for Phase 1. That matches.

The longest variance is step 7 (Layer 1 extraction). If it goes smoothly, 2 days. If you hit trap-#2 weirdness or the `escHtml` bug cascades, 4 days. Plan for 3.

---

## When you get stuck

- Re-read AUDIT.md §6 for trap cross-reference on the file you're editing
- Re-read replit.md for the original Sidney-written trap text
- Pause `npm run dev` and run `node -e "..."` parse-check from CLAUDE.md before testing admin UI edits
- If a step breaks the server boot, `git diff` the most recent commit and `git revert` if needed — small commits per step make this safe

Don't be heroic. Small commits, frequent verifies, one step at a time.
