# GMN Engine — Phase 1 Fork Audit

Read-only audit of the forked codebase (Sidney's white-label SMS engine) against the GMN B2B fitness target. No code was modified producing this document.

**Headline finding before you read further:** the "white-label cut (2026-05-02)" wiped `config.js` and `data/prompts.json`, but it did **not** wipe `prompts.js`. The `DEFAULTS` object in `prompts.js` still contains the full audiology **Variant E** branching scripts (insurance/eligibility, TruHearing/UHCH referrals, faxes/Sycle, after-hours), the audiology email prompts, and the audiology learning-brain prompt — and `conversationPrompt.E.enabled` defaults to `'true'`. So with the current empty `data/prompts.json`, the system would serve audiology copy out of the box. CLAUDE.md's git log shows commit `70d5c68 "Remove Variant E from the system and related analytics"`, but Variant E is still wired into `server.js`, `followups.js`, `conversations.js`, `brain.js`, and `prompts.js`. **This contradiction needs resolving (Question 1).**

Also note: `data/industry.json` currently holds leftover **dental test data** (`"TestCo"`, `"Sam"`, `"We text dormant patients on autopilot."`), and `data/prompts.json` is `{"structuredVariants": "{}"}` — the value is a JSON *string*, not an array (harmless because `variant-builder.js` guards with `Array.isArray`, but it should be `[]`).

---

## 1. Strip list — audiology-specific references

Grouped by file. "Proposed GMN equivalent" is a direction, not final copy — your B2B fitness copywriting drives the actual text.

### `prompts.js` — the big one (hardcoded `DEFAULTS` + `PROMPT_META`)

| Lines | Current | Proposed |
|---|---|---|
| `156–208` | `conversationPrompt.E.shared` — `"You are Sidney, an AI assistant for Ampify AI, texting audiology practice owners."`; `[PRACTICE_DETECTED:Sunrise Hearing\|123 Main St\|Austin]` example; persona "Sidney, Ampify AI"; step ranges 10–89 | Either delete the whole Variant E block (Q1) or rewrite: persona = GMN's name/brand, audience = gym/clinic owners, PRACTICE_DETECTED example = a gym name. |
| `210–244` | `conversationPrompt.E.opening` — `"Most audiologists can't handle what I'm about to show you"`; pain-point menu A/B/C/D = insurance eligibility checks / new patients vs third-party referrals / faxes & intake forms / 2 extra hours of peace | Rewrite menu for gym pains (member churn / lead-to-paid conversion / front-desk overload / owner time) or delete with Variant E. |
| `246–284` | `conversationPrompt.E.branchA` — insurance / eligibility / Availity / NaviNet / "local payers" / "eligibility check" | Delete or repurpose; no audiology-insurance analog for gyms. |
| `286–335` | `conversationPrompt.E.branchB` — `"Relying on those TruHearing or UHCH referrals"`, `"booked hearing tests"`, `"Gray Gold"` database mining, `"where you're losing patients to competitors"`, "Visibility Map", "Revenue Recovery Map" | Delete or repurpose (lead-list reactivation is conceptually portable to gyms; the named entities are not). |
| `337–375` | `conversationPrompt.E.branchC` — faxes / intake forms / `Blueprint`/`Sycle` (audiology PM systems) / "referral forms" | Delete or repurpose. |
| `377–417` | `conversationPrompt.E.branchD` — `"stuck being the doctor AND the office manager"`, `"Do you take my insurance?"` virtual front desk | Delete or repurpose ("doctor AND office manager" → "coach AND business owner"). |
| `62–103` | `PROMPT_META` entries for `conversationPrompt.E.*` — labels/descriptions: `"Branch B (New Patients / Leads)"`, `"new patients, ads, referrals, TruHearing, UHCH"`, `"faxes, intake forms"`, `"insurance, eligibility checks, Availity, NaviNet"` | Delete with Variant E, or relabel for GMN branches. |
| `422` | `email.system` — `"You are a sales assistant emailing audiology practice owners on behalf of Ampify AI."` | `"...emailing gym and fitness-clinic owners on behalf of {{brandName}}."` (better: tokenize via `{{audienceDescriptor}}`/`{{brandName}}` like `followup.*` already does). |
| `432` | `email.hook` — `"Mention a specific gap or opportunity (dormant patients, expiring benefits, competitors gaining ground)"` | `"(at-risk members, stalled trial sign-ups, a competitor gym gaining reviews)"` |
| `445` | `email.nurture` — `"a recent patient review, expiring insurance benefits, or a nearby referral source"` | `"a recent member review, a seasonal sign-up window, a nearby competitor"` |
| `463–~480` | `brain.analysisPrompt` — `"AI-powered SMS conversation with independent audiology practice owners ... reactivating dormant patients in the owner's database, optimizing their Google My Business profile, driving reviews ... front-desk workload"` | Rewrite the campaign description to GMN's actual offer (marketing + AI implementation for gyms — get the real one-liner from you). |
| `9, 11–12` | Header doc comment — `"Discovery script (steps 1-9)"`, `"claude-sonnet"` | Cosmetic; update when you touch the file. |

> **Note:** `followup.hook` / `followup.nurture` / `followup.system` are already tokenized via `config.followUpPrompts` (`{{audienceDescriptor}}`, `{{painPoints}}`, `{{valueProps}}`) — they self-heal once `data/industry.json` is set. No strip needed there.

### `config.js`

| Lines | Current | Proposed |
|---|---|---|
| `10` | Comment: `// (e.g. "audiologist", "dentist", "real estate agent", "restaurant").` | Cosmetic — add "gym", "fitness studio". |
| `46–48` | `keyword / scanKeyword / competitorKeyword: 'local business'` | Set to `'gym'` / `'fitness studio'` (or whatever search term identifies the prospect's category) — *only if* the visibility scan is kept (see §4 / Q3). |
| `57, 75, 99` | `systemPrompt`, `followUpPrompts.hook`, `followUpPrompts.nurture` use `{{audienceDescriptor}}` etc. — already tokenized | No strip; just confirm tokens resolve once industry.json is GMN. |
| `127` | `SCRIPTED_VARIANTS: []` | Decide GMN variant set (Q2). |

### `research.js` — heavily audiology

| Lines | Current | Proposed |
|---|---|---|
| `3–43` | `METRO_65_PLUS` lookup table + `get65PlusEstimate()` — "65+ population estimates ... (appropriate for audiology catchment)" | Delete (no gym analog) — or, if you want a generic "local population" signal, replace with total-population data. Low value either way. |
| `61–111` | `getCensusData()` — Census ACS query for the 65+ age cohort | Delete with the above, or repurpose to a generic population query. |
| `135` | `author: r.author_name \|\| 'A patient'` | `'A member'` (or `'A customer'`). |
| `209–251` | `findReferralSources()` — `REFERRAL_KEYWORDS = ['ear nose throat doctor', 'audiologist referral', 'health insurance']`; comment "ENTs, audiologist referrals" | Delete, or repurpose to gym-adjacent businesses (physios, nutritionists, PTs) — low confidence it adds value (Q4). |
| `261–288` | Mock `researchData` — competitors `"Clear Hearing Center"`, `"Bay Audiology"`, `"Advanced Hearing Solutions"`; mock reviews "hear my grandkids again", "hearing concerns"; `populationOver65`, `estimatedHearingLoss: Math.round(pop65 * 0.33)` | Mock with gym names; drop `populationOver65`/`estimatedHearingLoss`. |
| `383–403` | Live `researchData` — `competitorSummary: "...ranked Nth out of X practices by review count"`, `populationOver65`, `estimatedHearingLoss` | `"...ranked Nth out of X gyms by review count"`; drop the 65+/hearing-loss fields. **Downstream coupling:** the AI context block, `server.js sendScanVisibilityMessage`, `buildScanPage`, and `enrollment.js` all read this shape — change carefully. |

### `scanner.js`

| Lines | Current | Proposed |
|---|---|---|
| `270–291` | `generateMockResults()` — `"Clear Hearing Center"`, `"Bay Audiology"`, `"Advanced Hearing Solutions"` | Gym names. |

### `enrollment.js`

| Lines | Current | Proposed |
|---|---|---|
| `79–106` | `claudeAnalyseConversation()` prompt — `"analyzing an SMS conversation between a sales rep and an audiology practice owner"`; "6-step SMS sales flow" steps: `"Step 2: Benefits angle (insurance resets, percentage not captured)"`, `"Step 3: Dormant patients angle (patients not seen in 2+ years)"`, `"Step 4: Practice research reveal + booking ask"`, `"Step 5: Founder intro / scheduling (Sid pitch...)"` | Rewrite the prompt + step descriptions to match GMN's actual conversation flow (depends on §1 Variant E decision + the new variants you build). |
| `163–179` | `heuristicAnalysis()` keyword detectors — `"showing up on that map"`, `"percentage actually went through with it"`, `"sid, our founder"`, `"i pulled up"`, `"percentage actually went through"` | These match phrases from the old audiology script and will match nothing in GMN conversations. Either rip out the keyword heuristics (rely on Claude analysis) or rewrite for the GMN flow. |

### `server.js`

| Lines | Current | Proposed |
|---|---|---|
| `114–115` | Comment: `// • Variant B → hearing-aid percentage question (Step 5)` / `// Variant A/C → data reveal / booking step` | Cosmetic — update when you rework the post-`[PRACTICE_DETECTED]` flow. |
| `269` | `sendScanVisibilityMessage()` fallback string: `"...people looking for audiologists a few miles out aren't finding you."` | `"...people searching for a gym a few miles out aren't finding you."` (only if the scan is kept — Q3). |
| `2046` | `/api/generate`: `userMessage = "Generate a message for this prospect's audiology practice.\n\nPractice name: ${practiceName}..."` | `"...this prospect's gym/fitness business."` — or delete the whole endpoint (see §4, GMB One-Shot Generator). |
| `3286` | Playground mock: `competitors: [competitorName, 'Premier Audiology', 'Beltone']` (Beltone = hearing-aid brand) | Gym names. |
| `6721` | Conversation Tester page badge: `<div class="badge">Built exclusively for audiology practices</div>` | Just wrong/stale — `"GMN internal sales engine"` or remove the badge. |
| `7242` | Industry-setup placeholder: `customerNoun` → `"e.g. patient, client, guest"` | `"e.g. member, client, guest"` (cosmetic; it's a placeholder for *new* configs). |
| `7252, 7286` | `productDescription` placeholder + `EXAMPLES.dental` scaffold (`"wake up your dormant patient list"`, etc.) | Keep `EXAMPLES.gym` (already present at `server.js:7289`); make it the first/default chip; the dental/restaurant/realestate scaffolds are harmless white-label examples (keep and flag, do not strip). |
| `7409–7410` | Prompt-editor token reference: `{{customerNoun}}` → `"e.g. patient, guest, member"`, `{{audienceDescriptor}}` → `"e.g. dental practice owners"` | Cosmetic. |
| `4136, 4304, 4318` | Console banner / page `<title>` / header logo: `"Powered Up AI — GMB Message Generator"`, `"Admin Dashboard — Powered Up AI"`, logo `"Powered Up AI"` | Rebrand (Q7). |

### Data files

| File | Current | Proposed |
|---|---|---|
| `data/industry.json` | `industryName:"dental"`, `audienceDescriptor:"dental practices"`, `customerNoun:"patient"`, `brandName:"TestCo"`, `brandPersona:"Sam"`, `productDescription:"We text dormant patients on autopilot."`, `painPoints:"- empty chairs\n- low reviews"`, `valueProps:"- 30+ recovered appts"`, `vslUrl:"https://example.com/v"` | Replace entirely with GMN/fitness config: real brand name, persona, `industryName:"fitness"`, `audienceDescriptor:"gym owners and fitness-clinic operators"`, `businessNoun:"gym"` (or `"facility"`), `customerNoun:"member"`, real `productDescription` (GMN's actual offer), real pain points / value props, real `vslUrl`. **This is the single highest-leverage strip — it re-grounds every prompt via `industry.interpolate`.** |
| `data/prompts.json` | `{"structuredVariants": "{}"}` (value is a string!) | `{"structuredVariants": []}`; then build GMN variant(s) in `/admin/variants`. |
| `data/conversations.json` | `{}` | Fine — empty. |
| `package.json` | `"name":"powered-up-lead-magnet"`, `"description":"Audiology sales demo tool with streaming AI chat"` | `"name":"gmn-engine"`, `"description":"GMN internal B2B sales engine — inbound nurture + outbound crew"`. |

---

## 2. Keep as-is — industry-agnostic infrastructure

| Module / feature | What it does & why it's load-bearing | replit.md traps that touch it |
|---|---|---|
| `reconciliation.js` (webhook reconciliation poller) | Polls GHL every 30s for active contacts and replays missed inbound webhooks through `handleInbound` — the safety net for GHL's best-effort webhook delivery. Without it, a dropped inbound webhook = the AI goes permanently silent on a hot lead. | **#5** (GHL webhook misses), **#9** (the poller's architecture, dedup, Carson regression, tuning knobs). |
| `outbound-lock.js` (per-contact SEND→PERSIST lock) | Serializes the "send to GHL → persist exchange" critical section per `contactId` so a fast prospect reply between those two steps can't make `handleInbound` read stale state and re-send the opener. Self-clears on 60s timeout. | The "**Race-Condition Protection (outbound-lock.js)**" section; **#8** (the silence-nudge dedup acquires it; "Wrapped flows ... any change must preserve these"); **#10** (the duplicate-opener regression is the exact scenario it guards). |
| `exchanges` + `brain_messages` schema (`conversations.js`, `brain.js`) | `exchanges` = raw per-message conversation log (with GHL `message_id` for dedup); `brain_messages` = the analytics ledger and the **source of truth for booking stats**. Both round-trip on every boot. | **#9** (`exchanges.message_id` partial unique index + atomic claim — "the linchpin"); **#10** (`m.type === 1/2` direction bug lived in the parsers that feed `exchanges`); the "**Outbound Message Markers**" + "**Booking Flow**" sections (`brain_messages.booked` is the only stat-grade booking signal; `contacts.paused_reason` classification). |
| `optouts.js` (opt-out keyword detection + blocklist) | `OPT_OUT_KEYWORDS` regex + the `optouts` table; re-checked at multiple points (webhook, poller, follow-up sends). TCPA compliance — not optional. | **#8** (the `HOSTILE / AGGRESSIVE OPT-OUT — IMMEDIATE [DECLINED]` prompt block + `optouts.isOptedOut` re-check in the poller flow); CLAUDE.md coding rule "ALWAYS strip TCPA opt-out suffix from GHL outbound history". |
| Bayesian P(Best) Monte Carlo (`server.js:3061–3114`) | Models each variant's true booking rate as `Beta(bookings+1, non-bookings+1)`, runs 50k simulated worlds, reports the fraction each variant "wins" — the proper way to call an A/B/C/D test. Pure math, fully industry-agnostic. (Currently has nothing to compute because `SCRIPTED_VARIANTS: []` — comes alive when GMN variants exist.) | No numbered trap, but **#1** ("scripted variants are intentionally distinct — never reconcile them") is the adjacency: P(Best) operates over `config.SCRIPTED_VARIANTS` and the per-variant analytics in `brain.js`. |
| `industry.js` + `variant-builder.js` (the white-label layer) | `industry.interpolate()` substitutes `{{tokens}}` into every prompt; `variant-builder.js compileVariant()` stacks industry context + shared output rules + numbered steps into a system prompt. This *is the mechanism* GMN uses to install its own copy — keeping it is the whole point. | The "**White-Label Architecture**" section; **#2**-adjacent (the Variant Builder *admin page* is part of the `server.js` mega-template). |
| `prompts.js` file↔DB sync (`syncFromDb` / `syncToDb`) | Bidirectional auto-heal: file mtime vs `MAX(ai_prompts.updated_at)`, newer side wins. Lets a fresh deploy's file content win over stale DB rows, and lets UI edits survive restarts. | **#6** (the entire trap is about this — keep it; just swap the *content* of `DEFAULTS`). |
| `followups.js` scheduler / cadence / `_dbAtomicClaim` | The persisted follow-up job queue, the 7pm–9pm local send window, the 5-min silence nudge, and the 3-layer dedup (`getDueJobs` ID dedup → in-lock re-check → DB atomic claim). The *copy* it sends is config-driven; the *mechanism* is generic. | **#8** (the silence-nudge 3-layer defense, the server-side outbound-quality guard); the "**Race-Condition Protection**" section ("Wrapped flows ... `sendHook1Static`, `sendFollowUp`"). |
| `ghl.js` (GHL API wrapper) | `fetchContact / fetchMessages / sendMessage / sendEmail / getOrCreateConversation / fetchContactsByTag`. GHL is the CRM for *both* the Inbound Nurture and the future Outbound Crew module — this stays. | **#10** (`fetchMessages` is one of the parsers — direction is `m.direction` / `m.messageType`, never `m.type === N`); **#5** (webhook miss recovery uses `fetchMessages`). |
| `spend.js` (per-contact $1 Claude cap) | Tracks token cost per contact, hard-caps at $1, cancels pending jobs on cap-hit. Cost control — generic. | No numbered trap. (Relevant given the local key has only $20 in credits.) |
| `conversations.js` (contact state cache + DB) | In-memory `contactMap` synced to the `contacts` table; restores on boot; carries `variant`, `lead_form`, `paused_reason`, and `extra` (researchData, scanResults, branch locks). | **#9** (the Carson regression — `extra->>'conversationId'`); the "**Booking Flow**" section (`paused_reason` classification); **#6**-adjacent. |
| `sessions.js` | Trivial in-memory session store for the (transient) research/scan pipeline. Keep — it's 26 lines. | None. |
| `enrollment.js` *machinery* (the `runEnrollment` loop, `isInbound` / `isRealMessage`) | The bulk-enroll-from-GHL-tag pipeline. The Claude analysis *prompt* inside it is audiology (→ §1), but the loop, batching, variant assignment, and message-parsing helpers are generic. | **#10** (`isInbound` was a fix site — "If you find a new parser site, audit it against this rule"); **#5**-adjacent (replays GHL history). ⚠ `isRealMessage` at line 58 currently *drops* messages containing `"reply STOP to unsubscribe"` — that conflicts with CLAUDE.md's "ALWAYS strip TCPA opt-out suffix ... never drop the message"; flagged in §6. |

---

## 3. Refit list — structure stays, GMN content swaps in

These files/areas are *not* vestigial and *not* pure infra — they need GMN copy poured into an existing shape.

| Target | What stays | What gets swapped |
|---|---|---|
| `data/industry.json` | The schema (`industry.js DEFAULTS` keys) | All values → GMN/fitness (see §1). |
| `data/prompts.json` → `structuredVariants` | The structured-variant schema (`{id,name,steps[]}`, step types `text` / `practice_detection` / `vsl_send`) | Build GMN conversation flow(s) here via `/admin/variants` (Q2, Q9). |
| `prompts.js` `PROMPT_META` + `DEFAULTS` | The key names, the label/description structure, the file↔DB sync | The audiology default *content* (email prompts, brain analysis prompt, Variant E block) → GMN copy or removal. |
| `config.js` | The structural keys (`scanRadius`, `gridSize`, `competitorRadius`, the tokenized prompt templates) | `keyword`/`scanKeyword`/`competitorKeyword` → gym terms (if scan kept); `SCRIPTED_VARIANTS` → GMN set. |
| Admin UI page chrome (`server.js` `buildAdminDashboardPage`, `buildPromptEditorPage`, `buildPlaygroundPage`, `buildIndustrySetupPage`, `buildVariantBuilderPage`, `buildEnrollPage`, `buildSetupGuidePage`; `public/index.html`) | The HTML/CSS structure, the JS behavior, the route wiring | `<title>`s, header logos, the "Built exclusively for audiology practices" badge (`6721`), the brand name throughout ("Powered Up AI" / "White-Label SMS Engine" / "Ampify AI" / "Sidney") → GMN brand (Q7). `public/index.html` is a generic white-label landing page — for an internal tool embedded in GHL it's largely irrelevant; lowest priority. |
| `EXAMPLES` object in the industry-setup page (`server.js:7285–7291`) | The example-chip mechanism | Promote `EXAMPLES.gym` to the default; keep dental/restaurant/realestate as harmless white-label scaffolds (keep-and-flag, don't strip). |
| Funnel stage labels — `brain.js STAGE_MAP` (`'gap-exposure'`, `'data-reveal'`, `'booking'`, `'booked'`) + `server.js stageLabel()` (`'Hook X of 4'`, `'Bi-weekly'`, `'Monthly'`) | `stageLabel()` is generic and fine. | `STAGE_MAP` maps step numbers to labels that only made sense for the old fixed audiology script; with the structured builder, steps are arbitrary. Low risk to rename, but flag it as semi-vestigial — once GMN variants exist, decide what (if anything) these labels should mean. |
| `enrollment.js` analysis prompt + heuristics | The enrollment loop | The Claude prompt's flow description + the keyword detectors → GMN flow (see §1). |

---

## 4. Vestigial / decide-now

### DataForSEO — **KEEP, FLAG (product decision required — Q3)**

Used in exactly one place: `scanner.js` (`searchPointDataForSEO`, `searchPointWithFallback`) as the **primary source** for the "visibility scan" — a grid of points around the prospect's business, querying Google Maps SERP rank for `scanKeyword` at each point. Falls back to Google Places Nearby Search, then to mock data. Gated behind `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD` (currently unset → it no-ops today).

- It is **not audiology-specific tooling.** It returns generic Google-Maps-SERP ranking data. The "is any of its data useful for B2B fitness outreach?" question reduces to: *does GMN's offer to gyms include local search / Google Business Profile visibility?* Gyms absolutely care about ranking for "gym near me" — so the data is potentially very relevant. But that depends on GMN's actual service mix, which I can't determine from the codebase.
- **Recommendation:** keep it; leave the env vars unset until Q3 is answered. If GMN's pitch includes local SEO → repurpose (just change `scanKeyword`). If GMN's pitch is purely "reactivate dropped members + AI front desk + lead nurture" with no local-SEO component → the *entire* scan/research/`[PRACTICE_DETECTED]` pipeline becomes dead weight (a large surface: `scanner.js`, `research.js`, `server.js` lines ~100–290 + ~1753–1868 + `buildScanPage`, plus the `practice_detection` step type in `variant-builder.js`) and should be removed — **and the `[BOOKED]` guard at `server.js:1626` must be changed too** (it currently *requires* `researchData` AND `scanResults` to be present before honoring `[BOOKED]` — see §6, trap #8 — so killing the scan without touching that guard would silently block every booking).

### Google Places — **REPURPOSE**

Used in `research.js` and as the `scanner.js` fallback for:
1. **Prospect's own Google Business Profile lookup** (name, rating, review count, photos, website, hours, geometry) — *generic*, useful for any local business including gyms.
2. **Competitor discovery near the prospect** (`config.competitorKeyword`, proximity-weighted) — *generic*.
3. **`findReferralSources()`** — ENTs, "audiologist referral", "health insurance" offices within 2km — **purely audiology**, no gym analog.
4. **`getCensusData()` / `get65PlusEstimate()` / `estimatedHearingLoss`** — the 65+ demographic and the `× 0.33` hearing-loss math — **purely audiology**.
5. **Grid-scan fallback** (`searchPoint`) — *generic*.

- "Can it be repurposed for B2B gym lead *discovery*?" — partial yes, with a caveat: the GBP-lookup + competitor-discovery is exactly the enrichment a gym sales pitch wants ("here's how you rank vs. [competitor gym] on Google"). But this layer enriches a **known, opted-in inbound lead** (it fires on `[PRACTICE_DETECTED]`); it does **not discover new prospect gyms** — that's Phase 2's Outbound Crew (Outscraper / Apollo / Clay CSV ingestion). So "repurpose for lead discovery" is really "the Phase 2 Scout agent could optionally use Google Places for enrichment" — a Phase 2 design question, not a Phase 1 strip.
- **Recommendation:** keep #1, #2, #5 (swap `competitorKeyword` + mock names); **kill #3** (or repurpose to gym-adjacent businesses — Q4, low confidence it adds value); **kill #4** outright (drop `populationOver65` / `estimatedHearingLoss` from the `researchData` shape and from the AI context block).

### Other vestigial flags

- **Variant E (entire branching architecture)** — `prompts.js` DEFAULTS (`conversationPrompt.E.*`), `server.js` (`buildVariantESystemPrompt`, `_variantEBranchForStep`, lines ~558–602 / ~647 / ~1306–1311), `conversations.js:111–114` (`variantEBranch` lock + `extra`), `followups.js:~1180` (Variant E "Data Payload" job), `brain.js:714/969` (`[...config.SCRIPTED_VARIANTS, 'E']` in analytics), `prompts.js:151` (`conversationPrompt.E.enabled: 'true'`). CLAUDE.md's git log says commit `70d5c68` "Remove Variant E from the system and related analytics" — but it's still everywhere. **This is the #1 thing to resolve (Q1).** Either it's a partial/abandoned removal (finish it: rip out the E code paths) or there's an in-flight refactor. If GMN wants the *branching* concept, note the structured builder only does linear steps — branching needs new step types.
- **GMB One-Shot Generator** (`/api/generate` + `config.systemPrompt` + `server.js:2005–2099`) — a standalone "generate one message from Google Maps data" endpoint. Not part of the SMS conversation flow; no admin page links it; the landing page doesn't link it. Looks like a leftover from the "audiology sales demo tool" era. **Flag — likely kill** unless you want a one-off message-drafting tool (Q5).
- **Scan visualization page** (`/scan/:sessionId` + `buildScanPage` + `server.js:2103–2131 / 4222–4297`) — the Leaflet map render of the visibility grid. Keep iff the scan is kept (Q3).
- **`scripts/` one-off migrations** — `add-declined-marker.js`, `fix-variant-b-steps.js`, `fix-variant-c-steps.js`, `fix-variant-b-opening-rule.js`, `move-hearing-aid-q-into-prompts.js`, `apply-prompt-hardening.js`, `enroll-existing-leads.js`, `sim-roleplay.js`, `test-off-script-handlers.js`. Every one references audiology variant content that no longer exists in `config.js`/`data/prompts.json`. They already ran on Sidney's prod. **Flag — archive for reference, do not run.** (`scripts/prompts-sync-file-to-db.js` is the exception — it's `npm run prompts:push`, still useful.)
- **Root-level artifacts** — `attached_assets/` (75 files), `zipFile.zip` (5.4 MB), `rp_B.txt` / `rp_C.txt` / `rp_D.txt` / `rt_C.txt` / `rt_D.txt` / `stress_*.txt`. Not referenced by any running code (replit.md's stress harnesses live in `/tmp/`, not these). **Flag — likely delete** (Q8; archive `zipFile.zip` first if it's the only copy of anything).
- **`docs/powered-up-ai-full-breakdown.md` + `(copy).md`** — documents the old audiology product. Reference material; stale for GMN. Keep, mark stale.
- **`replit.nix` / `.replit`** — Replit-specific config; CLAUDE.md says we're running locally + Neon now. Harmless to leave; remove if you fully cut Replit.

---

## 5. Admin UI mega-template (`server.js`) — extraction plan

`server.js` is **7,747 lines**; roughly **3,700 of those** are the eight `buildXPage()` HTML/CSS/JS template-literal functions (`buildScanPage`, `buildAdminDashboardPage` ≈ 1,376 lines, `buildPromptEditorPage` ≈ 703, `buildEnrollPage` ≈ 241, `buildPlaygroundPage` ≈ 527, `buildIndustrySetupPage` ≈ 177, `buildVariantBuilderPage` ≈ 319, `buildSetupGuidePage` ≈ 100). The API/route layer is *already* separated — `/api/...` and `/admin/api/...` handlers return JSON; the page routes just call `buildXPage()` + `res.send()`.

### Quote-nesting risk audit (trap #2 territory)

Per replit.md trap #2: HTML strings that contain JS strings that contain HTML, *inside the outer backtick template* — contractions, `\'`, raw `\n`/`\t`, `JSON.stringify` into attributes, and inner backtick templates inside `<script>` helper functions. Every spot below lives inside an outer `` return `<!DOCTYPE html>...` `` literal:

1. **`buildAdminDashboardPage` `<script>` block (≈ lines 4630–5670, ~1,000 lines of client JS)** — the largest exposure. HTML-building helpers inside it:
   - `issueCard()` (4663–4685) — string concat with `&#39;` in `onclick` (the trap-#2 fix pattern). ✅ currently correct, but fragile.
   - `replaySearchContacts()` (5140–5159) — `&#39;` in `onclick` **and** `onmouseover="this.style.background=&#39;rgba(...)&#39;"` — this is the *exact* construct that crashed prod on 2026-04-26 per trap #2. ✅ currently correct.
   - `contactCell()` (4836–4842), `statusBadge()` (4849–4853), `renderQueue()` (4856+), `loadBrain()` (5237+), `loadSpend()` (5533+), `loadAwaitingConfirmation()`, `loadReconciliation()`, `loadFollowups()` — **these use inner backtick template literals** (`` `<div ...>${x}</div>` ``). Trap #2's hard rule: *"all JS helper functions added inside the admin `<script>` block must use plain string concatenation — never backtick template literals."* The current code is in technical violation of that rule in several places; it works because Node happens to parse it, but it's the fragile pattern the trap exists to prevent.
   - `loadBrain()` line 5268: `onclick="setLeadFormFilter(${JSON.stringify(f).replace(/"/g, '&quot;')})"` — the trap-#2 "JSON.stringify into HTML attribute" fix, applied. ✅
   - `loadBrain()` line 5473: `qi.text.split('\\n\\n')` — the double-escaped `\n` (trap #2's "string escape sequences must be double-escaped"). This is the construct that crashed the dashboard on 2026-05-01 (then at line 5351). ✅ currently `\\n\\n`.
   - `escHtml()` defined here (line 4765). **`buildPromptEditorPage` is a separate page with its own `<script>` — if it references `escHtml` without redefining it, you get `escHtml is not defined`, which is exactly the live bug CLAUDE.md lists ("Failed to load stats: escHtml is not defined" on the prompt editor).** Worth confirming/fixing during extraction.
2. **`buildPromptEditorPage` `<script>` (5675–6378)** — same class of risk; plus the suspected `escHtml` bug above.
3. **`buildPlaygroundPage` `<script>` (6621–7148)** — same class.
4. **`buildIndustrySetupPage` `<script>` (7279–7321)** — the `EXAMPLES` object (7286–7289) is full of `\\n`-escaped strings (trap #2's double-escape rule). Also `const ADMIN_KEY = ${JSON.stringify(adminKey)};` (the JSON-into-JS-literal pattern, safe here because adminKey is known-clean).
5. **`buildEnrollPage` (6379–6620)**, **`buildVariantBuilderPage` (7327–7646)**, **`buildScanPage` (4222–4297)** — `buildScanPage` has inner backtick templates at 4277–4289 (`L.divIcon({...html:\`<div ...>${...}</div>\`...})`), nested inside `<script>` inside the outer backtick. **`buildSetupGuidePage`** has a tiny inline `<script>` (7717–7720) — low risk.
6. **Contraction sweep** — trap #2 says every single-quoted JS string inside the outer backtick must avoid `hasn't / can't / won't / doesn't / you're / it's / I'll / we're`. A grep of all eight `<script>` blocks for contractions is required before *any* user-facing string edit in these functions, plus the `node -e` parse-check trap #2 prescribes.

### Layered extraction plan

**Layer 1 — move the `buildXPage()` functions out of `server.js` into a `views/` directory.** (lowest risk, biggest win)
- Cut each `buildXPage()` function verbatim into `views/admin-dashboard.js`, `views/prompt-editor.js`, etc., `module.exports` it, `require()` it from `server.js`. The template strings move byte-for-byte; the `${}` interpolations still work (they're just function parameters). No logic changes.
- Result: `server.js` ≈ 7,700 → ≈ 4,000 lines; the entire trap-#2 surface is now isolated in `views/` files that can be reasoned about (and parse-checked) per page; the suspected `escHtml`-not-defined bug becomes obvious once each page's `<script>` is in its own file.
- **Effort: ~2–4 hours** (mechanical move + fix `require` paths + smoke-test that all eight pages still render). Do this *before* adding the new GMN dashboard panels (DND/opt-out, cost-per-booking) so they land in clean files.

**Layer 2 — split static HTML/CSS out of the `views/*.js` modules.** (medium risk, low marginal value)
- For each `views/*.js`, separate the static `<head>`/CSS/markup into a `.html` (or a const) and keep a thin render function that does only the dynamic `${}` substitution. The risk: you must correctly identify which `${}` are dynamic (`adminKey`, the `safe` JSON blob) vs. which sit inside `<script>` and must not be touched. Honestly the real isolation win is Layer 1; Layer 2 mostly buys cosmetics.
- **Effort: ~4–8 hours.** Recommend deferring or skipping.

**Layer 3 — extract the client-side `<script>` blocks to real `.js` files served as static assets.** (highest risk, but the permanent fix)
- Pull each `<script>` body into `public/admin-dashboard.js` etc., load via `<script src="...">`. Thread `ADMIN_KEY` in via a one-line `<script>window.ADMIN_KEY=${JSON.stringify(key)}</script>` shim or a `/admin/config.js?key=...` endpoint.
- This **eliminates the entire trap-#2 bug class** — once the JS is in a `.js` file there's no outer backtick: no contraction landmine, no `\\n` double-escape, no `&#39;` gymnastics, no inner-backtick rule. It's the "major refactor candidate" CLAUDE.md flags ("the underlying admin template architecture that makes these bugs likely keeps recurring").
- Risk: you're touching working client code; subtle dependencies on server-side interpolation order can break. Do the dashboard page first as the proof-of-concept, then the rest if it pays off.
- **Effort: ~8–16 hours** total (dashboard alone ≈ 4–6h; the other pages are smaller).

**Suggested scope:** Layer 1 in full (~3h), then Layer 3 for the dashboard page only (~5h) as the proof-of-concept and to kill the recurring-bug pattern where it bites most. Skip Layer 2. ≈ 1 working day for the high-value chunk.

---

## 6. Trap cross-reference

For every file named in §1, §3, and §5. replit.md trap text quoted verbatim.

### `prompts.js` (editing `DEFAULTS` / Variant E content / email + brain prompts)
- **Trap #6** — *"Prompts live in two places — `data/prompts.json` (read by `prompts.get()` on every call, no in-memory cache) and the `ai_prompts` table (durable across deploys). ... when you change a prompt programmatically, write to BOTH places in the same operation. The canonical UPSERT is `INSERT INTO ai_prompts (name, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET value=$2, updated_at=$3`."* → After swapping the audiology `DEFAULTS`, run `npm run prompts:push` (= `scripts/prompts-sync-file-to-db.js`) and restart, or stale `ai_prompts` rows (if any exist) keep overriding the new file content. The boot log line to watch: *"[Prompts] File is newer than DB ... pushed N prompt(s) FILE → DB"* vs *"[Prompts] DB is newer than file ... pulled N prompt(s) DB → FILE"*.
- **Trap #1** — *"The scripted conversation prompt variants have deliberately different voices, step counts, and booking-close lines. They are not copies of one script — they are independent scripts being tested against each other. ... Do not propose unifying them, deduplicating them, or suggesting one is 'out of sync' with the others."* → When you write GMN variant copy (in `prompts.js` defaults or the builder), keep them deliberately distinct; don't "DRY" them into one template.
- **Trap #7** — *"The variant prompts are full of internal step references — RULES section ('EXCEPT the Step N bridge'), MAPS CONFIRMATION LOOP ('after the [PRACTICE_DETECTED] bridge in Step N'), EARLY BOOKING ('skip directly to Step N') ... When you change the numbering of any step, every one of those references must be updated in the same edit pass."* → The Variant E sub-prompts use step ranges (10–29 / 30–49 / 50–69 / 70–89) cross-referenced from the shared block; if you touch them rather than delete them, reconcile every reference.
- **Trap #8** — *"All 4 variants now carry two non-negotiable safety blocks ... `NEVER BOOK BEFORE QUALIFYING` ... `HOSTILE / AGGRESSIVE OPT-OUT — IMMEDIATE [DECLINED]` ... If you renumber steps, restructure the OBJECTIONS section, or do any large prompt edit: re-confirm both blocks survived intact."* → GMN's new prompts must carry equivalents. (`config.PLACEHOLDER_PROMPT` and `variant-builder.js SHARED_OUTPUT_RULES` carry lighter versions of the opt-out rule; verify GMN copy keeps the *book-only-after-qualifying* gate too — and note it's coupled to the server-side guard, below.)

### `config.js` (editing `keyword`/`systemPrompt`/`followUpPrompts`/`SCRIPTED_VARIANTS`)
- **Trap #6** — same as above; `config.js` supplies the `DEFAULTS` that `prompts.js` seeds and `prompts.get()` reads.
- (CLAUDE.md coding rule: *"ALWAYS use `process.env.PROD_DATABASE_URL` in one-off shell scripts, never `DATABASE_URL`"* — n/a to editing config.js itself, but if you script a `SCRIPTED_VARIANTS` migration, that rule applies to the script. For GMN's local setup, CLAUDE.md overrides: `DATABASE_URL` is the Neon prod DB.)

### `research.js` / `scanner.js`
- No directly-numbered trap. **Caution:** the `[PRACTICE_DETECTED] → research → AI-trigger → scan-watch` flow is documented in the `server.js:100–117` comment block and is fragile (poller-based, 90s timeouts). The `researchData` / `scanResults` *object shapes* are read by `server.js sendScanVisibilityMessage`, `buildScanPage`, the AI context builder, **the `[BOOKED]` guard at `server.js:1626`**, and `enrollment.js` — any shape change ripples. **Trap #8** is the relevant adjacency: *"Server-side belt-and-suspenders for #1 (added same patch): `server.js` line ~1278 — when `[BOOKED]` is emitted but `fresh.researchData` OR `fresh.scanResults` is missing, the marker is stripped, the AI is NOT paused, and the conversation continues."* — i.e. **if you delete the research/scan pipeline, this guard will strip every `[BOOKED]` marker** because `researchData`/`scanResults` will always be absent. Change or remove that guard in lockstep with any scan-pipeline removal (Q3).

### `enrollment.js`
- **Trap #10** — *"NEVER use `m.type === N` as a direction fallback in any GHL message-history parser. `type` is messageType (a content-kind code), not direction. Direction is `m.direction` (string) or `m.messageType` (string `'inbound'`/`'outbound'`). If you find a new parser site, audit it against this rule."* → `enrollment.js:isInbound` (39–45) was a fix site for exactly this; preserve `m.direction === 'inbound' || m.messageType === 'inbound'` when you rewrite the surrounding analysis prompt.
- **Trap #10** (TCPA suffix) — *"NEVER drop a GHL message just because its body contains a TCPA opt-out phrase. Strip the suffix; preserve the body."* + CLAUDE.md coding rule *"ALWAYS strip TCPA opt-out suffix from GHL outbound history, never drop the message."* → ⚠ **`enrollment.js:58` currently violates this** — `isRealMessage` returns `false` for any message matching `/reply STOP to unsubscribe/i`, dropping the whole message. The `server.js buildMessagesFromGhl` path was fixed (strip the suffix, keep the body); `enrollment.js` was not. Fix it while you're in there.
- **Trap #5** — *"GHL occasionally fails to deliver the inbound webhook ... `reconciliation.js` polls GHL every 30 seconds for active contacts and replays any missed inbound."* → `enrollment.js` replays GHL history through the same `handleInbound`-adjacent machinery; be aware the dedup story (trap #9) depends on `message_id` being populated.

### `server.js` (audiology strings in §1 + the `buildXPage()` functions in §5)
- **Trap #2** — *"the entire admin UI HTML+CSS+JS is rendered by huge backtick template literals inside server.js. ... Words like hasn't, can't, won't, doesn't, you're, it's, I'll, we're will silently break the page if they sit unescaped inside a single-quoted string inside a backtick template. ... all JS helper functions added inside the admin `<script>` block must use plain string concatenation — never backtick template literals. ... never write `\'` inside any string that lives inside the outer page backtick template. Use HTML entities instead — `&#39;` in HTML attributes. ... any string escape sequences (`\n`, `\t`, `\r`, etc.) that should appear literally in the output JavaScript must be double-escaped as `\\n`, `\\t`, `\\r`. ... after editing admin script strings, run `node -e \"const h=require('fs').readFileSync('/tmp/x.html','utf8');const m=h.match(/<script[^>]*>([\s\S]*?)<\/script>/);try{new Function(m[1]);console.log('OK')}catch(e){console.log(e.message)}\"` against the rendered /admin HTML to catch parse errors before the user sees them."* + CLAUDE.md coding rules (same, restated). → Applies to *every* user-facing string edit in §1 that lands in a `buildXPage()` function (`6721` the badge, the `<title>`s, the brand renames). Run the parse-check after each. The live "escHtml is not defined" bug on the prompt editor is a concrete instance to fix during the §5 extraction.
- **Trap #3** — *"Every data-loading function in the admin dashboard ... wraps its fetch calls in `fetchWithTimeout(url, opts, ms)` ... Any new `fetch(...)` call added to a load function must use `fetchWithTimeout(...)` instead."* + CLAUDE.md *"ALWAYS wrap new admin fetch calls in `fetchWithTimeout`."* → When you add the GMN dashboard panels (DND/opt-out tracking, close-loop attribution, cost-per-booking — the Phase 1 plan), wrap their fetches.
- **Trap #4** — *"DB writes ... live in prod immediately ... File/code changes ... only ship to prod when the user clicks Publish ... never just 'this is live now'."* → Relevant to your own deploy workflow; for GMN local dev, CLAUDE.md notes you're on Neon directly with `DEV_MODE=true` (no real SMS).
- **Trap #8** (server-side guards) — *"`server.js` line ~1278 — when `[BOOKED]` is emitted but `fresh.researchData` OR `fresh.scanResults` is missing, the marker is stripped"* (now at `server.js:1626`); also *"Server-side outbound-quality guard ... `server.js` lines ~1178–1240 inside `generateAndSendAiReply` ... Detects ... verbatim duplicate of the last outbound ... third consecutive outbound carrying the same `[STEP:N]` marker ... retries the Claude call ONCE."* → Don't break these when refitting copy or extracting templates; the `[BOOKED]`-needs-research-and-scan coupling is the one to watch (Q3).
- **Trap #10** (markers / activity events) — *"ALWAYS filter `messageType.startsWith('TYPE_ACTIVITY')` at the inbound webhook entry. Activity events are not prospect replies."* and *"NEVER strip a leading-assistant turn from the message history without prepending a synthetic user trigger."* → `server.js` is where `buildMessagesFromGhl`, `mergeAndNormalise`, `recoverStateFromHistory`, and the `[PRACTICE_DETECTED]`/`[BOOKED]`/`[DECLINED]` extraction live. Refitting copy shouldn't touch these, but a careless template-extraction could move code near them — preserve.

### `data/industry.json`
- No DB-sync trap (it's a file-only config, not mirrored to a table). **Caution:** per the "White-Label Architecture" section — *"`prompts.get()` runs every returned value through this interpolator, so no other code change is needed when industry config changes"* — a typo here propagates into **every** prompt instantly (no restart). Treat edits with the same care as a prompt edit.

### `data/prompts.json`
- **Trap #6** — *"the boot now compares `fs.statSync(FILE).mtimeMs` against `MAX(ai_prompts.updated_at)` (with a 5-second slop) and lets the newer side win ... Manual escape hatch: ... run `npm run prompts:push` ... It UPSERTs every `conversationPrompt*` / `followup.*` / `email.*` key from the file into prod `ai_prompts` with `updated_at = now`, then tells you to restart prod so the next `syncFromDb` pulls the corrected DB into the prod file."* → If you hand-edit `data/prompts.json` (e.g. fix `"structuredVariants": "{}"` → `[]`, or add GMN variant keys), and prod's `ai_prompts` happens to be newer, the next boot overwrites your file edit. Use `npm run prompts:push` to force file-wins.

### `package.json`
- No traps. Trivial string edit.

### `brain.js` `STAGE_MAP`
- No directly-numbered trap. **Trap #1** is the adjacency — `STAGE_MAP` feeds `classifyStage()` → `brain_messages.stage` → the winning-patterns analysis groups by stage. Renaming the labels is safe but changes how historical rows bucket; low risk on an empty DB.

---

## 7. Refit order

Your instinct — *industry.json → variant prompts → admin UI Layer 1 → handoff to Phase 2* — is **right in spirit, with two insertions**: (a) a "boot clean in DEV_MODE" step first (you can't refit what you can't run; it's CLAUDE.md's stated current step), and (b) a "resolve Variant E + strip the `prompts.js` audiology defaults" step *between* industry.json and writing new variants (the live system currently serves audiology Variant E copy by default — fix that before building on top of it).

1. **Get it booting clean in DEV_MODE.** Run `scripts/init-database.js` (the empty-DB schema is already written), fix `data/prompts.json` `"structuredVariants": "{}"` → `[]`, confirm `npm run dev` is error-free, log into `/admin?key=...`. *Why first:* prerequisite for every other step; lowest risk; it's where CLAUDE.md says you are.
2. **`data/industry.json` → GMN/fitness config.** One small file, no code change, instantly re-grounds every AI prompt via `industry.interpolate`. *Why second:* highest leverage per byte; the prompts reference `{{tokens}}` that resolve from here, so this must precede any prompt-text work. Trap exposure: minimal (file-only; "typo propagates everywhere" caution).
3. **Resolve Variant E + strip the audiology `prompts.js` `DEFAULTS`.** Decide Q1 (kill / rebuild). If kill: remove `conversationPrompt.E.*` from `prompts.js`, `buildVariantESystemPrompt`/`_variantEBranchForStep` from `server.js`, the Variant E Data Payload job from `followups.js`, the `'E'` entries from `brain.js` analytics, and `variantEBranch` from `conversations.js`. Either way, strip the audiology `email.*` and `brain.analysisPrompt` defaults. *Why third:* this is the single biggest block of *live* audiology copy (`conversationPrompt.E.enabled` defaults `'true'`), and CLAUDE.md's git log implies it's already supposed to be gone — resolve the contradiction before adding GMN variants. Trap exposure: **#6** (`prompts.js` → `npm run prompts:push` after), **#7** (step cross-refs if you edit rather than delete the E sub-prompts), **#1**. **Needs Q1 answered first.**
4. **Strip the remaining audiology strings.** `server.js` lines 269 / 2046 / 3286 / 6721 / 114–115; `research.js` (kill 65+/hearing-loss math + `findReferralSources`, swap mock names) per Q3/Q4; `scanner.js` mock names; `enrollment.js` analysis prompt + heuristics + the `isRealMessage` TCPA-drop bug; `package.json`. *Why fourth:* mechanical search-and-replace once industry.json + Variant E are settled. Trap exposure: **#2** for the `server.js` admin-string edits (run the parse-check after each); **#10** for `enrollment.js` (preserve `isInbound`, fix the TCPA drop); **#8** for `research.js` (don't break the `[BOOKED]`-needs-research guard unless you're also removing the scan pipeline per Q3).
5. **Build GMN conversation variant(s)** in `/admin/variants` (structured builder) or as `conversationPrompt.A/B/...` raw-text (Q9). Carry the trap-#8 safety blocks (`NEVER BOOK BEFORE QUALIFYING`, `HOSTILE OPT-OUT → [DECLINED]`). *Why fifth:* this is the actual product work; depends on steps 2–4 being done. Trap exposure: **#1**, **#7**, **#8**. **Needs Q2/Q9 + your B2B copy.**
6. **Admin UI Layer 1 extraction** (`buildXPage()` → `views/*.js`), ≈ 2–4h. Optionally Layer 3 for the dashboard page only, ≈ 5h. *Why sixth:* drops `server.js` by ~3,700 lines, isolates the trap-#2 surface, and should be done *before* the new GMN dashboard panels so they land in clean files — but *after* the copy refit so you're not moving target files mid-edit. Trap exposure: **#2** (the whole point — fix the suspected `escHtml`-not-defined bug while you're in there).
7. **Add GMN-specific panels + reschedule/no-show handling** (Phase 1 plan). DND/opt-out tracking, close-loop attribution, cost-per-booking; new GHL appointment-status webhook + cadence for reschedule/no-show (Q6 — I can't audit code that doesn't exist; flagging the scope). Trap exposure: **#3** (`fetchWithTimeout` on every new panel fetch); **#10** (any new GHL webhook handler — `messageType.startsWith('TYPE_ACTIVITY')` skip, `m.direction`/`m.messageType`).
8. **Handoff to Phase 2** — the Outbound Crew (CrewOS) greenfield build, on the now-GMN-native, running, refactored foundation.

---

## Questions for you (decisions only you can make)

1. **Variant E:** kill it entirely, or rebuild the branching concept for GMN? It's currently `enabled: 'true'` by default with full audiology copy (~250 lines in `prompts.js` + machinery in 4 other files), yet CLAUDE.md's git log shows commit `70d5c68 "Remove Variant E from the system and related analytics"`. The structured Variant Builder only does linear steps today — branching would need new step types. **(Blocks refit step 3.)**
2. **Variant count:** the legacy engine ran A/B/C/D (+F/G); `SCRIPTED_VARIANTS` is now `[]`. Start GMN with one variant, or stand up 2–4 for A/B testing from day one? (Determines whether the Bayesian P(Best) view has anything to compare — and CLAUDE.md's known-issue "re-enable Variant B after installing GMN copy" presupposes a B exists.)
3. **Local-SEO / visibility scan:** does GMN's offer to gyms include Google Business Profile / "rank for 'gym near me'" optimization? **Yes** → keep + repurpose the DataForSEO + Google Places scan + `[PRACTICE_DETECTED]` pipeline (just swap `scanKeyword`). **No** → it's a large dead surface to remove — *and* the `[BOOKED]` guard at `server.js:1626` (which strips `[BOOKED]` unless `researchData` AND `scanResults` are present) must change or be removed in the same pass.
4. **`findReferralSources()`** (currently ENTs / audiologists / insurance offices within 2km): kill it, or repurpose to something gym-relevant (physios? nutritionists? — I'd lean kill; low confidence it adds value)?
5. **GMB One-Shot Generator** (`/api/generate` + the `/scan/:sessionId` visualization page): keep as a standalone message-drafting tool, or remove? Nothing in the conversation flow uses it; it's a leftover from the "audiology sales demo tool" era.
6. **Reschedule + no-show handling** (CLAUDE.md Phase 1 item "Sidney never built this"): confirm scope — a new GHL appointment-status webhook handler + a new follow-up cadence, or something lighter? Flagging because there's no existing code to audit.
7. **Brand naming:** what should the engine call itself in UI titles/logos? Currently a mix of "Powered Up AI", "White-Label SMS Engine", "Ampify AI", and the persona "Sidney". GMN / "Gym Members Now" / a new persona name?
8. **Delete the dead artifacts?** `attached_assets/` (75 files), `zipFile.zip` (5.4 MB), `rp_*.txt` / `rt_*.txt` / `stress_*.txt` at root, and the `scripts/fix-variant-*.js` / `move-hearing-aid-q-into-prompts.js` / `apply-prompt-hardening.js` migrations — OK to delete (archive `zipFile.zip` first if it's the only copy of anything)? None are referenced by running code.
9. **Structured builder vs. legacy raw-text variants:** replit.md says "new operators should build via the structured editor," but the legacy `conversationPrompt.A/B/C/D` raw-text path still works (and supports branching, at the cost of re-introducing the trap-#7 step-renumbering fragility). Which path do you want GMN to use for its conversation flow? **(Affects refit step 5.)**
