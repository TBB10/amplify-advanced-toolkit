# Contributing snippets to the Amplify Advanced Toolkit

This guide is for the people who create new site tweaks and publish them to
everyone's extension. If you only *use* the extension, you don't need this —
see the [README](README.md).

Everything you need to know fits in one sentence: **you add or edit `.html`
files in the `head/` and `body/` folders, and that's it.** The rest of this
document explains the rules those files follow and why they matter.

> Working with an AI assistant? Give it [`docs/AI-CONTEXT.md`](docs/AI-CONTEXT.md).
> It's a self-contained spec written for an AI to read, so it can turn your
> raw CSS/JS into a correctly formatted snippet file. You can keep a copy on
> your computer and attach it to any chat.

---

## How the pieces fit together

```
  You push a .html file          Everyone's extension
  to head/ or body/     ──────►  pulls it on Sync
  in this repo                   (or within a day automatically)
```

There are two separate things, and it's important to know which is which:

| | What it is | Who updates it | How it reaches people |
|---|---|---|---|
| **Snippet library** | The `.html` files in `head/` and `body/` | **You** (and anyone with push access) | Automatically — the extension downloads them from this repo |
| **The extension itself** | `popup.*`, `lib/`, `manifest.json`, `icons/` | Thomas only | Chrome Web Store release (requires Google review) |

Because the extension downloads the snippet folders directly from GitHub, a
file you push is live for everyone **immediately** — no app update, no store
review. That's the whole point of this setup, and it's also why the rules
below matter: a bad file goes out to everyone just as fast as a good one.

---

## What you can change

- **Add a new snippet**: create a new `.html` file in `head/` or `body/`.
- **Change what a snippet does**: edit its file in place — the CSS, the
  script, the title, which values are adjustable, the defaults. All of it.
- **Retire a snippet**: delete its file. It disappears from everyone's list on
  their next sync. (Sites where it was installed keep working; it just shows
  as "not in library" there until someone unchecks it.)

## What you can't change (and what to do instead)

Anything **outside** `head/` and `body/` is the extension's own code. You have
the technical ability to edit it (GitHub doesn't do per-folder permissions),
but **please don't** — changes there do nothing for users until Thomas builds
a new version and gets it approved by the Chrome Web Store, and they can break
the extension for everyone who loads it unpacked. Specifically, hands off:

- `popup.html`, `popup.css`, `popup.js` — the extension UI
- `lib/` — the engine (snippet parsing, GitHub sync, markers, params)
- `manifest.json`, `icons/`, `package.sh`
- `README.md` / this file — fine to fix typos, but talk to Thomas about
  substantive changes

**If you need something the snippet format can't do** — a new kind of control
(say, a font-size picker with a unit dropdown), a new metadata field, a change
to how preview works — that's an extension change. Write up what you need and
send it to Thomas; don't try to work around it inside a snippet file.

---

## The one rule that can bite you: never rename or move a file

**A snippet's filename is its permanent identity.** When someone installs
`carousel-wave.html` on a site, the extension writes marker comments into that
site's settings containing the id `carousel-wave`, derived from the filename.
That id is how the extension later recognizes "this snippet is installed
here."

So if you rename `carousel-wave.html` to `hero-wave.html`, or move it from
`body/` to `head/`:

- Every site where it was installed now shows it as **"not in library"** —
  still preserved and still working on the site, but unlinked from its
  checkbox and controls.
- Someone has to visit each of those sites, uncheck the orphaned old one,
  check the new one, and Save.

**The fix is simple: edit files in place, never rename or move them.** Title,
behavior, params — all changeable. Only the filename is frozen once pushed.
Pick names carefully up front: kebab-case, describing the *effect*
(`tighten-accordion-spacing.html`), not the mechanism.

If you genuinely must rename something, tell Thomas first so it can be
coordinated.

---

## Anatomy of a snippet file

A snippet is a plain `.html` file: metadata comments at the top, then the
HTML/CSS/JS that gets injected into the page, exactly as written.

```html
<!-- title: Secondary Nav Button -->
<!-- param: color type=color label="Text color" default=#ffffff -->
<!-- param: background type=color label="Background color" default=#178483 -->
<!-- param: padding type=number label="Padding" unit=px min=0 max=40 step=1 default=10 -->
<style>
.amplify-header .container nav .secondary-container ul li:last-of-type a {
  color: {{color}};
  background: {{background}};
  padding: {{padding}}px;
  border-radius: 9px;
  font-weight: 700;
}
</style>
```

### `title:` — the display name

Shows in the popup. If omitted, the filename is prettified
(`teaser-columns` → "Teaser Columns"). Always include one.

### `param:` — a value the user can adjust

Each `param:` line declares one control that appears under the snippet when
it's checked. The first word is the param's **name**; put `{{name}}` in the
HTML wherever its value should go. Repeat the same `{{name}}` as many times as
you need; they all get the same value.

Common attributes: `label="..."` (shown next to the control) and
`default=...` (used until the user changes it — **set this to the value that
reproduces the original look**, so a fresh install matches what you built).

| `type=` | Renders | Extra attributes | Use for |
|---|---|---|---|
| `color` *(default)* | swatch + hex box | — | any CSS color |
| `number` | number field | `unit=px` `min=` `max=` `step=` | a size, count, px/rem value |
| `range` | slider | same as number | a value worth dragging while live preview is on (spacing, opacity) |
| `text` | text box | `placeholder="..."` | a font name, a short free value |
| `textarea` | multi-line box | `rows=4` `placeholder="..."` | a pasted block |
| `select` | dropdown | `options="a|b|c"` or `options="Label:value|..."` | a fixed set of choices |
| `multiselect` | checkbox list | `options="Label:value|..."` `default="v1|v2"` `separator=", "` | which selectors an effect applies to |
| `fontmap` | Google Fonts picker per target | `options="Label:selector|..."` | fonts — see `head/custom-fonts.html` |

Rules of thumb:

- For `number`/`range`, the control substitutes **just the number** — keep the
  unit in the CSS: `width: {{size}}rem;`, not `default=6rem`.
- `options` are split on `|`. Use `Label:value` (split on the first colon) for
  a friendly label; the value can contain commas and colons.
- Every `{{name}}` must have a matching `param:` line and vice versa. A stray
  placeholder is replaced with nothing; a param with no placeholder does nothing.
- Param names: letters, numbers, `_`, `-`. Case-sensitive.

### Which folder?

- **`head/`** — injected right before `</head>`. Use for `<style>` blocks,
  `<link>` imports, anything that should apply before the page paints.
- **`body/`** — injected right before `</body>`. Use for `<script>` that reads
  or builds page content (the carousel wave lives here).
- Never put bare markup (a loose `<div>`) in `head/`.

### Scripts: three rules

If your snippet has a `<script>`, it runs on **every page** of the site, and it
may be injected into an **already-loaded** page (live preview). So:

1. **Don't rely on `DOMContentLoaded` alone** — it won't fire again on a
   loaded page. Use:
   ```js
   if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', run);
   } else {
     run();
   }
   ```
2. **Make it idempotent.** Give anything you create a stable `id` and remove
   or reuse the previous instance first, so running twice never stacks
   duplicates. See `body/carousel-wave.html` for the pattern.
3. **Tolerate missing targets.** Not every page has a carousel. Check that the
   element exists; if it may mount late, use a `MutationObserver` that
   disconnects once it succeeds (and after a timeout).

### Don'ts

- Don't wrap the snippet in decorative comments ("my script starts here") —
  the extension adds its own markers.
- Don't paste `<!-- amplify-toolkit ... -->` or `<!-- amplify-params ... -->`
  comments into a file. Those are written by the extension at install time.
- Don't reference files that aren't on a public URL. Snippets are plain text
  injected into the page; there's no place to upload assets alongside them.

---

## Workflow

### Adding or editing a snippet

**Option A — GitHub website (no tools needed):**

1. Open the folder on GitHub: [`head/`](https://github.com/TBB10/amplify-advanced-toolkit/tree/main/head)
   or [`body/`](https://github.com/TBB10/amplify-advanced-toolkit/tree/main/body).
2. **Add file → Create new file**, name it `your-snippet-name.html`, paste the
   contents, and **Commit changes** directly to `main`. (To edit an existing
   one, open it and click the pencil.)
3. Done. Hit **Sync** in your extension and it appears.

**Option B — git on your computer:**

```sh
git clone git@github.com:TBB10/amplify-advanced-toolkit.git
cd amplify-advanced-toolkit
# add or edit a file in head/ or body/
git add head/your-snippet.html
git commit -m "Add your-snippet: what it does"
git push
```

### Test before you push (strongly recommended)

A pushed file is live for everyone within a day. Catch problems first:

1. Load the extension unpacked from your clone (`chrome://extensions` →
   Developer mode → Load unpacked → the repo folder) *or* just test the raw
   HTML by pasting it into a test site's **Preferences → Advanced** fields.
2. Open a **test site**, check your snippet with **Live preview** on, and
   confirm it does what you expect — including on pages that *don't* have the
   element you're targeting.
3. If it has params, drag/edit each one and make sure the page reacts.
4. Only then push.

If something does go wrong on a live site, the **Site Recovery** button at the
bottom of the popup reloads the page with custom HTML disabled so you can
uncheck the offender and Save.

### After pushing

- Anyone who clicks **Sync** gets it within a second or two.
- Everyone else gets it automatically the next time they open the popup after
  24 hours have passed since their last sync.
- Edits to an existing snippet reach people the same way. Sites where the old
  version is installed keep the old version until someone re-saves there —
  the extension doesn't silently rewrite live sites.

---

## Checklist before you commit

- [ ] File is in the right folder (`head/` for styles/imports, `body/` for DOM scripts)
- [ ] Filename is kebab-case, describes the effect, and **this is a new file or an in-place edit — not a rename**
- [ ] Has a `<!-- title: ... -->` line
- [ ] Every `{{placeholder}}` has a `param:` line, and every `param:` has a placeholder
- [ ] Every `default=` reproduces the original look
- [ ] Units live in the CSS next to `number`/`range` placeholders
- [ ] Any `<script>` handles already-loaded pages, is idempotent, and tolerates missing elements
- [ ] Tested on a test site with live preview, including a page without the target element

---

## Getting help

Snippet-format questions, "can the extension do X?", or anything touching
files outside `head/`/`body/`: ask Thomas. Found a bug in the extension
itself? Describe what you did, what you expected, and what happened — and
mention which version the `chrome://extensions` card shows.
