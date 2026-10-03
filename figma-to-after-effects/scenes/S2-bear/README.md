# S2 — Bear ("bear")

Figma source for the reel frame, built as native layers for the
figma-to-after-effects pipeline (see `../../SKILL.md`).

- **File:** https://www.figma.com/design/FIkU94cZReZL3P5xnERc36
- **Frame:** `S2 — Bear` — node `4:118`, 1080×1920
- **Shared component:** `Polar Bear` — node `4:86`, 460×367, 31 facets (instanced 2×)
- **Animation spec:** `S2 Notes` caption block under the frame

## How it was built

- The bear is low-poly: **31 flat-colour vector facets**, each its own layer, named
  by body part (`Shoulder`, `Neck Mint`, `Face Shadow`, `Foot Front Near`, …) and
  ordered far legs → body → near legs → head. No image, no SVG import.
- Each facet carries a same-colour 0.75px stroke to hide hairline seams between
  facets. Keep that stroke in AE, for the same reason.
- `Caption Word` was positioned by **ink** (`absoluteRenderBounds`), so its
  `ink` box goes straight into `A.textLayer({x, y, align:'C'})`.
- Font: Montserrat Regular.

## Layer map (back to front)

| Layer | Type | Notes |
|---|---|---|
| BG | rect | `#000000` full-frame |
| Caption Word | text | "bear", Regular 58, white, centred |
| Card | frame | 692×980 at (194, 471), r77, white, clips content |
| ↳ Bear Reflection | group | `Reflection Fade` (alpha-gradient mask) + `Bear Mirror` |
| ↳↳ Bear Mirror | instance | `Polar Bear` flipped vertically, 22% opacity, blur 6 |
| ↳ Bear | instance | `Polar Bear` at (331, 788) in frame space |

## AE notes

- Build `Polar Bear` once as a **shared precomp** (`A.sharedComp`), then
  instance it twice. For the mirror, set Scale `[100, -100]`.
- Gradient stops can't be scripted on shape layers (see `references/gotchas.md`),
  so rebuild `Reflection Fade` as an `A.gradLayer` alpha matte rather than a mask.
- `figma-nodes.json` has the frame records plus every facet's polygon (`pts`),
  ready for `A.addPath`.
