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
