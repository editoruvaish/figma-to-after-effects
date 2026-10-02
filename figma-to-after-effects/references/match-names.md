# Verified match names

Confirmed by running `probe.jsx` against After Effects 2026 (26.3) on macOS.
Anything not listed here should be probed rather than guessed — several match
names are not what you would expect, and a wrong one costs a whole build.

## Transform

| Property | Match name |
|---|---|
| Transform group | `ADBE Transform Group` |
| Anchor Point | `ADBE Anchor Point` |
| Position | `ADBE Position` |
| Scale | `ADBE Scale` |
| Rotation (2D) | `ADBE Rotate Z` ← **not** `ADBE Rotation` |
| Opacity | `ADBE Opacity` |

## Shape layers

| Property | Match name |
|---|---|
| Root contents | `ADBE Root Vectors Group` |
| Group | `ADBE Vector Group` → then `ADBE Vectors Group` for its children |
| Rectangle | `ADBE Vector Shape - Rect` |
| Ellipse | `ADBE Vector Shape - Ellipse` |
| Bezier path | `ADBE Vector Shape - Group` → `ADBE Vector Shape` |
| Fill | `ADBE Vector Graphic - Fill` |
| Stroke | `ADBE Vector Graphic - Stroke` |
| Gradient fill | `ADBE Vector Graphic - G-Fill` |
| Trim Paths | `ADBE Vector Filter - Trim` |

Rect: `ADBE Vector Rect Size`, `ADBE Vector Rect Position`, `ADBE Vector Rect Roundness`
Ellipse: `ADBE Vector Ellipse Size`, `ADBE Vector Ellipse Position`
Fill: `ADBE Vector Fill Color`, `ADBE Vector Fill Opacity` (0–100)
Stroke: `ADBE Vector Stroke Color`, `ADBE Vector Stroke Width`, `ADBE Vector Stroke Opacity`,
`ADBE Vector Stroke Line Cap` (1 butt, 2 round, 3 square), `ADBE Vector Stroke Line Join`

### Trim Paths

| # | Match name | Name | Default |
|---|---|---|---|
| 1 | `ADBE Vector Trim Start` | Start | 0 |
| 2 | `ADBE Vector Trim End` | End | 100 |
| 3 | `ADBE Vector Trim Offset` | Offset | 0 |
| 4 | `ADBE Vector Trim Type` | Trim Multiple Shapes | 1 |

An AE ellipse path starts at **12 o'clock** and runs **clockwise**, so drawing a
ring on from the top is simply `End: 0 → 100`.

### Gradient fill — stops are unwritable

| # | Match name | Name |
|---|---|---|
| 4 | `ADBE Vector Grad Type` | Type |
| 5 | `ADBE Vector Grad Start Pt` | Start Point |
| 6 | `ADBE Vector Grad End Pt` | End Point |
| 11 | `ADBE Vector Grad Colors` | Colors — **`NO_VALUE`, cannot be set** |
| 12 | `ADBE Vector Fill Opacity` | Opacity |

Use the Ramp pipeline below instead.

## Effects

### Drop Shadow — `ADBE Drop Shadow`

| # | Match name | Name | Notes |
|---|---|---|---|
| 1 | `ADBE Drop Shadow-0001` | Shadow Color | RGBA 0–1 |
| 2 | `ADBE Drop Shadow-0002` | Opacity | **0–255** |
| 3 | `ADBE Drop Shadow-0003` | Direction | degrees clockwise from up |
| 4 | `ADBE Drop Shadow-0004` | Distance | |
| 5 | `ADBE Drop Shadow-0005` | Softness | |

### Gradient Ramp — `ADBE Ramp`

| # | Match name | Name | Default |
|---|---|---|---|
| 1 | `ADBE Ramp-0001` | Start of Ramp | |
| 2 | `ADBE Ramp-0002` | Start Color | 0,0,0,1 |
| 3 | `ADBE Ramp-0003` | End of Ramp | |
| 4 | `ADBE Ramp-0004` | End Color | 1,1,1,1 |
| 5 | `ADBE Ramp-0005` | Ramp Shape | 1 linear, 2 radial |
| 6 | `ADBE Ramp-0006` | Ramp Scatter | 0 |
| 7 | `ADBE Ramp-0007` | Blend With Original | 0 |

### Levels — `ADBE Easy Levels2`

| # | Match name | Name |
|---|---|---|
| 1 | `ADBE Easy Levels2-0001` | Channel |
| 3 | `ADBE Easy Levels2-0003` | Input Black |
| 4 | `ADBE Easy Levels2-0004` | Input White |
| 5 | `ADBE Easy Levels2-0005` | Gamma |
| 6 | `ADBE Easy Levels2-0006` | Output Black |
| 7 | `ADBE Easy Levels2-0007` | Output White |

Note the index skip: `-0002` is the Histogram, which has no settable value.

### Shift Channels — `ADBE Shift Channels`

| # | Match name | Name | Default |
|---|---|---|---|
| 1 | `ADBE Shift Channels-0001` | Take Alpha From | 1 |
| 2 | `ADBE Shift Channels-0002` | Take Red From | 2 |
| 3 | `ADBE Shift Channels-0003` | Take Green From | 3 |
| 4 | `ADBE Shift Channels-0004` | Take Blue From | 4 |

Source enum: `1` Alpha, `2` Red, `3` Green, `4` Blue, **`5` Luminance**,
`6` Hue, `7` Lightness, `8` Saturation, `9` Full On, `10` Full Off.

### Fill — `ADBE Fill`

| # | Match name | Name | Notes |
|---|---|---|---|
| 1 | `ADBE Fill-0001` | Fill Mask | |
| 2 | `ADBE Fill-0007` | All Masks | indices are **out of order** |
| 3 | `ADBE Fill-0002` | Color | |
| 4 | `ADBE Fill-0006` | Invert | |
| 5 | `ADBE Fill-0003` | Horizontal Feather | |
| 6 | `ADBE Fill-0004` | Vertical Feather | |
| 7 | `ADBE Fill-0005` | Opacity | 0–1 |

Fill replaces RGB while preserving alpha, which is what makes the Ramp pipeline
work.

### Gaussian Blur — `ADBE Gaussian Blur 2`

`ADBE Gaussian Blur 2-0001` Blurriness · `-0002` Blur Dimensions · `-0003` Repeat Edge Pixels

## The gradient pipeline

Since shape gradient stops are unwritable, a two-stop **alpha** gradient is:

```
solid
 └ ADBE Ramp             white -> black luminance wedge, linear or radial
 └ ADBE Easy Levels2     (optional) Input Black moves the first stop;
                         Gamma shapes the falloff
 └ ADBE Shift Channels   Take Alpha From = 5 (Luminance)
 └ ADBE Fill             Color = the real colour; alpha survives
 └ ADBE Gaussian Blur 2  (optional) knock out banding
```

`A.gradLayer()` and `A.glow()` implement this.

## Masks

`ADBE Mask Parade` → `addProperty("ADBE Mask Atom")`
→ `ADBE Mask Shape`, `ADBE Mask Feather`, `ADBE Mask Opacity`, `ADBE Mask Offset`
Mode via `mask.maskMode = MaskMode.SUBTRACT` (etc.).

## Text

`ADBE Text Properties` → `ADBE Text Document` (the whole TextDocument object)

Animators: `ADBE Text Properties` → `ADBE Text Animators`
→ `addProperty("ADBE Text Animator")` → `ADBE Text Animator Properties`

| Animator property | Match name |
|---|---|
| Tracking Amount | `ADBE Text Tracking Amount` ← **not** `ADBE Text Track Amount` |
| Tracking Type | `ADBE Text Track Type` |
| Position | `ADBE Text Position 3D` |
| Scale | `ADBE Text Scale 3D` |
| Rotation | `ADBE Text Rotation` |
| Opacity | `ADBE Text Opacity` |
| Blur | `ADBE Text Blur` |

Selectors live under `ADBE Text Selectors` and a scripted animator has **none**,
which makes it apply uniformly to every character.

## Comp and project

`comp.motionBlur`, `comp.shutterAngle`, `comp.bgColor`, `comp.openInViewer()`,
`comp.saveFrameToPng(time, File)`
`proj.items.addComp(name, w, h, pixelAspect, durationSec, fps)`
`proj.items.addFolder(name)`, `item.parentFolder`, `proj.removeUnusedFootage()`
`proj.save(new File(path))`

## Re-probing

Run `./go.sh probe.jsx` and read `probe.txt`. Add match names to the `EFFECTS`
and `ANIM_PROPS` arrays at the top of the script to dump anything not covered
here. Probing takes one run; guessing costs a build each time.
