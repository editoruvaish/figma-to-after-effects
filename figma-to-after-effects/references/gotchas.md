# ExtendScript + After Effects gotchas

Every entry below cost a failed build to find. Read the symptom column; if it
matches what you are seeing, the fix is already written.

---

## Silent failures

### A bare `DoScriptFile` on a throwing script does nothing

`osascript` returns 0, After Effects shows no dialog, and no layers appear. The
error is swallowed entirely.

**Fix:** always run builders through `run.jsx`, which wraps `$.evalFile` in a
try/catch and writes the error and line number to a log. `go.sh` does this for
you. Never call a builder directly.

---

## Keyframes and easing

### `setTemporalEaseAtKey` → "Value array does not have N elements"

**Spatial** properties (Position, Anchor Point) take exactly **one** ease
regardless of dimension count. **Value** properties (Scale, Opacity, Rotation)
take **one per dimension** — and a null's Scale is 3-dimensional even in a 2D
comp.

**Fix:** branch on `prop.isSpatial` and size the array from `prop.keyValue()`.
`A.easeOutAt()` already does this; use it rather than constructing eases inline.

### Rotation is `ADBE Rotate Z`

`ADBE Rotation` returns `null` on a 2D layer, and the next line dies with
`TypeError: null is not an object`.

---

## Shape layers

### Group index 1 renders IN FRONT

`addProperty` appends to the **bottom** of the Contents list, and the item at
index 1 draws on top. So building "well, then glyph" puts the well's fill over
the glyph and the icon vanishes.

**Fix:** build foreground groups **first**, background last. (This is the
opposite of the layer rule below, which is a genuine trap.)

### `ReferenceError: Object is invalid`

Adding a sibling group or effect invalidates references you are still holding to
earlier siblings.

**Fix:** either finish a group completely before adding the next one, or re-fetch
by index (`parade.property(3)`) instead of holding the value `addProperty`
returned. `A.elevateAnim` re-fetches for exactly this reason.

### Gradient stops cannot be scripted at all

`ADBE Vector Grad Colors` is `PropertyValueType.NO_VALUE`. `setValue` throws
`Can not get or set a value from this property`. There is no workaround at the
shape level, in any AE version to date.

**Fix:** build gradients on a solid as **Ramp → Levels → Shift Channels → Fill**
(`A.gradLayer`). Ramp writes a luminance wedge, Levels repositions the first
stop (`Input Black`) or shapes the falloff (`Gamma`), Shift Channels converts
luminance to alpha (`Take Alpha From = 5`), Fill restores the real colour while
preserving the new alpha.

---

## Layers

### `layers.add*()` always inserts at index 1

Every new layer goes to the **top**, so a top-down build order inverts the
z-order and the background covers everything.

**Fix:** create **back to front**. Verify by dumping the layer stack — `shoot.jsx`
prints it every run for this reason.

### Null opacity does not propagate to children

Parenting inherits **transform only**. Fading a rig null does nothing to the
layers parented to it, and the group stays fully visible.

**Fix:** `A.fadeInGroup(layers, t0, t1)` / `A.fadeOutGroup(...)`, which touch
every member and preserve each one's own resting opacity.

### Masks render BEFORE effects

A mask cannot soften anything a later effect rewrites. Feathering a solid and
then running Shift Channels (which sets alpha from luminance) discards the
feather completely — you get a hard rectangle.

**Fix:** for soft-edged light, use a **radial** ramp sized so it reaches zero
inside the layer bounds (`A.glow`). Reserve masks for layers whose effects do
not touch alpha.

### Mask coordinates are layer space with a TOP-LEFT origin

Not centred on zero. A mask built from `[-w/2, -h/2]` to `[w/2, h/2]` covers only
the top-left quadrant.

**Fix:** build mask paths from `[0,0]` to `[w,h]`. For a layer whose anchor is
`[0,0]` and whose Position sits at the shape centre (everything `A.rectLayer`
makes), layer space is comp space minus Position — which is what `A.clipCard`
computes.

### Mask feather is clipped in half at the layer edge

Feather runs both inward and outward from the path; the outward half falls
outside the layer and is discarded.

**Fix:** inset the mask path by roughly half the feather so the ramp has room on
both sides.

---

## Text

### `tracking` must be an integer

`-25.9` throws `Unable to set "tracking". -25.9 is not an integer.`

**Fix:** `Math.round()`. `A.textLayer` does this.

### Fonts are PostScript names, and `app.fonts` is unreliable

`SFPro-Semibold`, not `SF Pro Semibold`. The `app.fonts` API can return objects
whose properties all read as `undefined`, and `system_profiler` may not list a
family AE can nevertheless resolve.

**Fix:** probe by setting a candidate on a real text layer and reading it back.
If the value survives, the font resolves with no substitution. `probe.jsx` does
this.

### Text animators are additive

An animator's Tracking Amount stacks **on top of** the layer's base tracking. To
go from 20px to the design's -3px at 134pt:

```
base    = track(-3, 134)                 // -22
start   = track(20, 134) - base          // 149 - (-22) = 171
A.trackIn(layer, 171, t0, t1);           // animator runs 171 -> 0
```

A script-created animator has **no selector**, which is what you want: it applies
uniformly to every character.

### Centre-justified track-ins grow both ways

A wordmark that tracks in beside a logo mark will walk its left edge straight
into the mark. Anchor it `'L'` so it only ever contracts rightward into place.

---

## Effects

### Drop Shadow Opacity is 0–255

Not 0–100. A Figma alpha of `0.14` becomes `0.14 * 255`.

### Drop Shadow Direction is degrees clockwise from UP

So a Figma shadow cast downward (`offset.y > 0`) is **180**, not 0.
`dir = atan2(dx, -dy)`, normalised to 0–360. `A.shadow` handles it.

### One shadow reads as a sticker

Real depth needs a stack: a tight contact shadow, a mid lift, and a wide ambient
shadow. And when an object scales or moves, its shadow Distance and Softness
must animate **with** it — an object that scales while its shadow holds still
reads flat and is the single most common tell in scripted motion work.

`A.elevate()` applies the stack; `A.elevateAnim()` animates it.

---

## Project panel

### Rebuilt scenes leave orphaned solids

Removing a comp does not remove the solids and nulls it used. Rerun a builder
ten times and the Solids folder holds ten sets.

**Fix:** call `proj.removeUnusedFootage()` before sorting. `A.organize()` does.

### Rebuilding a SHARED precomp orphans earlier scenes

If scene 2 and scene 3 both call `buildDashboard()`, and that function deletes
and recreates the comp, then building scene 3 silently strips the source from
scene 2's layer. The layer stays in the timeline and renders nothing — which
looks like an animation bug, not a project bug.

**Fix:** shared comps are **reuse-by-name** (`A.sharedComp` returns the existing
comp unless `force` is true). Regenerate them from a dedicated build step, then
rebuild the scenes that use them.

---

## ExtendScript itself

It is ES3. No `let`, `const`, arrow functions, `Array.forEach`, `Array.map`,
template literals, or default parameters. Use `var`, `function`, and index
loops. `JSON` is unavailable in some hosts — build strings manually.

`$.evalFile(new File(path))` is how you load a shared library; assign to
`$.global.NAME` so it survives across the eval boundary.

---

## Verification

`comp.saveFrameToPng(time, file)` renders one frame without the render queue or
`aerender`. It is fast enough to run after every build, and looking at the frame
is the only way to catch z-order inversions, invisible glyphs, and silently
missing sources. Build → shoot → **look** → fix.

For an actual video you still need the render queue or `aerender`;
`saveFrameToPng` is a verification tool, not a delivery one.
