# Detect a color param's value from the live page

**Requested by:** Isabella  **Date:** 2026-10-16  **Status:** done (shipped in extension 1.3.0)

## What we're trying to do
When a designer applies the Quicklinks Template Colors snippet to a site, they
usually want to start from the site's *current* colors and nudge from there,
not type six hex codes by hand. The workflow should be: open the snippet, click
once to pull the colors the site is already using into the pickers, adjust,
Save.

## Is the snippet waiting on this?
No — convenience. The clean snippet is pushed as
`head/quicklinks-template-colors.html` and fully works; this would make it
faster to use.

## What exists today
`head/quicklinks-template-colors.html` — six `type=color` params with
`default=""` so each rule stays inert until a color is set. Fully functional;
the designer just has to find and type each color manually.

## The gap
Reading the computed colors off the live page and writing them into the
param controls requires code running in the popup (and in the page's main
world across frames). A snippet only injects CSS/JS into the page; it can't
touch the popup UI or the save flow. This hits "the popup reading from the
live page" and "new param type/attribute" in Part A.

## Proposed capability (general, reusable)
A new optional attribute on `type=color` params:

    detect="<css selector>|<css property>"

The popup shows an eyedropper button next to that picker. Clicking it reads
`getComputedStyle(querySelector(selector))[property]` from the live page and
fills the picker with the hex value. When two or more params on a snippet have
`detect`, also show a single "Detect all" action. Any snippet can use it.

Other snippets that would use it: Secondary Nav Button (sample the site's
existing nav colors), Social Link Icons, Quicklinks Color — any snippet that
recolors something the site already renders.

## Example / draft snippet
```html
<!-- param: iconbg type=color label="Icon circle" default="" detect=".amplify-quicklinks-container article .icon|background-color" -->
```

## Notes
- Hover/focus states can't be sampled from a static page; those params simply
  omit `detect`.
- A transparent `background-color` should fall through to the nearest visible
  ancestor's color, since that's what the eye sees.
- Detection should temporarily lift the live preview so it samples the site's
  own colors rather than the snippet's pending override.

**Outcome:** shipped as described. Property defaults to `color` when omitted.
`quicklinks-template-colors.html` updated to use it.
