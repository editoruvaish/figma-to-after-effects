---
name: figma-to-after-effects
description: Use when the user wants to turn a Figma design, storyboard, frame, or mockup into an animated After Effects composition, or wants to build/animate AE scenes as native vector layers from code. Reads geometry out of Figma via the Figma MCP, generates ExtendScript that rebuilds it as native AE shape and text layers (no SVG import, no rasterizing, every element independently animatable), runs it inside After Effects, and verifies by rendering check frames. Trigger on "animate this Figma design", "take this into After Effects", "build this storyboard in AE", "vectorize this into AE layers", "make an AE comp from this frame", or any Figma-to-motion handoff.
---

# Figma to After Effects

Rebuild a Figma design inside After Effects as **native vector layers** and
animate it, entirely from code.

Not an SVG import, not a flattened PNG, not an Illustrator round-trip. Every
rectangle is a real shape layer, every string is a real text layer, every shadow
is a real Drop Shadow effect. The result opens like something a designer built
by hand: fully editable, every element on its own animatable layer.

## When to use

- A Figma frame, storyboard, or mockup needs to become a moving comp
- A design exists and the animation has to match it exactly, not approximately
- Scenes need to be produced repeatably (a rebuild reruns a script, not an afternoon)
- The output must stay editable in After Effects afterwards

**Not** for: editing existing footage, compositing video, or work with no design
source. If there is no Figma file and no visual spec, get one first.

## Connecting to After Effects

**There is no After Effects MCP.** The connection is AppleScript driving a
*running* copy of AE via `osascript ... DoScriptFile`. Nothing to install, but
four things have to be true:

1. **After Effects is installed and open.** These scripts drive a live app; they
   do not launch one, and they write into whichever project is currently open.
2. **Your terminal is authorised to send Apple events to it.** macOS asks once,
   the first time. If it was ever denied the answer is sticky:
   System Settings → Privacy & Security → Automation → your terminal → tick
   After Effects. If it is not listed at all, `tccutil reset AppleEvents` brings
   the prompt back.
3. **Scripts are allowed to write files.** After Effects → Settings →
   Scripting & Expressions → **Allow Scripts to Write Files and Access Network**.
   Without it the script runs but every log and PNG silently fails to appear.
4. **The app name in the `tell` block matches the `.app` basename** — for AE 2026
   that is `Adobe After Effects 2026`, *not* the bundle name "After Effects".
   Override with `AE_APP="Adobe After Effects 2025" ./go.sh ...`

Run the checker rather than working through that list by hand:

```bash
cd scripts && chmod +x *.sh
./doctor.sh
```

It reports each item, distinguishes "not authorised" (`-1743`) from "no such
app" (`-1728`) from "not running", and prints the exact fix for whichever one
fails. It tests the scripting preference **functionally** — by asking AE to
write a file — because AE only flushes preferences to disk on quit, so grepping
the prefs file can report a stale value for a whole session.

Also needed: **Figma MCP** for reading geometry, **ffmpeg** for contact sheets,
and the design's fonts installed locally.

> **Windows:** there is no `osascript`. Replace the call in `go.sh` with
> `"C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe" -r <script.jsx>`.
> Everything else — the library, the builders, the gotchas — is unchanged.

## Setup

Copy `scripts/` next to wherever you are working. The first `go.sh` run stamps
absolute paths into the scripts automatically, so the folder works from
anywhere. Confirm the pipeline before touching real design data:

```bash
./doctor.sh                           # all five checks green
./go.sh build-scene.jsx scene.log     # expect RESULT=built
./go.sh shoot.jsx
./sheet.sh PROJ_S1 2 0 12 24 40 60
```

Open the resulting sheet. If a card lifts in over a cream field with a soft
overhead pool, everything works. Compare against
`frames/PROJ_S1_sheet.png`.

## The loop

Work **one scene at a time**, and look at a render before moving on. The failure
mode of this pipeline is not crashing, it is producing something wrong that
nobody looked at.

### 1. Read the design

Pull geometry with the walker in `references/figma-extraction.md`. One frame per
call, skipping shared subtrees you have already read. You want positions, sizes,
corner radii, fills, strokes, effects, and — for text — `absoluteRenderBounds`,
which is the tight ink box.

Also read the animation spec, wherever it lives: caption blocks on the board, a
brief, or the user's description. Get timings before writing any code.

### 2. Write the builder

Copy `build-scene.jsx` per scene. Keep the five-part structure: config, comp,
layers back-to-front, animation, organize. Paste Figma numbers directly; do not
retype or round them.

Anything shared between scenes (a UI card, a repeated panel) becomes a
**precomp at native size**, instanced by each scene. Build it at 100% and scale
the instance — never rebuild the same component at three sizes.

### 3. Run it

```bash
./go.sh build-B2.jsx b2.log
```

Always through `go.sh`. A bare `DoScriptFile` on a throwing script fails
completely silently.

### 4. Look at it

```bash
./go.sh shoot.jsx                       # edit PREFIX and FRAMES first
./sheet.sh PROJ_S2 2 0 20 40 60 80
```

Read the sheet. Sample across the whole move, not just the resting frame — the
resting frame hides everything interesting. `shoot.jsx` also prints the layer
stack, which is how inverted z-order gets caught.

When it has to match the design exactly, put them side by side rather than
trusting memory:

```bash
curl -sL -o figma.png "<get_screenshot image_url>"
ffmpeg -y -i figma.png -i ../frames/PROJ_S2_f60.png \
  -filter_complex "[0:v]scale=640:360[a];[1:v]scale=640:360[b];[a][b]hstack" cmp.png
```

### 5. Fix and repeat

Then move to the next scene. Once the scenes exist, `A.master()` lays them onto
one timeline at their cut points.

## Non-negotiables

**Position text by ink, never by the text box.** Figma's text frame carries
line-height padding AE does not reproduce. Feed `absoluteRenderBounds` into
`A.textLayer({x, y})` and the two agree with no per-style fudging.

**Build layers back to front.** `comp.layers.add*()` always inserts at index 1,
so the last layer created ends up on top.

**Build shape groups front to back.** The opposite rule, and it catches everyone:
inside a shape layer, group index 1 renders *in front*, so a glyph must be built
before the filled well behind it.

**Animate shadows with the object.** When something scales or moves, its Drop
Shadow Distance and Softness animate alongside. `A.elevateAnim()` does this. An
object that scales while its shadow holds still reads flat, and it is the most
common tell in scripted motion work.

**Use three shadows, not one.** A tight contact shadow, a mid lift, a wide
ambient. `A.elevate()` applies the stack.

**Never rebuild a shared precomp from a scene builder.** It orphans the layers
of every scene built earlier — they stay in the timeline and render nothing,
which looks like an animation bug rather than a project bug. Use `A.sharedComp`
(reuse-by-name) and regenerate shared assets from their own build step.

**Call `A.organize()` at the end of every build.** It sweeps orphaned solids and
sorts comps into folders, so a project rebuilt fifty times looks like one built
once.

## Library

`ae-lib.jsx` — load with `$.evalFile`, then `$.global.AEB`.

| | |
|---|---|
| `configure({W,H,FPS,prefix,folder})` | project-wide settings |
| `f(n)` · `hex(s)` · `track(px,size)` | frames→seconds, hex→RGB, Figma px→AE tracking |
| `rectLayer` · `ellipseLayer` · `shapeLayer` | positioned by Figma's top-left |
| `addGroup/Rect/Ellipse/Path/Fill/Stroke/Trim` | raw shape construction |
| `roundRectShape` · `clipCard` | rounded-rect mask paths, card clipping |
| `rotatedCentre(x,y,w,h,deg)` | Figma's rotated top-left → AE's Position |
| `textLayer({...})` · `trackIn` · `animator` | ink-positioned text, uniform animators |
| `shadow` · `elevate` · `elevateAnim` · `setElevation` | the depth system |
| `ramp2` · `pop` · `rise` · `fade` · `easeOutAt` · `easeAll` | keyframing |
| `fadeInGroup` · `fadeOutGroup` · `rig` | grouped moves (null opacity does not propagate) |
| `gradLayer` · `glow` | gradients, since shape gradient stops are unwritable |
| `sceneComp` · `sharedComp` · `wipe` · `findComp` | comp lifecycle |
| `organize` · `folder` · `master` · `log` | project hygiene and the final timeline |

## Files

```
scripts/
  doctor.sh         check the AE connection — run this first
  ae-lib.jsx        the library
  build-scene.jsx   runnable template + smoke test — copy per scene
  run.jsx           error-capturing wrapper (go.sh drives it; never edit)
  go.sh             run a .jsx inside AE and print the result
  shoot.jsx         render check frames + dump the layer stack
  sheet.sh          stitch frames into a contact sheet
  probe.jsx         discover match names and test font resolution

references/
  figma-extraction.md   the walker, every Figma→AE conversion, rotated nodes
  gotchas.md            every trap, with the fix
  match-names.md        verified match names, the gradient pipeline
```

## When something breaks

`references/gotchas.md` first — it is organised by symptom and covers silent
failures, easing array errors, invisible glyphs, unwritable gradients, orphaned
sources, mask ordering, and integer tracking.

For a match name not in `references/match-names.md`, run `./go.sh probe.jsx` and
read `probe.txt`. Probing takes one run; guessing costs a build each time.

## Rendering

`saveFrameToPng` is a verification tool, not a delivery one. For an actual video
file, add the comp to the render queue or call `aerender`.
