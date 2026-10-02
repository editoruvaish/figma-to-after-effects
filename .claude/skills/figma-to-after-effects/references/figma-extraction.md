# Extracting geometry from Figma

The goal is to read a frame once, get every number you need, and never guess or
eyeball a position again. Run the walker below through the Figma MCP `use_figma`
tool, then paste the numbers straight into a builder.

## The walker

Read-only. It emits one compact record per node, relative to the frame's origin,
so the numbers are already in comp space for a comp the same size as the frame.

```js
const page = figma.root.children.find(p => p.name === "YOUR PAGE NAME");
await figma.setCurrentPageAsync(page);   // required — see "lazy pages" below

function hex(c){const h=v=>Math.round(v*255).toString(16).padStart(2,'0');
  return '#'+h(c.r)+h(c.g)+h(c.b);}

function paints(ps){ if(!ps||ps===figma.mixed||!ps.length) return null;
  return ps.filter(p=>p.visible!==false).map(p=>{
    if(p.type==='SOLID') return {t:'S',c:hex(p.color),o:+(p.opacity===undefined?1:p.opacity).toFixed(3)};
    if(p.type.indexOf('GRADIENT')===0) return {t:'G',
      stops:p.gradientStops.map(s=>({c:hex(s.color),a:+s.color.a.toFixed(2),p:+s.position.toFixed(2)}))};
    return {t:p.type};
  });
}

function fx(es){ if(!es||!es.length) return null;
  return es.filter(e=>e.visible!==false).map(e=>
    (e.type==='DROP_SHADOW'||e.type==='INNER_SHADOW')
      ? {t:e.type[0]+'S',x:e.offset.x,y:e.offset.y,r:e.radius,sp:e.spread||0,
         c:hex(e.color),a:+e.color.a.toFixed(3)}
      : {t:e.type, r:e.radius});
}

function walk(node, ox, oy, depth, out){
  const m = node.absoluteTransform;
  const rot = +(Math.atan2(m[1][0], m[0][0])*180/Math.PI).toFixed(2);
  const rec = { id:node.id, n:node.name, t:node.type, d:depth,
    x:+(m[0][2]-ox).toFixed(1), y:+(m[1][2]-oy).toFixed(1),
    w:+node.width.toFixed(1), h:+node.height.toFixed(1) };
  if (Math.abs(rot)>0.05) rec.rot = rot;
  if (node.opacity!==undefined && node.opacity<0.999) rec.op=+node.opacity.toFixed(3);
  const f=paints(node.fills); if(f) rec.f=f;
  const s=paints(node.strokes); if(s){rec.s=s; rec.sw=node.strokeWeight;}
  if (node.cornerRadius!==undefined && node.cornerRadius!==figma.mixed && node.cornerRadius>0)
    rec.r=node.cornerRadius;
  const e=fx(node.effects); if(e) rec.e=e;
  if (node.type==='TEXT'){
    rec.ch=node.characters;
    const fn=node.fontName; rec.fn = fn===figma.mixed?'mixed':fn.style;
    rec.fs=node.fontSize;
    rec.ls=node.letterSpacing && node.letterSpacing.value;   // PIXELS
    rec.al=node.textAlignHorizontal;
    const rb=node.absoluteRenderBounds;                      // TIGHT INK BOUNDS
    if(rb) rec.ink={x:+(rb.x-ox).toFixed(1),y:+(rb.y-oy).toFixed(1),
                    w:+rb.width.toFixed(1),h:+rb.height.toFixed(1)};
  }
  if (node.type==='ELLIPSE' && node.arcData){ const a=node.arcData;
    if(a.innerRadius>0 || Math.abs(a.endingAngle-a.startingAngle-Math.PI*2)>0.01)
      rec.arc={s:+a.startingAngle.toFixed(4),e:+a.endingAngle.toFixed(4),ir:+a.innerRadius.toFixed(3)};
  }
  if (node.type==='VECTOR' && node.vectorPaths) rec.vp=node.vectorPaths.map(p=>p.data);
  out.push(rec);
  if (node.children) for (const c of node.children) walk(c, ox, oy, depth+1, out);
  return out;
}

const fr = await figma.getNodeByIdAsync("15:7");   // the frame you want
const m = fr.absoluteTransform;
const out = [];
for (const c of fr.children) walk(c, m[0][2], m[1][2], 0, out);
return { name: fr.name, n: out.length, nodes: out };
```

### Keeping the payload small

A dense frame can blow past a useful response size. Two easy cuts:

- **Skip shared subtrees.** If every frame has the same `BG` group, skip it after
  the first read: `if (c.name === 'BG') continue;`
- **Collapse repeated components.** When a frame contains a clone of something
  you already extracted, record the wrapper and stop descending:
  ```js
  if (node.children && node.name.indexOf('Dashboard') < 0) { /* recurse */ }
  else if (node.children) out.push({ n:'(collapsed)', kids: node.children.length });
  ```

## Conversions

| Figma | After Effects |
|---|---|
| `letterSpacing.value` in **px** | `tracking` in 1/1000 em → `px / fontSize * 1000`, **rounded to an integer** |
| colour `{r,g,b}` 0–1 | same 0–1 range, no conversion |
| effect `offset {x,y}` + `radius` | Direction (deg clockwise from up) + Distance + Softness → use `A.shadow()` |
| shadow `color.a` 0–1 | Drop Shadow Opacity is **0–255**, so `a * 255` |
| node `x, y` (top-left) | layer Position = top-left + `w/2, h/2` (helpers do this) |
| `absoluteRenderBounds` | the ink box — feed straight into `A.textLayer({x, y})` |
| `arcData.innerRadius` on an ellipse | a **stroke**, not a fill: `strokeWidth = r_outer - r_inner`, ellipse size = `2 * (r_outer + r_inner) / 2` |
| `arcData` sweep | Trim Paths `End`, as a percentage |
| rotated node `absoluteTransform` translation | post-rotation top-left → use `A.rotatedCentre(x, y, w, h, deg)` |

### Text positioning

Always position text by **ink**, never by the text box. Figma's text frame
carries line-height padding that AE's does not reproduce, so box-to-box
alignment drifts by a few pixels per style. `absoluteRenderBounds` is the tight
painted box, and `A.textLayer` anchors the layer to its own measured
`sourceRectAtTime` — so the two agree with no per-style fudge factor.

```
align: 'L'  ->  (x, y) is the ink TOP-LEFT
align: 'C'  ->  (x, y) is the ink TOP-CENTRE
```

Use `'L'` for anything whose tracking animates. A centre-justified track-in
expands in **both** directions and will walk into whatever sits beside it.

### Rotated nodes

Figma bakes rotation into `absoluteTransform`, so the translation you read is
the top-left **after** rotation. AE rotates about the layer's Position. Adding
`w/2, h/2` gives the wrong centre for anything rotated:

```js
var c = A.rotatedCentre(x, y, w, h, deg);
layer.property("ADBE Transform Group").property("ADBE Position").setValue(c);
layer.property("ADBE Transform Group").property("ADBE Rotate Z").setValue(deg);
```

To recover a rotated child's position in its parent's **unrotated** space
(useful when rebuilding a rotated panel as an upright precomp), inverse-rotate
the delta:

```
dx = childX - parentX,  dy = childY - parentY
localX =  dx*cos(-t) - dy*sin(-t)
localY =  dx*sin(-t) + dy*cos(-t)
```

Sanity-check the result: values should land on round numbers. If a set of bars
comes back at `y = 340.0, 310.0, 328.0` with a common baseline, the maths is
right; if they come back at `339.7, 310.4`, check the rotation sign.

## Lazy pages

A page that is not the current page reports `children.length === 0`. This looks
exactly like data loss and is not. Always:

```js
await figma.setCurrentPageAsync(page);   // async setter; figma.currentPage = p throws
```

Call it **at most once per `use_figma` invocation**. For multi-page work, issue
one `use_figma` call per page, in parallel.

## Verifying against the design

`get_screenshot` on the same node gives you a reference render. Put it beside an
AE frame and compare directly rather than trusting your memory of the design:

```bash
curl -sL -o figma.png "<image_url from get_screenshot>"
ffmpeg -y -i figma.png -i ../frames/PROJ_S1_f60.png \
  -filter_complex "[0:v]scale=640:360[a];[1:v]scale=640:360[b];[a][b]hstack" cmp.png
```

This is how you catch things that read fine in isolation but are plainly wrong
side by side: a glow that is too broad, an arc that is too bright, a panel edge
that should not be visible.
