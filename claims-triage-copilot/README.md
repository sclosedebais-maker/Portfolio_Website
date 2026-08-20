# Claims & Vulnerable-Customer Triage Copilot — conference demo

A scripted, offline demonstration of AI-assisted claims triage, built for MiniLUCA
(ALUCA) — Melbourne 8 Oct, Sydney 15 Oct, Brisbane 22 Oct 2026.

The demo walks one synthetic claim at a time through five stages: the copilot reads
the file, surfaces bio-psycho-social signals with its reasoning shown, proposes a
case-management pathway, drafts a customer update, and then stops. A person decides.

---

## Running it

Double-click `index.html`. That's it.

One file, no build step, no dependencies, no server. It works from a USB stick, from
a Downloads folder, and with the wifi switched off. There is deliberately nothing to
install on the day.

**What it does not do:** no LLM or API calls, no network requests of any kind, no
`localStorage` / `sessionStorage` / cookies, no external fonts or images, no
analytics. Every word on screen is hard-coded in the file. Given the same clicks it
produces the same output every time — including the timestamps in the audit trail,
which are generated from a fixed base time rather than the system clock, so a
rehearsal and the live run look identical.

---

## Presenting it

**Browser and window.** Any modern browser. Open it, then press <kbd>F11</kbd>
(Windows) or <kbd>Ctrl</kbd>+<kbd>Cmd</kbd>+<kbd>F</kbd> (Mac) for full screen —
the layout is built for a fixed-height window, so the browser chrome is wasted space.
Tested at 1440×900 and 1920×1080. It is not built for phones.

**Presenter mode.** Press <kbd>P</kbd> to show your talking points in the right-hand
panel, keyed to the step you are on. The current step's block is highlighted and
scrolls itself into view as you advance.

> **Important:** the notes panel is part of the page, so it appears on the projector
> too if you are mirroring your display. Either extend your display and drag the
> window to the laptop screen, or present with notes hidden and use them for
> rehearsal only. Press <kbd>P</kbd> to hide before you switch to a projector.

**Editing the notes.** They live in the `notes` object on each case, near the top of
the `<script>` block — five arrays keyed `read`, `signals`, `pathway`, `draft`,
`decide`. Paste your own script in as list items; `<strong>` renders bold and `<em>`
renders in the accent colour for the lines you want to land.

**Keyboard shortcuts** (press <kbd>?</kbd> in the app for this list):

| Key | Action |
| --- | --- |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Jump straight to a case |
| <kbd>←</kbd> <kbd>→</kbd> | Previous / next case |
| <kbd>Enter</kbd> | Advance to the next step |
| <kbd>Backspace</kbd> | Step back one stage |
| <kbd>P</kbd> | Presenter notes on / off |
| <kbd>R</kbd> | Reset the current case |
| <kbd>Shift</kbd>+<kbd>R</kbd> | Reset all three cases |
| <kbd>?</kbd> / <kbd>Esc</kbd> | Open / close the shortcut list |

**Resetting between rehearsals.** <kbd>Shift</kbd>+<kbd>R</kbd> returns all three
cases to their starting state instantly. A page refresh does the same thing, because
nothing is persisted anywhere. There is no state to clear between sessions and
nothing to clean up afterwards.

---

## The three cases

They are ordered low → medium → high so that <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>
escalate with the story.

1. **David Nguyen** (IP-58213) — low complexity. Short, evidenced, employer engaged.
   The copilot recommends fast-track and explicitly recommends *against* a
   rehabilitation referral. One of the two signals is a protective factor. Approve
   and send; move on quickly.

2. **Robert Fenwick** (IP-59902) — medium complexity. A recurrence inside 18 months
   where the return-to-work path that worked last time no longer exists. The signal
   to read aloud is `"I can't do another nine weeks off, financially. I'll manage."`
   — nine words on page 22 that a busy assessor scrolls past.

3. **Priya Sharma** (TPD-40871) — high complexity. Five risk signals in her own words.
   **The copilot declines to draft the customer email**, shows the perfectly good,
   perfectly wrong draft it suppressed, and prepares a call plan for the assessor
   instead. The final action is *"Assign to me — I'll call Priya today"*, not a send
   button. Don't click send. That's the point of the whole thing.

---

## What changed from the seed version

The seed prototype rendered all four panels of a case at once as a static read-only
view, with a single approve button at the end. The rebuild keeps its scenarios,
claim IDs, source-traceability fields and its central beat — the AI recommending a
phone call rather than an automated message for Priya — and turns the rest into
something the audience watches happen. Triage is now a five-step sequence a person
has to advance through, with a progress indicator, a staggered reveal animation on
the signals, and a per-signal reasoning line ("why the copilot flagged this") quoting
the source page. Human control is no longer only asserted in the footnote copy: the
assessor can override the complexity read, set individual signals aside (the pathway
recount updates), pick a different pathway, edit the draft in a live text box, and
every one of those actions is written to a visible audit trail naming the person who
took it. Case three now escalates from "the AI suggests a phone call" to "the AI
refuses to draft the email, shows you the one it suppressed, and hands you a call
guide" — and its decision row has no primary send button at all. Presenter mode,
keyboard-only operation, focus management on each reveal and the full shortcut sheet
are new; so is a strict pass over the palette (the seed's green/amber/red badges are
gone, replaced by a neutral → ink → signal escalation), with the accent darkened to
`#C23F00` wherever it carries small text so every text pairing clears WCAG AA.

## Verification performed

Driven end to end with Playwright in headless Chromium at both 1440×900 and
1920×1080 — all three cases clicked through all five steps to a decision, plus the
complexity override, set-aside, alternative-pathway, assessor-edit, step-back and
reset-all paths:

- 0 console errors, 0 console warnings
- 0 network requests of any kind (no non-`file://` request is ever issued)
- `localStorage.length + sessionStorage.length === 0` after a full run
- no horizontal page scroll, no vertical body scroll, and no clipped content in the
  rail, workspace or notes panel at either resolution
