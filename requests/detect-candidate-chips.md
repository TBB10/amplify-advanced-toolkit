# Click-to-assign candidate color chips for detect-enabled params

**Requested by:** Isabella  **Date:** 2026-10-20  **Status:** open

## What we're trying to do
When a designer uses `detect=` on a color param (Quicklinks Template Colors /
D10 Quicklinks, and likely other recoloring snippets), they currently get one
sampled value per field. In practice a site often has 2-3 colors that could
plausibly fill a given role (brand primary, an accent, a secondary brand
color), and the designer wants to see those options side by side and assign
one with a single click, instead of hunting for the right selector or typing
hex codes by hand.

## Is the snippet waiting on this?
No — convenience. A workaround ships today: extra sibling "candidate" params
with their own `detect=` targeting other plausible site elements (e.g. nav
background, footer accent, CTA button), filled by the existing "Detect all"
action. The designer reads each candidate's hex and pastes it into the real
field by hand.

## What exists today
`head/d10-quicklinks.html` (currently in Local Testing, not yet pushed) uses
`type=color` + `detect="selector|property"` per the 1.3.0 syntax, five color
params (cardbg, cardhover, iconbg, icon, text), four of them with `detect`.
"Detect all colors from this page" works and correctly samples each field's
one target. The manual-candidate workaround above also works today with no
extension changes.

## The gap
The popup's color control has no concept of "here are 2-3 candidate values,
click one to use it." Each `type=color` param only ever holds and displays
its own single value — there's no click handler wired to any swatch/chip that
writes a value into a sibling param, and no copy-to-clipboard action either.
This is a popup UI/behavior change; no amount of extra params or detect
attributes in a snippet can produce it. It hits "popup reading the live page
in a new way" and "changes to popup UI behavior" in AGENTS.md Part A.

## Proposed capability (general, reusable)
Extend a `detect`-enabled `type=color` param so it can optionally surface 2-3
detected candidate colors as small clickable chips to the left of the
existing swatch, instead of exactly one sampled value:

    detect="<selector>|<property>" candidates="<selector2>|<property2>, <selector3>|<property3>"

Clicking a candidate chip assigns that color into the field it's attached to
(updates swatch, hex box, and live preview) and copies the hex to the
clipboard, so it's also available to paste elsewhere. If `candidates` is
omitted, behavior is unchanged from today (single eyedropper, no chips). This
is general — any `detect`-enabled param on any snippet could add a short
candidate list: Quicklinks Template Colors, Secondary Nav Button, Social Link
Icons, and future recoloring snippets would all use it.

## Example
```html
<!-- param: iconbg type=color label="Icon circle" default="" detect=".amplify-quicklinks-container article .icon|background-color" candidates=".amplify-header|background-color, .amplify-footer|background-color" -->
```

## Notes
- Candidate chips render to the left of the existing swatch (mockup shared
  with Thomas directly).
- Clicking a chip both assigns the color to the field and copies the hex to
  clipboard.
- If a candidate's computed value is transparent, climb to the nearest
  visible ancestor the same way default `detect` already does.
- `candidates` only applies to params that also declare `detect`; it's
  additive, not a replacement for single-field detect.
- Separately, a plain click-to-copy (no assign) on the existing single-value
  swatch/hex box would also help, but assign-and-copy on candidate chips
  covers the main workflow.
