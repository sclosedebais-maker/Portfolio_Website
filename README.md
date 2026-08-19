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

## Running it locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Hosting

The site is static, so anything that serves files will host it. A GitHub Pages
workflow is included at `.github/workflows/pages.yml` — enable it under
repository Settings → Pages by setting the source to "GitHub Actions", and every
push to `main` will publish.
