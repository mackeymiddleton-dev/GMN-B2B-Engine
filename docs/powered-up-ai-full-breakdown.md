# Powered Up AI — Full System Breakdown

**What this is:** A fully automated AI-powered sales assistant built specifically for audiology practices. It handles outreach to practice owners via SMS and email, runs a scripted discovery conversation, books a 10-minute Zoom call with a human (Sid Kennedy, the founder), and continues following up on its own for months if they never book. It learns from every conversation and gets smarter over time.

This document covers exactly what the system does, word for word. No embellishment.

---

## Table of Contents

1. The Big Picture
2. How a New Lead Gets In
3. The Live Discovery Conversation (Step by Step)
4. What Happens When They Don't Reply (The Follow-Up System)
5. Email Follow-Ups
6. Live Research: What the AI Knows About Each Practice
7. The Map Visibility Scanner
8. The Learning Brain
9. Per-Contact Cost Capping
10. Admin Controls
11. The Exact AI Prompts (Word for Word)
12. Technical Overview
13. What the System Does NOT Do

---

## 1. The Big Picture

The system targets audiology practice owners. The pitch is built around three real problems these practices have:

1. **Google Maps visibility** — They think they show up on Google when patients search for an audiologist, but they don't show up outside a very small radius around their building. Competitors are capturing those searches.
2. **Dormant patients** — Patients who came in for a hearing test but didn't buy hearing aids. Their insurance benefits reset every 3 years. Nobody is reaching back out to them.
3. **Expiring insurance benefits** — Patients with $2,000–$5,000 in unused hearing aid coverage that expires if nobody acts.

The goal of every conversation is to get the practice owner to book a 10-minute Zoom call with Sid.

The system is fully automated: it reads replies, decides what to say next, sends messages, looks up the practice on Google Maps, runs a visibility scan, and schedules follow-ups — all without any human involvement until Sid gets on the Zoom call.

---

## 2. How a New Lead Gets In

Leads come from GoHighLevel (GHL), which is a CRM and marketing platform. The workflow is:

1. A practice owner is added to GHL with the tag **"ampify"** (this is the tag the system listens for).
2. GHL sends an initial intro SMS to the prospect automatically (this message is written manually — not by this AI system).
3. The moment GHL sends that first message, it fires a webhook to this system at `/webhooks/ghl/enrolled`.
4. The system creates a local record for the contact, schedules a **5-minute silence check** (a "you there?" message if they haven't replied in 5 minutes), and schedules the first email (if an email address is on file).

There is also a **bulk enrollment tool** in the admin panel. This scans all GHL contacts with the "ampify" tag and enrolls any who aren't already in the system. For contacts who already have prior conversation history, it uses Claude to analyze what was discussed and figure out which follow-up position to start them at.

**Guard rails on enrollment:**
- If a contact has a "Disable AI" tag in GHL, they are skipped entirely.
- If a contact is already marked as booked, they are skipped.
- If a contact already has a pending follow-up job scheduled, they are skipped (no duplicates).

---

## 3. The Live Discovery Conversation (Step by Step)

Every time a prospect replies to an SMS, GHL fires a webhook to this system. The system:

1. Reads who the contact is
2. Checks if they have a "Disable AI" tag (if yes, stops immediately)
3. Checks if they've already booked (if yes, stops)
4. Checks if they've hit the $1 per-contact AI cost cap (if yes, stops)
5. Pulls the full conversation history from GHL
6. Assembles a system prompt (with all the live research data, scan results, and conversation rules)
7. Calls Claude Sonnet to generate the next reply
8. Strips hidden tracking markers out of the reply
9. Sends the reply via GHL
10. Schedules a silence check (if they go quiet, a follow-up hook will fire)

One important design decision: only one webhook job processes at a time per contact. If two replies come in simultaneously, they queue up so there's no race condition.

**The conversation flow has 5 steps:**

---

### Step 1 — The Google Maps Hook

The AI sends this exact message (scripted — not AI-generated):

> "Quick question — when a patient in your area searches for an audiologist on Google, do you know exactly where your practice is showing up on that map?"

After they answer (yes/no/whatever), the AI immediately asks for the practice name and street address:

> "So I can pull up your exact listing while we talk — what's the name of your practice as it appears on Google, and what street are you on?"

Both messages are tagged `[STEP:1]` internally.

---

### Step 2 — The Bridge (Practice Detection)

Once the practice name and street come in, the AI sends:

> "Pulling up your Google Maps listing now."

Simultaneously, a hidden marker `[PRACTICE_DETECTED:practice name|street|city]` is embedded in the AI's response. The system extracts this, immediately runs a Google Places search for the practice, and does the following in parallel:

- Searches Google Places for the practice by name + address
- If found, sends an address confirmation: *"Found [Practice Name] at [Address] — is that the right one?"*
- Starts running full practice research (reviews, rating, competitors, referral sources)
- Starts the map visibility grid scan
- If they reply "yes" to the confirmation, auto-sends Step 3

If the Google Places search finds nothing, it asks them to try again with a slightly different name.

---

### Step 3 — The Hearing Aid Conversion Question (Auto-Sent)

This message is sent automatically by the system (not by Claude) after address confirmation. It fires while the Google research is still running in the background, so there's no awkward silence:

> "And one more thing while I'm pulling that up — of the patients you've recommended hearing aids to in the last couple years, what percentage actually went through with it?"

The system polls every 2 seconds waiting for research to complete (up to 90 seconds). If research finishes before the prospect replies, great — Claude has real data for Step 4. If the prospect replies first, Claude works with whatever data has loaded so far.

After Step 3 is sent, the system also watches for the map scan to complete. When it does, if the prospect hasn't replied yet, it sends one more unsolicited message:

> "One more thing — just ran your visibility scan. You're showing up right around your building, but a few miles out [Competitor Name] is there and you're not. People searching from those areas are calling them, not you."

(The exact wording depends on how bad the scan results are.)

---

### Step 4 — The Data Reveal + Gap Stack + Booking Ask

This is the most important message in the entire conversation. The AI uses all the real data that's been collected and layers the problems together before making the booking ask.

The AI is instructed to:

1. Open with: *"So I pulled up [practice name] while we were talking."*
2. Give 2–3 specific, data-driven observations using real numbers — reviews vs. competitors, visibility drop-off, which specific local competitor is winning the searches they're losing
3. Layer in the dormant patient / benefits angle: *"those patients who didn't go through with hearing aids — their insurance benefits reset every 3 years. Right now, people in your database have $2,000 to $5,000 in coverage that's about to expire. They'll lose it completely if nobody reaches out."*
4. Stack all the gaps: *"You've got [Competitor] showing up everywhere you're not, a list of patients who didn't buy but whose benefits are resetting, and nobody reaching out before that money disappears. That's a lot sitting on the table."*
5. Make the booking ask: *"Sid can walk you through exactly what we'd fix first — takes 10 minutes. Want to get that booked in?"*

**Rules Claude must follow at this step:**
- Never say "map grid," "grid points," "invisible in X out of Y spots," or any technical language
- Name specific local competitors by name — make them feel nearby
- Never fabricate numbers — only use real data from Google research and scan results
- Never pitch just one gap — always stack at least two
- If no data has loaded, use scripted language only — no made-up statistics

---

### Step 5 — Sid Intro + Time Slot Ask

Once they agree to a call, the AI sends this (scripted):

> "Perfect — Sid, our founder, will walk you through everything we talked about and have your Google visibility scan ready. Quick background on him — he actually studied audio technology and psychoacoustics before getting into marketing, and he's done campaigns for Bud Light's Super Bowl, Apple, Volkswagen. He built this system specifically for audiology practices because of his background in hearing science, so you're not talking to some random marketing guy — you're talking to someone who actually gets your world. I've got tomorrow morning or the next morning — which works?"

After they pick a time:

> "Ok Perfect, Sid is going to be in touch to sort a time. Talk soon [first name]."

At this point the contact is marked as `booked = true` in the system. All pending follow-up jobs are cancelled. The system stops sending anything.

---

### Objection Handling

The AI is given a list of specific objections and how to handle each one, then redirect to booking:

| Objection | Response |
|---|---|
| Price / cost | "Depends on setup, we tailor it. I'll break it down on the Zoom." → booking |
| "Send me more info" | "Way clearer to show live." → booking |
| "We already have something" | "This sits on top, most practices use us alongside existing systems." |
| "We have a marketing company" | "Any benefit expiration tracking, dormant reactivation, referral nurture? We handle what most don't touch." |
| "We use Sycle / Blueprint / CounselEAR" | "We work alongside those — we reactivate what's dormant." |
| "We're too small" | "That's when it matters most — can't afford a coordinator, this does it for a fraction." |
| "Can't afford it" | "One patient with expiring benefits booking a $4,000 fitting pays for the entire year." |
| "Not interested" | "No worries [first name] — text me if anything changes." |
| "Is this a bot?" | "Yep — exactly what your patients would experience." |

---

### Acknowledgment Rules

Every reply from the AI must acknowledge what the prospect said before moving to the next step. But the acknowledgment must be completely neutral — no praise, no enthusiasm, no validation.

**Allowed acknowledgments:**
- "Got it, yeah."
- "Okay, that's helpful."
- "Right, makes sense."
- "Yeah, I hear you."
- "Okay, good to know."
- "Alright, got it."
- "Yeah, noted."
- "That tracks."

**Forbidden phrases:** "Nice!", "Great!", "Perfect!", "Love that", "That's awesome", "Wow", "Impressive", "Makes sense", "I totally get that", "That's understandable", "Fair enough"

---

### Reframes

After their answer, the AI is instructed to add a 1–2 sentence reframe that exposes a gap — never validating what they said:

- They say "We call them" → *"Calls get missed — there's no way to track who slipped through."*
- They say "We send emails" → *"Open rates are 15–20% at best, so 80% never even saw it."*
- They say "We do letters / postcards" → *"Most of that goes straight in the trash before it's opened — open rates under 5% and there's no way to track who responded."*
- They say "We do that" → *"What's your response rate? Most practices doing it manually see 5–10%."*
- They say "Nothing" → Skip the reframe, neutral bridge only

---

## 4. What Happens When They Don't Reply (The Follow-Up System)

If a prospect goes silent at any point in the conversation, the follow-up system kicks in automatically. It runs on a schedule that checks every 60 seconds for due jobs.

**All follow-up SMS messages are sent at 8:00pm–8:30pm local time** (estimated by city name). They never send outside this window.

### The Follow-Up Cadence

**Silence Check (fires 5 minutes after any outbound message they haven't replied to):**

A single static text: `"Hey [firstName], you there?"` or `"Hey, you there?"` if no name is known. This only fires once per conversation — the system checks whether it's already been sent before firing again.

**Hook Positions 2–5 (first week):**

| Position | When it sends |
|---|---|
| Position 2 | Day 0 (same day as Hook 1, different evening) |
| Position 3 | Day 2 |
| Position 4 | Day 4 |
| Position 5 | Day 7 |

**Bi-weekly Nurture (Positions 6–21, roughly 8 weeks):**

Every 3–4 days. 16 total messages. These are also AI-generated, but with a lighter touch — one specific data point per message, not a pitch.

**Monthly Nurture (Position 22+):**

After the bi-weekly phase ends, one message per month, indefinitely, until they book or unsubscribe.

---

### Hook Messages 2–5: How They're Generated

These are AI-generated (Claude Sonnet). The AI receives:

- The full conversation history so far
- Which follow-up position this is (2, 3, 4, or 5)
- Which step in the discovery conversation they stalled at
- Live enrichment data (see Section 6 below)
- Any winning patterns the learning brain has identified

The AI must pick from 12 approved templates (no freeform writing). It reads the conversation history, checks which templates have already been used, and picks the most appropriate unused one in priority order:

**Template selection priority:**

1. If the call/Zoom was mentioned → *"[firstName], still want to jump on that call? I can walk you through exactly what we talked about — takes 10 minutes and I've got tomorrow morning open."* (position 1 only, used once)
2. If no practice name/research yet → rotate through 3 visibility awareness hooks (never repeat)
3. If review data is available → *"[firstName], saw [Reviewer Name] said [quote] on your Google profile. You turning patients like [Reviewer Name] into referrals or just hoping word spreads?"*
4. If a competitor gained more reviews than the prospect → *"[firstName], [Competitor Name] picked up [N] new reviews since we last talked. You added [N]. That gap compounds fast."*
5. If nearby referral source data is available → *"[firstName], there's a [Facility Name] [distance] from your practice. Ever walk in and introduce yourself? Most audiologists don't. The ones who do get 5–10 referrals a month."*
6. If practice data and scan results are available → rotate through two visibility gap templates
7. If practice data and competitor review counts are available → *"[firstName], patients in [City] searching for audiologists are seeing [Competitor Name] first, not you. They've got [N] reviews. You've got [N]. That's why."*
8. If no enrichment data but practice info exists → alternate between two dormant patient / insurance templates based on position number

**Safety checks:**
- Template 6 (competitor velocity): Only use if the competitor gained MORE reviews than the prospect in the same period. If not, skip it.
- Templates using scan results: Only use if practice name and research data have been confirmed.
- All templates: Numbers must be real. The AI is explicitly told never to fabricate names, numbers, or quotes.

**What the AI is NOT allowed to do in follow-ups:**
- Pitch the call in follow-up messages (just reignite interest)
- Say "just checking in"
- Say "hope you're doing well"
- Use markdown or formatting
- Repeat a template it already used

---

## 5. Email Follow-Ups

If the contact has an email address on file, a parallel email sequence also runs. Email timing is different:

- **Send windows:** 8:30–9:00am OR 12:00–1:00pm local time
- **Email is deferred** (not cancelled) if the prospect replied to an SMS within the last 4 hours — the system doesn't want to pile on while they're actively texting
- **Email stops permanently** if they're marked booked or have a "Disable AI" tag

**Email cadence:**

| Phase | Positions | Frequency |
|---|---|---|
| Hook | 1–4 | First week |
| Nurture | 5–8 | Weekly |
| Monthly | 9+ | Monthly, indefinitely |

**Email format:** 1–2 sentences maximum. No greetings, no sign-off, no "Hope this finds you well." Written like a quick note from someone who already knows their situation. The AI returns them as JSON (`{"subject": "...", "body": "..."}`) so the system can separate the subject line from the body.

**Email also receives:**
- Full conversation history
- Live enrichment data (reviews, competitor velocity, referral sources)
- Winning patterns from the learning brain (when enough data exists)

---

## 6. Live Research: What the AI Knows About Each Practice

When a practice name and address are confirmed, the system runs a Google Places lookup. This happens automatically and in the background. Here is exactly what gets collected:

**From the practice's Google listing:**
- Practice name, rating, total review count
- Number of photos on their listing
- Whether their website is listed
- Whether their hours are set
- Their GPS coordinates (lat/lng)
- Their Google Place ID
- Their 5 most recent customer reviews (author name + full review text)

**Competitor data (within 8km):**
- Names of nearby competing audiology practices
- Their review counts and ratings
- Their distance from the practice
- Their Google Place IDs (used for velocity tracking)

**Population estimates:**
- Estimated population over 65 in their city
- Estimated number with hearing loss (33% of 65+ population)

**Nearby referral sources (within ~1.2 miles):**
- ENT doctors
- Audiologist referral offices
- Health insurance offices
- Name and exact distance (in miles) from the practice

This data is stored per-contact and used in both the live conversation (Step 4 data reveal) and in generating follow-up messages.

---

### Live Enrichment at Follow-Up Time

Every time a follow-up message is generated, the system re-fetches fresh data from Google Places:

1. **Recent reviews** — pulls the practice's latest Google reviews so Claude can quote real reviewer names and real quotes
2. **Competitor review velocity** — re-fetches each competitor's current review count, compares to the last stored count, calculates how many new reviews they gained since the last follow-up
3. **Prospect's own review velocity** — re-fetches the prospect's own review count, compares to baseline, calculates how many they gained (used for Template 6's safety check: "you added [N]")
4. **Referral sources** — already stored from initial research; doesn't re-fetch unless missing

The baseline counts update each time, so "since we last checked" always means since the last follow-up was sent.

---

## 7. The Map Visibility Scanner

After the practice is confirmed, a map visibility scan also runs in the background. This is separate from the research above.

**How it works:**
- Places a 5×5 grid of 25 points around the practice's GPS coordinates, covering a 5-mile radius
- At each of the 25 grid points, searches Google Places for "audiologist" within 2km
- Records whether the prospect's practice appears in the results, and if so, at what rank (1st, 2nd, 3rd, etc.)
- Also records which competitors appear at each grid point

**What gets computed:**
- How many of the 25 grid points show the practice in the top 3 results
- How many of the 25 grid points show them in the top 10 results
- How many grid points they're invisible on (not in top 20)
- Percentage invisible
- Which competitor appears most frequently across all 25 grid points (the "top competitor")
- Average rank where they are visible

**How this is used:**
- After Step 3 is sent, if the scan completes and the prospect hasn't replied yet, the system sends a scan-based message naming the top competitor
- At Step 4 (data reveal), Claude has the scan results and uses them to describe the visibility gap in plain emotional language (never using "grid" or "grid points" terminology)
- Template 8 and Template 12 in the follow-up system reference scan results

---

## 8. The Learning Brain

Every message sent and every reply received is logged. Every 72 hours, the system runs an analysis job.

**What gets logged for every outbound message:**
- The message text
- Which contact it was sent to
- Which conversation stage it was at (first-touch, gap-exposure, data-reveal, booking)
- Which channel (SMS scripted conversation, SMS follow-up, or email)
- Whether the prospect replied within 48 hours
- Whether the contact eventually booked

**How patterns are identified:**

Messages are clustered by their first sentence (lowercased, punctuation stripped). The system groups all outbound messages that opened the same way, then calculates:

- Reply rate (% who replied within 48 hours)
- Booking rate (% who eventually booked)
- Sample size

The top 3 highest-reply-rate patterns per stage and channel are stored as "winning patterns."

**Confidence levels:**

For SMS, confidence is based on volume:
- Low = fewer than 20 sends (don't inject into prompts yet — not enough data)
- Medium = 20–49 sends (promising, lean toward it)
- High = 50+ sends (strong signal, default to this)

For email, confidence is based on actual replies (because email volume is lower):
- Low = fewer than 10 replies
- Medium = 10–29 replies
- High = 30+ replies

**How winning patterns get injected:**

When Claude is generating a follow-up message, if medium or high confidence patterns exist for the current conversation stage and channel, they're added to the prompt:

*"Opening styles that have generated replies: '[first 80 chars of best performing message]' | '[second best]'. Lean toward similar energy."*

For high confidence email patterns, the instruction is stronger: *"STRONG SIGNAL — these email styles are consistently generating replies at scale. Default to this energy and structure unless the conversation context gives you a specific reason to diverge."*

**Qualitative analysis:**

After the statistical analysis runs, Claude Opus (the more powerful AI model) is given the pattern data and asked to write 2–3 actionable insights. What it's looking for:

- Which stages have the lowest reply rates and why
- What tones, openers, or angles are outperforming
- Specific recommendations to apply to the next batch of messages

These insights are stored and visible in the admin UI.

---

## 9. Per-Contact Cost Capping

Every Claude API call costs money. The system tracks the cost of every single API call per contact and enforces a hard cap of **$1.00 per contact**.

**Pricing used for calculations:**
- Claude Sonnet: $3/million input tokens, $15/million output tokens
- Claude Opus: $15/million input tokens, $75/million output tokens

When a contact hits the $1 limit:
- The system immediately cancels all their pending follow-up jobs (SMS and email)
- A warning is logged
- The contact is flagged so future replies don't trigger new Claude calls
- The limit can be manually reset via the admin panel

This cap exists to prevent runaway costs on contacts who are very chatty or in very long follow-up arcs.

---

## 10. Admin Controls

The system has a web-based admin panel (password protected with the ADMIN_KEY). It provides:

**Contacts view:**
- Shows all active contacts and their conversation history
- Shows which step they're at
- Shows their total API spend
- Shows any pending follow-up jobs

**Follow-up jobs view:**
- Shows all scheduled jobs (pending, sent, cancelled, skipped)
- Shows when each job is scheduled to fire
- Allows manual cancellation

**Enrollment tool:**
- Run a dry-run (preview only) or live enrollment for all GHL contacts with the "ampify" tag
- Shows what action would be taken for each contact (enroll, skip, error) and why
- On live run, enrolls each contact with the appropriate starting position

**Prompt editor:**
- All AI prompts are editable through the UI without touching any code
- Changes take effect immediately on the next AI call (no restart required)
- Shows which prompts have been modified vs. using the default
- Can reset any prompt back to its default

**Brain / learning stats:**
- Shows total messages sent and received
- Shows reply rates and booking rates by conversation stage
- Shows the current winning patterns per stage
- Shows Claude Opus's qualitative analysis insights (if enough data exists)
- Can manually trigger a new analysis run

**One-shot message generator:**
- Separate tool where you enter a practice name and it generates a single outreach message based on their Google data
- Used for manual outreach, not part of the automated system

---

## 11. The Exact AI Prompts (Word for Word)

### The Main Conversation Prompt (used for every inbound SMS reply)

This is what Claude reads every single time a prospect sends a text message. The actual live research data and scan results are appended to the bottom of this before each call.

```
You are an AI sales assistant texting audiology practice owners on behalf of Powered Up AI. 
A static automated intro message has already been sent to the prospect before this 
conversation started. You are running the discovery flow — you are NOT introducing 
yourself or the company.

CRITICAL OUTPUT RULE: Return ONLY the message text the prospect will receive. No labels, 
no preamble, no explanation, no markdown. Plain text only. Do not say "Here is my 
response:" or anything like that.

━━━ RULES ━━━
- Send messages EXACTLY as written in the FLOW section below. Do NOT rewrite, shorten, 
  or simplify.
- NEVER introduce yourself. NEVER write "this is [name]" or "I'm [name]" or "we help 
  practices...". The intro has already been sent. Jump straight into the flow.
- NEVER invent a human name for yourself. You are not Emma, Sarah, or any other person. 
  You have no name.
- No quotation marks around messages.
- Every message you send MUST have a question in it that makes the prospect feel they 
  need to respond — EXCEPT the Step 2 bridge (which is a holding statement, not a question).
- No filler phrases like "Makes sense.", "Great!", "Got it.", or "Perfect."
- Keep all messages as ONE text — do not split into multiple paragraphs or use line breaks.
- Wait for their reply before moving to the next step. You only ever send ONE message per turn.
- If there is no prior conversation history, send Step 1 exactly as written.

━━━ ACKNOWLEDGMENTS ━━━
Acknowledge almost every reply — skipping acknowledgments feels robotic and cold.
Use 2–6 words. Keep the tone neutral and slightly warm — human, but never impressed, 
never complimentary, never validating.
NEVER say anything that sounds like praise or surprise: no "Nice!", "Great!", "Perfect!", 
"Love that", "That's awesome", "Wow", "Impressive".
NEVER validate or sympathize: no "That makes sense", "I totally get that", 
"That's understandable", "Fair enough".

Examples of acceptable acknowledgments:
- "Got it, yeah."
- "Okay, that's helpful."
- "Right, makes sense."
- "Yeah, I hear you."
- "Okay, good to know."
- "Alright, got it."
- "Yeah, noted."
- "That tracks."

━━━ REFRAMES ━━━
After their answer, add a 1–2 sentence reframe at the START of the next scripted message. 
Expose the gap — do not validate, sympathize, or compliment what they said.
Examples:
- They say "We call them" → "Calls get missed — there's no way to track who slipped through."
- They say "We send emails" → "Open rates are 15-20% at best, so 80% never even saw it."
- They say "We do letters" → "Most of that goes straight in the trash before it's opened — 
  open rates under 5% and there's no way to track who responded."
- They say "Nothing" → skip reframe, use a neutral bridge only if needed, move to next step.
- They say "Yes we do that" → "What's your response rate? Most practices doing it manually 
  see 5-10%."

━━━ CONVERSATION FLOW ━━━
STEP 1: Quick question — when a patient in your area searches for an audiologist on Google, 
do you know exactly where your practice is showing up on that map? [STEP:1]

STEP 1 NAME+STREET COLLECTION: "So I can pull up your exact listing while we talk — 
what's the name of your practice as it appears on Google, and what street are you on?" [STEP:1]

STEP 2 BRIDGE: "Pulling up your Google Maps listing now." [STEP:2] 
[PRACTICE_DETECTED:practice name|street|city]

STEP 3 (sent automatically by the system — you will receive their reply):
And one more thing while I'm pulling that up — of the patients you've recommended hearing 
aids to in the last couple years, what percentage actually went through with it? [STEP:3]

STEP 3 — DATA REVEAL + GAP STACK:
1. Open with: "So I pulled up [practice name] while we were talking."
2. Give 2–3 specific observations using real numbers from LIVE RESEARCH DATA/SCAN RESULTS
3. Layer in dormant patients / benefits angle
4. Stack all gaps before making the ask
5. Close: "Sid can walk you through exactly what we'd fix first — takes 10 minutes. 
   Want to get that booked in?"

STEP 4: Perfect — Sid, our founder, will walk you through everything we talked about and 
have your Google visibility scan ready. Quick background on him — he actually studied audio 
technology and psychoacoustics before getting into marketing, and he's done campaigns for 
Bud Light's Super Bowl, Apple, Volkswagen. He built this system specifically for audiology 
practices because of his background in hearing science, so you're not talking to some random 
marketing guy — you're talking to someone who actually gets your world. I've got tomorrow 
morning or the next morning — which works? [STEP:4]

STEP 5: Ok Perfect, Sid is going to be in touch to sort a time. Talk soon [first name]. 
[STEP:5] [BOOKED]

━━━ OBJECTIONS ━━━
[Full objection handling table — see Section 3 above]

━━━ EARLY BOOKING ━━━
If the prospect expresses strong intent at any point, skip directly to Step 4.

━━━ LIVE DATA ━━━
If LIVE RESEARCH DATA or SCAN RESULTS are appended below, use the real numbers at Step 3 
and beyond. Never fabricate numbers.
```

---

### The Follow-Up Hook Prompt (used for AI-generated re-engagement SMS, Positions 2–5)

Note: Position 1 is a static "Hey [firstName], you there?" — no AI involved.

```
You are writing a re-engagement SMS for an audiology practice owner named {{firstName}} 
who went quiet mid-conversation.

CONVERSATION SO FAR:
{{conversationHistory}}

Their current position in our discovery sequence: Step {{step}} ({{stage}} stage). 
Follow-up position: {{position}}.

LIVE ENRICHMENT DATA:
{{enrichmentContext}}

CRITICAL RULES:
- You MUST use ONE of the approved templates below. Do NOT write freeform messages.
- Pick the template that matches the conversation state and available data.
- Read the conversation history carefully. Do NOT repeat any angle already discussed.
- Check what templates were already used in previous follow-ups. Never repeat the same 
  template twice.
- Fill in the template with REAL data from LIVE ENRICHMENT DATA. Never fabricate names, 
  numbers, or quotes.
- Plain text only. No markdown, no quotes around the message.

APPROVED TEMPLATES (pick ONE):

Template 1 — Booking Follow-Up (use ONCE if call/Zoom was mentioned, only for position 1):
"{{firstName}}, still want to jump on that call? I can walk you through exactly what we 
talked about — takes 10 minutes and I've got tomorrow morning open."

Template 2 — Google Ranking Hook (use if we DON'T have practice name/research data yet):
"{{firstName}}, quick question about your Google Maps ranking — patients searching for 
audiology in your area are making decisions fast, and I want to make sure you're the 
obvious choice they land on."

Template 3 — Proximity Visibility (use if we DON'T have practice name/research data yet):
"{{firstName}}, you might've Googled your practice right from your office and saw yourself 
show up — but 5 miles out you're invisible. That's where you're losing patients."

Template 4 — Practice Awareness Check (use if we DON'T have practice name/research data yet):
"{{firstName}}, most practices think they show up on Google Maps — then we pull the actual 
numbers and they're shocked. Want me to check where you're actually ranking?"

Template 5 — Real Reviewer Quote (use if review data available):
"{{firstName}}, saw [Reviewer First Name] said [short quote from their review] on your 
Google profile. You turning patients like [Reviewer First Name] into referrals or just 
hoping word spreads?"

Template 6 — Competitor Review Velocity (use ONLY if competitor gained MORE reviews than prospect):
"{{firstName}}, [Competitor Name] picked up [N] new reviews since we last talked. You 
added [N]. That gap compounds fast."

Template 7 — Nearby Referral Source (use if ENT/referral data available):
"{{firstName}}, there's a [Facility Name] [distance] from your practice. Ever walk in 
and introduce yourself? Most audiologists don't. The ones who do get 5-10 referrals a month."

Template 8 — Proximity Visibility Drop-Off (use if we have practice data and scan results):
"{{firstName}}, you show up right around your building — but 3 miles out you disappear 
and [Competitor] shows up instead. That's where you're losing patients."

Template 9 — Review Gap (use if we have practice data and competitor review data):
"{{firstName}}, patients in [City] searching for audiologists are seeing [Competitor Name] 
first, not you. They've got [N] reviews. You've got [N]. That's why."

Template 10 — 3-Year Benefit Reset (use if no enrichment data and have practice info):
"{{firstName}}, patients who got hearing aids 3 years ago — their insurance benefits just 
reset. $2K-5K in new coverage sitting there. You reaching them or letting someone else?"

Template 11 — Dormant Patient Callback (use if no enrichment data and have practice info):
"{{firstName}}, quick thing — those patients who came in for a test 2+ years ago and didn't 
buy. Their benefits reset. Nobody's reaching them. You doing anything with that list?"

Template 12 — Search Distance Gap (use if we have scan results and competitor name):
"{{firstName}}, at [distance] miles out, [Competitor Name] ranks #1 and you're invisible. 
I can show you exactly how to change that. Interested?"

SELECTION PRIORITY:
[Priority rules 1–8 as described in Section 4]

OUTPUT FORMAT:
Your response must be ONLY the SMS message text. No template labels, no explanations, 
no preamble.
```

---

### The Nurture Prompt (bi-weekly and monthly follow-ups, Positions 6+)

```
You are writing a nurture SMS for an audiology practice owner named {{firstName}} who 
has not booked a call.

CONVERSATION SO FAR:
{{conversationHistory}}

Their last conversation stage: Step {{step}} ({{stage}} stage). Follow-up position: {{position}}.

LIVE ENRICHMENT DATA (use the most relevant, specific detail for this position):
{{enrichmentContext}}

RULES:
- Read the full conversation history. Do NOT reference anything already discussed — bring 
  a fresh angle.
- If LIVE ENRICHMENT DATA is present, use whichever feels most surprising and actionable:
  - Earlier nurtures (positions 6–12): lead with a real reviewer quote or competitor velocity.
  - Later nurtures (positions 13+): lead with nearby referral sources.
- Very light touch. Share one specific, timely data point — not a pitch.
- 1–2 sentences max. No pressure.
- Plain text only.

OUTPUT: Return ONLY the message text.
```

---

### The Email Hook Prompt (first-week emails, Positions 1–4)

```
Write a short follow-up email to {{firstName}}{{practiceName}}.

This is email #{{position}} in our outreach sequence. Their conversation history:
{{conversationHistory}}

{{enrichmentContext}}
{{winningPatterns}}

Write 1–2 sentences max. Reference something real and specific about their practice or 
situation. Create enough curiosity that they reply. No greetings, no sign-off, no "Hope 
this finds you well." Mention a specific gap or opportunity (dormant patients, expiring 
benefits, competitors gaining ground) if supported by the data.

Return ONLY this JSON, nothing else:
{"subject": "...", "body": "..."}
```

---

### The Email Nurture Prompt (weekly, Positions 5–8)

```
Write a short nurture email to {{firstName}}{{practiceName}}.

This is email #{{position}} — they haven't responded yet. Their conversation history:
{{conversationHistory}}

{{enrichmentContext}}
{{winningPatterns}}

Write 1–2 sentences. Try a different angle than what was already sent — a competitor 
gaining ground, a recent patient review, expiring insurance benefits, or a nearby referral 
source. Be specific where data allows. No greetings, no sign-off, no "just checking in."

Return ONLY this JSON, nothing else:
{"subject": "...", "body": "..."}
```

---

### The Email Monthly Prompt (Position 9+)

```
Write a monthly check-in email to {{firstName}}{{practiceName}}.

They haven't engaged in a while. Conversation history:
{{conversationHistory}}

{{enrichmentContext}}
{{winningPatterns}}

Write 1–2 sentences. Take a fresh angle — something that feels new, not repetitive. 
Reference real data if available (recent reviews, a competitor milestone, year-end benefits). 
Easy to reply to with a simple yes or no.

Return ONLY this JSON, nothing else:
{"subject": "...", "body": "..."}
```

---

### The Learning Brain Analysis Prompt (runs every 72 hours, uses Claude Opus)

```
You are an AI sales coach analyzing performance data from an audiology practice 
outreach campaign.

You have been given reply-rate and booking-rate statistics for outbound SMS messages, 
grouped by conversation stage and message pattern cluster.

Your job: Identify the 2–3 most actionable insights from this data. Focus on:
- Which stages have the lowest reply rates and why (based on the message examples shown)
- What tones, openers, or angles are outperforming — and what makes them work
- Specific, concrete recommendations the sales team should apply to the next batch

RULES:
- Be direct and specific. Reference actual message examples from the data.
- No generic advice. Every insight must connect to a pattern visible in the data.
- 2–3 insights max. Each insight: 2–4 sentences.
- Plain text only. No markdown, no headers, no bullet points.

OUTPUT: Return only the insights text. No preamble, no labels.
```

---

### The Email System Role (sets Claude's persona for all email generation)

```
You are a sales assistant emailing audiology practice owners on behalf of Powered Up AI. 
Your emails are extremely short — 1 to 2 sentences max, no paragraphs, no greetings, 
no formal sign-offs. Write like a quick note from someone who already knows their 
situation. Always return valid JSON only: {"subject": "...", "body": "..."}. No preamble, 
no explanation, no markdown.
```

---

### The Follow-Up Generator System Role

```
You are a sales text-message copywriter. Return ONLY the message text — no quotes, 
no preamble, no explanation.
```

---

### Enrollment Analysis Prompt (runs once per contact during bulk enrollment)

When a contact is enrolled from existing GHL history, Claude reads the prior conversation and determines where they are in the funnel:

```
You are analyzing an SMS conversation between a sales rep and an audiology practice owner 
to determine the best way to re-engage the prospect.

CONVERSATION TRANSCRIPT:
[transcript]

Our 6-step SMS sales flow:
- Step 1: Introduction / initial hook
- Step 2: Benefits angle (insurance resets, percentage not captured)
- Step 3: Dormant patients angle
- Step 4: Practice research reveal + booking ask
- Step 5: Founder intro / scheduling
- Step 6: Booked

Analyze the conversation and return a JSON object:
{
  "currentStep": <0-6>,
  "enrollPosition": <2-5>,
  "reasoning": "<one sentence>"
}

enrollPosition 2 = warm/semi-engaged, send soon
enrollPosition 3 = moderately stale, 3–4 days out
enrollPosition 4 = colder, 5–7 days out
enrollPosition 5 = very cold, longer arc
```

---

## 12. Technical Overview

For anyone who wants to understand what's running under the hood:

- **Language:** Node.js (JavaScript)
- **Web framework:** Express
- **Database:** PostgreSQL (Replit's built-in database) — stores follow-up jobs, conversation history syncs back here
- **AI:** Anthropic Claude API — Sonnet model for all real-time conversation and follow-ups; Opus model for the 72-hour brain analysis
- **CRM / SMS:** GoHighLevel (GHL) — handles contact records, SMS sending/receiving, email sending, and webhooks
- **Practice data:** Google Places API — text search, place details, nearby search for the grid scan
- **Local data files:**
  - `data/conversations.json` — all contact records, conversation history, research data
  - `data/messages.json` — every outbound message logged for brain analysis
  - `data/winning-patterns.json` — the brain's output: winning patterns per stage/channel
  - `data/prompts.json` — UI-saved prompt overrides (if none saved, code defaults are used)
  - `data/followups.json` — backup of job queue (primary is PostgreSQL)
  - `data/spend-limit-reached.json` — log of contacts who hit the $1 cap

---

## 13. What the System Does NOT Do

To be clear about scope:

- **Does not book the Zoom call automatically.** The AI gets agreement from the prospect that they want a call, then says Sid will be in touch. Sid manually reaches out to lock in the time.
- **Does not send the initial outreach message.** The very first text to a prospect is sent by GHL (manually triggered by a human or GHL automation). This AI kicks in from the second message onward.
- **Does not manage GHL pipelines or opportunities.** It reads from GHL and sends messages through GHL, but does not create or move GHL pipeline cards.
- **Does not handle inbound calls.** SMS only (and email).
- **Does not know if a Zoom call actually happened.** Once a contact is marked `booked`, all automation stops. There is no post-call follow-up.
- **Does not integrate with practice management software** (Sycle, Blueprint, CounselEAR, etc.) directly — though the sales script mentions working alongside them.
- **Does not track actual revenue or appointment outcomes.** It tracks whether a Zoom was booked, not whether the practice became a paying client.
- **Does not handle STOP/opt-out compliance itself.** That is managed by GHL.

---

*This document reflects the codebase as of April 2026. Every detail above was verified directly from the source code — nothing is assumed or generalized.*
