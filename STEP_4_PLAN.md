# STEP 4 PLAN — Audiology cleanup + repurposing (audit only, no code changed)

**Version: v2 — revised after operator decisions A (DELETE) and B (fold-in).**

**Changelog v1 → v2:**
- **Decision A** — sub-task 5 (`structuredVariants`) changed from `UPDATE … SET value='[]'` to **`DELETE`** the `ai_prompts` row; `prompts.js` `DEFAULTS` (which has no `structuredVariants` key) lets `variant-builder.js` fall back to `[]` durably, and the next `prompts:push`/sync cannot re-corrupt a row that does not exist. Verification updated.
- **Decision B** — the eight locations previously flagged in "Risk Flags / Open Questions" are promoted to **proper sub-tasks 8–15** with full per-location inventory: prompts.js email/brain prompts (8), config.js keyword swaps (9), scanner.js mock names (10), research.js residual strings (11), followups.js residual strings (12), the `ampifyform:` / `ampifyai.com` "Ampify" references (13), the GMB-generator user message at `server.js:1908` (14), the `practiceName`/`practice_name` field rename (15).
- Removal/rewrite **sequence** re-ordered per operator guidance (trivial → quick rewrites → refactors → prompt rewrites last).
- **Trap exposure**: trap #6 (prompts file↔DB sync) is now **firmly in scope** — `npm run prompts:push` after the `prompts.js` edits is **mandatory, not conditional**. Trap #2 surface re-checked against the new server.js locations.
- **File inventory** updated: modified files are now `package.json`, `server.js`, `enrollment.js`, `research.js`, `followups.js`, `prompts.js`, `config.js`, `scanner.js`, `ghl.js`, plus the `conversations.js`/`spend.js`/`brain.js`/`variant-builder.js`/`industry.js` touches that the `practiceName` rename (sub-task 15) drags in, plus a Neon DB change (DELETE one `ai_prompts` row; sub-task 15 also adds a DB column migration).
- **Open design questions** consolidated; v1 questions answered by Decisions A/B removed; new questions for sub-tasks 8/13/14/15 added; the enrollment.js + prompts.js prompt-rewrite design calls are gathered in one cluster.

**Status:** deliverable. Nothing in the codebase was modified producing it. Line numbers verified against the *post-Step-3* tree (`server.js` = 7576 lines; AUDIT.md's numbers are stale by ~170 lines). Read-only on code; only `STEP_4_PLAN.md` was written.

**Goal of Step 4 after Decision B:** the engine is **fully audiology-free** when Step 4 completes — no "audiology", "hearing", "TruHearing/UHCH/Availity/NaviNet/Blueprint/Sycle/Beltone/Gray Gold", no "Ampify/ampifyform/ampifyai.com", no "dormant patients", no medical-sense "patient/practice/doctor/office manager", no audiology mock names — across `server.js`, `enrollment.js`, `research.js`, `followups.js`, `prompts.js`, `config.js`, `scanner.js`, `ghl.js`, and the data files. (`replit.md`, `docs/`, `archived/` are reference material and intentionally left as-is.)

**Still explicitly out of scope:** Step 5 territory (variant builder *content* / `structuredVariants` *contents* / `config.SCRIPTED_VARIANTS`) and Step 6 territory (the GMB One-Shot Generator's *behavior* — `/api/generate` flow, `config.systemPrompt` *structure*, the `/scan/:sessionId` page as a GMB output). Note sub-task 14 *does* touch the GMB generator's *user-message string* (an audiology string) but not its behavior, prompt structure, or routing — that narrow string fix is folded in per Decision B.

---

## 1. Per-sub-task inventory

> Trap-#2 note used below: an edit is "trap-#2 zone" when it lands **inside** a `buildXPage()` outer-backtick template literal (`server.js`). For those, single-quoted JS strings must avoid contractions, `\'` is banned (use `&#39;` in HTML attributes), `\n`/`\t` must be double-escaped (`\\n`), and `<script>`-block helpers must use string concatenation, not inner backticks. Run the rendered-`<script>` `new Function()` parse-check after every such edit.

### Sub-task 1 — Audiology strings in `server.js` (admin UI chrome, placeholders, preset chips, comments, runtime strings)

**1.1 — Brand chrome (titles, logos, footers, console banner, persona placeholder).** Per Q7 → "GMN" (persona name TBD; `data/industry.json` already uses `brandPersona: "Josh"`). All trap-#2 zone except `:3976`.

| Line | Current | Proposed |
|---|---|---|
| `server.js:3976` | `console.log(\`Powered Up AI — GMB Message Generator running on port ${PORT}\`);` | `\`GMN Engine running on port ${PORT}\`` |
| `server.js:4097` | `<div class="footer">Powered by Powered Up AI</div>` | `Powered by GMN` (or drop — internal tool) |
| `server.js:4133` | `<title>Admin Dashboard — Powered Up AI</title>` | `… — GMN Engine` |
| `server.js:4302` | `<div class="logo">Powered Up AI</div>` (admin dashboard) | `GMN Engine` |
| `server.js:4395` | `placeholder="GHL tag name (e.g. Powered Up AI)"` | `placeholder="GHL tag name (e.g. gmn-inbound)"` |
| `server.js:5532` | `<title>Prompt Editor — Powered Up AI</title>` | `… — GMN Engine` |
| `server.js:5655` | `<div class="logo">Powered Up AI</div>` (prompt editor) | `GMN Engine` |
| `server.js:6214` | `<title>Lead Enrollment — Powered Up AI</title>` | `… — GMN Engine` |
| `server.js:6265` | `<div class="logo">Powered Up AI</div>` (enroll page) | `GMN Engine` |
| `server.js:6458` | `<title>Conversation Tester — Powered Up AI</title>` | `… — GMN Engine` |
| `server.js:6547` | `<div class="logo">Powered Up AI</div>` (playground) | `GMN Engine` |
| `server.js:6983` | `<title>Industry Setup — White-Label SMS Engine</title>` | `… — GMN Engine` |
| `server.js:7016` | `<div class="logo">White-Label SMS Engine</div>` (industry setup) | `GMN Engine` |
| `server.js:7043` | `<input type="text" id="brandPersona" placeholder="e.g. Sidney">` | `placeholder="e.g. Josh"` |
| `server.js:7160` | `<title>Variant Builder — White-Label SMS Engine</title>` | `… — GMN Engine` |
| `server.js:7223` | `<div class="logo">White-Label SMS Engine</div>` (variant builder) | `GMN Engine` |
| `server.js:7491` | `<title>Setup — White-Label SMS Engine</title>` | `… — GMN Engine` |
| `server.js:7524` | `<div class="eyebrow">White-Label SMS Engine</div>` (setup guide) | `GMN Engine` |
| `server.js:7574` | `<div class="foot">White-Label SMS Sales Engine &middot; <a href="/">home</a></div>` | `GMN Engine &middot; …` |

*Justification:* cosmetic rename; no logic, no token; safe trap-#2-zone character swaps.

**1.2 — The "audiology" badge on the Conversation Tester (playground) page.** Trap-#2 zone.

| Line | Current | Proposed |
|---|---|---|
| `server.js:6550` | `<div class="badge">Built exclusively for audiology practices</div>` | `<div class="badge">GMN internal sales engine</div>` (or delete the line) |

**1.3 — Playground scan mock (`_playgroundSeedScanData`).** Plain function — **not** trap-#2 zone.

| Line | Current | Proposed |
|---|---|---|
| `server.js:3119` | `const name = session.practiceName \|\| 'Your Practice';` | `… \|\| 'Your Gym';` (note: `session.practiceName` becomes `session.gymName` after sub-task 15 — coordinate) |
| `server.js:3121` | `const competitorName = \`${city.split(',')[0]} Hearing Center\`;` | `\`${city.split(',')[0]} Strength Co\`` (any gym-style name) |
| `server.js:3126` | `competitors: [competitorName, 'Premier Audiology', 'Beltone'],` | `[competitorName, 'Iron Tribe Fitness', 'Anytime Fitness']` (illustrative) |
| `server.js:3127` | `competitorSummary: \`${competitorName} has 4× your review count and ranks #1 in 14/15 nearby searches.\`` | generic — leave; only the name interpolates |

**1.4 — `sendScanVisibilityMessage` fallback string.** Plain route helper (backtick used only for interpolation) — **not** trap-#2 zone, but rephrase the contraction anyway for consistency.

| Line | Current | Proposed |
|---|---|---|
| `server.js:269` | `msg = \`One more thing — just ran your visibility scan. There are gaps in your local search coverage — people looking for audiologists a few miles out aren't finding you.\`;` | `\`… people searching for a gym a few miles out are not finding you.\`` |

**1.5 — Industry-setup form placeholders + example chips + variant-builder token reference.** Trap-#2 zones (`buildIndustrySetupPage`, `buildVariantBuilderPage`).

| Line | Current | Proposed |
|---|---|---|
| `server.js:7024-7028` | Chips: `Dental practices`, `Restaurants`, `Real estate`, `Gyms / studios`, `Clear all` | Reorder so **`Gyms / studios` is first** (de-facto default). Keep the dental/restaurant/realestate chips + their `EXAMPLES` scaffolds (audit says keep-and-flag — they are generic white-label examples, not audiology). |
| `server.js:7054` | `placeholder="e.g. dental, restaurant, real estate"` | `placeholder="e.g. fitness, gym, studio"` |
| `server.js:7059` | `placeholder="e.g. dental practice owners"` | `placeholder="e.g. gym owners and fitness-clinic operators"` |
| `server.js:7066` | `placeholder="e.g. practice, clinic, shop"` | `placeholder="e.g. gym, studio, facility"` |
| `server.js:7071` | `placeholder="e.g. patient, client, guest"` | `placeholder="e.g. member, client, guest"` |
| `server.js:7081` | `placeholder="e.g. We run automated SMS campaigns that wake up your dormant patient list, …outranking you on Google."` | fitness one-liner, e.g. `"e.g. We help gym owners grow membership with AI-powered SMS lead nurture and member referral systems."` |
| `server.js:7086` | `placeholder="- Empty appointment slots cost hundreds of dollars each&#10;- Front desk forgets to follow up with no-shows&#10;- Reviews lag behind the competitor down the street"` | fitness pains (uses `&#10;` HTML entity newline — no escape concern) |
| `server.js:7091` | `placeholder="- 30+ recovered appointments per month from dormant lists&#10;- 12% reply rate on automated outreach&#10;- New 5-star reviews on autopilot"` | fitness outcomes (same `&#10;` mechanism) |
| `server.js:7236-7239` | token-reference examples: `{{businessNoun}}` "e.g. practice, restaurant, gym", `{{customerNoun}}` "e.g. patient, guest, member", `{{audienceDescriptor}}` "e.g. dental practice owners" | gym-first: `{{businessNoun}}` → "e.g. gym, studio, facility"; `{{customerNoun}}` → "e.g. member, client, guest"; `{{audienceDescriptor}}` → "e.g. gym owners and fitness-clinic operators" |

**1.6 — Comments (cosmetic, no trap exposure, lowest priority).**

| Line | Current | Proposed |
|---|---|---|
| `server.js:114-115` | `// • Variant B → hearing-aid percentage question (Step 5)` / `// Variant A/C → data reveal / booking step` | reword to GMN's planned step flow, or delete the two bullets |
| `server.js:314-316`, `server.js:800`, `server.js:930`, `server.js:5149` | code comments referencing `ampifyform:<slug>` | handled together with sub-task 13 (`ampifyform:` rename), not here |
| `server.js:5160-5163` | admin-UI HTML text showing `ampifyform:&lt;slug&gt;` examples | handled in sub-task 13 |

*Items found in `server.js` but handled elsewhere or out of scope:* `server.js:1908` (GMB-generator user message) → **sub-task 14**. `server.js:1967` / `:1666` / `:3473` `'Your Practice'` / "is that your practice listing?" and all `practiceName`/`practiceCity`/`practiceStreet`/`_playgroundLookupPractice` identifiers → **sub-task 15** (the field rename). The `ampifyform:` strings/comments → **sub-task 13**.

---

### Sub-task 2 — Kill `findReferralSources` (keep the gym-discovery scan)

**Decision (Q4):** GMN's referral pitch is *internal member referrals*, not geographic adjacent-business referrals → remove the "find ENTs / insurance offices near the practice" feature. **Keep** the Google Places GBP-lookup, competitor discovery, the 25-point grid scan, and the DataForSEO path (Q3).

**Shared-helper map (the surgical line):** the only shared dependency between the referral code and the kept gym-discovery code is `haversineKm` (`research.js:114`) — it **stays** (competitor-distance math needs it). `searchPlaces` / `fetchPlaceDetails` / `extractRecentReviews` / `getCensusData` (its own sub-task 3) / the grid-scan helpers are *not* used by `findReferralSources`. `REFERRAL_KEYWORDS` is a local const inside `findReferralSources` — dies with it. **Net: the `research.js` side is purely subtractive; the real ripple is `followups.js`.**

**`research.js` removals:**

| Line(s) | Code | Action |
|---|---|---|
| `research.js:209-251` | JSDoc `/** Search Google Places for nearby referral sources: ENTs… */` + `async function findReferralSources(lat, lng, apiKey) { … const REFERRAL_KEYWORDS = ['ear nose throat doctor','audiologist referral','health insurance']; … }` | **DELETE** JSDoc + function |
| `research.js:380-381` | `// Find nearby referral sources (ENTs, insurance offices)` / `const nearbyReferralSources = await findReferralSources(lat, lng, apiKey);` | **DELETE** both lines |
| `research.js:402` | live `researchData`: `nearbyReferralSources` key | **DELETE** key (mind trailing comma) |
| `research.js:287` | mock `researchData`: `nearbyReferralSources: []` | **DELETE** key |
| `research.js:406` | `console.log(\`[Research] Complete … — ${recentReviews.length} recent reviews, ${nearbyReferralSources.length} referral sources\`);` | **MODIFY** — drop the `, ${nearbyReferralSources.length} referral sources` fragment (var no longer exists → crash otherwise) |
| `research.js:436` | `module.exports = { runResearch, fetchCompetitorVelocity, findReferralSources, refreshRecentReviews, fetchReviewCount };` | **MODIFY** — remove `findReferralSources` from exports |

**`followups.js` ripple (same commit — `node --check followups.js` fails otherwise; the server crashes when a follow-up job runs otherwise):**

| Line(s) | Code | Action |
|---|---|---|
| `followups.js:12` | `const { fetchCompetitorVelocity, findReferralSources, refreshRecentReviews, fetchReviewCount } = require('./research');` | **MODIFY** — drop `findReferralSources` |
| `followups.js:431` | JSDoc bullet `* 3. nearbyReferralSources — fetch once if not already stored (or if empty)` | **DELETE** bullet |
| `followups.js:441` | `enrichment` object key `nearbyReferralSources: researchData?.nearbyReferralSources || []` | **DELETE** key (last property — trailing-comma watch) |
| `followups.js:497-510` | `// 3. Referral sources — fetch once; re-fetch if empty …` block: `if (enrichment.nearbyReferralSources.length === 0 && …) { … const sources = await findReferralSources(...); … }` | **DELETE** whole block |
| `followups.js:540-548` | `formatEnrichmentContext`: `if (enrichment.nearbyReferralSources && …) { … parts.push(\`NEARBY REFERRAL SOURCES (…)\n${sourceLines}\`); }` | **DELETE** whole block |

*After removal:* `{{enrichmentContext}}` (consumed by `followup.hook`/`followup.nurture`/`email.nurture`) no longer carries referral sources — recent reviews + competitor velocity + prospect's own review gain still flow. **No prompt edit required for this sub-task** — but the `prompts.js`/`config.js` defaults still *mention* referral sources; those rewrites are now sub-tasks 8 and 9 (Decision B), not separate flags.

*Justification:* explicit Q4 decision; the named entities (ENTs, audiologist referrals, health insurance) have no gym analog.

---

### Sub-task 3 — Delete the 65+/hearing-loss math in `research.js`

**Decision:** GMN does not need demographic math for B2B lead research. Remove the senior-population lookup table, the Census ACS query for the 65+ cohort, the `× 0.33` hearing-loss derivation, and the two `researchData` fields they feed.

| Line(s) | Code | Action / downstream check |
|---|---|---|
| `research.js:3-35` | `// 65+ population estimates by metro/county area (appropriate for audiology catchment)` + `const METRO_65_PLUS = { … };` | **DELETE** — only consumer is `get65PlusEstimate` (also deleted) |
| `research.js:37-43` | `function get65PlusEstimate(city) { … return 45000; }` | **DELETE** — consumers: `getCensusData` (deleted) + `research.js:279-280` (deleted) |
| `research.js:61-111` | `async function getCensusData(city) { … Census ACS county query B01001_020E…025E + 044E…049E … }` | **DELETE** whole function — consumers: the `Promise.all` sites at `research.js:301` and `:321` |
| `research.js:294` | `let place, details, pop65, usedPlaceId;` | **MODIFY** — drop `pop65` from the declaration |
| `research.js:299-302` | `[details, pop65] = await Promise.all([ fetchPlaceDetails(confirmedPlaceId, apiKey), getCensusData(city) ]);` | **MODIFY** → `details = await fetchPlaceDetails(confirmedPlaceId, apiKey);` |
| `research.js:318-323` | `const [placeResults, pop65_] = await Promise.all([ searchPlaces(searchQuery, apiKey), getCensusData(city) ]); pop65 = pop65_;` | **MODIFY** → `const placeResults = await searchPlaces(searchQuery, apiKey);` (drop `pop65_` and the assignment) |
| `research.js:279-280` | mock `researchData`: `populationOver65: get65PlusEstimate(city), estimatedHearingLoss: Math.round(get65PlusEstimate(city) * 0.33),` | **DELETE** both keys |
| `research.js:397-398` | live `researchData`: `populationOver65: pop65, estimatedHearingLoss: Math.round(pop65 * 0.33),` | **DELETE** both keys |

**Downstream coupling check (run at execution time, must be clean before deleting):** `grep -rn "populationOver65\|estimatedHearingLoss" --include="*.js" .` (excluding `node_modules`/`archived`) currently returns **only `research.js`** — nothing in `server.js`'s AI context builder, `buildScanPage`, `sendScanVisibilityMessage`, `conversations.js`'s `extra`, or `enrollment.js` reads these. Removal is safe.

**Trap #8 adjacency:** the `[BOOKED]` qualification guard at `server.js:~1625` (`lacksQualification = !fresh?.researchData || !fresh?.scanResults`) keys on *presence* of `researchData`/`scanResults`, not their fields — removing fields *within* `researchData` does not affect it. Do **not** touch that guard.

> **Recommendation:** execute sub-tasks 2, 3, and 11 (research.js residual strings) as **one `research.js` commit** even though the sequence below lists them in different category-buckets — the file is open once, and they do not conflict. The sequence positions reflect *category ordering*, not a requirement to split research.js across three commits.

---

### Sub-task 4 — Rewrite the `enrollment.js` analysis prompt + heuristics for GMN (MAP ONLY — body written in execution)

**Where it lives:** `enrollment.js`, `claudeAnalyseConversation(ghlMessages, contactId)` — the `const prompt = \`…\`` template literal spanning roughly `enrollment.js:98-125`. Also `heuristicAnalysis(ghlMessages)` (`enrollment.js:166-227`) — the fallback used in dry-runs and on Claude-call failure — carries audiology-script fingerprints (`'showing up on that map'`, `'percentage actually went through with it'`, `'sid, our founder'`, `'i pulled up'`) at `enrollment.js:183-198`.

**Context surface the prompt has:** `transcript` (`enrollment.js:92-96`, built from filtered+sorted real GHL messages, lines prefixed `PROSPECT:`/`US:`, bodies already TCPA-stripped via the Step 1.2 `messageText()` fix); a hardcoded description of the legacy 6-step audiology flow (intro → "Benefits angle (insurance resets…)" → "Dormant patients angle" → "Practice research reveal + booking ask" → "Founder intro / scheduling (Sid pitch)" → "Booked"); `contactId` (used only for `spend.track`). Model `process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'`, `max_tokens: 300`. **Existing bug to fix in the rewrite:** the prompt says "6-step SMS sales flow" up top but "the 8-step flow above" in the Rules — inconsistent.

**Output contract (other code consumes this — keep it unless you also write new consumers):**
```json
{ "currentStep": <0-N>, "enrollPosition": <2-5>, "reasoning": "<one sentence>" }
```
Parsed at `enrollment.js:152-157`. Consumed in `processContact` (`enrollment.js:301-375`): `currentStep` → `conversations.update(contactId, { currentStep })` + `context.lastOutboundStep` on the scheduled `hook` job (the pointer the conversation prompt uses to resume); `enrollPosition` → `scheduleJob({ type:'hook', position: enrollPosition })` and via `POSITION_DELAY = {2:0,3:2,4:4,5:7}` (days) sets how soon the first re-engagement hook fires; `reasoning` → enrollment results table only.

**What the rewrite must do:** re-flavor the flow description for GMN's actual sales conversation (qualifying → pain confirmation → research/data reveal → VSL → booking) and detect gym-owner intent / qualification signals / common objections, per the operator. **The body is written in execution, not this audit** — it depends on the GMN conversation step flow (built in Step 5; circular dependency → write against PHASE_1_PLAN §5.2's planned template and accept a likely touch-up after Step 5).

**Heuristics:** the audiology fingerprints match nothing in GMN conversations → `usedCurrentScript` always false → `detectedStep` forced to 0. PHASE_1_PLAN §4.5 recommends ripping the keyword fingerprints out entirely (rely on Claude analysis; the count-based `enrollPosition` logic at `enrollment.js:200-211` is generic and stays); rewriting them is premature (no GMN conversation data to fingerprint yet).

**Must NOT touch (trap #10):** `isInbound` (`enrollment.js:39-45`), `messageText` / `TCPA_OPTOUT_SUFFIX` / `isRealMessage` (`enrollment.js:59-82`). Only the `prompt` string and the `heuristicAnalysis` keyword block change.

**Design questions → consolidated below.** This sub-task is sequenced **last** alongside sub-task 8.

---

### Sub-task 5 — DELETE the `structuredVariants` row from the Neon `ai_prompts` table (Decision A)

**Why DELETE, not UPDATE.** `data/prompts.json` already holds `"structuredVariants": []`. The `ai_prompts` table has a stale row `name='structuredVariants'`, `value='{}'` (a string). `prompts.js syncFromDb` (`prompts.js:335-405`) treats every `ai_prompts` row as a string prompt; `structuredVariants`'s file value is an *array*, so file-vs-DB never `===` (always a diff), and on the boots where the DB side wins it rewrites `data/prompts.json` with the string `'{}'`. An `UPDATE … SET value='[]'` would not survive either — the next file→DB push serializes the JS array `[]` through `node-pg`, which encodes it as the Postgres array literal `'{}'`, re-corrupting the row. **DELETE removes the problem class:** `syncFromDb` leaves file-only keys alone, so once the row is gone the file's `"structuredVariants": []` is the single source of truth; and `prompts.js DEFAULTS` has *no* `structuredVariants` key, so nothing seeds it back into the DB with the wrong type. `variant-builder.js` reads `structuredVariants` straight from `data/prompts.json` (`variant-builder.js:32-47`) with an `Array.isArray` guard — never via `ai_prompts` — so deleting the row changes no behavior.

**Exact command** (uses `process.env.DATABASE_URL` per CLAUDE.md's local-setup note that DATABASE_URL is our prod Neon DB):

```bash
# Inspect first:
psql "$DATABASE_URL" -c "SELECT name, value, updated_at FROM ai_prompts WHERE name = 'structuredVariants';"

# Delete:
psql "$DATABASE_URL" -c "DELETE FROM ai_prompts WHERE name = 'structuredVariants';"
```

Node alternative (no `psql`):
```bash
node -e "const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"DELETE FROM ai_prompts WHERE name='structuredVariants'\").then(r=>{console.log('deleted rows:',r.rowCount);return p.end();});"
```

**Verification:**
1. `psql "$DATABASE_URL" -c "SELECT count(*) FROM ai_prompts WHERE name='structuredVariants';"` → `0`.
2. Restart `npm run dev`. The `[Prompts]` boot line should **not** mention `structuredVariants` (it is no longer a row). `data/prompts.json` is untouched by the sync.
3. `node -e "console.log(JSON.parse(require('fs').readFileSync('data/prompts.json','utf8')).structuredVariants)"` → `[]` (an array).
4. `git status` → `data/prompts.json` clean after boot.
5. (Sanity) open `/admin/variants?key=…` → the builder loads with zero variants, no error.

> Note: `prompts.js DEFAULTS` does not "repopulate the row with the correct array type" — there *is* no `structuredVariants` default; the point of DELETE is that the row simply stays gone and `data/prompts.json` (array) wins by being the only place it lives. (If, later, the operator wants `structuredVariants` mirrored to the DB, that would require teaching `prompts.js` to handle non-string values — out of scope, and unnecessary.)

---

### Sub-task 6 — Rewrite the gym preset (`EXAMPLES.gym`) in `server.js` to match `data/industry.json`

**Where:** `server.js:7118`, inside `buildIndustrySetupPage`'s `<script>` — **trap-#2 zone, and the highest-risk single edit in Step 4** (a large block of new string content going into single-quoted JS strings inside the outer backtick). Current entry:

```js
gym: {brandName:'',brandPersona:'',industryName:'fitness',audienceDescriptor:'gym and studio owners',businessNoun:'gym',customerNoun:'member',productDescription:'We text former and at-risk members to re-enroll them, plus run new-lead nurture so trial sign-ups actually convert into paying members.',painPoints:'- Dropped members never come back\\n- Trial-to-paid conversion stalls below 30%\\n- Front desk has no time to follow up',valueProps:'- 15–25 reactivated members per month\\n- Trial conversion lifted to 50%+\\n- Hands-off lead nurture',extraContext:''},
```

**Field-name check:** the preset must match the form's `FIELDS` array at `server.js:7110` (which is what `loadExample()` populates): `brandName, brandPersona, industryName, audienceDescriptor, businessNoun, customerNoun, productDescription, painPoints, valueProps, extraContext`. That set differs from `data/industry.json` by exactly two keys: the preset has `extraContext` (form has an "Extra context" field; `data/industry.json` does not), and `data/industry.json` has `vslUrl` (form does not manage it). So the replacement includes `extraContext:''` and **omits** `vslUrl`. All other field names line up 1:1 with `data/industry.json` and `industry.js`'s token names.

**Draft replacement** (content from `data/industry.json`; **contractions removed** — single-quoted JS strings in this zone cannot contain `'`, and `\'` is banned by trap #2; **`\n` → `\\n`**; `$` in `$80K`/`$4.7M` is safe — not `${`; em-dashes are safe; **`brandName` uses a double-quoted JS string** because `"Andy Gundlach's team"` has an apostrophe — legal inside the backtick template since the value has no `"` chars, but it breaks the other presets' single-quoted convention → see open question):

```js
  gym: {brandName:"Andy Gundlach's team",brandPersona:'Josh',industryName:'fitness',audienceDescriptor:'gym owners',businessNoun:'gym',customerNoun:'client',productDescription:'We are an agency that owns and operates 140+ gyms and studios. We sell gym owners the same AI-powered marketing, sales, and member-retention systems we run inside our own locations — as a done-for-you service with coaching.',painPoints:'- Lead flow is unpredictable — some months you are slammed with sign-ups, other months you are staring at an empty pipeline\\n- Dormant members sitting in your CRM that nobody has followed up with in months\\n- No real system for turning your happy clients into a referral engine\\n- No process for getting consistent Google reviews month after month\\n- Trainers and front-desk staff do not have a consistent sales process — every consultation feels different\\n- Drowning in admin work — you are doing marketing, sales, ops, coaching all yourself\\n- Classes running half-empty during certain time slots and you do not know how to fill them\\n- Local competition opening up and cutting into your member base\\n- Hard to compete with low-priced chains without dropping your own pricing',valueProps:'- AI-powered lead nurture that texts every lead within seconds and qualifies them 24/7 — no more leads going cold while you are coaching\\n- Dormant member reactivation campaigns proven to recover 5-figure revenue from your existing CRM (Whitney pulled $80K in 5 weeks)\\n- Member referral systems that turn your happy clients into a consistent growth channel\\n- Automated Google review collection that compounds month over month — without you ever asking\\n- Trainer and front-desk sales playbooks battle-tested across our own 140+ locations\\n- Done-for-you marketing campaigns — we run them, you focus on coaching and culture\\n- Real coaching from people who actually operate gyms, not theoretical agency consultants\\n- Proven scaling systems used to take operators from 2 to 11 locations and beyond (Brandon did it in 28 months with $4.7M in contracts)',extraContext:''},
```

After editing: `node --check server.js`; trap-#2 rendered-`<script>` parse-check against `/admin/industry`; visually confirm the chip fills the form with no raw `\n` or stray quotes.

*Justification:* per Decision/Q6 — the GMN preset should carry GMN's real config.

---

### Sub-task 7 — `package.json` name + description (+ dead npm script)

| Field | Current | Proposed |
|---|---|---|
| `name` | `"powered-up-lead-magnet"` | `"gmn-engine"` |
| `description` | `"Audiology sales demo tool with streaming AI chat"` | `"GMN internal B2B sales engine — inbound nurture + outbound crew"` |
| `scripts.test:off-script` | `"node scripts/test-off-script-handlers.js"` | **Remove the line** — `scripts/test-off-script-handlers.js` was `git mv`-d to `archived/` in Step 1.3, so this script is broken; it is dead audiology tooling. (Other scripts — `start`, `dev`, `db:init`, `prompts:push` — are fine.) |

*Justification:* trivial, no traps, no JS — keep `package.json` valid JSON.

---

### Sub-task 8 — `prompts.js` audiology copy: `email.system`, `email.hook`, `email.nurture`, `email.monthly`, `brain.analysisPrompt` (REWRITE — bodies finalized in execution)

These are `DEFAULTS` entries in `prompts.js` (not in any `buildXPage()` template — **no trap #2** here, but **trap #6** applies in full: after editing, `npm run prompts:push` + restart is **mandatory**, see Trap exposure). They are currently audiology-flavored:

| Line(s) | Current (excerpt) | Proposed action |
|---|---|---|
| `prompts.js:111` | `'email.system': 'You are a sales assistant emailing audiology practice owners on behalf of Ampify AI. …'` | Rewrite the audience + brand: `'… emailing gym owners and fitness-clinic owners on behalf of {{brandName}}. …'` — prefer tokenizing (`{{audienceDescriptor}}`, `{{brandName}}`) so `industry.interpolate` keeps it industry-neutral, like `followup.*` already is. Keep the "1–2 sentences, JSON-only" rules verbatim. |
| `prompts.js:113-124` | `'email.hook'` — body ends `…Mention a specific gap or opportunity (dormant patients, expiring benefits, competitors gaining ground) if supported by the data.` | Swap the example gaps to fitness: `(at-risk members, a stalled trial sign-up window, a competitor gym gaining reviews)`. `{{practiceName}}` token in the salutation → see sub-task 15 (becomes `{{gymName}}` if the rename lands). |
| `prompts.js:126-137` | `'email.nurture'` — `…a recent patient review, expiring insurance benefits, or a nearby referral source.` | Swap to: `…a recent member review, a seasonal sign-up window, or a competitor gym gaining ground.` (Note: "nearby referral source" is also being removed structurally by sub-task 2 — keep the prompt text consistent with that.) |
| `prompts.js:139-150` | `'email.monthly'` — `…recent reviews, a competitor milestone, year-end benefits.` | "year-end benefits" is an insurance/audiology cue → swap to a fitness cue, e.g. `…a recent member review, a competitor milestone, a New-Year sign-up surge.` |
| `prompts.js:152-173` | `'brain.analysisPrompt'` — `…AI-powered SMS conversation with independent audiology practice owners… reactivating dormant patients in the owner's database, optimizing their Google My Business profile, driving reviews… front-desk workload…` | Rewrite the *campaign description* paragraph to GMN's actual offer (the agency-that-owns-140+-gyms positioning from `data/industry.json` — done-for-you AI marketing/sales/retention + coaching, member reactivation, referral systems, review collection, trainer/front-desk playbooks). The Hormozi/Suby framing, the "2–3 SMS insights then one email paragraph" structure, and the RULES/OUTPUT sections stay verbatim — only the campaign-context paragraph (lines ~154 and the "On the backend sales call the team sells:" sentence) changes. |
| `prompts.js:45`, `prompts.js:50` | `PROMPT_META` descriptions for `followup.hook` / `followup.nurture` mention "(recent Google reviews, competitor velocity, referral sources)" / "nearby referral sources" | Drop the "referral sources" mention (consistent with sub-task 2's structural removal). Low priority — these are admin-UI helper text, not sent to the AI. |
| `prompts.js:9`, `:11-12`, `:16` | header doc comment: `conversationPrompt — Discovery script (steps 1-9)`, `claude-sonnet`, etc. | cosmetic — tidy while editing the file |

*Justification:* these are the last hard-coded audiology *copy* in the codebase. `followup.hook` / `followup.nurture` / `followup.system` in `config.js` are already tokenized (`{{audienceDescriptor}}` etc.) and self-heal from `data/industry.json` — they need no edit (but `config.js`'s `keyword` triple does — sub-task 9). **The email/brain bodies are finalized in execution, not this audit** — design questions consolidated below; they are written together with the enrollment.js prompt (sub-task 4) as the last step.

---

### Sub-task 9 — `config.js` keyword swaps + comment

`config.js` is structural and already mostly generic — there is no *audiology* string in it, but the local-business search keywords are placeholder `'local business'` and the header comment uses "audiologist" as an example.

| Line(s) | Current | Proposed action |
|---|---|---|
| `config.js:10` | `// (e.g. "audiologist", "dentist", "real estate agent", "restaurant").` | `// (e.g. "gym", "fitness studio", "personal trainer studio").` |
| `config.js:46` | `keyword:           'local business',` | `'gym'` |
| `config.js:47` | `scanKeyword:       'local business',` | `'gym'` |
| `config.js:48` | `competitorKeyword: 'local business',` | `'gym'` (this is what `research.js` searches for to find competitor businesses near the prospect's gym; `'gym'` is the right category. Reconsider if GMN also targets boutique studios — could be `'gym fitness studio'`; see open question) |

*Note:* `config.systemPrompt` (the GMB-generator system prompt, `config.js:57-68`) uses `{{audienceDescriptor}}` and is otherwise generic — **no audiology string, leave it**. Only its *consumer's* user-message string (`server.js:1908`) has the audiology word — that is sub-task 14. `config.PLACEHOLDER_PROMPT` and `config.followUpPrompts.*` are already tokenized — leave.

*Justification:* makes the Google Places / DataForSEO enrichment search for gyms instead of generic "local business"; the comment example was the only audiology word in the file.

---

### Sub-task 10 — `scanner.js` mock competitor names

| Line(s) | Current | Proposed action |
|---|---|---|
| `scanner.js:278-281` | mock grid `topBusinesses`: `{ name: practiceName, … }, { name: 'Clear Hearing Center', … }, { name: 'Bay Audiology', … }` | swap the two hard-coded names to gym names, e.g. `'Iron Tribe Fitness'`, `'Anytime Fitness'` (keep `practiceName` as the prospect entry — it becomes `gymName` after sub-task 15) |
| `scanner.js:282-285` | mock fallback `topBusinesses`: `'Clear Hearing Center'`, `'Bay Audiology'`, `'Advanced Hearing Solutions'` | swap all three to gym names, e.g. `'Iron Tribe Fitness'`, `'Anytime Fitness'`, `'Orangetheory'` (illustrative) |

`scanner.js` is plain Node (no template literals here) — **no trap #2**. Used only when `GOOGLE_PLACES_KEY` is unset (the mock path).

*Justification:* mock data should look like a gym scan, not a hearing-clinic scan, since this is the visible output in the playground / scan page.

---

### Sub-task 11 — `research.js` residual audiology strings (beyond the math in #3 and the referral code in #2)

| Line(s) | Current | Proposed action |
|---|---|---|
| `research.js:135` | `author: r.author_name \|\| 'A patient'` (in `extractRecentReviews`) | `'A member'` |
| `research.js:271-275` | mock `researchData.competitors`: `{ name: 'Clear Hearing Center', reviews: 187, … }, { name: 'Bay Audiology', … }, { name: 'Advanced Hearing Solutions', … }` | swap to gym names, e.g. `'Iron Tribe Fitness'`, `'Anytime Fitness'`, `'Orangetheory'` (keep the review/rating numbers) |
| `research.js:277` | mock `competitorSummary: \`${practiceName} is ranked 4th out of 7 practices by review count\`` | `…out of 7 gyms by review count` |
| `research.js:283-285` | mock `recentReviews`: `{ author: 'Emma R.', text: 'This practice completely changed my quality of life — I can hear my grandkids again!' }, { author: 'James T.', text: 'Professional and thorough. Highly recommend to anyone with hearing concerns.' }` | gym review text, e.g. `'Best decision I made — down 22 lbs and the coaches actually know my name.'` / `'Clean facility, real programming, no contract games. Recommend it.'` |
| `research.js:395` | live `competitorSummary: \`${practiceName} is ranked ${prospectRank}${ordinal(prospectRank)} out of ${allByReviews.length} practices by review count\`` | `…out of ${allByReviews.length} gyms by review count` |

`research.js` is plain Node — **no trap #2**. (`practiceName` here becomes `gymName` after sub-task 15.)

*Justification:* completes the audiology purge of `research.js` — the mock competitor/review data and the "practices" wording were left out of sub-tasks 2 & 3, which only handled the referral function and the demographic math.

---

### Sub-task 12 — `followups.js` residual audiology string

| Line(s) | Current | Proposed action |
|---|---|---|
| `followups.js:530` | `parts.push(\`RECENT GOOGLE REVIEWS (their actual patients, use names/quotes directly):\n${reviewLines}\`);` | `…(their actual members, use names/quotes directly):…` (or `(their actual customers, …)` if "member" feels wrong for a gym owner reading their own data) |

`followups.js` is plain Node — **no trap #2**. This string is injected into the `{{enrichmentContext}}` token that feeds `followup.hook`/`followup.nurture`/`email.nurture`.

*Note:* the `nearbyReferralSources` block at `followups.js:497-510` and `:540-548` is being removed by sub-task 2, not here — no double-handling. After both, `grep -ni "patient\|referral" followups.js` should be clean.

*Justification:* "patients" in a gym owner's review-data context is wrong; small but visible (the AI quotes this block).

---

### Sub-task 13 — Rename the `ampifyform:` lead-form tag prefix + clear other "Ampify" references

"Ampify AI" was Sidney's brand. It survives in: the `ampifyform:<slug>` GHL-tag convention (the lead-form bucket parser), an outbound email from-address, and a couple of comments.

**13a — The `ampifyform:` tag prefix.** This is a *GHL wire-protocol slug* — contacts get tagged `ampifyform:high-volume` etc. in GHL, and the parser buckets them. GMN's GHL location is **not connected yet** (`GHL_API_KEY` blank), so there is no live data to migrate — safe to rename now, but the operator must use the new slug when configuring GHL forms later.

| Line(s) | Current | Proposed action |
|---|---|---|
| `conversations.js:326` | `const LEAD_FORM_PREFIXES = ['ampifyform:', 'form:'];` | `['gmnform:', 'form:']` — *or* `['gmnform:', 'ampifyform:', 'form:']` to keep `ampifyform:` as a legacy alias (see open question on whether to keep the alias). Note `'form:'` (generic) is already supported and stays. |
| `conversations.js:318-322` | comment: `// Convention: any GHL tag of the form \`ampifyform:<slug>\` (canonical, e.g. \`ampifyform:high-volume\`, …)` | reword to `gmnform:` |
| `server.js:314-316` | comment: `// It looks for any \`ampifyform:<slug>\` GHL tag and … Falls back to 'unknown' when no \`ampifyform:*\` tag is present.` | reword to `gmnform:` (plain JS comment — no trap #2) |
| `server.js:800` | comment: `// \`ampifyform:<slug>\` GHL tag (see parseLeadForm) — defaults to 'unknown'.` | reword to `gmnform:` |
| `server.js:930` | comment: `// a contact from \`ampifyform:high-volume\` to \`ampifyform:high-intent\`) is` | reword to `gmnform:` |
| `server.js:5149` | comment (inside `buildAdminDashboardPage` template, but a `//` comment): `// \`ampifyform:<slug>\` GHL tag at enrollment / tag update). A new tag` | reword — it is a JS comment, low trap-#2 risk, but it is inside the backtick template so keep it a clean `//` line with no contractions/escapes |
| `server.js:5160-5163` | admin-UI HTML text: `<code…>ampifyform:&lt;slug&gt;</code> (e.g. <code…>ampifyform:high-volume</code>, <code…>ampifyform:high-intent</code>, <code…>ampifyform:high-intent-2FA</code>) &mdash; new buckets appear here automatically.` | replace `ampifyform:` → `gmnform:` in all four `<code>` examples (trap-#2 zone — these are HTML text, plain character swaps, safe) |
| `brain.js:768` | comment: `* the matching \`ampifyform:<slug>\` GHL tag shows up.` | reword to `gmnform:` |

**13b — Outbound email from-address.**

| Line | Current | Proposed action |
|---|---|---|
| `ghl.js:208` | `emailFrom: 'contact@ampifyai.com'` | replace with a real GMN sending address (see open question — needs the operator's actual email; placeholder `'contact@gymmembersnow.com'` until confirmed) |

**13c — Cosmetic comment.**

| Line | Current | Proposed action |
|---|---|---|
| `ghl.js:119-120` | comment: `// so we send the lowercased tag to match. Without this, an admin typing "Ampify" // gets zero results even though "ampify" matches 55 contacts.` | reword the example to a GMN tag (e.g. "GMN") — cosmetic |

*Justification:* "Ampify" is Sidney's brand; `ampifyform:` and `contact@ampifyai.com` would leak it into GMN's GHL config and outbound email. Renaming the tag prefix now (before GHL is connected) avoids a later migration.

---

### Sub-task 14 — `server.js:1908` GMB-generator user message (the one audiology string in `/api/generate`)

| Line | Current | Proposed action |
|---|---|---|
| `server.js:1908` | `let userMessage = \`Generate a message for this prospect's audiology practice.\n\nPractice name: ${practiceName}\nCity: ${city}\`;` | `\`Generate a message for this prospect's gym/fitness business.\n\nGym name: ${gymName}\nCity: ${city}\`` — note `${practiceName}` becomes `${gymName}` after sub-task 15; the `\n` here is fine (plain backtick assignment in a route handler, **not** a trap-#2 zone). |

*Scope note:* this is the **only** edit Step 4 makes to the GMB One-Shot Generator — a one-word string fix on its input prompt. The generator's *behavior, prompt structure (`config.systemPrompt`), routing, and the `/scan/:sessionId` output page* remain Step 6 territory and are untouched. Folded in here per Decision B because it is a stray audiology string and leaving it would mean the engine is not "fully audiology-free."

*Justification:* the prospect's business is a gym, not an audiology practice.

---

### Sub-task 15 — Rename the `practiceName` / `practice_name` field to `gymName` / `gym_name` (cross-file refactor — PLAN ONLY; this is the heavy one)

The prospect's business is referred to throughout as `practiceName` (in-memory record + `{{practiceName}}` prompt token), `practice_name` (Postgres column), with `practiceCity` / `practiceStreet` siblings, plus the `[PRACTICE_DETECTED:Name|Street|City]` AI marker, plus function/variable names like `_playgroundLookupPractice`, plus user-facing fallbacks like `'Your Practice'` and `"is that your practice listing?"`. **`grep` finds ~145 occurrences of `practiceName`/`practice_name`/`practiceCity`/`practiceStreet`/`_playgroundLookupPractice` across the JS files**, plus 18 occurrences of `PRACTICE_DETECTED` across `server.js` + `variant-builder.js`. This is a genuine cross-file rename, not a string sweep — it needs its own carefully-sequenced commit (and a DB migration). The operator asked for it folded in; here is the full surface.

**Layer A — the Postgres column `contacts.practice_name`.** Referenced at `conversations.js:32` (`practiceName: c.practice_name` in `initFromDb`) and `conversations.js:137` (the INSERT/UPSERT column list) — and **in the schema** (`scripts/init-database.js`, which the audit did not read in full; confirm). Renaming the column requires a migration: `ALTER TABLE contacts RENAME COLUMN practice_name TO gym_name;` against `$DATABASE_URL` (fresh local DB → trivial). **Decision needed:** rename the column, or leave the column `practice_name` and only rename the JS identifier (`c.practice_name` → keep, `practiceName` → `gymName` in memory)? Renaming the column is cleaner but is an irreversible-ish prod change; leaving it is less work and the column name is invisible to users. — see open question.

**Layer B — the in-memory record field `practiceName` (+ `practiceCity`, `practiceStreet`).** `conversations.js` (`:32`, `:108`, `:137`, `:227` — the record shape, the upsert, the `extra` blob), `server.js` (~70 lines — `_extractPracticeName`-style parsing, `confirmationPending`, `_playgroundLookupPractice`, `buildScanPage` params, the `[PRACTICE_DETECTED]` handler, playground session), `research.js` (~10 — `runResearch(session, practiceName, practiceStreet, city, …)` param, `competitorSummary`, the `console.log`), `scanner.js` (~10 — `startScan(sessionObj, practiceName, …)`, `generateMockResults`, `computeScanStats`, `fuzzyMatch` against `practiceName`), `spend.js:109` (`practiceName: c.practiceName || null` in the spend-stats row), `followups.js:2` occurrences (enrichment / job context). **Rename `practiceName` → `gymName`, `practiceCity` → `gymCity`, `practiceStreet` → `gymStreet`** consistently. Pure mechanical rename; `node --check` each file after.

**Layer C — the `{{practiceName}}` prompt token.** Used in `prompts.js`'s `email.hook` / `email.nurture` / `email.monthly` defaults (`prompts.js:113`, `:126`, `:139` — `Write a short follow-up email to {{firstName}}{{practiceName}}.`). This token is filled at email-generation time in `followups.js` (a per-contact `.replace()`, not `industry.interpolate` — `practiceName` is not a `data/industry.json` key). **Rename the token `{{practiceName}}` → `{{gymName}}` in both the `prompts.js` defaults and the `followups.js` substitution site, in the same commit.** (This overlaps sub-task 8's `prompts.js` edits — do them together; and because it touches `prompts.js` defaults, **trap #6 → `npm run prompts:push` after**.)

**Layer D — the `[PRACTICE_DETECTED:Name|Street|City]` AI marker.** Emitted by the AI when it identifies the prospect's business; parsed in `server.js`; *instructed* by `variant-builder.js`'s `practice_detection` step-type compiler (`SHARED_OUTPUT_RULES` / the step instruction text). 18 occurrences across `server.js` + `variant-builder.js`. **No live variant references it** (`structuredVariants` is empty after Step 1.1; `SCRIPTED_VARIANTS` is `[]`), so renaming the marker is low-risk *right now*. **Decision needed:** rename the marker too (`[PRACTICE_DETECTED]` → `[GYM_DETECTED]`, and the `practice_detection` step type → `gym_detection`) for consistency, or leave the marker as an internal protocol token and only rename the user-visible field? Renaming it now is cheap; renaming it after Step 5 (once GMN variants exist that hardcode it) is expensive. — see open question. *Recommendation:* rename it now, in this sub-task, while nothing references it.

**Layer E — user-facing strings.** `server.js:1666` `"Just want to make sure — is that your practice listing? Reply yes or no."` and `server.js:3473` (the playground mirror) → `"…is that your gym's listing? Reply yes or no."` (apostrophe in "gym's" — fine in a double-quoted JS string; check it is not inside a trap-#2 single-quoted zone — `:1666` is in a route handler, `:3473` is in `_playgroundReply`-style code, neither is a `buildXPage` template). `server.js:1967` `const practiceName = session?.practiceName || 'Your Practice';` and `server.js:3119` (sub-task 1.3 already flags this one) → `'Your Gym'`. `buildScanPage`'s `'Your Practice'` default likewise.

**Sequencing within sub-task 15:** (1) DB migration `RENAME COLUMN` (if Layer A "rename column" is chosen); (2) `conversations.js` (record shape + column refs); (3) `server.js` + `research.js` + `scanner.js` + `spend.js` + `followups.js` (in-memory field + params + user strings); (4) `prompts.js` + `followups.js` token rename (Layer C — same commit as sub-task 8); (5) `variant-builder.js` + `server.js` marker rename (Layer D, if chosen). `node --check` every file; boot; smoke-test a `[GYM_DETECTED:…]` (or `[PRACTICE_DETECTED:…]` if not renamed) round-trip in the playground; confirm `grep -rn "practiceName\|practice_name\|practiceCity\|practiceStreet" --include="*.js" .` is clean (excluding `node_modules`/`archived`/`docs`).

*Justification:* the prospect is a gym; "practice" is medical-sense vocabulary. But this is the riskiest sub-task to get wrong (145+ touch points, a DB column, an AI protocol marker) — it is sequenced **last among the refactors**, before only the prompt rewrites.

---

## 2. Removal / rewrite sequence (execution order)

Per operator guidance: trivial first → quick rewrites → refactors → prompt rewrites last. Commit after each numbered step; `node --check` (or JSON-lint) and a boot-check between steps. Where two steps touch the same file, the note says so.

**Trivial (no logic, no traps):**
1. **`package.json`** — name + description + remove dead `test:off-script` script (sub-task 7). Verify `node -e "require('./package.json')"`; boot. Commit: `Phase 1 Step 4.1: package.json → GMN, drop dead npm script`.
2. **DELETE the `structuredVariants` `ai_prompts` row** (sub-task 5, Decision A). Inspect → `DELETE`. Restart; confirm `data/prompts.json` stays `[]` and `git status` clean. (No code diff — commit is just the plan/notes, or fold into step 1's commit.)
3. **`config.js`** — keyword triple `'local business'` → `'gym'`, comment example (sub-task 9). `node --check config.js`; boot. Commit: `Phase 1 Step 4.2: config.js search keywords → gym`.
4. **`scanner.js`** — mock competitor names → gym names (sub-task 10). `node --check scanner.js`; boot. Commit: `Phase 1 Step 4.3: scanner.js mock names → gyms`.

**Quick rewrites (string swaps; trap #2 where noted):**
5. **`server.js` — gym preset** (sub-task 6). One-line replacement of `:7118`. `node --check server.js`; trap-#2 parse-check on `/admin/industry`. Commit: `Phase 1 Step 4.4: rewrite gym preset to match GMN industry.json`.
6. **`server.js` — audiology string sweep + rebrand chrome** (sub-task 1: 1.1 chrome, 1.2 badge, 1.3 playground mock, 1.4 scan-visibility fallback, 1.5 placeholders + chip reorder, 1.6 comments). `node --check server.js`; trap-#2 parse-check on **every** admin page touched (`/admin`, `/admin/prompts`, `/admin/enroll`, `/admin/playground`, `/admin/industry`, `/admin/variants`, `/admin/setup`). Commit: `Phase 1 Step 4.5: strip audiology strings + rebrand chrome in server.js`. *(Highest trap-#2 surface alongside step 5 — keep it isolated so it can be reverted alone.)*
7. **`followups.js` — residual string** (sub-task 12): `"their actual patients"` → `"their actual members"`. `node --check followups.js`. Commit: `Phase 1 Step 4.6: followups.js review-context wording → members`. *(Note: this file is touched again in step 11 — findReferralSources ripple — and in step 14 — token rename. If preferred, do steps 7+11 together as one `followups.js`+`research.js` commit.)*
8. **`research.js` — residual strings** (sub-task 11): `'A patient'` → `'A member'`, mock competitor/review names + text → gyms, `competitorSummary` "practices" → "gyms". `node --check research.js`; boot. Commit: `Phase 1 Step 4.7: research.js mock data + wording → gyms`. *(This file is touched again in steps 11 + 12 — recommend doing all `research.js` edits — sub-tasks 11, 2, 3 — as one commit; the category split here is presentational.)*
9. **`ampifyform:` rename + Ampify references** (sub-task 13): `conversations.js` `LEAD_FORM_PREFIXES` + comments, `server.js` comments + admin-UI `<code>` examples, `brain.js` comment, `ghl.js` `emailFrom` + comment. `node --check conversations.js server.js brain.js ghl.js`; trap-#2 parse-check on `/admin` (the `<code>` swap). Commit: `Phase 1 Step 4.8: rename ampifyform: → gmnform:, clear Ampify references`.
10. **`server.js:1908` — GMB-generator user message** (sub-task 14): "audiology practice" → "gym/fitness business" (and `Practice name:` → `Gym name:`; the `${practiceName}` here will be reconciled in step 13's rename). `node --check server.js`. Commit: `Phase 1 Step 4.9: GMB-generator prompt wording → gym`. *(Could be folded into step 6's commit since both touch `server.js` strings.)*

**Refactors:**
11. **Kill `findReferralSources`** (sub-task 2): `research.js` removals + `followups.js` ripple, one commit. `node --check research.js followups.js`; boot → no `ReferenceError`; `grep -n "findReferralSources\|nearbyReferralSources" research.js followups.js` → zero. Commit: `Phase 1 Step 4.10: remove findReferralSources (referral discovery)`.
12. **Delete the 65+/hearing-loss math in `research.js`** (sub-task 3): `METRO_65_PLUS`, `get65PlusEstimate`, `getCensusData`, the two `Promise.all` rewrites, the `pop65` decl, the four `researchData` keys. `grep -rn "populationOver65\|estimatedHearingLoss\|get65PlusEstimate\|METRO_65_PLUS" --include="*.js" .` → zero; `node --check research.js`; boot; smoke-test a `[PRACTICE_DETECTED]` (or `[GYM_DETECTED]` if step 13 reordered) in the playground — research/scan pipeline completes, `[BOOKED]` guard still works. Commit: `Phase 1 Step 4.11: remove 65+/hearing-loss demographic math`.
13. **`practiceName` / `practice_name` → `gymName` / `gym_name` cross-file rename** (sub-task 15): DB migration (if column-rename chosen) → `conversations.js` → `server.js`/`research.js`/`scanner.js`/`spend.js`/`followups.js` → (`prompts.js`+`followups.js` token rename — coordinate with step 15) → (`variant-builder.js`+`server.js` `[PRACTICE_DETECTED]`→`[GYM_DETECTED]` marker rename, if chosen). `node --check` every file; boot; `[GYM_DETECTED:…]` round-trip smoke test; `grep -rn "practiceName\|practice_name\|practiceCity\|practiceStreet" --include="*.js" .` clean. Commit(s): split by layer if it helps bisecting — `Phase 1 Step 4.12a: rename practiceName field → gymName (memory + DB)`, `4.12b: rename {{practiceName}} token → {{gymName}}`, `4.12c: rename [PRACTICE_DETECTED] marker → [GYM_DETECTED]`.

**Prompt rewrites (last — they benefit from all other audiology context being clean, and from knowing the planned conversation flow):**
14. **`prompts.js` — email.system / email.hook / email.nurture / email.monthly / brain.analysisPrompt rewrites** (sub-task 8) + the `{{practiceName}}`→`{{gymName}}` token in those same prompts (sub-task 15 Layer C, if not already done in step 13). **Then `npm run prompts:push` + restart — mandatory (trap #6).** Confirm the `[Prompts]` boot line says "pushed N prompt(s) FILE → DB" (not "pulled … DB → FILE"). `node --check prompts.js`. Commit: `Phase 1 Step 4.13: rewrite email + brain prompts for GMN`.
15. **`enrollment.js` — analysis prompt + heuristics rewrite** (sub-task 4). Touch only the `prompt` template literal and the `heuristicAnalysis` keyword block; leave `isInbound`/`messageText`/`isRealMessage` untouched. `node --check enrollment.js`; dry-run an enrollment against a mock tag in DEV_MODE — confirm it still returns `{currentStep, enrollPosition, reasoning}` and `processContact` still schedules a `hook` job. Commit: `Phase 1 Step 4.14: rewrite enrollment.js analysis prompt + heuristics for GMN`.

---

## 3. Risk flags

- **`findReferralSources` ripple into `followups.js` (sub-task 2):** the only shared helper with kept gym-discovery code is `haversineKm` (stays). The `research.js` side is purely subtractive — but if you delete `findReferralSources` without also fixing `followups.js:12` (the destructured import) **and** the two call/format sites, the server throws `findReferralSources is not a function` when a follow-up job runs. **One commit.** Same applies to the `nearbyReferralSources` key removals — drop them from both the `enrichment` object and `formatEnrichmentContext` together.
- **`research.js` is touched by three sub-tasks (2, 3, 11)** — recommend one combined `research.js` commit despite the category-split sequence. Watch trailing commas when removing `researchData` keys (`node --check` catches it). Re-run the `populationOver65|estimatedHearingLoss|nearbyReferralSources` downstream grep before deleting — currently clean outside `research.js`/`followups.js`, but confirm.
- **`followups.js` is touched by three sub-tasks (2, 12, 15-Layer-C)** — likewise consider combining.
- **Trap #6 is now in scope and mandatory** (sub-tasks 8 + 15-Layer-C edit `prompts.js DEFAULTS`): after those edits, `npm run prompts:push` + restart, then verify the `[Prompts]` boot line shows **file→DB push**, not DB→file pull. If you skip it and a stale `ai_prompts` row exists for any of `email.*` / `brain.analysisPrompt`, that stale audiology row keeps getting served. (On the fresh local DB the rows likely match the file already — but `prompts:push` is the documented escape hatch and is idempotent.)
- **Trap #2 surface in Step 4:** `buildIndustrySetupPage` (gym preset — *the* fragile edit: new multi-line string content with contractions → remove them, `\n` → `\\n`, the brand-name apostrophe forces a double-quoted JS string; plus form placeholders, chip reorder, persona placeholder), `buildVariantBuilderPage` (token-reference examples — plain HTML text), `buildAdminDashboardPage` (the `ampifyform:`→`gmnform:` `<code>` swap at `:5160-5163` and the `//` comment at `:5149` — plain text/comment), `buildPromptEditorPage` / `buildEnrollPage` / `buildPlaygroundPage` (incl. the badge at `:6550`) / `buildSetupGuidePage` (titles/logos/footers). **Not** trap-#2 zones: `_playgroundSeedScanData` (1.3), `sendScanVisibilityMessage` (1.4), `server.js:1908` (14), `server.js:1666`/`:3473` (15-Layer-E), and all of `enrollment.js`/`research.js`/`scanner.js`/`followups.js`/`config.js`/`prompts.js`/`ghl.js`/`conversations.js`/`brain.js`/`variant-builder.js` — those are plain Node, no outer backtick template. Run the rendered-`<script>` `new Function()` parse-check after every `buildXPage` edit.
- **The `practiceName` rename (sub-task 15) is the highest-blast-radius change** — ~145 identifier touch points across ~8 files, a Postgres column, an AI protocol marker (`[PRACTICE_DETECTED]`), and several user-facing strings. Sequenced last among refactors. Split into the layered commits (memory/DB → token → marker) so a regression bisects cleanly. Two sub-decisions block parts of it: rename the DB column or not (Layer A), rename the `[PRACTICE_DETECTED]` marker or not (Layer D) — see open questions. **Renaming the marker is cheap now (no live variant references it) and expensive after Step 5** — strong recommendation to do it now if it is going to be done at all.
- **`enrollment.js` analysis prompt depends on a flow that does not exist yet** — the GMN conversation step flow is built in Step 5; writing the analysis prompt in Step 4 means describing a flow the (future) variants must match. If they diverge, `currentStep` detection returns 0 and enrollment falls back to position-only logic (graceful degrade, but the "resume at the right step" feature stops working). Mitigation: write against PHASE_1_PLAN §5.2's planned step template; expect a touch-up after Step 5. (Reason it is sequenced last.)
- **`ampifyform:` → `gmnform:` is a GHL-side coordination point** — once GMN configures real lead forms in GHL, they must tag with `gmnform:<slug>`. GHL is not connected yet (`GHL_API_KEY` blank), so there is no data to migrate, but document the new slug for the operator. If you keep `ampifyform:` as a legacy alias in `LEAD_FORM_PREFIXES`, that is purely defensive (there is no legacy data) — operator's call.
- **`ghl.js:208 emailFrom`** needs the operator's real GMN sending address — using a placeholder (`contact@gymmembersnow.com` or similar) until confirmed; this is the only spot where a wrong value would actually misbehave (outbound email From header) if it ships unconfirmed and GHL is later connected. Flag for explicit confirmation.
- **Audiology language outside the original 7 + the new fold-ins (8–15)** — re-grepping the tree, the remaining audiology/Ampify references all live in **reference material that is intentionally left as-is**: `replit.md` (the 53KB trap doc — historical, references the audiology build by design), `docs/powered-up-ai-full-breakdown.md` (+ `(copy).md`), `archived/**` (Step 1.3-archived scripts/assets), `replit.nix`/`.replit` (Replit config). **Flag, do not scope in.** If a fresh grep at execution time turns up an audiology/Ampify string in a *live* `.js`/`.json` file not listed in sub-tasks 1–15, **flag it then** rather than silently expanding.

---

## 4. Post-execution verification

Run from the repo root with `npm run dev` (DEV_MODE=true) in another tab.

**Grep — the engine should be audiology-free across the live source** (watch the noted false positives):
```bash
# audiology/medical vocabulary — expect ZERO hits in live source:
grep -rni "audiolog\|hearing aid\|hearing test\|hearing concern\|hearing loss\|truhearing\|uhch\b\|availity\|navinet\|blueprint\b\|sycle\|gray gold\|beltone\|estimatedHearingLoss\|populationOver65" \
  --include="*.js" --include="*.json" . \
  | grep -v node_modules | grep -v "/archived/" | grep -v "replit" | grep -v "/docs/"
# expect: zero

# Ampify brand — expect ZERO:
grep -rni "ampify\|powered-up-lead-magnet\|powered up ai\|white-label sms engine" \
  --include="*.js" --include="*.json" . | grep -v node_modules | grep -v "/archived/" | grep -v "replit" | grep -v "/docs/"
# expect: zero  (ampifyform: → gmnform:, contact@ampifyai.com → GMN address, "Powered Up AI" → "GMN Engine")

# removed identifiers — expect ZERO:
grep -rn "findReferralSources\|nearbyReferralSources\|REFERRAL_KEYWORDS\|get65PlusEstimate\|getCensusData\|METRO_65_PLUS" --include="*.js" . | grep -v node_modules | grep -v "/archived/"
# expect: zero

# old field/marker names — expect ZERO (after sub-task 15; if the marker rename was skipped, [PRACTICE_DETECTED] will still appear in server.js + variant-builder.js — decide explicitly):
grep -rn "practiceName\|practice_name\|practiceCity\|practiceStreet" --include="*.js" . | grep -v node_modules | grep -v "/archived/" | grep -v "/docs/"
grep -rn "PRACTICE_DETECTED\|practice_detection" --include="*.js" . | grep -v node_modules | grep -v "/archived/"
# expect: zero (or only the deliberately-kept marker, if Layer D was declined)

# medical-sense "patient" / "practice" wording in live source — expect ZERO new hits:
grep -rni "dormant patient\|patient list\|patient review\|their actual patient\|out of [0-9]* practices\|'a patient'\|your practice listing\|'your practice'" --include="*.js" . | grep -v node_modules | grep -v "/archived/"
# expect: zero
```
*False-positive notes:* bare `"hearing"` / `"patient"` / `"practice"` are weak patterns — prefer the phrase patterns above. `"practice"` may legitimately survive in `replit.md`/`docs/` (excluded) and possibly in unrelated comments — eyeball any hit.

**Syntax check every modified file:**
```bash
node --check server.js enrollment.js research.js followups.js prompts.js config.js scanner.js ghl.js conversations.js brain.js variant-builder.js industry.js
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json OK')"
node -e "console.log(JSON.parse(require('fs').readFileSync('data/prompts.json','utf8')).structuredVariants)"  # → []  (an array)
```
All exit 0; the last prints `[]`.

**Server boot expectation:**
- Boots clean — no `SyntaxError`/`ReferenceError` (watch especially `findReferralSources is not defined` in `followups.js`, and `getCensusData`/`get65PlusEstimate` references in `research.js`, if a removal was incomplete).
- DEV MODE banner present; `[Conversations] DB loaded`, `[Prompts] …` sync line, `[Followups] DEV MODE — scheduler not started`, `[Reconciliation] DEV MODE …`, `[Bootstrap] …` all present.
- The `[Prompts]` line should report **file→DB push** for the `email.*` / `brain.analysisPrompt` keys after `npm run prompts:push` (or "already up to date" if they happened to match) — **not** a DB→file pull. It should **not** mention `structuredVariants` (row deleted).
- `git status` → `data/prompts.json` clean after boot (and `data/conversations.json` / `data/industry.json` untouched).

**`npm run prompts:push` — MANDATORY this step** (sub-tasks 8 + 15-Layer-C edit `prompts.js DEFAULTS`): run it after step 14 (the prompt rewrites) and restart; confirm the boot log shows the file winning.

**Admin UI smoke test (trap #2 — sub-tasks 1, 6, 13 edit `buildXPage()` template literals):** for each admin page touched, fetch the rendered HTML and `new Function()`-parse every `<script>` block:
```bash
KEY=gmn-local-dev-key-change-me
for p in "admin" "admin/prompts" "admin/enroll" "admin/playground" "admin/industry" "admin/variants" "admin/setup"; do
  curl -s "http://localhost:3000/$p?key=$KEY" > /tmp/gmn-$$.html
  node -e "const h=require('fs').readFileSync('/tmp/gmn-$$.html','utf8');const ms=[...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];let ok=true;ms.forEach((m,i)=>{try{new Function(m[1])}catch(e){ok=false;console.log('  /$p script',i,'FAIL:',e.message)}});console.log('/$p:',ok?'OK ('+ms.length+' scripts)':'BROKEN');"
done
```
Every page reports `OK`. Then visually: `/admin/industry` — "Gyms / studios" chip is first; clicking it fills the form with the GMN content (140+ gyms, Whitney/Brandon proof) with no raw `\n` or stray quotes in the textareas; `/admin/playground` — shows "GMN internal sales engine" (or no badge), variant tester runs; `/admin` — logo/title say "GMN Engine", Lead Form Performance card shows `gmnform:<slug>` examples, browser console clean (the pre-existing `escHtml is not defined` bug on the prompt editor is **not** Step 4's scope — Step 7 — but note it if it surfaces).

**Functional smoke tests:**
- Trigger a fake `[GYM_DETECTED:Some Gym|123 Main St|Austin, TX]` (or `[PRACTICE_DETECTED:…]` if Layer D was declined) in `/admin/playground` → research + scan pipeline completes (no crash from the removed `findReferralSources`/`getCensusData`), data-reveal step renders, `[BOOKED]` guard still honors a booking.
- Dry-run an enrollment in `/admin/enroll` against a mock GHL tag → `claudeAnalyseConversation` returns `{currentStep, enrollPosition, reasoning}`; a `hook` job gets scheduled. (Meaningful only after step 15.)
- (DB) `psql "$DATABASE_URL" -c "\d contacts"` → column is `gym_name` (if Layer A column-rename chosen) or still `practice_name` (if declined); either way `SELECT count(*) FROM ai_prompts WHERE name='structuredVariants';` → `0`.

---

## 5. Trap exposure summary

| Trap | In scope for Step 4 v2? | Where / what to watch |
|---|---|---|
| **#2** (admin UI = giant backtick template literals in `server.js`; contractions in single-quoted strings, `\'`, raw `\n`/`\t`, inner backticks in `<script>` helpers all break the page) | **Yes — the dominant trap.** | Sub-task 6 (gym preset, `server.js:7118`) is the riskiest single edit — new multi-line string content: remove contractions ("We are", "you are", "nobody has", "do not"), `\n` → `\\n`, the apostrophe in `"Andy Gundlach's team"` forces a double-quoted JS string. Sub-task 1 (chrome/badge/placeholders/chip reorder/persona placeholder) and sub-task 13 (`ampifyform:`→`gmnform:` in the `<code>` examples + the `//` comment inside `buildAdminDashboardPage`) are character swaps in existing HTML/comments — low risk, but still run the rendered-`<script>` parse-check on every page touched. **Not** trap-#2 zones: `_playgroundSeedScanData` (1.3), `sendScanVisibilityMessage` (1.4), `server.js:1908` (14), `server.js:1666`/`:3473` (15-E), and everything in `enrollment.js`/`research.js`/`scanner.js`/`followups.js`/`config.js`/`prompts.js`/`ghl.js`/`conversations.js`/`brain.js`/`variant-builder.js`/`industry.js`. |
| **#6** (prompts in `data/prompts.json` + `ai_prompts`; newer side wins; `npm run prompts:push` is the escape hatch) | **Yes — firmly in scope, mandatory.** | Sub-task 8 rewrites `prompts.js`'s `email.system`/`email.hook`/`email.nurture`/`email.monthly`/`brain.analysisPrompt` defaults; sub-task 15-Layer-C renames the `{{practiceName}}` token in those same defaults. After those edits → `npm run prompts:push` + restart → confirm the `[Prompts]` boot line shows **file→DB push**. Use `process.env.DATABASE_URL` for the sub-task-5 `DELETE` and any one-off SQL (CLAUDE.md local-setup note). *(Sub-task 5's DELETE is itself a consequence of `structuredVariants` not fitting the string-prompt sync model — DELETE removes it from the sync loop entirely.)* |
| **#10** (GHL message parsers — `m.direction`/`m.messageType`, never `m.type === N`; TCPA suffix: strip, never drop; `TYPE_ACTIVITY` filtering) | **Yes — in `enrollment.js` (sub-task 4).** | The rewrite touches `claudeAnalyseConversation`'s prompt string and `heuristicAnalysis`'s keyword block **only**. `isInbound` (`enrollment.js:39-45`), `messageText`/`TCPA_OPTOUT_SUFFIX`/`isRealMessage` (`enrollment.js:59-82`) — direction logic and the Step 1.2 TCPA fix — untouchable. Also: `ghl.js` is edited by sub-task 13 (`emailFrom` + comments) — keep clear of `fetchMessages`/the direction parsers. |
| **#8** (`[BOOKED]` needs `researchData` AND `scanResults` present; the `NEVER BOOK BEFORE QUALIFYING` / `HOSTILE OPT-OUT → [DECLINED]` safety blocks) | **Adjacency only.** | Sub-tasks 2 & 3 remove *fields within* `researchData`, not `researchData` itself → the `[BOOKED]` guard at `server.js:~1625` (presence check) is unaffected. Do **not** touch that guard. No safety-block edits in Step 4. |
| **#1** (scripted variants are deliberately distinct — never reconcile/dedupe) | **Not applicable.** | No variant prompt *content* is edited (Step 5). `config.SCRIPTED_VARIANTS` untouched. `structuredVariants` is *deleted from the DB* (Decision A), leaving the empty array in the file — not "reconciling variants". |
| **#7** (variant prompts cross-reference their own step numbers — renumber one ref, renumber all) | **Not applicable** *unless* Layer D of sub-task 15 renames `[PRACTICE_DETECTED]`/`practice_detection` — and even then, no *step numbers* change; the marker rename is a find-replace across `server.js` + `variant-builder.js` (18 sites), with no live variant referencing it. The `enrollment.js` analysis prompt *describes* a flow but defines/renumbers no conversation step. |
| **#3** (admin fetches must use `fetchWithTimeout`) | **Not applicable.** | Step 4 adds no `fetch(...)` calls. (Relevant later — PHASE_1_PLAN Step 8 dashboard panels.) |
| **#4** (DB writes live immediately; code/file changes ship on Publish) | Background only. | For GMN local dev, `DATABASE_URL` is the live Neon DB and `DEV_MODE=true`. The sub-task-5 `DELETE` and the sub-task-15 `RENAME COLUMN` (if chosen) are live DB writes — intended. |

---

## 6. Open design questions for the execution phase

*(v1 questions answered by Decisions A and B have been dropped.)*

**The prompt-rewrite cluster — every design call needed for sub-task 4 (`enrollment.js`) and sub-task 8 (`prompts.js` email/brain) in one place** (these two are written together, last):
1. **`enrollment.js` output contract:** keep `{ currentStep: 0-N, enrollPosition: 2-5, reasoning: string }` (consumed by `processContact` → `conversations.update({currentStep})` + `scheduleJob({position})` + `POSITION_DELAY`)? Or expand it (e.g. `detectedObjection`, `qualificationSignals[]`)? — expanding means writing new consumer code, out of Step 4's scope. *Recommend: keep the contract.*
2. **The GMN conversation step flow** the `enrollment.js` prompt maps onto — use PHASE_1_PLAN §5.2's template (1 opener / 2 qualifying / 3 `gym_detection` / 4 data-reveal / 5 pain-confirm + objections / 6 `vsl_send` / 7 booking)? Confirm the canonical step list (Step 5 will build to it).
3. **Gym-owner *intent* signals** the `enrollment.js` prompt should detect (e.g. "asks about pricing", "mentions a current marketing agency", "says they're growing / opening a location", "asks how it works", "asks who you are")?
4. **Common gym-owner *objections*** it should recognize (e.g. "I already have a marketing person/agency", "I tried texting/automation before", "I'm too busy to onboard", "my members won't respond to texts", "what does it cost", "we're a small studio, not a big-box gym")?
5. **`enrollment.js` heuristics:** rip out the keyword fingerprints entirely (rely on Claude analysis; the count-based `enrollPosition` logic stays) per PHASE_1_PLAN §4.5, or rewrite them? — no GMN conversation data to fingerprint against yet. *Recommend: rip out for now, revisit when there is data.*
6. **`brain.analysisPrompt` campaign description** (sub-task 8): confirm the exact one-liner for GMN's offer to drop into the "the campaign is…" / "on the backend sales call the team sells:" sentences — the `data/industry.json` `productDescription` is a good starting point, but the analysis prompt wants the *backend-call* offer specifically (member reactivation, referral systems, review collection, trainer/front-desk playbooks, done-for-you marketing, coaching). Does it differ from the `industry.json` text?
7. **`email.system` / `email.*` rewrites** (sub-task 8): tokenize fully (`{{audienceDescriptor}}`, `{{brandName}}`) like `followup.*`, or hardcode "gym owners and fitness-clinic owners" / "GMN"? *Recommend: tokenize* — it self-heals from `data/industry.json` and matches the existing pattern.
8. Confirm the GMN conversation flow's **step count** so the `enrollment.js` prompt is internally consistent (fixing the existing "6-step vs 8-step" bug).

**Sub-task 15 (the `practiceName` rename) — two blocking sub-decisions:**
9. **DB column:** `ALTER TABLE contacts RENAME COLUMN practice_name TO gym_name` (cleaner, but a prod DB change — trivial on the fresh local DB), or leave the column `practice_name` and only rename the JS identifier? *Recommend: rename the column — fresh DB, no downside.*
10. **The `[PRACTICE_DETECTED]` AI marker + `practice_detection` step type:** rename to `[GYM_DETECTED]` / `gym_detection` (cheap now — no live variant references it — and expensive after Step 5 builds variants that hardcode it), or keep the marker as an internal protocol token? *Recommend: rename now.* And the new name: `[GYM_DETECTED]` / `gym_detection` (proposed) — confirm.

**Sub-task 13 (`ampifyform:` / Ampify references):**
11. **New tag prefix slug:** `gmnform:` (matches the old style — no hyphen) vs `gmn-form:` vs something else? And: keep `ampifyform:` as a legacy alias in `LEAD_FORM_PREFIXES` (purely defensive — there is no legacy data), or drop it clean? *Recommend: `gmnform:`, drop the alias.*
12. **Outbound email From-address** (`ghl.js:208`): what is GMN's real sending address? (`contact@gymmembersnow.com` placeholder until confirmed — this is the one spot where a wrong unconfirmed value would actually misbehave if GHL is later connected.)

**Sub-task 6 (gym preset) + sub-task 1 (chrome):**
13. `brandName` in the preset is `"Andy Gundlach's team"` — the apostrophe forces a double-quoted JS string in the trap-#2 zone (breaking the other presets' single-quoted convention). Accept the double-quote, change the brand name to something apostrophe-free, or leave `brandName:''` in the *preset* and keep the real name only in `data/industry.json`? Also: keep the full 9 pain points / 8 value props in the chip, or trim to ~3 each like the other presets?
14. Persona name (Q7 still nominally TBD; `data/industry.json` already uses `"Josh"`): use "Josh" for the `brandPersona` placeholder at `server.js:7043` and in the gym preset, or keep it generic ("e.g. <first name>")? And the brand string everywhere — "GMN" vs "Gym Members Now" vs "GMN Engine" (the draft uses "GMN Engine" for the tool's own chrome and "GMN" for `brandName`)?

**Sub-task 9 (`config.js` keywords):**
15. `competitorKeyword` — `'gym'` covers big-box + most independents; if GMN also targets boutique studios / CrossFit boxes, consider `'gym fitness studio'` or similar. Confirm the search term that best identifies GMN's prospect category on Google Maps.

**Cross-cutting:**
16. If a fresh grep at execution time turns up an audiology/Ampify/medical-vocabulary string in a *live* `.js`/`.json` file not covered by sub-tasks 1–15, flag it then for a decision — do not silently scope it in. (Known-and-intentionally-left: `replit.md`, `docs/`, `archived/**`, `replit.nix`/`.replit`.)

— end of plan v2 —
