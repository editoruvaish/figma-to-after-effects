# S2 — "and prepared." (clock at the horizon)

Figma: https://www.figma.com/design/j5D8HZ4OmupSSA2KW7YmDk  
Page `S2 — Prepared` (`6:2`) · Frame `S2_Prepared` — node `6:3` — 1080 × 1920 (9:16)

Rebuilt from a 709 × 1255 reference still. The reference was scaled by 1.5233 to
1080 wide and offset 4 px down. Everything is absolutely positioned. Horizon is
at **y = 1028**.

## Layer stack (back → front)

| Layer | Type | Key numbers |
|---|---|---|
| `BG_Base` | rect 1080×1920 | `#000000` |
| `Clock_Glow` | ellipse Ø 1280, centre 312, 1000 | radial white 0.20 → 0 |
| `Clock` (group) | centre 312, 1000 | see below |
| `Ground` | rect 1080×892 at y 1028 | `#000000`. Hides the glow and the lower half of the clock. |
| `Reflection` (frame, clips) | 1080×892 at y 1028, **opacity 0.05** | mirrored clock: `Refl_Rim`, `Refl_Face`, `Refl_Hand_Long`, `Refl_Hand_Short` |
| `Panel_Right` | vector, bbox 571, 613 · 559×1257, cornerRadius 40 | points (1130,613) (765,1408) (571,1604) (1127,1870); vertical linear `#505050` → `#000000`, reaches black at 82 % of its height |
| `Text_And_Prepared` | text | Open Sans Regular 44.9, `#FFFFFF`, **ink** x 393.7 y 238.6 w 292.7 h 44.9 (centred on 540) |

### Clock

| Layer | Notes |
|---|---|
| `Clock_Rim` | Ø 469, linear top-left → right `#D2D2D2` → `#151515` |
| `Clock_Face` | Ø 432, radial `#7A7A7A` → `#383838` |
| `Clock_Hand_Long` | 202.6 × 6, round ends, pivot **308, 1002**, rotation **−136.26°**, `#1E1E1E` → `#2A2A2A` @ 0.55 toward the tip |
| `Clock_Hand_Short` | 148.2 × 6, round ends, pivot **308, 1002**, rotation **−154.22°**, `#262626` |

The reflection is the same clock mirrored about y = 1028. Its centre is at 312, 1056
and the pivot is at 308, 1054. The hand rotations are negated (+136.26°, +154.22°).

## AE notes

- The reference font looks like Segoe UI. Figma doesn't have it, so the text is
  Open Sans Regular. If Segoe UI is installed locally, switch it in AE and keep the
  same ink box.
- Put each hand's anchor at its pivot end so a rotation animation turns it around
  the clock centre. Figma's rotations are clockwise-from-+x, the same as AE's
  Rotation, so the values carry across directly.
- Clipping by the horizon: `Ground` sits above the clock. In AE, the `Reflection`
  frame becomes a precomp (or a layer with a rect mask from y 1028 down).
- A mirrored clock in AE can also be the `Clock` precomp with Scale [100, −100],
  anchored on the horizon, at 5 % opacity.
- All gradients have two stops, so `A.gradLayer()` / `A.glow()` can reproduce them.
- Font needed locally: Open Sans Regular (or Segoe UI).
