# S1 — Interest ("$10 a year")

Figma source for the reel frame, built as native layers for the
figma-to-after-effects pipeline (see `../../SKILL.md`).

- **File:** https://www.figma.com/design/FIkU94cZReZL3P5xnERc36
- **Frame:** `S1 — Interest` — node `2:41`, 1080×1920
- **Shared component:** `Cash Stack` — node `2:2`, 330×196 (instanced 3×)
- **Animation spec:** `S1 Notes` caption block under the frame

## How it was built

- No images, no flattening: every element is a rectangle, ellipse, vector or text node.
- Font: Montserrat (Regular / Medium / SemiBold / Bold).
- Text was positioned by **ink** (`absoluteRenderBounds`), so the walker's
  `ink` boxes drop straight into `A.textLayer({x, y})`.
- The card carries the three-shadow stack (contact / lift / ambient) the skill
  asks for, so `A.elevate()` maps 1:1.
- The smeared lower bills in the reference are motion blur from the drop-in, not
  part of the design. The stacks are drawn crisp; turn on motion blur in AE.

## Layer map (back to front)

| Layer | Type | Notes |
|---|---|---|
| BG | rect | `#E4E4E4` full-frame |
| BG Glow | ellipse | white 50%, layer blur 220 → `A.glow` |
| Caption Word | text | "year", Regular 60, centred |
| Cash Stack L / R / C | instance | C is in front; build `Cash Stack` once as a shared precomp |
| Account Card | frame | 652×452, r22, `#F4F4F4`, 3 drop shadows |
| ↳ Account Name, Account Number, Divider, Balance Label, Balance Value, Interest Label, Interest Value, Progress Track, Progress Fill, Rate | | `Progress Fill` is the bar to animate |
| Headline | text | "$10 a year", SemiBold 84, centred |

`figma-nodes.json` has the walker output (comp-space coordinates).
