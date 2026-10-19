# Amplify Advanced Toolkit — snippet library

This repo is the shared library of site tweaks ("snippets") for the **Amplify
Advanced Toolkit** Chrome extension used by CivicPlus staff on Streamline
Amplify sites.

It contains exactly two things that matter:

```
head/   snippets injected right before </head>   (styles, font imports)
body/   snippets injected right before </body>   (scripts that touch the page)
```

Everyone's extension downloads these two folders straight from GitHub. **Push a
`.html` file here and it's in every staff member's toolkit** — on their next
Sync, or automatically within a day. No build step, no app update, no review.

The extension itself (its code, its Chrome Web Store listing) is **not** in this
repo and is maintained separately by Thomas. If you need the extension to do
something new — a new kind of control, a change to how preview or Save works,
the popup reading something off the page — that's an **extension feature**:
write it up as a file in [`requests/`](requests/) (there's a template and a
worked example) and Slack Thomas. He builds it, ships a new version, and you
update your snippet to use it. Most asks split into "snippet part now, request
for the rest"; `AI-CONTEXT.md` Part A explains how to tell them apart.

> **Using an AI assistant?** Tell it to read [`AI-CONTEXT.md`](AI-CONTEXT.md)
> first. It's the complete spec, written for an AI: what the extension already
> provides, how to decide snippet-vs-extension, the file format, and how to
> write a request. Claude Code and Cursor pick it up automatically via
> `CLAUDE.md` / `AGENTS.md` when opened in this folder.

---

## The three rules

1. **Only touch `head/`, `body/`, and `requests/`.** Everything else here is
   documentation.

2. **Never rename, move, or delete an existing snippet file.** The filename is
   the snippet's permanent identity — it's baked into every site where the
   snippet is installed. Renaming `carousel-wave.html` or moving it between
   folders makes it show up as **"not in library"** on all those sites
   (still working there, but unlinked from its checkbox and controls) until
   someone re-applies the new one. To change what a snippet does, **edit the
   file in place** — title, CSS, script, params, defaults are all fair game.
   If a rename is truly needed, talk to Thomas first.

3. **Adding a file is safe; editing one is live.** A new snippet does nothing
   until someone checks it on a site, so pushing one is harmless. Editing an
   existing snippet changes what people get the next time they Save it on a
   site — so test edits on a test site before you push.

---

## Workflow

### Add or edit a snippet

**On GitHub (no tools needed):** open [`head/`](head/) or [`body/`](body/) →
**Add file → Create new file** (or click the pencil on an existing file) →
paste → **Commit changes** to `main`.

**With git:**

```sh
git pull
# add or edit a file in head/ or body/
git add head/my-snippet.html
git commit -m "Add my-snippet: what it does"
git push
```

### Test it

1. In the extension popup, click **Sync**. Your snippet appears in the list.
2. On a **test site**, turn on **Live preview**, check the snippet, and confirm
   it does what you expect — including on a page that *doesn't* have the
   element it targets.
3. If it has params, change each one and watch the page react.
4. Fix and push again as needed. Nothing reaches a real site until someone
   checks it there and hits Save.

If a snippet ever breaks a site, the **Site Recovery** button at the bottom of
the popup reloads the page with custom HTML disabled so you can uncheck it and
Save.

---

## Snippet file format (short version)

A snippet is a plain `.html` file: optional metadata comments at the top, then
the HTML/CSS/JS that gets injected into the page exactly as written.

```html
<!-- title: Secondary Nav Button -->
<!-- param: color type=color label="Text color" default=#ffffff -->
<!-- param: padding type=number label="Padding" unit=px min=0 max=40 step=1 default=10 -->
<style>
.amplify-header nav .secondary-container ul li:last-of-type a {
  color: {{color}};
  padding: {{padding}}px;
}
</style>
```

- `title:` — the name shown in the popup.
- `param:` — one line per value the user can adjust. Put `{{name}}` in the body
  where the value goes. Types: `color`, `number`, `range`, `text`, `textarea`,
  `select`, `multiselect`, `fontmap`. Set `default=` to the value that
  reproduces the original look. A color param can add
  `detect="selector|property"` to get an eyedropper that samples the site's
  current color.
- Filenames: kebab-case, describing the effect (`tighten-accordion-spacing.html`).
- Scripts must work on an already-loaded page, must not stack duplicates when
  run twice, and must tolerate a missing target element.

The full specification — every type, every attribute, worked examples, and the
rules for scripts — is in [`AI-CONTEXT.md`](AI-CONTEXT.md). It's written for AI
assistants but it's the reference for humans too.

---

## Checklist before you commit

- [ ] Right folder: `head/` for styles/imports, `body/` for scripts that touch the page
- [ ] New file or in-place edit — **not** a rename or move
- [ ] Has a `<!-- title: ... -->` line
- [ ] Every `{{placeholder}}` has a `param:` line and vice versa
- [ ] Every `default=` reproduces the original look; units stay in the CSS
- [ ] Tested on a test site with Live preview, including a page without the target element
