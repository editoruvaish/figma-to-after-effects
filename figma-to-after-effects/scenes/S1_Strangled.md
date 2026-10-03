# S1 — "strangled" (SEC vs Crypto)

Figma: https://www.figma.com/design/j5D8HZ4OmupSSA2KW7YmDk  
Frame: `S1_Strangled` — node `2:2` — 1080 × 1920 (9:16), page `S1 — Strangled`

Rebuilt from a 700 × 1260 reference still. The reference was scaled by 1.5429 to
1080 wide and cropped 12 px top/bottom. Everything is absolutely positioned.
Auto-layout is not used, so the walker in `references/figma-extraction.md`
returns comp-space numbers directly.

## Layer stack (back → front)

| Layer | Type | Key numbers |
|---|---|---|
| `BG_Base` | rect 1080×1920 | linear top→bottom `#2A2A2A` → `#020202` |
| `BG_Glow_TopLeft` | ellipse 1500, x -650 y -800 | radial white 0.55 → 0 |
| `Beam_Soft_Wide` | rect 520×980, rot -10 | white 0.55 → 0, blur 90 |
| `Beam_Left` | rect 95×1150, rot 3 | white 1 → 0, blur 18 |
| `Beam_Center` | rect 190×620, rot -14 | white 1 → 0, blur 36 |
| `Beam_Center_Core` | rect 70×420, rot -14 | white 1 → 0, blur 14 |
| `Beam_Mid_Faint` | rect 120×560, rot -6 | white 0.6 → 0, blur 40 |
| `Text_Strangled` | text | Montserrat Medium 52.5, `#FFFFFF`, **ink** x 416.4 y 307 w 247.2 h 49.5 |
| `SEC_Seal` (group) | centre 540, 597 · Ø 333 | see below |
| `Crypto_Coin` (group) | centre 540, 1508 · Ø 640 | see below |

### SEC_Seal

| Layer | Notes |
|---|---|
| `Seal_Gold_Ring` | Ø 333, linear `#F6CF5A` → `#D9A436`, stroke `#3A2C0C` 2.5 inside |
| `Seal_Inner_Line` | Ø 258, `#2E2410` |
| `Seal_Disc` | Ø 250, radial `#24497A` → `#132C4B`, stroke `#EFE6CC` 2.5 inside |
| `Seal_Ring_Text` | one flattened vector (circular text, Noto Serif Condensed Bold 28, `#0E1A2C`) |
| `Seal_Eagle` | group of named vectors: `Eagle_Wing_L/R`, `Eagle_Feathers_L/R`, `Eagle_Head`, `Eagle_Beak`, `Eagle_Eye`, `Eagle_Tail`, `Eagle_Olive_*`, `Eagle_Arrow_1-3`, `Eagle_Arrowhead_1-3`, `Eagle_Talon_L/R`, `Shield_*` |

The eagle is a simplified vector drawing, not the official artwork. To use the
official seal, swap `Seal_Eagle` for it. The ring and disc layers stay
animatable either way.

### Crypto_Coin

| Layer | Notes |
|---|---|
| `Coin_Disc` | Ø 640, linear top→bottom `#DADADA` → `#0A0A0A`, stroke white 0.95→0.25, 2.5 inside |
| `Coin_C_Ring` | Ø 408 at centre 545, 1512 · `arcData` 40°→320°, innerRadius 0.689 → AE stroke ring, Trim End 77.8 % · fill linear TL→BR `#FFFFFF` → `#6E6E6E` |
| `Text_Crypto` | Montserrat SemiBold 63.2, `#C2C2C2`, **ink** x 546 y 1478 w 213 h 57.6, align L |

## AE notes

- All gradients have two stops, so `A.gradLayer()` / `A.glow()` can reproduce them.
- Beams are rotated about their top-centre. Pass the walker's `x, y, w, h, rot` to
  `A.rotatedCentre()`.
- `Coin_C_Ring` uses `arcData` with an inner radius, so build it as a stroke:
  width = 0.5 × 408 × (1 − 0.689) ≈ 63.4, path Ø ≈ 344.6.
- Fonts needed locally: Montserrat (Medium, SemiBold). Noto Serif is only needed
  if `Seal_Ring_Text` is rebuilt as live text.
