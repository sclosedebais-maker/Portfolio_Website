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

## Prototypes

Two visual explorations live alongside the site. Neither is linked from
`index.html`, and neither changes it.

```
prototype.html      Agentic Underwriting — a ten-minute stage demo
demo.css / demo.js  its design system and playback engine

prototype-lap.html  "The lap" — the CV read as a single timed F1 lap
prototype-lap.css / prototype-lap.js
```

### Agentic Underwriting

A live product demo built to a ten-minute stage script: the hook, a
three-agent cascade reading a 120-page attending physician statement, the
missing-data edge case with a human in the loop, and the closing value
comparison. Every figure on screen is synthetic — there is no real applicant
and no real medical record anywhere in it.

It plays two ways, because a stage needs both. Press play and the clock runs,
firing each beat on its own timecode; or step it with the arrow keys, and the
clock snaps to the beat you land on, so a presenter who is talking long never
gets overtaken by their own demo.

```
Space   play / pause          1–4  jump to act
← →     step beat             R    restart
S       presenter script      Esc  close the script
```

### Fonts

Both prototypes self-host their faces from `fonts/`: Newsreader for display,
Archivo for interface, JetBrains Mono for anything measured. The live site
still loads Fraunces and Inter from Google Fonts.
