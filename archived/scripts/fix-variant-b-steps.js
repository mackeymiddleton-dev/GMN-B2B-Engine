#!/usr/bin/env node
// One-shot: fix four real issues in Variant B.
// Idempotent — re-running is a no-op.
// POSTs to the running server so the ai_prompts DB table is updated too.

const fs = require('fs');
const path = require('path');
const PROMPTS_PATH = path.join(__dirname, '..', 'data', 'prompts.json');
const data = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
let b = data['conversationPrompt.B'];
const before = b;

// ── 1. FIX: "STEP 2 NAME+STREET COLLECTION" also ends with [STEP:2]  ───────
//    This is a direct ALWAYS ADVANCE violation (model just sent [STEP:2]
//    for the visibility question; it can't send [STEP:2] again).
//    Give name/street its own step: [STEP:3].
b = b.replace(
  'STEP 2 NAME+STREET COLLECTION (send this IMMEDIATELY after their Step 2 reply, before moving to Step 3):',
  'STEP 3 NAME+STREET COLLECTION (send this IMMEDIATELY after their Step 2 reply):'
);
b = b.replace(
  'Send: "So I can pull up your exact listing while we talk — what\'s the name of your practice as it appears on Google, and what street are you on?" [STEP:2]\nNOTE: Keep [STEP:2] on this message — we are still in the Step 2 exchange collecting info.',
  'Send: "So I can pull up your exact listing while we talk — what\'s the name of your practice as it appears on Google, and what street are you on?" [STEP:3]'
);

// ── 2. FIX: Bridge was "STEP 3", now STEP 4 ──────────────────────────────────
//    Also update the RULES exception ref and the PRACTICE_DETECTED section text.
b = b.replace(
  'EXCEPT the Step 3 bridge (which is a holding statement, not a question)',
  'EXCEPT the Step 4 Bridge (which is a holding statement, not a question)'
);
b = b.replace(
  'STEP 3 BRIDGE (send after they give their practice name and street — this is a holding message, NOT a question):',
  'STEP 4 BRIDGE (send after they give their practice name and street — this is a holding message, NOT a question):'
);
b = b.replace(
  '- Full message: "Pulling up your Google Maps listing now." [STEP:3] [PRACTICE_DETECTED',
  '- Full message: "Pulling up your Google Maps listing now." [STEP:4] [PRACTICE_DETECTED'
);
b = b.replace(
  '- The system will send an address confirmation and then a follow-up question automatically — you do not need to send either here.',
  '- The system will send an address confirmation and then a follow-up question automatically — you do NOT need to send either. Wait until LIVE RESEARCH DATA / SCAN RESULTS appear before generating anything.'
);

// ── 3. FIX: "STEP 4 QUESTION" is labeled [STEP:4] but the server sends  ──────
//    this message automatically (hardcoded STEP3_TEXT) with NO [STEP:N]
//    marker. Claude never generates it. Labeling it [STEP:4] is misleading
//    because (a) Claude doesn't own it and (b) [STEP:4] is now the bridge.
//    Rename the section and remove the marker from the template text.
b = b.replace(
  'STEP 4 QUESTION (sent automatically by the system after address is confirmed — you will receive their reply):\nAnd one more thing while I\'m pulling that up — of the patients you\'ve recommended hearing aids to in the last couple years, what percentage actually went through with it? [STEP:4]',
  'AUTO-SENT QUESTION (sent automatically by the system after address is confirmed — you will receive the prospect\'s reply. Do NOT generate this message yourself):\n"And one more thing while I\'m pulling that up — of the patients you\'ve recommended hearing aids to in the last couple years, what percentage actually went through with it?"'
);

// ── 4. FIX: "STEP 4 — DATA REVEAL" → STEP 5 ─────────────────────────────────
//    The bridge is now [STEP:4]; after the system auto-sends its question
//    and the prospect replies, Claude generates the data reveal, which
//    must be [STEP:5] to satisfy ALWAYS ADVANCE (bridge was [STEP:4]).
b = b.replace(
  'STEP 4 — DATA REVEAL + GAP STACK (after their Step 4 reply):',
  'STEP 5 — DATA REVEAL + GAP STACK (after the prospect answers the auto-sent question):'
);
b = b.replace('LANGUAGE RULES for Step 4:', 'LANGUAGE RULES for Step 5:');
// All closing data-reveal lines emit [STEP:4] — change to [STEP:5].
// The ALWAYS ADVANCE example uses [STEP:4] generically and stays.
b = b.replace(
  'takes 10 minutes. Want to get that booked in?" [STEP:4]',
  'takes 10 minutes. Want to get that booked in?" [STEP:5]'
);
b = b.replace(
  '10 minutes on Zoom. Want to lock it in?" [STEP:4]',
  '10 minutes on Zoom. Want to lock it in?" [STEP:5]'
);
b = b.replace(
  'want to get that in the calendar?" [STEP:4]\nNOTE:',
  'want to get that in the calendar?" [STEP:5]\nNOTE:'
);
// The trailing NOTE line about fabrication also ends [STEP:4]:
b = b.replace(
  'Vague language is always better than a fabricated number. [STEP:4]\n\nSTEP 5',
  'Vague language is always better than a fabricated number. [STEP:5]\n\nSTEP 6'
);

// ── 5. FIX: Booking step "STEP 5" → STEP 6 ───────────────────────────────────
b = b.replace(
  /^STEP 5:/m,
  'STEP 6:'
);
b = b.replace(
  'I\'ve got tomorrow morning or the next morning — which works? [STEP:5]',
  'I\'ve got tomorrow morning or the next morning — which works? [STEP:6]'
);

// ── 6. FIX: Close step "STEP 6" → STEP 7 + fix banned filler ─────────────────
//    "Ok Perfect" violates the RULES ("No filler phrases like… 'Perfect.'").
b = b.replace(
  'STEP 6: Ok Perfect, Sid is going to be in touch to sort a time. Talk soon [use their first name]. [STEP:6] [BOOKED]',
  'STEP 7: Locked in — Sid will be in touch to sort a time. Talk soon [use their first name]. [STEP:7] [BOOKED]'
);

// ── 7. FIX: EARLY BOOKING reference ──────────────────────────────────────────
b = b.replace(
  'skip directly to Step 5.',
  'skip directly to Step 6 (the booking step).'
);

// ── 8. FIX: LIVE DATA reference ──────────────────────────────────────────────
b = b.replace(
  'use the real numbers at Step 4 and beyond.',
  'use the real numbers at Step 5 (Data Reveal) and beyond.'
);

// ── 9. FIX: Sid name rule clarification in RULES ─────────────────────────────
//    The current rule "NEVER invent a human name for yourself" is correct but
//    could read as banning "Sid" — which IS a real person (the founder).
//    Add a parenthetical so there's no ambiguity.
b = b.replace(
  'NEVER invent a human name for yourself. You are not Emma, Sarah, or any other person. You have no name.',
  'NEVER invent a human name for yourself. You are not Emma, Sarah, or any other person. You have no name. (Note: "Sid" in the script refers to the real human founder the prospect is being booked with — not your name. You may reference Sid when the scripted steps do so.)'
);

// ── Verify ────────────────────────────────────────────────────────────────────
console.log('\nStep marker sequence in FLOW (non-example, non-meta):');
const ignore = new Set(['N', 'N+1', 'M']);
[...b.matchAll(/\[STEP:([^\]]+)\]/g)].forEach(m => {
  if (ignore.has(m[1])) return;
  const ctx = b.slice(Math.max(0, m.index - 60), m.index + 12).replace(/\n/g, ' ').trim();
  const ex = ctx.includes('WRONG') || ctx.includes('RIGHT \u2192') || ctx.includes('must NEVER');
  console.log(`  ${ex ? '[ex]' : '[LV]'} [STEP:${m[1]}]  ...${ctx.slice(-70)}...`);
});

// Check the four key fixes
const checks = [
  ['Dual [STEP:2] gone',           !b.includes('"[STEP:2]\nNOTE: Keep')],
  ['Name/street now [STEP:3]',      b.includes('as it appears on Google, and what street are you on?" [STEP:3]')],
  ['Bridge now [STEP:4]',           b.includes('"Pulling up your Google Maps listing now." [STEP:4] [PRACTICE_DETECTED')],
  ['RULES ref updated to Step 4',   b.includes('EXCEPT the Step 4 Bridge')],
  ['Auto-sent Q clearly labeled',   b.includes('AUTO-SENT QUESTION')],
  ['Data reveal is STEP 5',         b.includes('STEP 5 — DATA REVEAL')],
  ['Booking is STEP 6',             b.includes('STEP 6:') && b.includes('which works? [STEP:6]')],
  ['Close is STEP 7',               b.includes('[STEP:7] [BOOKED]')],
  ['Ok Perfect filler fixed',       !b.includes('Ok Perfect')],
  ['EARLY BOOKING updated',         b.includes('Step 6 (the booking step)')],
  ['Sid rule clarification added',  b.includes('Sid\" in the script refers to the real human founder')],
];
console.log('\nFix verification:');
checks.forEach(([label, ok]) => console.log(`  ${ok ? 'YES' : 'NO '} ${label}`));

if (b === before) {
  console.log('\nNo changes needed (already applied).');
} else {
  data['conversationPrompt.B'] = b;
  fs.writeFileSync(PROMPTS_PATH, JSON.stringify(data, null, 2) + '\n');
  console.log('\nWrote prompts.json. B length:', b.length);
}

async function push() {
  const key = process.env.ADMIN_KEY;
  if (!key) { console.warn('[!] ADMIN_KEY not set — DB not updated.'); return; }
  const url = `http://localhost:5000/admin/prompts/conversationPrompt.B?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: data['conversationPrompt.B'] })
  });
  console.log('POST conversationPrompt.B →', res.status, await res.text().then(t => t.slice(0, 100)));
}
push().catch(e => { console.error('Push failed:', e.message); process.exit(1); });
