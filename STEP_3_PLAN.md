# STEP 3 PLAN — Variant E Removal (audit only, no code changed)

**Decision being executed (from PHASE_1_PLAN.md Step 3 + AUDIT.md §1 / §4 "Other vestigial flags"):** kill the Variant E branching infrastructure entirely. Do **not** rebuild branching — new GMN variants will use the structured builder with in-context adaptation, so no explicit branch step types are needed.

**Scope:** Variant E only. Step 4 audiology cleanup (research.js 65+/hearing-loss math, `findReferralSources`, enrollment.js analysis prompt + heuristics, server.js audiology copy strings, `package.json`, `data/industry.json`, `data/prompts.json`) is **out of scope** for this plan.

**Status:** This is a deliverable. Nothing in the codebase was modified producing it. Deletions happen in a follow-up pass.

---

## 0. What "Variant E" actually is here

Variant E is a self-contained, code-composed conversation prompt: instead of one flat `conversationPrompt.X` string, it's assembled at runtime from `conversationPrompt.E.shared` + `conversationPrompt.E.opening` (steps 1–9) + one of four branch scripts `conversationPrompt.E.branchA/B/C/D` (steps 10–29 / 30–49 / 50–69 / 70–89), selected by `currentStep` or by a sticky `variantEBranch` lock stamped on the contact once a branch-range step marker is seen. It also has its own video-link step (`[Link]` placeholder → `VARIANT_E_VSL_URL`), its own "Data Payload" delayed follow-up job, and its own entries in the variant analytics arrays.

Two facts that make removal low-risk:

1. **`config.SCRIPTED_VARIANTS` is `[]`.** Nothing currently assigns Variant E to new contacts — `prompts.pickVariant()` / `prompts.getEnabledVariants()` only iterate `SCRIPTED_VARIANTS`. The only place `'E'` enters the variant universe is the literal `[...config.SCRIPTED_VARIANTS, 'E']` spread in `brain.js` (×3), `server.js` (×2), and the standalone `conversationPrompt.E.enabled: 'true'` default. So on the current (fresh) DB, no contact has `variant === 'E'`.
2. Because of (1), the runtime `contactVariant === 'E'` branches in `server.js` and the `processDataPayload` job are dead-but-reachable-on-paper code. Removing them changes no live behavior; it only deletes audiology copy and dead branches.

---

## 1. Per-file inventory

### 1a. `prompts.js`  (737 lines)

| Lines | Code | What it does | Action |
|---|---|---|---|
| 62–103 | `PROMPT_META` entries: `conversationPrompt.E.vslUrl` (with `sectionLabel: 'Variant E (Sidney — Branching Brain)'`), `.enabled`, `.shared`, `.opening`, `.branchA`, `.branchB`, `.branchC`, `.branchD` | The prompt-editor metadata (labels/descriptions) that makes the Variant E sub-prompts editable in `/admin/prompts`. All audiology-flavoured. | **Delete** the whole `// ── Variant E ── … ` block (lines 62–103). Make sure the comma/array syntax of `PROMPT_META` stays valid — line 61 ends `},` and line 104 begins `{` (the `email.system` entry). |
| 149–417 | `DEFAULTS` entries: comment `// Variant E — Branching Adaptive Sales Brain …` (149–150), `'conversationPrompt.E.enabled': 'true'` (151), `'conversationPrompt.E.vslUrl': ''` + comment (152–155), `'conversationPrompt.E.shared': \`…\`` (156–208), `'conversationPrompt.E.opening': \`…\`` (210–244), `'conversationPrompt.E.branchA': \`…\`` (246–284), `'conversationPrompt.E.branchB': \`…\`` (286–335), `'conversationPrompt.E.branchC': \`…\`` (337–375), `'conversationPrompt.E.branchD': \`…\`` (377–417) | The actual Sidney/audiology branch scripts (insurance/eligibility/Availity/NaviNet; TruHearing/UHCH/"Gray Gold"; Blueprint/Sycle faxes; after-hours "doctor AND office manager"). `conversationPrompt.E.enabled` defaults `'true'` — this is the line AUDIT.md flags as "system serves audiology copy out of the box." | **Delete** all of it (149–417). Line 148 ends `...Object.fromEntries(config.SCRIPTED_VARIANTS.map(v => [\`conversationPrompt.${v}.notes\`, ''])),` and line 418 begins `systemPrompt: config.systemPrompt,` — splice straight from 148→418. |
| 9, 11, 16 | Header doc comment lists prompt names; mentions "Discovery script (steps 1-9)". No Variant E mention here. | — | **No action** (cosmetic, owned by Step 4). |

Note: `prompts.js` lines 128–148 (`VARIANT_PROMPT_DEFAULTS` loop, the `DEFAULTS` spreads over `config.SCRIPTED_VARIANTS`), `getEnabledVariants`, `setVariantEnabled`, `pickVariant`, `seed`, sync functions — **untouched**. None of them reference `'E'` literally; they iterate `SCRIPTED_VARIANTS`. Leave them.

### 1b. `server.js`  (7747 lines)

| Lines | Code | What it does | Action |
|---|---|---|---|
| 558–593 | `// ─── Variant E Prompt Builder ───` comment block + `function buildVariantESystemPrompt(currentStep, branchLock) { … }` | Composes the E system prompt from `prompts.get('conversationPrompt.E.shared'|'.opening'|'.branchA'|…)`. | **Delete** the comment block (558–568) and the function (569–593). |
| 595–603 | `// Map a step number to its branch letter …` + `function _variantEBranchForStep(step) { … }` | Step→branch-letter mapping for the branch lock. Only caller is `buildVariantESystemPrompt`'s sibling at server.js:1651. | **Delete** (595–603). |
| 646–650 | Inside `generateAndSendOpener`: `if (variant === 'E' && !variantBuilder.getVariant('E')) { systemContent = buildVariantESystemPrompt(0); } else { systemContent = resolveVariantPrompt(variant); }` | Picks the E builder at enrollment time. | **Modify** → collapse to `systemContent = resolveVariantPrompt(variant);` (the `else` branch). |
| 676–680 | Comment: `// … in case Claude emits multiple step markers in one turn (e.g. Variant E Steps 2+3 sent together).` plus the `allOpenerStepMatches` "use the LAST marker" logic. | The "use last `[STEP:N]` marker" logic is generic and worth keeping; only the *reason* references E. | **Modify** — keep the logic; reword the comment to drop the "Variant E Steps 2+3" example (or just say "in case Claude emits multiple step markers in one turn"). Low priority; not load-bearing. |
| 1304–1314 | Inside `generateAndSendAiReply` (the main inbound path): comment `// Variant E uses a modular composition …` + `if (contactVariant === 'E' && !variantBuilder.getVariant('E')) { systemContent = buildVariantESystemPrompt(fresh?.currentStep ?? 0, fresh?.variantEBranch || null); } else { systemContent = resolveVariantPrompt(contactVariant); }` | Picks the E builder per inbound. | **Modify** → collapse to `systemContent = resolveVariantPrompt(contactVariant);`; trim the comment to "Pick variant-specific prompt; fall back to the base prompt if no variant is assigned." |
| 1414–1422 | `// Variant E step 3 is the routing turn …` + `const isVariantEStep3Clarifier = contactVariant === 'E' && _newStepPre === 3;` + the `if (!isHardCapViolation && !isVariantEStep3Clarifier && …)` in the same-step-reask guard. | Carve-out so E's step-3 routing clarifier doesn't trip the same-step-reask guard. | **Modify** — delete `isVariantEStep3Clarifier` (line 1416) and its `!isVariantEStep3Clarifier &&` term (line 1417). The same-step-reask guard then applies uniformly, which is correct once E is gone. |
| 1455–1463 | Comment on the `allStepMatches` "use the LAST `[STEP:N]` marker" block referencing "Variant E Steps 2+3 sent together". | Same as 676–680 — keep logic, reword comment. | **Modify** (low priority, cosmetic). |
| 1466–1531 | The `[PRACTICE_DETECTED]` handler. Lines **1492–1516** branch on `if (contactVariant === 'E') { … }` vs `else { … }` — both branches now do *the same thing* (queue `confirmationPending` + `confirmationMsg`); the E branch has an extra `if (reply.includes('[Link]')) { reply = reply.split(/\n\n/)[0] … }` truncation. Lines **1520, 1525, 1529**: `if (contactVariant !== 'E') scheduleAiResponseAfterResearch(contactId, resolvedConvId);` — E *skips* the auto-AI-trigger-after-research (because the E script re-generates the video step itself). | E-specific divergence in the practice-detection / research-trigger flow. | **Modify** — (a) at 1492–1516, drop the `if (contactVariant === 'E')` wrapper and the `[Link]`-truncation block; keep the (formerly `else`) body unconditionally. (b) at 1520/1525/1529, change `if (contactVariant !== 'E') scheduleAiResponseAfterResearch(...)` → unconditional `scheduleAiResponseAfterResearch(...)`. **⚠ Verify against §3 — this re-enables `scheduleAiResponseAfterResearch` for what used to be the E path; for non-E variants nothing changes.** |
| 1642–1658 | Inside the "Update step" block: comment `// Variant E branch lock: the first time a branch-range step marker …` + `if (contactVariant === 'E' && !fresh?.variantEBranch) { const branch = _variantEBranchForStep(detectedStep); if (branch) { stepUpdates.variantEBranch = branch; console.log(\`[VariantE] Branch lock set …\`); } }` | Stamps `variantEBranch` onto the contact. | **Delete** lines 1645–1656 (the comment + the `if (contactVariant === 'E' …)` block). Keep `const stepUpdates = { currentStep: detectedStep };` (1644) and `conversations.update(contactId, stepUpdates);` (1657). |
| 1664–1675 | `// Variant E: inject VSL URL into [Link] placeholder. … VARIANT_E_VSL_URL … conversationPrompt.E.vslUrl …` + `if (contactVariant === 'E' && reply.includes('[Link]')) { const vslUrl = process.env.VARIANT_E_VSL_URL \|\| prompts.get('conversationPrompt.E.vslUrl') \|\| ''; if (vslUrl) { reply = reply.replace(/\[Link\]/gi, vslUrl); } else { … reply = ''; } }` | Resolves the `[Link]` placeholder for E video steps; fails closed if no URL. | **Delete** (1664–1675). The `[Link]` placeholder convention is E-only. |
| 1688–1695 | Comment `// Variant E video link steps (12/32/52/72): suppress the normal 5-minute silence nudge …` + `const isVariantEVideoStep = contactVariant === 'E' && [12, 32, 52, 72].includes(detectedStep); if (!isVariantEVideoStep) { followups.scheduleSilenceCheck(contactId, persistStep, reply); }` | Suppresses the silence nudge on E video steps. | **Modify** → `followups.scheduleSilenceCheck(contactId, persistStep, reply);` unconditionally; delete `isVariantEVideoStep` and the `if`. Drop the comment. |
| 1698–1719 | `// Variant E: schedule Data Payload follow-up 15–20 min after video link steps. …` + `if (contactVariant === 'E' && [12, 32, 52, 72].includes(detectedStep)) { … followups.scheduleJob({ contactId, type: 'data-payload', position: 1, sendAt: …, context: { variant: 'E', videoStep: detectedStep, retries: 0 } }); … }` | The only producer of `data-payload` jobs. | **Delete** (1698–1719). |
| 3175–3183 | Inside `_buildPlaygroundSystemPrompt`: `} else if (session.variant === 'E' && !variantBuilder.getVariant('E')) { systemContent = buildVariantESystemPrompt(session.currentStep || 0); } else { systemContent = resolveVariantPrompt(session.variant); }` | Playground can pick the E builder. | **Modify** — delete the `else if (session.variant === 'E' …)` arm; the trailing `else { systemContent = resolveVariantPrompt(session.variant); }` covers it. |
| 3473–3476 | `// … Legacy scripted variants always use single uppercase letters …` + `const _validLegacy = [...config.SCRIPTED_VARIANTS, 'E']; if (_validLegacy.includes(v)) return { variant: v };` (in `_normalizePlaygroundVariant`) | Lets the playground accept `'E'` as a valid variant id. | **Modify** → `const _validLegacy = [...config.SCRIPTED_VARIANTS];`. (Leaving the `'E'` in would let an operator type "E" into the playground and get the base prompt — harmless but confusing.) |
| 3549 | `const legacyOk = [...config.SCRIPTED_VARIANTS, 'E'].includes(session.variant);` (mid-session revalidation in `/admin/playground/message`) | Same as above, for an existing session. | **Modify** → `const legacyOk = [...config.SCRIPTED_VARIANTS].includes(session.variant);`. |
| 4206–4215 | Inside the post-bootstrap block: `// Variant E VSL URL check: warn if E is enabled …` + `const isEEnabled = prompts.getEnabledVariants().includes('E'); const vslUrlConfigured = !!(process.env.VARIANT_E_VSL_URL \|\| prompts.get('conversationPrompt.E.vslUrl')); if (isEEnabled && !vslUrlConfigured) { console.error('[VariantE] WARNING: …'); … }` | Boot-time warning that E is enabled without a VSL URL. (`getEnabledVariants()` iterates `SCRIPTED_VARIANTS`, so `isEEnabled` is already always `false` — this never fires.) | **Delete** (4206–4215). |
| 5449 | `\${vData.variants.filter(v => v.variant !== 'E').map(v => \`` — inside `buildAdminDashboardPage`'s "Variant Notes" render. | Excludes Variant E from the per-variant notes UI. | **Modify** → `\${vData.variants.map(v => \`` (drop the `.filter(v => v.variant !== 'E')`). Once `getVariantStats`/`variantStats` stop emitting an `'E'` row (see brain.js below), there's nothing to filter. **⚠ trap #2 territory — this edit lives inside the outer backtick template literal of `buildAdminDashboardPage`; run the `<script>` parse-check after (see §4). The edit itself is removing characters from an existing `${}` expression, low risk.** |
| 114–115 | Comment: `// • Variant B → hearing-aid percentage question (Step 5)` / `// Variant A/C → data reveal / booking step` — **not** Variant E. | — | **No action** (owned by Step 4 / AUDIT.md §1). |
| 2899–2917 | `app.post('/admin/variants/:variant/enabled', …)` — validates `variant` against `[...config.SCRIPTED_VARIANTS]` (no `'E'`). | Already doesn't accept E. | **No action.** |

### 1c. `followups.js`  (1466 lines)

| Lines | Code | What it does | Action |
|---|---|---|---|
| 1180–1280 | `// ─── Variant E Data Payload ───` comment + `async function processDataPayload(job) { … }` — sends the "I finished pulling your local data while you watched" message ~15–20 min after an E video step; reads `contact.scanResults` / `contact.researchData`; persists with `type: 'data-payload', variant: 'E'`. | The handler for `data-payload` jobs. After the producer in `server.js:1698–1719` is deleted, no `data-payload` job is ever created. | **Delete** the comment block (1180–1184) and the whole `processDataPayload` function (1185–1280). |
| 1308–1316 | In `processJob`: `if (job.type === 'silence-check') { … } else if (job.type === 'email-hook' \|\| job.type === 'email-nurture') { … } else if (job.type === 'data-payload') { await processDataPayload(job); } else { await processHookOrNurture(job); }` | Routes `data-payload` jobs to the handler. | **Modify** — delete the `} else if (job.type === 'data-payload') { await processDataPayload(job);` arm. |
| 325–339 | In `cancelContactJobs`: the filter `j.type !== 'data-payload'  // data-payload self-cancels on booked/optout check` and the log line `… (email jobs and data-payload preserved)`. | Excludes `data-payload` jobs from bulk cancellation. | **Modify** — delete the `&& j.type !== 'data-payload'` clause and the inline comment; reword the log line to `(email jobs preserved)`. (Harmless to leave, but it references a job type that can no longer exist.) |

> **Already-orphaned `data-payload` jobs in the DB:** in this fresh local environment there are none. If this were run against a DB that had pending `data-payload` rows, the safe handling is: after the code change, any such job hitting `processJob` would fall through the `else` to `processHookOrNurture` — which would mis-handle it. So **before deleting the handler**, run a one-off `UPDATE followup_jobs SET status='cancelled' WHERE type='data-payload' AND status='pending'` (using `process.env.DATABASE_URL` per CLAUDE.md's local note). For the current empty DB this is a no-op but include it in the runbook for safety. Confirm the `followup_jobs` table/column names against `followups.js` before running.

### 1d. `brain.js`  (1166 lines)

| Lines | Code | What it does | Action |
|---|---|---|---|
| 714 | `winning.variantStats = [...config.SCRIPTED_VARIANTS, 'E'].map(v => { … })` — builds the `variantStats` array stored in winning-patterns analysis. | Forces an `'E'` row into the analytics output even though E is never assigned. | **Modify** → `winning.variantStats = [...config.SCRIPTED_VARIANTS].map(v => { … })`. |
| 969 | `return [...config.SCRIPTED_VARIANTS, 'E'].map(v => { … })` — inside the function that returns per-variant reply/booking stats (consumed by the dashboard variant table / LLM analysis). | Same — emits an `'E'` row. | **Modify** → `return [...config.SCRIPTED_VARIANTS].map(v => { … })`. |
| 1061 | `[...config.SCRIPTED_VARIANTS, 'E'].filter(v => prompts.get(\`conversationPrompt.${v}.enabled\`) === 'true')` — inside `runLlmAnalysis`, builds the set of "enabled variants" to include in the LLM summary. After the `prompts.js` delete, `prompts.get('conversationPrompt.E.enabled')` returns `''`, so `'E'` would already be filtered out — but the literal should still go. | Same. | **Modify** → `[...config.SCRIPTED_VARIANTS].filter(v => …)`. |

> No other `'E'` literals in `brain.js`. `STAGE_MAP`, `classifyStage`, `recordOutbound`, `recordBooking` etc. are variant-agnostic — untouched.

### 1e. `conversations.js`  (348 lines)

| Lines | Code | What it does | Action |
|---|---|---|---|
| 111–114 | Inside `_dbUpsertContact`'s `extra` object: `// Variant E branch lock — once set, server.js's buildVariantESystemPrompt() … selects the branch script by this letter …` + `variantEBranch: record.variantEBranch \|\| null` | Persists the branch lock into `contacts.extra` JSON. | **Modify** — delete the comment (111–113) and the `variantEBranch: record.variantEBranch || null` line (114). **⚠ Mind the trailing comma:** line 110 currently ends `practiceCity:        record.practiceCity        || null,` — after removing `variantEBranch`, line 110 must end *without* a trailing comma (it becomes the last property in the `extra` object literal), or trailing-comma-in-object is fine in modern Node — but be consistent with the file style. |
| 44 | `...(c.extra || {}),` in `initFromDb` — spreads `extra` (including any old `variantEBranch`) back onto the in-memory record on boot. | Generic — it just spreads whatever's in `extra`. Old rows with a stale `variantEBranch` key will still get it spread in, but nothing reads it after the server.js delete. | **No action** (harmless; the key just becomes inert). Optionally a one-off `UPDATE contacts SET extra = extra - 'variantEBranch'` could scrub it, but unnecessary on a fresh DB. |

---

## 2. Removal sequence (safest execution order)

Principle: delete *producers* before *consumers*, delete *callers* before the *functions* they call, delete *code* before the *analytics that aggregate that code's output*, and parse-check / boot-check after each file.

1. **`server.js` — delete the `data-payload` job *producer* first** (lines 1698–1719). Now no new `data-payload` jobs can be created. (Optionally also run the `UPDATE followup_jobs … WHERE type='data-payload'` cancel in the DB — no-op on the fresh DB.)
2. **`followups.js` — delete the `data-payload` *consumer*:** the `processDataPayload` function (1185–1280) + its comment (1180–1184), the `else if (job.type === 'data-payload')` arm in `processJob` (1308–1316), and the `j.type !== 'data-payload'` clause + log wording in `cancelContactJobs` (325–339). `node --check followups.js`.
3. **`server.js` — delete the remaining E runtime branches:** `buildVariantESystemPrompt` + `_variantEBranchForStep` (558–603); the three `contactVariant === 'E'` / `variant === 'E'` / `session.variant === 'E'` prompt-builder branches (646–650, 1304–1314, 3175–3183) → collapse each to the `resolveVariantPrompt(...)` else-arm; the practice-detection E divergence (1492–1516 unwrap, 1520/1525/1529 make unconditional); the branch-lock stamp (1645–1656); the `[Link]` VSL injection (1664–1675); the silence-nudge suppression (1688–1695) → unconditional; the same-step-reask E carve-out (1416–1417); the playground `_validLegacy` / `legacyOk` literals (3475, 3549); the boot VSL warning (4206–4215); the `buildAdminDashboardPage` `.filter(v => v.variant !== 'E')` (5449). Then comment-only touch-ups at 676–680 / 1455–1463 (optional). `node --check server.js`.
4. **`conversations.js` — delete `variantEBranch`** from the `extra` object in `_dbUpsertContact` (111–114). `node --check conversations.js`.
5. **`prompts.js` — delete the Variant E `PROMPT_META` entries** (62–103) **and the Variant E `DEFAULTS` block** (149–417). `node --check prompts.js`. *(Doing `prompts.js` after `server.js` means there's no window where `server.js` still calls `prompts.get('conversationPrompt.E.shared')` against a key whose default has been removed — though even that window would only return `''`, not crash. Order is for tidiness, not correctness.)*
6. **`brain.js` — delete the `'E'` from the three `[...config.SCRIPTED_VARIANTS, 'E']` spreads** (714, 969, 1061). `node --check brain.js`. *(Last because these are pure analytics aggregation — they read `m.variant` off `brain_messages` rows; once no row can have `variant === 'E'`, the literal is dead. Removing it earlier would be fine too; this just keeps "analytics last" as the rule.)*
7. **Run `npm run prompts:push`** (= `scripts/prompts-sync-file-to-db.js`) then **restart**, so any stale `ai_prompts` rows for `conversationPrompt.E.*` don't shadow the now-removed defaults (trap #6). On the fresh local DB these rows almost certainly don't exist, but the push is the documented escape hatch and is idempotent. Optionally also `DELETE FROM ai_prompts WHERE name LIKE 'conversationPrompt.E.%'` to scrub them outright.
8. **Boot + smoke-test** (see §4).

---

## 3. Risk flags

- **`scheduleAiResponseAfterResearch` becomes unconditional for the old E path** (server.js 1520/1525/1529 and the 1492–1516 unwrap). For every non-E variant this changes nothing — they already called it. The only "behavior change" is to a code path that, on the current DB, no contact can reach (`variant === 'E'` is unassignable). **Verify** that after the unwrap, the practice-detection handler's non-E body is exactly what runs (it is: today the `else` branch already runs for everything except E). Low risk, but it's the one place where "delete the E branch" isn't purely subtractive — it promotes the `else` to unconditional.
- **`[BOOKED]` qualification guard is NOT affected by this step.** The guard at `server.js:~1625` (`lacksQualification = !fresh?.researchData || !fresh?.scanResults`) is shared by all variants and is *not* Variant-E-specific. Step 3 does not touch it. (It *is* coupled to the scan/research pipeline — but that's AUDIT.md Q3 / Step 4, not here. Don't let the practice-detection edits in §1b drift into that guard.)
- **`PROMPT_META` / `DEFAULTS` array & object syntax.** Both deletions are mid-array (`PROMPT_META`) and mid-object (`DEFAULTS`) splices. The failure mode is a dangling/missing comma → `SyntaxError` on require. `node --check prompts.js` catches it; do it before booting.
- **`conversations.js` `extra` object trailing comma** — see §1e. `node --check` catches it.
- **`buildAdminDashboardPage` edit at line 5449 is inside the outer backtick template literal** (trap #2 surface). The edit only removes characters from an existing `${}` expression — it does not introduce a contraction, a `\'`, a raw `\n`, or an inner backtick — so it's about as safe as a trap-#2-zone edit gets. Still: run the rendered-`<script>` parse-check from trap #2 / CLAUDE.md after, against `/admin`.
- **Stale `ai_prompts` rows for `conversationPrompt.E.*`** (if any exist in some other environment): after the `prompts.js` delete, `prompts.get('conversationPrompt.E.shared')` reads `DEFAULTS['conversationPrompt.E.shared']` which is now `undefined` → returns `''`. A stale DB row, *if present*, would still be returned by `prompts.get` (DB rows override defaults via the sync). But since *no code calls `prompts.get('conversationPrompt.E.*')` anymore* after the server.js delete, those rows are inert. `npm run prompts:push` + optional `DELETE … WHERE name LIKE 'conversationPrompt.E.%'` cleans them. — **flag, not a blocker.**
- **`conversationPrompt.E.enabled: 'true'`** — note this default does *not* currently make Variant E "active" anywhere (every "is E enabled?" check routes through `getEnabledVariants()`, which iterates `SCRIPTED_VARIANTS === []`). AUDIT.md's "system serves audiology copy out of the box" claim is about a *hypothetical* path where someone adds `'E'` to `SCRIPTED_VARIANTS`; it's not live today. Removing the default closes that door. — **flag for context, not a behavior change.**
- **Old contacts with `variant === 'E'` in a non-fresh DB.** None on the current local DB. If this ever runs against Sidney's prod data: a contact stuck on `variant === 'E'` would, after removal, get `resolveVariantPrompt('E')` → `conversationPrompt.E` key doesn't exist → falls back to `prompts.get('conversationPrompt')` (the base script). That's a graceful degrade, not a crash, but it'd be a jarring mid-conversation voice switch. **Out of scope for the local fork; flag if the plan is ever ported.**
- **Comment-only edits at server.js 676–680 and 1455–1463** are optional. The "use the LAST `[STEP:N]` marker" logic they annotate is generic and stays; only the "(e.g. Variant E Steps 2+3 sent together)" example is stale. Skipping these is fine; doing them is a 2-word reword. Listed for completeness, not pressure.
- **Nothing in `data/prompts.json` or `data/industry.json` is touched** by Step 3 — Variant E lives entirely in code. (`data/prompts.json` currently holds `structuredVariants` only; no `conversationPrompt.E.*` overrides. If it ever did, `npm run prompts:push` semantics apply — trap #6.)
- **`scripts/`** — `scripts/fix-variant-b-steps.js` etc. reference *other* variants, not E; not in scope. No Variant-E-specific one-off script exists.

---

## 4. Post-removal verification

Run from the repo root.

**Grep — Variant E should be gone (expect zero hits):**
```bash
grep -rn -i "variantE\|variant E\|conversationPrompt\.E\b\|conversationPrompt\.E\.\|buildVariantE\|_variantEBranch\|variantEBranch\|VARIANT_E_VSL_URL\|data-payload\|processDataPayload\|isVariantE" \
  prompts.js server.js followups.js brain.js conversations.js
# also catch the spread pattern:
grep -rn "SCRIPTED_VARIANTS, *'E'" prompts.js server.js followups.js brain.js conversations.js
# and the dashboard filter:
grep -n "v.variant !== 'E'" server.js
```
All of the above must return nothing. (A residual hit in a *comment* you chose not to touch at 676–680 / 1455–1463 is acceptable if you skipped those — decide explicitly.)

**Syntax check each modified file:**
```bash
node --check prompts.js
node --check server.js
node --check followups.js
node --check brain.js
node --check conversations.js
```
All must print nothing (exit 0).

**Server boot expectation (`npm run dev`, DEV_MODE=true):**
- Boots clean, no `ReferenceError` / `SyntaxError`.
- **Absent** from the log: any `[VariantE]` line (the old boot warning at server.js:4206–4215), any `[DataPayload]` line.
- Still present (unchanged): `[Conversations] DB loaded: …`, `[Prompts] …` sync line, `[Followups] DEV MODE — scheduler not started`, `[Reconciliation] DEV MODE — …`, `[Bootstrap] GHL state and conversations ready.`.
- `prompts.seed()` / `syncFromDb` must not error on the now-smaller `DEFAULTS`/`PROMPT_META`.

**Admin UI smoke (trap #2 parse-check) — required because of the server.js:5449 edit:**
```bash
# fetch the rendered admin page and parse-check its <script> blocks
curl -s "http://localhost:3000/admin?key=$ADMIN_KEY" > /tmp/admin.html
node -e "const h=require('fs').readFileSync('/tmp/admin.html','utf8'); \
  const ms=[...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]; \
  ms.forEach((m,i)=>{try{new Function(m[1]);console.log('script',i,'OK')}catch(e){console.log('script',i,'FAIL:',e.message)}});"
```
Every script block must report `OK`. Then visually: `/admin` loads, the Variant Performance table renders (it'll show only `SCRIPTED_VARIANTS` rows — currently empty, which is expected), and the "Variant Notes" section no longer needs the E exclusion. `/admin/prompts` loads and the Variant E section is **gone** from the prompt list. `/admin/playground` loads; entering `E` as a variant should now be rejected with the "variant must be one of: …" error (since `_validLegacy` no longer includes `'E'`).

**Trap #6 follow-through:**
```bash
npm run prompts:push   # = node scripts/prompts-sync-file-to-db.js
# then restart the server; watch for one of:
#   "[Prompts] File is newer than DB ... pushed N prompt(s) FILE → DB"   (good)
#   "[Prompts] DB sync complete — N prompt(s) already up to date"        (also fine on fresh DB)
```
Optionally confirm no stale rows: `SELECT name FROM ai_prompts WHERE name LIKE 'conversationPrompt.E.%';` should return zero rows (or DELETE them if any).

---

## 5. Trap exposure summary

| Trap | Applies because | Watch for when executing |
|---|---|---|
| **#1** (scripted variants are deliberately distinct — never reconcile/dedupe them) | Variant E *is* one of those scripts. The relevant move here is the inverse of "don't dedupe": you're *deleting* a whole variant by an explicit product decision. That's allowed — but don't let the deletion touch the *other* variants' prompts or the analytics that compare them (`brain.js variantStats`, the Bayesian P(Best) view), beyond removing the `'E'` row. The structured builder remains the path for GMN's distinct variants. |
| **#6** (prompts live in `data/prompts.json` + `ai_prompts` table; newer side wins; `npm run prompts:push` is the escape hatch) | You're editing `DEFAULTS` in `prompts.js`. Stale `ai_prompts` rows for `conversationPrompt.E.*` could in principle shadow the removed defaults. | Run `npm run prompts:push` + restart after the `prompts.js` edit. Confirm the boot log shows file→DB push (or "already up to date"). Optionally `DELETE FROM ai_prompts WHERE name LIKE 'conversationPrompt.E.%'`. Use `process.env.DATABASE_URL` for any one-off SQL (CLAUDE.md local-setup note). |
| **#7** (variant prompts cross-reference their own step numbers — renumber one ref, renumber all) | The Variant E sub-prompts (`.shared` references "Path A: [STEP:10]–[STEP:29]" etc., the branch scripts reference their own step ranges). | **Not a hazard here because we're deleting all of them together**, not renumbering. The trap would bite if someone tried to *repurpose* the E sub-prompts and edited step ranges piecemeal — we're not doing that. Just make sure the delete is *all* of `conversationPrompt.E.*` (shared + opening + branchA–D + enabled + vslUrl) and *all* of the step-range-aware code (`buildVariantESystemPrompt`, `_variantEBranchForStep`, the `[12,32,52,72]` video-step lists, the `_newStepPre === 3` carve-out) — no half-removal that leaves a dangling step reference. |
| **#2** (admin UI is rendered by giant backtick template literals in `server.js`; contractions / `\'` / raw `\n` / inner backticks break the page) | The server.js:5449 edit is inside `buildAdminDashboardPage`'s outer template literal. | The edit only deletes characters from an existing `${}` — it introduces no new string literal, contraction, escape, or backtick. Still: run the rendered-`<script>` `new Function()` parse-check (above) against `/admin` after. If you also reword the optional comments at 676–680 / 1455–1463 — those are plain JS comments outside any template, zero trap-#2 exposure. |
| **#3** (admin fetches must use `fetchWithTimeout`) | Not triggered — Step 3 adds no fetch calls. Listed only so it's not confused with later Phase 1 work (the new DND/cost-per-booking panels). | n/a |

— end of plan —

---

## Execution notes (post-removal)

- Executed against the local fork. All five files edited via `str_replace` only; `node --check` passed for each; all §4 grep verifications returned zero genuine hits (the only matches were unrelated identifiers — `setVariantEnabled`, the "Variant Enable/Disable" admin comment, "variant even" in a code comment).
- Also removed: the dead, unreferenced `_extractStepDescsFromText` helper in `server.js` (inside `/api/brain/variants`) — it existed only to flatten the Variant E modular sub-prompts and was never called; leaving it would have failed the §4 grep on the "Variant E uses modular sub-prompts" comment.
- **Deferred:** the orphaned `data-payload` follow-up job DB cleanup (`UPDATE followup_jobs SET status='cancelled' WHERE type='data-payload' AND status='pending'`) and the optional `extra->>'variantEBranch'` scrub were **not run** — the local DB is fresh and has no such rows, so they would be no-ops. These belong to a future prod-porting pass if this removal is ever applied to a database that carried Variant E traffic.
- `npm run prompts:push` reported `0 pushed, 0 already in sync` — `data/prompts.json` never held `conversationPrompt.E.*` overrides, so there was nothing stale in `ai_prompts` to reconcile.
