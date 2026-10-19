# AI context: building for the Amplify Advanced Toolkit

You are helping a CivicPlus staff member build site tweaks for Streamline
**Amplify** websites using the Amplify Advanced Toolkit Chrome extension. This
document is the complete specification. Follow it exactly; when it conflicts
with your general instincts, this document wins.

There are two very different kinds of work, and your first job on every
request is to tell them apart:

1. **A snippet** — a `.html` file in `head/` or `body/` of this repo. You can
   build these completely. Pushing one publishes it to everyone's extension.
2. **An extension feature** — anything that needs code inside the extension
   itself (the popup UI, how controls behave, reading the live page from the
   popup, Save/Sync/preview behavior). You **cannot** build these. The
   extension's code lives on Thomas's machine and ships through the Chrome Web
   Store. For these you write a request file into `requests/` (Part C) and the
   user Slacks Thomas.

Most asks are snippets, or a snippet plus a small request. Say which part is
which — "we can build this part; this part needs Thomas" — then do the snippet
part now.

---

# Part A — Snippet or extension feature? Decide first.

## What the extension already gives every snippet (use these, don't rebuild them)

Before deciding something needs new tooling, check this list. Nearly every
"the user needs to be able to adjust X" is already covered by a param type.

| Need | Already provided by |
|---|---|
| User-adjustable color | `type=color` (swatch + hex box, blank = "no color") |
| **Pull a color from the live site into that picker** | `type=color` + `detect="selector\|property"` → eyedropper button; 2+ detectable colors also get "Detect all" |
| User-adjustable size, count, px/rem value | `type=number` with `unit=` `min=` `max=` `step=` |
| Value the user tunes while watching the page | `type=range` (slider) |
| Free text (font name, short value) | `type=text` |
| Pasted block of markup | `type=textarea` |
| Pick one of fixed choices | `type=select options="Label:value\|..."` |
| Choose which elements/selectors an effect applies to | `type=multiselect options="Label:selector\|..."` → comma-joined selector list |
| Google Fonts per text type, with weights | `type=fontmap` |
| Same value in several CSS rules | one param, repeat `{{name}}` |
| "Leave the site's own style unless set" | `default=""` — a blank value makes the CSS declaration invalid, so the site's styling stays |
| See changes before saving | live preview (always on, automatic) |
| Try a file before pushing | the user's Local Testing mode (reads their local `head/`/`body/`) |
| Undo a broken site | Site Recovery in the popup (Actions menu) |
| Values survive the snippet being edited later | automatic (`amplify-params` metadata written by the extension) |

Combine these freely. A snippet with six color params, two of them with
`detect`, a range, and `default=""` fallbacks is normal and needs nothing new.

## The test: does it need code to run *outside the injected HTML*?

A snippet is text the extension drops into the page. Everything it does happens
**inside the page** via that text's own `<style>`/`<script>`. So:

**It's a snippet if** the behavior can be expressed as CSS/JS that runs on the
site's pages, with values exposed through the existing param types above.

**It's an extension feature if** it needs any of these — no snippet can do
them, and no amount of clever script inside the page changes that:

- Code running **in the popup** (new buttons, new fields, new layouts, changes
  to how the list or controls look or behave).
- The popup **reading from the live page** or talking to the site's API in a
  new way (e.g. "detect the current font", "read the site's logo URL").
- A **new param `type=`** or a **new param attribute**. The types/attributes in
  Part B are the complete set. Unknown `type=` values silently fall back to a
  color picker — never invent one.
- Changes to **Save, Sync, live preview, Favorites, Local Testing, Appearance,
  or Site Recovery** behavior.
- Anything about the extension's **permissions**, store listing, or install.
- Loading an asset that isn't on a **public URL**.

Worked example — "Quicklinks Template Colors with a 'detect colors from site'
button": the CSS with six color params is a **snippet** (build it). "Detect
colors" needed the popup to read computed colors from the page and fill the
fields — that was an **extension feature**, so it was requested, Thomas built
`detect=` as a reusable attribute, and now any snippet gets it with one
attribute. That's the pattern: snippets stay simple; reusable capability goes
in the extension once.

## Prefer existing tooling; request new tooling only when it's clearly better

- First, build the ask with the existing param types, even if slightly less
  elegant. A `select` of three presets beats a request for a new control.
- Write a request **when a new reusable capability would make this snippet
  (and likely future ones) materially simpler or possible at all** — not for
  one-off convenience. Good requests describe a *general* tool ("a param
  attribute to read a computed style from the page"), not a one-snippet hack
  ("a Detect button for Quicklinks").
- If you're unsure whether something exists, re-read the table above and Part
  B. Do not assume a feature is missing because you haven't seen it used.

## Where things live (and what you may touch)

```
head/        snippets injected before </head>        ← you may create/edit
body/        snippets injected before </body>        ← you may create/edit
requests/    extension feature requests (Part C)     ← you may create
README.md, AI-CONTEXT.md, AGENTS.md, CLAUDE.md       ← read only
```

Nothing else exists here. The extension's source is not in this repo and you
cannot change it from here.

## Your output

For the snippet part: produce **one complete `.html` file**, state **which
folder it belongs in** and **its exact filename**, in a single code block with
no commentary inside. Then briefly list the params you declared and why.

For any extension part: produce a request file per Part C and tell the user to
Slack Thomas with the filename.

---

# Part B — Snippet file specification

## Step 1 — choose the folder

- Only `<style>` and/or `<link>` (fonts, imports) → **`head/`**, so styles
  apply before first paint.
- Any `<script>` that reads or builds page content (`document.querySelector`,
  `createElement`, `MutationObserver`, etc.) → **`body/`**.
- A snippet with both a `<style>` and a DOM `<script>` → **`body/`**.
- Never put bare markup elements (a loose `<div>`, `<svg>`, text) in `head/`.

## Step 2 — choose the filename (critical)

The filename **is the snippet's permanent identity**. It is baked into every
site where the snippet gets installed; renaming or moving the file later breaks
that link.

- New snippet: kebab-case, `.html`, describing the **effect** not the
  mechanism. Good: `tighten-accordion-spacing.html`, `hide-footer-badge.html`.
  Bad: `fix3.html`, `mutation-observer-nav.html`, `Izzy Test.html`.
- **Editing an existing snippet: keep its filename exactly as is.** Never
  suggest renaming or moving an existing file, even to a "better" name. If the
  user asks to rename one, warn them it will unlink existing installs and tell
  them to coordinate with the extension owner first.

## Step 3 — metadata lines at the very top

Metadata is HTML comments on the first lines of the file. They are stripped
before injection.

```html
<!-- title: Human Readable Name -->
<!-- param: NAME type=TYPE label="Shown in UI" default=VALUE [type-specific attrs] -->
```

- `title:` — always include exactly one. Short, describes the effect.
- `param:` — zero or more, one per adjustable value (see Step 4).
- These two are the only metadata lines that exist. Do not invent others; an
  unknown line is treated as snippet content and injected into the page.
- Nothing may precede the metadata lines except blank lines.

## Step 4 — parameters and placeholders

A param makes one value user-adjustable. Declare it with a `param:` line and
reference it in the body as `{{NAME}}`. The extension substitutes the user's
chosen value for every `{{NAME}}` occurrence.

Param attributes:

- first word after `param:` — the **name**: letters, digits, `_`, `-`; case-sensitive
- `type=` — control type (table below); omit for `color`
- `label="..."` — control label in the popup
- `default=...` — value used until the user changes it (quote it if it has spaces)

| `type=` | Control | Type-specific attributes | Use for |
|---|---|---|---|
| `color` | swatch + hex text box | `detect="selector\|property"` (optional) | any CSS color; `default=#1978be`, or `default=""` for "unset" |
| `number` | number input | `unit=px` (display only), `min=`, `max=`, `step=` | sizes, counts, px/rem/% values |
| `range` | slider | same as `number` | a value the user will tune live (spacing, opacity, radius) |
| `text` | single-line text | `placeholder="..."` | font family name, short free value |
| `textarea` | multi-line text | `rows=N`, `placeholder="..."` | a pasted block |
| `select` | dropdown | `options="a\|b\|c"` or `options="Label:value\|Label2:value2"` | fixed set of choices |
| `multiselect` | checkbox list | `options="Label:value\|..."`, `default="value1\|value2"`, `separator=", "` | which CSS selectors an effect applies to; the chosen values are joined into a selector list |
| `fontmap` | per-target Google Font picker | `options="Label:selector\|..."` | fonts only; body is just `{{NAME}}`; see example |

Hard rules:

1. **Every `{{NAME}}` must have a matching `param:` line, and every `param:`
   must be used at least once.** Unmatched placeholders are replaced with
   nothing; unused params are dead UI.
2. **For `number` and `range`, the control substitutes only the number.** Keep
   the unit in the CSS: `width: {{size}}rem;` — never `default=6rem`.
3. **`default=` must reproduce the user's original value.** If the original
   CSS had `fill: #1978BE`, the param is `default=#1978BE`. A fresh install must
   look exactly like what the user gave you.
4. **One param per independently-adjustable value.** If the same value appears
   in several places and must stay identical (the same spacing in four rules),
   use one param and repeat `{{NAME}}`. If two values could sensibly differ,
   make two params.
5. `options` are split on `|`. Use `Label:value` (split on the first colon)
   when a friendly label helps; the value may itself contain commas and colons.
6. Choose `range` over `number` when there is a sensible min/max and the user
   will want to drag it while watching the page. Choose `number` for counts or
   when the range is open-ended.
7. **`detect="<css selector>|<css property>"`** (color params only) adds an
   eyedropper that samples that property's computed value from the live page
   and fills the picker. Use the selector the snippet itself styles, and the
   property that holds the color: `background-color`, `color`, `fill`,
   `border-color`. A transparent `background-color` climbs to the nearest
   visible ancestor color. Omit `|property` to mean `color`. States that aren't
   on screen (`:hover`, `:focus`) can't be detected — leave those params
   without `detect`. When two or more params have `detect`, the popup also
   shows "Detect all colors from this page".

### What to parameterize

Parameterize what the user asked for. If they didn't say, parameterize:

- every hard-coded **color** that affects appearance
- the obvious **tunable dimension** (a width, a spacing, a radius) if the
  snippet is about sizing

Do **not** parameterize structural selectors, breakpoints, or values that
exist only to make the effect work (`position: relative`, `z-index` hacks,
`display: block`). Over-parameterizing clutters the UI.

## Step 5 — the snippet body

**Preserve the user's CSS/JS verbatim.** Do not reformat, re-indent,
"modernize", rename variables, or change selectors. Your only edits inside the
body are:

- replacing specific values with `{{placeholders}}`
- the script-safety changes in Step 6, when needed

Do **not** add wrapper comments like `<!-- my snippet starts here -->`. The
extension adds its own markers. Do not add `<!-- amplify-toolkit ... -->` or
`<!-- amplify-params ... -->` comments; those are written by the extension.

## Step 6 — script safety (only if there is a `<script>`)

A snippet's script runs on **every page** of the site, and the extension's
live-preview feature injects it into **already-loaded** pages. Ensure:

1. **It runs on an already-loaded page.** `DOMContentLoaded` alone is not
   enough; use:
   ```js
   if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', run);
   } else {
     run();
   }
   ```
   If the user's code uses `document.addEventListener('DOMContentLoaded', fn)`
   directly, wrap it this way. This is the one structural change you are
   allowed to make to their script.
2. **It is idempotent.** Anything it creates gets a stable `id`; before
   creating, remove or reuse the existing element with that id so running
   twice never duplicates.
3. **It tolerates missing targets.** Not every page has the element. Check
   existence before acting. If the element may mount late (carousels, embeds),
   use a `MutationObserver` on `document.documentElement` that disconnects once
   it succeeds, with a `setTimeout` to disconnect after ~15s regardless.

## Reference examples

### Styles only, one color param → `head/`

```html
<!-- title: Secondary Nav Button -->
<!-- param: color type=color label="Text color" default=#ffffff -->
<!-- param: background type=color label="Background color" default=#178483 -->
<!-- param: padding type=number label="Padding" unit=px min=0 max=40 step=1 default=10 -->
<!-- param: radius type=number label="Border radius" unit=px min=0 max=40 step=1 default=9 -->
<style>
.amplify-header .container nav .secondary-container ul li:last-of-type a {
  color: {{color}};
  text-decoration: none;
  background: {{background}};
  padding: {{padding}}px;
  border-radius: {{radius}}px;
  font-weight: 700;
}
</style>
```

### One value repeated, slider → `head/`

```html
<!-- title: Tighten Accordion Spacing -->
<!-- param: space type=range label="Spacing" unit=px min=0 max=30 step=1 default=2 -->
<style>
.amplify-section-container:has(.accordion) {
  margin-top: {{space}}px !important;
  margin-bottom: {{space}}px !important;
  padding-top: {{space}}px !important;
  padding-bottom: {{space}}px !important;
}
.amplify-section-container:has(.accordion) .accordion-header h2 {
  margin: {{space}}px !important;
}
</style>
```

### Multiselect of targets → `head/`

```html
<!-- title: Hide Elements -->
<!-- param: targets type=multiselect label="Hide" default=".legacy-badge" options="Footer badge:.legacy-badge|Sign-in link:.footer .sign-in" -->
<style>
{{targets}} { display: none !important; }
</style>
```

### Colors sampled from the site, with "unset" defaults → `head/`

```html
<!-- title: Quicklinks Template Colors -->
<!-- param: cardbg type=color label="Card background" default="" detect=".amplify-quicklinks-container .quicklinks-container article a|background-color" -->
<!-- param: cardhover type=color label="Card hover background" default="" -->
<!-- param: icon type=color label="Icon" default="" detect=".amplify-quicklinks-container article .icon|color" -->
<style>
.amplify-section-container.amplify-quicklinks-container .quicklinks-container article a:not(:hover) {
  background: {{cardbg}} !important;
}
.amplify-section-container.amplify-quicklinks-container .quicklinks-container article a:hover {
  background: {{cardhover}} !important;
}
.amplify-section-container.amplify-quicklinks-container article .icon svg {
  fill: {{icon}} !important;
}
</style>
```

`default=""` leaves each rule inert until the user sets a color; `detect`
fills a picker from what the site currently shows. The hover color has no
`detect` because hover state can't be sampled from a static page.

### Fonts (special control) → `head/`

```html
<!-- title: Custom Fonts -->
<!-- param: fonts type=fontmap options="Headings (h1-h3):h1, h2, h3|Body (base):body|Paragraphs:p|Links:a|Navigation links:.amplify-navigation ul li a" -->
{{fonts}}
```

### DOM-building script with a color, preview-safe → `body/`

```html
<!-- title: Carousel Bleed Wave -->
<!-- param: color type=color label="Wave color" default=#1978BE -->
<script>
(function () {
  var WAVE_ID = 'carousel-bleed-wave';

  function makeWave() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.id = WAVE_ID;
    svg.setAttribute('viewBox', '0 0 1773 110');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.position = 'absolute';
    svg.style.left = '0'; svg.style.right = '0'; svg.style.bottom = '-1px';
    svg.style.width = '100%'; svg.style.height = '110px';
    svg.style.pointerEvents = 'none';
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M681.358 99.6025C419.811 130.111 119.139 45.2462 -0.00375175 0L-0.00390625 110H1773V47.7646C1253.91 -13.3418 965.155 66.4982 681.358 99.6025Z');
    path.setAttribute('fill', '{{color}}');
    svg.appendChild(path);
    return svg;
  }

  function run() {
    var carousel = document.querySelector('.amplify-carousel-container');
    if (!carousel) return false;
    if (getComputedStyle(carousel).position === 'static') carousel.style.position = 'relative';
    var old = document.getElementById(WAVE_ID);
    if (old) old.remove();
    carousel.appendChild(makeWave());
    return true;
  }

  function boot() {
    if (run()) return;
    var mo = new MutationObserver(function () { if (run()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
</script>
```

## Final self-check before you answer

- Folder is correct for the content (styles → `head/`, DOM scripts → `body/`).
- Filename is kebab-case `.html` describing the effect; if editing an existing
  snippet, the filename is unchanged.
- Exactly one `title:` line; it's the first thing in the file.
- Every `{{name}}` ↔ `param:` pair matches; names are case-consistent.
- Every `default=` reproduces the original value; units stay in the CSS.
- The user's CSS/JS is otherwise verbatim.
- Any script runs on an already-loaded page, is idempotent, and tolerates a
  missing target.
- No decorative wrapper comments; no `amplify-toolkit` / `amplify-params`
  comments.

---

# Part C — Requesting an extension feature

When Part A says a piece of the ask is an extension feature, don't try to
build it, approximate it with hacks, or tell the user it's impossible. Write a
request file and tell them to Slack Thomas.

## Before writing a request

1. Re-check Part A's table and Part B. Many "missing" features exist.
2. Separate the ask: build the snippet portion now with existing tooling,
   leaving a clear gap for the requested capability (e.g. the param exists but
   has to be filled by hand until the feature ships).
3. Think **general**. The request should describe a reusable capability that
   any snippet could use, phrased as a param type/attribute or a popup
   behavior — not a one-snippet special case. `detect=` is the model: one
   attribute, every color param can use it.

## Writing the request

Create **one Markdown file** at `requests/<kebab-case-title>.md`. Use this
exact structure (also in `requests/_template.md`):

```markdown
# <Short title of the capability>

**Requested by:** <name>  **Date:** <YYYY-MM-DD>  **Status:** open

## What we're trying to do
<One paragraph: the user-facing goal, in plain language. Which snippet(s)
this is for and what the designer's workflow would look like.>

## What we built with existing tooling
<The snippet file(s) created or edited, and exactly what part works today.>

## The gap
<Precisely what can't be done from a snippet, and why (which bullet of
Part A's test it hits).>

## Proposed capability (general, reusable)
<How it would be declared in a snippet's metadata and how it would behave in
the popup. Prefer a new attribute on an existing type over a new type; prefer
a new type over a popup-wide behavior change. Include a one-line example.>

## Example
<A short snippet excerpt showing the proposed syntax in use.>

## Notes
<Edge cases, alternatives considered, anything Thomas should know.>
```

Rules:

- Filename describes the capability, not the snippet:
  `detect-computed-color-for-params.md`, not `quicklinks-request.md`.
- One capability per file. Two unrelated needs → two files.
- Don't include extension source code. Thomas owns that; describe behavior.
- Commit the request together with the snippet work, push, and tell the user:
  "Slack Thomas: `requests/<file>.md` is ready."

## After the request ships

Thomas marks the request `Status: done` (or `declined` with a reason) and
notes the released version. The user updates their extension (Chrome does this
automatically), then you update the snippet to use the new capability.

---

# Quick reference: what you can never do from a snippet

- Add a new param `type=`, attribute, or metadata line → **request**.
- Change popup UI, Save/Sync/preview/Favorites/Local Testing/Appearance/Site
  Recovery behavior → **request**.
- Have the popup read the live page or the site's API → **request**.
- Load assets that aren't on a public URL → not possible; inline them.
- Rename or move an existing snippet file → never; edit in place.
