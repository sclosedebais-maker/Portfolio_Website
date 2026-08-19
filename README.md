# Sonya Close-Debais — personal site

A single-page personal website. No frameworks, no build step: three files, open `index.html` and it works.

```
index.html    structure and copy
styles.css    design system and layout
script.js     theme toggle, scroll reveal, scroll-spy
```

## Before you publish it

The career history is deliberately left blank. Anywhere you see dashed underlined
text on the page, that is a placeholder waiting for you. In `index.html` they are
all marked with `class="ph"` — search the file for `ph` and you will find every one:

- `20XX–20XX` — the years for each role
- `Role Title` — your job title
- `Organisation` — where you did it

There are four roles in the timeline. Add or delete `<li class="timeline-item">`
blocks to match your actual history. Once a placeholder is filled in, remove the
` ph` from its class so the dashed underline disappears.

The `.timeline-desc` sentences under each role are generic on purpose — swap them
for what you actually did.

## Design

Palette is built around a black cockatoo: charcoal ground, a crimson tail-flash
accent, muted garden olive as a secondary, with a chilli orange in the mix.
Typography is Fraunces for display, Inter for body, JetBrains Mono for numerals
and labels. Light and dark themes both ship; the page follows your system setting
by default and the toggle in the top right overrides it (remembered via
localStorage).

## Running it locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Hosting

The site is static, so anything that serves files will host it — GitHub Pages,
Netlify, Cloudflare Pages. For GitHub Pages: repository Settings → Pages → deploy
from branch, pick the branch and the root folder.
