#!/usr/bin/env node
// One-shot: fix three real issues in Variant C that Claude identified.
// Idempotent — re-running is safe.
// After editing the file it POSTs to the running server so the DB
// (ai_prompts table, the real source of truth) is updated too.

const fs = require('fs');
const path = require('path');

const PROMPTS_PATH = path.join(__dirname, '..', 'data', 'prompts.json');
const data = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
let c = data['conversationPrompt.C'];
const before = c;

// ── 1. Rules EXCEPT clause references old bridge step name ────────────────
c = c.replace(
  'EXCEPT bridge messages (Step 4.5 bridge)',
  'EXCEPT bridge messages (Step 6 Bridge)'
);

// ── 2. IF/THEN response handlers all emit [STEP:4] despite a [STEP:4] ─────
//    already having been sent for the main Step 4 question.
//    ALWAYS ADVANCE requires M > N, so they must emit [STEP:5].
//    Only the five handler-closing lines end with
//    "what city are you in? [STEP:4]" — the main Step 4 message and the
//    ALWAYS ADVANCE example use [STEP:4] in different contexts and are
//    left untouched.
c = c.replaceAll(
  'what city are you in? [STEP:4]',
  'what city are you in? [STEP:5]'
);

// ── 3. Bridge step header/marker: "STEP 3.5" sits AFTER Step 4 in the ─────
//    actual conversation, which is backwards numerically (3.5 < 4) and
//    would cause ALWAYS ADVANCE to flag it as going backwards.
//    Rename it to Step 6 so the live sequence is 4 → 5 → 6 → 7 → 8.
c = c.replace('STEP 3.5 BRIDGE', 'STEP 6 BRIDGE');
c = c.replace(
  '"Got it, pulling that up now." [STEP:3.5]',
  '"Got it, pulling that up now." [STEP:6]'
);

// ── 4. Booking step: was "STEP 5", now STEP 7 ─────────────────────────────
c = c.replace('STEP 5 — BOOKING', 'STEP 7 — BOOKING');
// Both "data available" and "no data" booking lines close with [STEP:5].
// The ALWAYS ADVANCE example "RIGHT → You [STEP:5]" stays (generic example).
c = c.replaceAll(
  '\u2014 which works? [STEP:5]',
  '\u2014 which works? [STEP:7]'
);

// ── 5. Close/booked step: was "STEP 6", now STEP 8 ───────────────────────
c = c.replace(
  'STEP 6 (if they agree to a time):',
  'STEP 8 (if they agree to a time):'
);
c = c.replace(
  'STEP 6 ALTERNATIVE (if they ask questions instead of booking):',
  'STEP 8 ALTERNATIVE (if they ask questions instead of booking):'
);
c = c.replace('[STEP:6] [BOOKED]', '[STEP:8] [BOOKED]');
// STEP 8 ALTERNATIVE pivot-back line
c = c.replace(
  'morning or Thursday afternoon \u2014 which works?" [STEP:6]',
  'morning or Thursday afternoon \u2014 which works?" [STEP:8]'
);

// ── 6. LIVE DATA section references old step name ─────────────────────────
c = c.replace(
  'SCAN RESULTS are appended after Step 4.5',
  'SCAN RESULTS are appended after the Step 6 Bridge'
);

// ── 7. EARLY BOOKING: replace vague "Step 5 or Step 6 depending on…" ──────
c = c.replace(
  `If the prospect expresses strong intent at any point ("yes let's book", "I want to see this", "let's do it"), skip directly to Step 5 or Step 6 depending on whether you've already collected their practice name.`,
  `If the prospect expresses strong intent at any point ("yes let's book", "I want to see this", "let's do it"):\n- Practice name and city NOT yet collected: ask for them now using the Step 5 response format, then send the Step 6 Bridge to trigger the scan, then proceed to Step 7.\n- Practice name and city already given in a prior reply: send the Step 6 Bridge immediately, then proceed to Step 7.`
);

// ── 8. Sidney name: add a scoped note so the bot doesn't introduce the ─────
//    name before the booking step. Inserted at the top of Step 7 section.
const sidneyNoteAnchor = 'STEP 7 — BOOKING (sent after system shows competitor data):';
const sidneyNote = `\n\nNAME NOTE: The scripted messages below include "I\u2019m Sidney." This refers to the real founder \u2014 not a fabricated persona. Do NOT use the name Sidney before this step. Only introduce it here, as written in the script.`;
const sidneySentinel = 'NAME NOTE: The scripted messages below include';
if (!c.includes(sidneySentinel)) {
  const pos = c.indexOf(sidneyNoteAnchor);
  if (pos !== -1) {
    const cut = pos + sidneyNoteAnchor.length;
    c = c.slice(0, cut) + sidneyNote + c.slice(cut);
  }
}

// ── Verify the live step sequence ─────────────────────────────────────────
console.log('\nStep marker sequence in the FLOW (non-example, non-meta):');
const ignore = new Set(['N', 'N+1', 'M']);
[...c.matchAll(/\[STEP:([^\]]+)\]/g)].forEach(m => {
  if (ignore.has(m[1])) return;
  const ctx = c.slice(Math.max(0, m.index - 55), m.index + 10).replace(/\n/g, ' ').trim();
  const inExample = ctx.includes('WRONG') || ctx.includes('RIGHT \u2192') || ctx.includes('must NEVER do');
  const label = inExample ? '[example]' : '[LIVE]';
  console.log(`  ${label} [STEP:${m[1]}]  ...${ctx.slice(-65)}...`);
});

if (c === before) {
  console.log('\nNo changes needed (already applied).');
} else {
  data['conversationPrompt.C'] = c;
  fs.writeFileSync(PROMPTS_PATH, JSON.stringify(data, null, 2) + '\n');
  console.log('\nWrote prompts.json. C length:', c.length);
}

// Push to DB via admin endpoint ────────────────────────────────────────────
async function push() {
  const key = process.env.ADMIN_KEY;
  if (!key) { console.warn('[!] ADMIN_KEY not set — DB not updated.'); return; }
  const url = `http://localhost:5000/admin/prompts/conversationPrompt.C?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: data['conversationPrompt.C'] })
  });
  console.log('POST conversationPrompt.C →', res.status, await res.text().then(t => t.slice(0, 100)));
}
push().catch(e => { console.error('Push failed:', e.message); process.exit(1); });
