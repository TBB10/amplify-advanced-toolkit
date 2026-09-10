# Amplify Advanced Toolkit

A Chrome extension for Streamline/Amplify staff. It toggles site-wide custom
HTML snippets on and off in **Preferences → Advanced** ("Site-wide custom HTML
before `</head>` / `</body>`") without opening that UI — it reads and writes the
settings directly through the site's API, using your logged-in browser session.

This repo holds both the extension source (root, `lib/`, `icons/`) and the
shared **snippet library** (`head/` and `body/`). The extension is installed
from the Chrome Web Store; snippets are pulled from this repo, so adding or
editing a file here updates every staff member's toolkit — no extension release
needed.

## Install / use

1. Install from the Chrome Web Store link shared internally (the listing is
   unlisted/private). Chrome keeps the extension itself up to date.
2. Open your Streamline site (any `*.specialdistrict.org` tab, logged in as
   staff).
3. Click the extension icon. On first open it downloads the snippet library
   from this repo; after that it opens instantly from a local copy. It shows
   every snippet with a checkbox reflecting whether it is currently installed
   on the site.
4. Check/uncheck snippets (and set any of their values), then hit **Save**.
5. Reload the public site to see the result.

**Sync.** The **Sync** button (bottom right, with a "Synced 2 days ago" label)
pulls the latest snippets from this repo on demand. The extension also
re-syncs silently on its own at most once a day, so everyone converges on the
same library without any network traffic on ordinary opens. Syncing never
touches your unsaved tweaks.

## Renaming or moving a snippet — read this first

**A snippet's filename is its permanent identity.** The id (`carousel-wave.html`
→ `carousel-wave`) is baked into the marker comments on every site where that
snippet has been installed. That means:

- **Renaming a file**, or **moving it between `head/` and `body/`**, changes its
  id. On every site where the old one is installed, it will show up as
  **"not in library"** — still preserved and still working on the site, but
  unlinked from its checkbox and controls — until someone re-applies the renamed
  snippet there and removes the old one.
- **To change what a snippet does, edit the file in place.** Behavior, CSS,
  title, params — all of that can change freely. Only the filename must stay.
- Pick the filename carefully when you create a snippet. Describe the effect
  (`tighten-accordion-spacing.html`), not the mechanism.

The popup can be resized: drag the small grip in the bottom-left corner to make
it wider/taller (double-click the grip to reset). The size is remembered and
applies on every site. For snippets with settings, clicking the row header
toggles the settings panel open/closed like an accordion (opening a disabled
snippet also enables it; closing never changes enablement — only the checkbox
does). The chevron (▾) does the same, and collapsed/expanded state is
remembered.

Nothing you wrote by hand in the Advanced fields is ever touched: the extension
only manages blocks wrapped in its own `<!-- amplify-toolkit:... -->` marker
comments, and appends them after any existing content.

## Live preview

**Live preview** (checkbox above the list) is on by default. It shows checked
snippets applied to the current tab immediately — great for tuning values like
a color or a logo size without a save-and-reload cycle each time. As you toggle
snippets or adjust their controls, the page updates in real time.

Because preview layers on top of the live page, checking a snippet that's
**already saved** produces no visible change — it's already on the page. The
status line calls this out and suggests adjusting a value (e.g. dragging a color)
to see preview react. To see a snippet appear from scratch, preview one that
isn't installed yet (like the logo-size snippet before it's saved).

Live preview is **not** saved: it's a temporary overlay injected into the page
you're looking at. Hit **Save** to actually persist, then reload the public site
to see the real, freshly-loaded result. Reloading the page at any time clears
the preview.

Closing the popup does **not** lose your work: pending tweaks (checkbox
toggles, adjusted values, the preview switch) are remembered and restored the
next time you open the popup — so you can click away to inspect a part of the
page the popup was covering, reopen, and hit Save. **Save** applies the pending
state for real; **refreshing the page** discards the pending tweaks and starts
over from the saved site state.

It works whether you're viewing the standalone public page or the staff admin
view (where the site is embedded in an `#amplify-frame` iframe) — the preview is
injected into every same-origin frame, so the snippet's selectors match wherever
the real elements live.

Limitations to be aware of:

- Preview only *adds* effects on top of what's already on the page. Turning a
  CSS snippet off in preview reverts cleanly, but if a snippet's `<script>`
  built DOM (like the carousel wave), that stays until you reload the page.
- Because an already-saved snippet is still rendered by the server on the
  current page, preview shows your pending version layered on top. For CSS the
  newer value wins visually, so tuning looks correct; the definitive result is
  always what you get after Save + reload.
- Preview needs the snippet's `<script>`/`<style>` to run under the site's
  content security policy — the same requirement as installing it for real, so
  anything that works when saved also previews.

## Adding snippets

Add a `.html` file to `head/` (injected before `</head>`) or `body/` (injected
before `</body>`) in this repo and push to `main` — either by cloning, or with
GitHub's web editor ("Add file" inside the folder). There's no build step.
Everyone gets it the next time they hit **Sync** (or automatically within a
day). Editing an existing file works the same way.

Before pushing, re-read "Renaming or moving a snippet" above: create new files
freely, edit existing ones in place, but don't rename or move them.

## Snippet file format

A snippet is a plain `.html` file: any combination of `<style>`, `<script>`,
and markup that should be injected verbatim into the page. Two rules matter:

1. **The filename becomes the snippet's identity.** The extension detects
   "already installed" by an ID derived from the filename
   (`carousel-wave.html` → `carousel-wave`). See "Renaming or moving a
   snippet" above — never rename or move a file once it has been pushed; edit
   it in place instead.
2. **Optional metadata goes in comment lines at the very top of the file.**
   Metadata lines are stripped before injection.

### Metadata reference

```html
<!-- title: Carousel Bleed Wave -->
<!-- param: color type=color label="Wave color" default=#1978BE -->
```

- `title:` — display name in the popup. If omitted, the filename is prettified
  (`carousel-wave` → "Carousel Wave").
- `param:` — declares a user-configurable value. May appear multiple times
  (one line per param). Common attributes: `label="..."` (control label) and
  `default=...` (value used when the snippet isn't installed yet).

  Types (`type=`):
  - `color` (default) — color swatch + hex text box. `default=#1978BE`.
  - `number` — numeric input. Supports `min`, `max`, `step`, and `unit`
    (shown as a suffix; the unit stays literal in the CSS). e.g.
    `type=number unit=px min=0 max=40 step=1 default=10`.
  - `range` — a slider (same `min`/`max`/`step`/`unit` as number). Nice for
    live-preview tuning. e.g. `type=range unit=px min=0 max=30 step=1 default=2`.
  - `text` — single-line text box. Optional `placeholder="..."`.
  - `textarea` — multi-line box (for pasting blocks like a font `<link>`
    import). Optional `rows=4` and `placeholder="..."`.
  - `select` — dropdown. `options="a|b|c"`, or labelled: `options="Label:value|..."`.
  - `multiselect` — checkbox group; the chosen option values are substituted
    as a comma-joined list (ideal for a CSS selector list). Options use the
    same `label:value` form, `default` is a `|`-separated list of the values to
    pre-check, and `separator` (default `", "`) controls how values are joined.
  - `fontmap` — a specialized Google-Fonts control (see `head/custom-fonts.html`).
    `options` are the targets in `Label:selector` form. The popup renders a
    searchable font picker **and a weight dropdown** per target, plus an
    "Apply to all" row. A per-target font or weight overrides "Apply to all";
    a weight can be set with no font (styles the theme's own font); and the
    control substitutes a generated `<link>` import + CSS block into the
    snippet's single `{{name}}` placeholder (the body is just that placeholder).

  Notes:
  - `options` are split on `|`. Use `Label:value` (split on the first colon)
    when you want a friendly label; the value may contain commas and colons.
  - A `number`/`range` substitutes just the number — put the unit in the CSS,
    e.g. `width: {{size}}rem;`.

### Placeholders

Reference a param anywhere in the snippet body as `{{name}}`:

```html
<!-- title: Carousel Bleed Wave -->
<!-- param: color type=color label="Wave color" default=#1978BE -->
<script>
  // ...
  path.setAttribute('fill', '{{color}}');
</script>
```

On Save, `{{color}}` is replaced by the chosen value. When the popup opens on a
site where the snippet is already installed, the current value is read back out
of the installed copy — so a wave someone recolored to yellow shows yellow in
the picker, and is still recognized as the same snippet.

**Placeholder rules:**

- Names are `[A-Za-z0-9_-]`, matched case-sensitively: `{{color}}`.
- A `param:` line with no matching `{{name}}` placeholder does nothing.
- A `{{name}}` placeholder with no `param:` line is replaced with an empty
  string — always declare the param.
- The same placeholder may appear multiple times; all occurrences get the same
  value.

### Worked examples

Color param, body snippet that builds DOM:

```html
<!-- title: Announcement Banner -->
<!-- param: bg type=color label="Banner background" default=#B45309 -->
<style>
  #tk-announcement { background: {{bg}}; color: #fff; padding: .5rem 1rem; text-align: center; }
</style>
<script>
  (function () {
    var el = document.getElementById('tk-announcement') || document.createElement('div');
    el.id = 'tk-announcement';
    el.textContent = 'Office closed Friday for maintenance.';
    document.body.prepend(el);
  })();
</script>
```

Number param with a unit (the unit stays literal in the CSS, only the number
is substituted):

```html
<!-- title: Quicklinks Icon Size -->
<!-- param: size type=number label="Icon size" unit=rem min=1 max=20 step=0.5 default=6 -->
<style>
  .amplify-section-container .container header img {
    width: {{size}}rem;
    height: {{size}}rem;
  }
</style>
```

Range slider (identical attributes to number; renders a draggable slider,
best when the user will tune it with live preview on):

```html
<!-- title: Tighten Accordion Spacing -->
<!-- param: space type=range label="Spacing" unit=px min=0 max=30 step=1 default=2 -->
<style>
  .amplify-section-container:has(.accordion) { margin-top: {{space}}px !important; }
</style>
```

Multiselect (chosen option values become a comma-joined CSS selector list):

```html
<!-- title: Hide Elements -->
<!-- param: targets type=multiselect label="Hide" default=".legacy-badge" options="Footer badge:.legacy-badge|Sign-in link:.footer .sign-in" -->
<style>
  {{targets}} { display: none !important; }
</style>
```

Fontmap (the whole Custom Fonts snippet — a searchable per-target Google Font
picker; the body is just the placeholder and the control generates the imports
+ CSS):

```html
<!-- title: Custom Fonts -->
<!-- param: fonts type=fontmap options="Headings (h1-h3):h1, h2, h3|Body (base):body|Paragraphs:p|Links:a|Navigation links:.amplify-navigation ul li a|Quicklink headings:.amplify-quicklinks-container .container header h3" -->
{{fonts}}
```

The shipped files in `head/` and `body/` are the canonical reference — read
them to see the exact conventions in practice.

## Recipe for generating a snippet (for humans and AI agents)

When someone gives you working custom HTML/CSS/JS and wants it as a droppable
snippet file, follow these steps and output a single `.html` file:

1. **Pick the folder by injection point.** `head/` is injected right before
   `</head>`; `body/` right before `</body>`. Rule of thumb: pure `<style>`
   (and `<link>`/font imports) → `head/` so it applies before first paint;
   anything that reads or builds page DOM via `<script>` → `body/`. Never put
   bare markup elements (a loose `<div>`) in `head/`.

2. **Preserve the original CSS/JS verbatim.** Don't reformat, re-indent, or
   "improve" selectors — copy it as given. Your only edits are: add the
   metadata comment lines at the very top, and replace the specific
   hard-coded values the user wants to control with `{{placeholders}}`.

3. **Turn each requested variable into a `param` + `{{placeholder}}`.** Choose
   the type by the kind of value:
   - a CSS **color** → `type=color`, `default=<the original hex>`.
   - a **single number** (px/rem/%/count), especially one worth tuning live →
     `type=range` if it has a sensible min/max to slide, else `type=number`;
     set `unit=` to the CSS unit and keep the unit literal in the CSS
     (`{{n}}px`), not in the value.
   - a **free string** (font-family, a word, a short value) → `type=text`.
   - a **pasted block** (a font `<link>` import, an embed) → `type=textarea`.
   - a **fixed set of choices** → `type=select` with `options`.
   - **which selectors/targets an effect applies to** → `type=multiselect`
     with `Label:selector` options; put the placeholder where the selector
     list goes (`{{targets}} { ... }`).
   Always set `default` to the value that reproduces the *original* look, so an
   unconfigured install matches what the user gave you. Reuse the same
   `{{name}}` for every occurrence that must stay identical (e.g. one `{{space}}`
   used in four rules).

4. **Make scripts self-contained, idempotent, and preview-safe.** A snippet's
   `<script>` runs on every page and may be injected *after* load (live
   preview), so:
   - Run immediately if the DOM is ready, else wait — never rely on
     `DOMContentLoaded` alone:
     `if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();`
   - Guard created DOM with a stable `id`: remove/reuse the prior instance so
     re-running never stacks duplicates (see `body/carousel-wave.html`).
   - If the target may mount late, add a `MutationObserver` fallback that
     disconnects once it succeeds (and after a timeout).

5. **Name it.** Add a `<!-- title: … -->` describing the *effect*
   ("Tighten Accordion Spacing"), and save the file as the kebab-case of that
   title (`tighten-accordion-spacing.html`). The filename is the snippet's
   permanent identity. **Never rename or move an existing snippet file** — if
   you're asked to change a snippet that already exists in `head/` or `body/`,
   edit that file in place and keep its filename exactly as is.

6. **Don't add decorative wrapper comments** ("my script starts here") — the
   extension wraps each snippet in its own marker comments on install.

7. **Sanity-check before handing it off:** every `{{name}}` has a matching
   `param:` line and vice-versa; each `default` reproduces the original
   appearance; units live in the CSS next to `number`/`range` placeholders; and
   the file contains only the metadata comments plus the verbatim snippet.

## How it works (for the curious)

- The Advanced fields are stored as site variables (`html_head_end`,
  `html_body_end`) behind the site's GraphQL API (`/api/graphql`). The popup
  injects a small function into the active tab that reads them with a
  `variable(name:)` query and writes them with the same `setVariable` mutation
  the real Save button uses, authenticated by your session cookie + the page's
  CSRF token. The Preferences UI never opens.
- Each installed snippet is wrapped in
  `<!-- amplify-toolkit:<head|body>:<id> START/END -->` comments. Detection is
  by marker ID (color changes don't affect it). On save, the extension strips
  its own blocks, keeps everything else byte-for-byte, and re-appends the
  checked snippets.
- Snippets installed on the site whose ID isn't in your library (a renamed
  file, or one that was deleted from the repo) are listed as "not in library",
  checked. They are preserved exactly as-is unless you uncheck them.
- The snippet library is fetched from this repo's `head/` and `body/` folders
  via the public GitHub API (`lib/remote.js`, repo set in `lib/config.js`).
  The popup renders from a local cache in `chrome.storage`; a sync lists both
  folders (2 requests) and downloads only files whose git sha changed. GitHub
  allows 60 anonymous requests/hour per IP, so even a whole office syncing
  through one router stays far under the limit. If GitHub is unreachable, the
  popup keeps working from the cache and Sync reports the error.

## Developing the extension

- Load unpacked: `chrome://extensions` → Developer mode → Load unpacked →
  select this folder. Reload after code changes.
- To test snippets before they land on `main`, push them to a branch (or a
  fork) and point `lib/config.js` at it, then Sync. Switch it back before
  packaging.
- Package for the Chrome Web Store with `./package.sh`; it writes
  `dist/amplify-advanced-toolkit-<version>.zip` containing only the extension
  files (the `head/`/`body/` library is fetched at runtime, so it's excluded).
  Upload that zip in the developer dashboard as an **Unlisted** (or Private)
  item and share the install link internally.

## Repo layout

```
manifest.json        MV3 manifest
popup.html/css/js    the popup UI and all logic
icons/               extension icons
head/                snippet library: files injected before </head>
body/                snippet library: files injected before </body>
lib/config.js        which GitHub repo/branch to sync from; auto-sync interval
lib/remote.js        GitHub sync + local cache
lib/markers.js       marker wrap/detect/strip/rebuild
lib/params.js        {{placeholder}} substitution + current-value extraction
lib/snippets.js      snippet file metadata parsing
lib/google-fonts.js  font list for the Custom Fonts picker
package.sh           builds the Chrome Web Store zip
```
