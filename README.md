# Sonya Close-DeBais — personal site

A single-page personal website. No frameworks, no build step: three files, open
`index.html` and it works.

```
index.html    structure and copy
styles.css    design system and layout
script.js     theme toggle, scroll reveal, scroll-spy
```

## Content

Career history, selected work, study and speaking are all drawn from the real
profile: Data & AI Business Advisory Lead at Avanade, twelve years at Suncorp
Group before that, and a Master of Design (Research) in design innovation from
QUT. Everything on the page is editable directly in `index.html` — the copy is
plain HTML, not templated.

## Design

The palette is built around a black cockatoo: charcoal ground, a crimson
tail-flash accent, muted garden olive as a secondary, with a chilli orange in the
mix. Typography is Fraunces for display, Inter for body, and JetBrains Mono for
numerals and labels. The section numbers and metric lines borrow their look from
F1 timing screens.

Light and dark themes both ship. The page follows the system setting by default;
the toggle in the top right overrides it and the choice is remembered in
`localStorage`.

Accessibility: single `h1`, ordered headings, a skip link, visible focus rings on
every interactive element, AA contrast in both themes, and a
`prefers-reduced-motion` path that disables all animation.

## Prototypes

`prototypes/accelerated-underwriting.html` is a self-contained working demo:
**Accelerated Medical Underwriting & APS Synthesis**. It simulates an agentic
life insurance pipeline end to end.

An eighty-page Attending Physician Statement is triaged page by page, the two
material pages are deep-read with the extracted values highlighted in the raw
text stream, and eight clinical entities land in a structured medical graph —
every one of them carrying the page it came from. Four agents run in sequence:
document parsing, medical reasoning (ICD-10 mapping, debits, comorbidity
detection), requirements drafting, and actuarial pricing. It ends on a
conditional offer, an audit memo where every debit links back to its source
page, and a human sign-off gate. Nothing issues until a person presses the
button.

The whole run takes about 24 seconds of wall clock against an industry
benchmark of 30 to 45 days. A turbo toggle runs it at 4× for impatient
audiences; the timer always shows real elapsed time, never a faked one. Click
any `p.12 ↗` citation to jump to that page in the document pane.

The drawer at the bottom shows each agent's system prompt and its input and
output JSON payload, so the contract between agents is visible rather than
implied. The applicant, the APS and the rate basis are all synthetic — it is a
prototype, not a quote.

It is one file with no dependencies and no build step. Open it directly, or
follow the link from the Selected work section of the site. It is deliberately
not part of `sonya-close-debais.html`, which stays a single self-contained page.

## Just open it

`sonya-close-debais.html` is the whole site in one file: CSS and JavaScript are
inlined, so it needs nothing else next to it. Double-click it and it opens in your
browser. You can email it, put it on a USB stick, or drop it on any web host as-is.

It is generated from the three source files, so edit those and regenerate rather
than editing the bundle by hand.

## Running it locally

```sh
./serve.sh
```

That serves the folder and opens <http://localhost:8000> in your browser. Pass a
port if 8000 is taken: `./serve.sh 3000`. Ctrl+C stops it.

If you would rather not use the script, this is all it does:

```sh
python3 -m http.server 8000
```

You can also just double-click `index.html` to open it straight from disk. Every
part of the page works that way, including the theme toggle and the scroll
animations, because there is no build step and nothing is fetched from your own
server. The only reason to prefer the local server is that it matches how the
site will behave once hosted.

## Hosting

The site is static, so anything that serves files will host it. A GitHub Pages
workflow is included at `.github/workflows/pages.yml` — enable it under
repository Settings → Pages by setting the source to "GitHub Actions", and every
push to `main` will publish.
