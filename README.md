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

## Just open it

`sonya-close-debais.html` is the whole site in one file: CSS and JavaScript are
inlined, so it needs nothing else next to it. Double-click it and it opens in your
browser. You can email it, put it on a USB stick, or drop it on any web host as-is.

It is generated from the three source files, so edit those and regenerate rather
than editing the bundle by hand.

## AI Value Assessment

`ai-value-calculator.html` is a standalone tool for building the business case
behind an AI use case. It is self-contained — one file, no build step, no
dependencies — so it opens by double-clicking it, the same as the rest of the
site.

It has two depths, switched in the header:

- **Quick — POC.** One page of inputs, sized for deciding whether a proof of
  concept is worth running. Time released is built up from people, hours, loaded
  cost and realistic adoption; everything else is one honest number each. The
  low and high cases are set automatically at ±40% of the base.
- **Full — Solution.** Six steps for a real investment decision: governance
  thresholds, the use case definition and evidence, low/base/high financials
  across five benefit and six cost categories, eight weighted non-financial
  dimensions, ten readiness and risk control areas, and a decision dashboard.

Both depths run the same calculation engine, so the two modes can never
disagree with each other.

### What it works out

Net present value, return on total cost, payback, and the annual cash-flow
profile — each carried through the low, base and high case over a horizon you
set. Benefits are ramped (year 1, year 2, year 3 onward), grown, and cut by an
evidence-confidence haircut before any of it counts. Non-financial value,
delivery readiness and residual risk are weighted 0–5 scores, where 0 means
"not assessed" and is excluded rather than counted as a zero.

On top of the numbers it produces the parts of a business case that usually get
argued about:

- **Decision gates** — every threshold tested individually, so a "no" comes with
  the reason attached.
- **Sensitivity** — each driver moved through a realistic range with everything
  else held still, ranked by how far it swings the NPV, plus the annual benefit
  needed to break even.
- **Value profile** — financial value, broader value, readiness and risk control
  on one radar, which is where a case with a hollow in it shows up.
- **A written summary** generated from the inputs, ready to paste into a paper.

Export sits in the header menu: print or save as PDF, copy the summary as plain
text, or download the case as JSON and open it again later.

### Notes

The model is adapted from an AI Business Value Calculator workbook, with the
same categories, weightings and gate logic. Two things were changed
deliberately: payback is calculated from the cumulative position crossing zero
and interpolated within the year, rather than dividing the investment by an
average year; and the evaluation horizon is adjustable instead of fixed at five
years.

Everything typed in stays in the browser. Inputs are remembered in
`localStorage` between visits — with one caveat: Chrome disables `localStorage`
for pages opened directly from disk over `file://`, so if you want the tool to
remember your work, serve it with `./serve.sh` rather than double-clicking it.
The tool itself works either way.

The palette is orange, black and white, and reads as heat: the stronger the
case, the hotter the page runs. It follows the system light or dark setting,
with a toggle in the header.


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
