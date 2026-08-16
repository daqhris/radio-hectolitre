# Day/night theme

The site ships two themes — night (the original look) and day — chosen
automatically on first visit and switchable from a button in the nav from
then on.

## How the decision gets made, and when

1. **First-ever visit, no stored choice yet.** Falls back to the
   visitor's OS/browser setting via `prefers-color-scheme`. Someone with
   their system set to light mode gets the day theme without doing
   anything; dark-mode systems (and everyone else — no preference
   reported at all resolves to no match) get night, matching the site's
   original default.
2. **Every visit after that.** Whatever the visitor last picked from the
   nav toggle, read back from `localStorage`. Their explicit choice
   always wins over the system setting from then on, including if their
   OS-level setting later changes.

This happens in **two places that have to stay in sync**, because a
multi-page static site with no build step re-runs page setup on every
navigation, not once per session:

- **A tiny inline `<script>` in every page's `<head>`, right after the
  viewport meta tag.** This is what actually avoids a flash of the wrong
  theme: it runs synchronously, before the browser paints anything, and
  sets `data-theme="light"` or `data-theme="dark"` on `<html>`. It has to
  be inline (not an external file) and it has to run this early —
  `assets/js/app.js` loads at the bottom of `<body>`, long after first
  paint, so relying on it alone would show night for a fraction of a
  second even to a day-theme visitor. It's duplicated across all 18 HTML
  files rather than shared, same tradeoff as `window.SITE_BASE` — an
  extra network request to fetch a shared snippet would itself reopen the
  flash-of-wrong-theme window it exists to close.
- **`assets/js/app.js`'s `renderThemeToggle()` / `setTheme()` /
  `getTheme()`.** Renders the actual sun/moon button into the nav (so it
  appears on every page via `RadioHecto.initChrome()`, same as the nav
  links and footer) and keeps `localStorage` updated when the visitor
  clicks it.

Both pieces read/write the same `localStorage` key: **`rh-theme`**
(values `"light"` or `"dark"`). If you ever change one, change the other.

## Adding a new page

Copy the theme-init `<script>` block from any existing page's `<head>`
(it must come immediately after the viewport `<meta>` tag, before any
`<link rel="stylesheet">`) — same as you'd carry over `window.SITE_BASE`.
Forgetting it doesn't break the page, it just means that one page always
flashes night before `app.js` catches up and applies the stored/system
theme via the nav — same category of easy-to-miss bug as a wrong
`SITE_BASE`, just less visible since it only shows for a frame.

## Adding or changing a color token

All theme-able colors are CSS custom properties defined twice in
`assets/css/styles.css` — once under `:root,:root[data-theme="dark"]`,
once under `:root[data-theme="light"]` — and used everywhere else via
`var(--token-name)`, never a literal hex value. To add a new token:
add it to both blocks, then use `var(--your-token)` wherever it's needed.

Two tokens exist purely to make theme-switching possible for things a
plain color variable can't do on its own:

- **`--overlay-rgb`** — the *R,G,B triplet* of `--bg` (e.g. `10,10,8`),
  not a color on its own. `rgba(var(--bg), .96)` isn't valid CSS — `rgba()`
  needs three separate numbers, not one packed color — so every
  translucent bar (nav, sticky player, station bar, photo caption,
  archive card badge) uses `rgba(var(--overlay-rgb), .96)` instead. If
  you change `--bg` in either theme block, update that theme's
  `--overlay-rgb` to match, or those bars will stop blending with the
  page background.
- **`--accent-hover`** — a separate hover-state shade for the accent
  circular play buttons, one value per theme block, rather than deriving
  it from `--accent` at runtime (plain CSS can't lighten/darken a
  variable). The lightbox backdrop (`.lightbox-modal`) is the one
  intentional exception to "always use a token" — it stays pure black in
  both themes by design, since a photo viewer's backdrop is conventionally
  near-black regardless of site theme; see the comment above that rule.

## Why these specific light-theme colors

The night palette was designed first and reused as-is; the day palette
had to be chosen, not just inverted, because a few tokens are used as
*text* color, not just backgrounds or borders — `--accent` in particular
is the nav logo, link-hover, and eyebrow-label color, not only a button
fill. The bright lime that reads clearly on near-black (`#c4ef3c`) fails
basic legibility as text on a light background, so the day theme uses a
darker, more saturated moss-green instead. Every text-role token
(`--text`, `--muted`, `--accent`, `--accent-dim`, `--amber`) was checked
against WCAG contrast math for both `--bg` and `--surface` before being
picked; `--red` (the live-dot) only needs to clear the lower bar for
non-text UI (3:1), since it's a small decorative indicator, not a word.
