#!/usr/bin/env node
// Task #65 follow-up fix: the global "asked once at the opening step only"
// rule contradicts the new Step 5 placement of the hearing-aid percentage Q.
// Update the rule to reference the post-confirmation Step 5 placement.

const fs = require('fs');
const path = require('path');
const PROMPTS_PATH = path.join(__dirname, '..', 'data', 'prompts.json');

const data = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
let b = data['conversationPrompt.B'];
const before = b;

b = b.replace(
  'Each scripted question is asked ONCE per conversation. The hearing-aid conversion question (about percentages, who bought, or who recommended) is asked ONCE — at the opening step only. Never again. Not during the Maps lookup. Not after the Maps lookup. Never.',
  'Each scripted question is asked ONCE per conversation. The hearing-aid conversion question (about percentages, who bought, or who recommended) is asked ONCE — at Step 5, immediately after the prospect confirms the address. Never again. Not during the bridge. Not at the data reveal. Never.'
);

const ok = b.includes('at Step 5, immediately after the prospect confirms the address') &&
           !b.includes('at the opening step only');

console.log(ok ? 'YES rule updated to reference Step 5' : 'NO rule update did not match');

if (b === before) {
  console.log('No change (already applied).');
} else {
  data['conversationPrompt.B'] = b;
  fs.writeFileSync(PROMPTS_PATH, JSON.stringify(data, null, 2) + '\n');
  console.log(`Wrote prompts.json. B length: ${b.length}`);
}

if (!ok) process.exit(1);

(async () => {
  const key = process.env.ADMIN_KEY;
  if (!key) { console.warn('[!] ADMIN_KEY not set — DB not updated.'); return; }
  const url = `http://localhost:5000/admin/prompts/conversationPrompt.B?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: b })
  });
  console.log(`POST conversationPrompt.B → ${res.status} ${(await res.text()).slice(0, 120)}`);
})().catch(e => { console.error('Push failed:', e.message); process.exit(1); });
