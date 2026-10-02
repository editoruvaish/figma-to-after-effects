// ============================================================
// ae-lib.jsx — shared builder library for Figma -> After Effects
//
// Load at the top of every scene builder:
//     $.evalFile(new File(BASE + "ae-lib.jsx"));
//     var A = $.global.AEB;
//     A.configure({ prefix: "MYPROJ", folder: "My Project" });
//
// Everything here writes NATIVE After Effects vector: shape layers, text
// layers, masks, effects. Nothing is imported and nothing is rasterised, so
// every element stays independently animatable.
//
// ExtendScript is ES3. No let/const, no arrow functions, no Array.forEach.
// ============================================================

$.global.AEB = (function () {

  // ---------- config ----------
  var CFG = {
    W: 1920, H: 1080, FPS: 30,
    prefix: "PROJ",              // comp-name prefix, used by organize()
    folder: "Project",           // top-level project-panel folder
    sceneFolder: "01 Scenes",
    precompFolder: "02 Precomps",
    solidFolder: "03 Solids"
  };
  function configure(o) {
    for (var k in o) if (o.hasOwnProperty(k)) CFG[k] = o[k];
    return CFG;
  }

  function f(n) { return n / CFG.FPS; }                     // frames -> seconds
  function rgba(c, a) { return [c[0], c[1], c[2], a === undefined ? 1 : a]; }

  // #RRGGBB -> [r,g,b] in 0-1. AE and Figma both want 0-1, not 0-255.
  function hex(h) {
    h = String(h).replace("#", "");
    return [parseInt(h.substr(0, 2), 16) / 255,
            parseInt(h.substr(2, 2), 16) / 255,
            parseInt(h.substr(4, 2), 16) / 255];
  }

  // Figma letter-spacing is in PIXELS; AE tracking is in 1/1000 em.
  function track(px, fontSize) { return Math.round(px / fontSize * 1000); }

  // ============================================================
  // SHAPE PRIMITIVES
  // ============================================================
  function shapeLayer(comp, name) {
    var l = comp.layers.addShape();
    l.name = name;
    // anchor at [0,0] so layer space == comp space minus Position. Every helper
    // below (and clipCard) depends on this.
    l.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0]);
    return l;
  }
  function rootGrp(layer) { return layer.property("ADBE Root Vectors Group"); }

  // NOTE: group index 1 renders IN FRONT. Build foreground groups first.
  function addGroup(parent, name) {
    var g = parent.addProperty("ADBE Vector Group");
    g.name = name;
    return g.property("ADBE Vectors Group");
  }
  function addRect(vecs, w, h, r, cx, cy) {
    var s = vecs.addProperty("ADBE Vector Shape - Rect");
    s.property("ADBE Vector Rect Size").setValue([w, h]);
    s.property("ADBE Vector Rect Position").setValue([cx || 0, cy || 0]);
    s.property("ADBE Vector Rect Roundness").setValue(r || 0);
    return s;
  }
  function addEllipse(vecs, w, h, cx, cy) {
    var s = vecs.addProperty("ADBE Vector Shape - Ellipse");
    s.property("ADBE Vector Ellipse Size").setValue([w, h]);
    s.property("ADBE Vector Ellipse Position").setValue([cx || 0, cy || 0]);
    return s;
  }
  function addPath(vecs, verts, ins, outs, closed) {
    var sh = new Shape();
    sh.vertices = verts;
    sh.inTangents = ins;
    sh.outTangents = outs;
    sh.closed = closed;
    var p = vecs.addProperty("ADBE Vector Shape - Group");
    p.property("ADBE Vector Shape").setValue(sh);
    return p;
  }
  function addFill(vecs, color, opacity) {
    var fl = vecs.addProperty("ADBE Vector Graphic - Fill");
    fl.property("ADBE Vector Fill Color").setValue(rgba(color));
    fl.property("ADBE Vector Fill Opacity").setValue((opacity === undefined ? 1 : opacity) * 100);
    return fl;
  }
  function addStroke(vecs, color, width, opacity, roundCap) {
    var st = vecs.addProperty("ADBE Vector Graphic - Stroke");
    st.property("ADBE Vector Stroke Color").setValue(rgba(color));
    st.property("ADBE Vector Stroke Width").setValue(width);
    st.property("ADBE Vector Stroke Opacity").setValue((opacity === undefined ? 1 : opacity) * 100);
    if (roundCap) {
      st.property("ADBE Vector Stroke Line Cap").setValue(2);
      st.property("ADBE Vector Stroke Line Join").setValue(2);
    }
    return st;
  }
  // Trim Paths. On an AE ellipse the path starts at 12 o'clock and runs
  // clockwise, so "draw a ring on from the top" is just End 0 -> 100.
  function addTrim(vecs) { return vecs.addProperty("ADBE Vector Filter - Trim"); }

  // reach back into a layer built by rectLayer / ellipseLayer
  function vecsOf(layer, groupIndex) {
    return rootGrp(layer).property(groupIndex || 1).property("ADBE Vectors Group");
  }
  function rectOf(layer) { return vecsOf(layer).property(1); }

  // ---------- one-call layers, positioned by Figma's TOP-LEFT ----------
  function rectLayer(comp, name, x, y, w, h, r, fillCol, fillOp, strokeCol, strokeW, strokeOp) {
    var l = shapeLayer(comp, name);
    var v = addGroup(rootGrp(l), name);
    addRect(v, w, h, r, 0, 0);
    if (fillCol) addFill(v, fillCol, fillOp);
    if (strokeCol) addStroke(v, strokeCol, strokeW, strokeOp);
    l.property("ADBE Transform Group").property("ADBE Position").setValue([x + w / 2, y + h / 2]);
    return l;
  }
  function ellipseLayer(comp, name, x, y, w, h, fillCol, fillOp, strokeCol, strokeW, strokeOp) {
    var l = shapeLayer(comp, name);
    var v = addGroup(rootGrp(l), name);
    addEllipse(v, w, h, 0, 0);
    if (fillCol) addFill(v, fillCol, fillOp);
    if (strokeCol) addStroke(v, strokeCol, strokeW, strokeOp);
    l.property("ADBE Transform Group").property("ADBE Position").setValue([x + w / 2, y + h / 2]);
    return l;
  }

  // Rounded-rect bezier. AE has no rounded-rect MASK primitive, so build one.
  function roundRectShape(x0, y0, w, h, r) {
    var k = r * 0.5523, x1 = x0 + w, y1 = y0 + h;
    var sh = new Shape();
    sh.vertices = [[x0 + r, y0], [x1 - r, y0], [x1, y0 + r], [x1, y1 - r],
                   [x1 - r, y1], [x0 + r, y1], [x0, y1 - r], [x0, y0 + r]];
    sh.inTangents  = [[-k, 0], [0, 0], [0, -k], [0, 0], [k, 0], [0, 0], [0, k], [0, 0]];
    sh.outTangents = [[0, 0], [k, 0], [0, 0], [0, k], [0, 0], [-k, 0], [0, 0], [0, -k]];
    sh.closed = true;
    return sh;
  }

  // Clip a layer to a rounded rectangle given in COMP space. Use this for card
  // chrome (title bars, sidebars) that must not poke past a card's corners.
  // Assumes the layer's anchor is [0,0], which everything above guarantees.
  function clipCard(layer, cardX, cardY, cardW, cardH, r) {
    var pos = layer.property("ADBE Transform Group").property("ADBE Position").value;
    var mk = layer.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
    mk.property("ADBE Mask Shape").setValue(
      roundRectShape(cardX - pos[0], cardY - pos[1], cardW, cardH, r));
    return mk;
  }

  // Rotated-rectangle centre. Figma stores rotated nodes with the translation
  // at the post-rotation top-left, but AE rotates about the layer Position, so
  // you cannot just add w/2, h/2.
  function rotatedCentre(x, y, w, h, deg) {
    var t = deg * Math.PI / 180, cs = Math.cos(t), sn = Math.sin(t);
    return [x + (w / 2) * cs - (h / 2) * sn,
            y + (w / 2) * sn + (h / 2) * cs];
  }

  // ============================================================
  // SHADOWS + ELEVATION
  // ============================================================
  // Figma offset (dx,dy) -> AE Direction/Distance. AE direction is degrees
  // CLOCKWISE FROM UP, so a Figma shadow cast downward is 180.
  function shadow(layer, dx, dy, blur, color, alpha) {
    var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Drop Shadow");
    fx.property("ADBE Drop Shadow-0001").setValue(rgba(color));
    fx.property("ADBE Drop Shadow-0002").setValue(alpha * 255);   // 0-255, not 0-100
    var dir = Math.atan2(dx, -dy) * 180 / Math.PI;
    if (dir < 0) dir += 360;
    fx.property("ADBE Drop Shadow-0003").setValue(dir);
    fx.property("ADBE Drop Shadow-0004").setValue(Math.sqrt(dx * dx + dy * dy));
    fx.property("ADBE Drop Shadow-0005").setValue(blur);
    return fx;
  }

  // Three stacked shadows read as a real object; one reads as a sticker.
  // [dx, dy, blur, alpha] — contact, mid lift, ambient room shadow.
  var ELEV = [[0, 2, 6, 0.10], [0, 20, 44, 0.14], [0, 64, 110, 0.17]];
  function setElevation(stack) { ELEV = stack; return ELEV; }

  function elevate(layer, scale, tint) {
    var c = tint || [0, 0, 0], s = (scale === undefined ? 1 : scale);
    for (var i = 0; i < ELEV.length; i++) {
      shadow(layer, ELEV[i][0] * s, ELEV[i][1] * s, ELEV[i][2] * s, c, ELEV[i][3]);
    }
    return layer;
  }

  // Grow the whole stack alongside a Scale move. An object that scales without
  // its shadow changing reads flat — this is the single highest-value call in
  // the library. baseIndex = parade index of the first drop shadow.
  function elevateAnim(layer, t0, t1, s0, s1, influence, baseIndex) {
    var parade = layer.property("ADBE Effect Parade");
    var bi = baseIndex || 1;
    for (var i = 0; i < ELEV.length; i++) {
      // re-fetch by INDEX: adding sibling effects invalidates held references
      var fx = parade.property(bi + i);
      var dist = Math.sqrt(ELEV[i][0] * ELEV[i][0] + ELEV[i][1] * ELEV[i][1]);
      var dP = fx.property("ADBE Drop Shadow-0004");
      dP.setValueAtTime(t0, dist * s0);
      dP.setValueAtTime(t1, dist * s1);
      easeOutAt(dP, 2, influence || 90);
      var sP = fx.property("ADBE Drop Shadow-0005");
      sP.setValueAtTime(t0, ELEV[i][2] * s0);
      sP.setValueAtTime(t1, ELEV[i][2] * s1);
      easeOutAt(sP, 2, influence || 90);
    }
  }

  // ============================================================
  // TEXT
  // ============================================================
  // Positioned by measured INK bounds, which is exactly what Figma's
  // absoluteRenderBounds reports — so paste those numbers straight in.
  //   align 'L' -> (x,y) is ink top-left.  'C' -> ink top-centre.
  //   o = { name, str, font, size, tracking, color, opacity, align, x, y }
  // font is a PostScript name ("SFPro-Semibold"), not a display name.
  function textLayer(comp, o) {
    var l = comp.layers.addText(o.str);
    l.name = o.name;
    var prop = l.property("ADBE Text Properties").property("ADBE Text Document");
    var td = prop.value;
    td.resetCharStyle();
    td.font = o.font;
    td.fontSize = o.size;
    td.tracking = Math.round(o.tracking || 0);   // AE rejects non-integers here
    td.fillColor = o.color;
    td.applyFill = true;
    td.applyStroke = false;
    td.justification = (o.align === 'C')
      ? ParagraphJustification.CENTER_JUSTIFY
      : ParagraphJustification.LEFT_JUSTIFY;
    prop.setValue(td);
    var tr = l.property("ADBE Transform Group");
    tr.property("ADBE Opacity").setValue((o.opacity === undefined ? 1 : o.opacity) * 100);
    var r = l.sourceRectAtTime(0, false);
    var ax = (o.align === 'C') ? (r.left + r.width / 2) : r.left;
    tr.property("ADBE Anchor Point").setValue([ax, r.top]);
    tr.property("ADBE Position").setValue([o.x, o.y]);
    return l;
  }

  // A text animator with NO selector applies uniformly to every character,
  // which is what you want for a track-in. Adding a selector via script is
  // unnecessary here and only complicates the result.
  function animator(layer, name) {
    var a = layer.property("ADBE Text Properties")
                 .property("ADBE Text Animators").addProperty("ADBE Text Animator");
    a.name = name || "Animator";
    return a.property("ADBE Text Animator Properties");
  }
  // Tracking animators are ADDITIVE on top of the layer's base tracking, so
  // pass the delta: track(fromPx, size) - baseTracking.
  // Anchor centre-justified text only if it may grow into a neighbour — a
  // centre-justified track-in expands BOTH ways.
  function trackIn(layer, startAmount, t0, t1, influence) {
    var props = animator(layer, "Track In");
    var amt = props.addProperty("ADBE Text Tracking Amount");
    amt.setValueAtTime(t0, startAmount);
    amt.setValueAtTime(t1, 0);
    easeOutAt(amt, 2, influence || 88);
    return amt;
  }

  // ============================================================
  // KEYFRAMES + EASING
  // ============================================================
  // SPATIAL properties (Position) take exactly ONE ease regardless of how many
  // dimensions they have; value properties take one PER dimension. Passing the
  // wrong count throws "Value array does not have N elements".
  function easeOutAt(prop, keyIndex, influence) {
    var e = new KeyframeEase(0, influence);
    var n = 1;
    if (!prop.isSpatial) {
      var v = prop.keyValue(keyIndex);
      n = (v instanceof Array) ? v.length : 1;
    }
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(e);
    prop.setTemporalEaseAtKey(keyIndex, arr, arr);
  }
  function easeAll(prop, influence) {
    for (var k = 1; k <= prop.numKeys; k++) easeOutAt(prop, k, influence || 85);
  }

  // Two keys plus an ease on the landing key — the workhorse.
  function ramp2(prop, t0, v0, t1, v1, influence) {
    prop.setValueAtTime(t0, v0);
    prop.setValueAtTime(t1, v1);
    easeOutAt(prop, 2, influence === undefined ? 90 : influence);
    return prop;
  }
  // Scale 0 -> over -> rest. Reads as weight rather than a linear pop.
  function pop(prop, t0, t1, tSettle, target, over) {
    var o = over === undefined ? 1.1 : over;
    prop.setValueAtTime(t0, [0, 0]);
    prop.setValueAtTime(t1, [target * o, target * o]);
    prop.setValueAtTime(tSettle, [target, target]);
    easeOutAt(prop, 2, 78);
    easeOutAt(prop, 3, 70);
    return prop;
  }
  // Rise into place: Y offset + opacity, the default "element arrives" move.
  function rise(layer, t0, durSec, dy, toOpacity, influence) {
    var p = layer.property("ADBE Transform Group").property("ADBE Position");
    var home = p.value;
    ramp2(p, t0, [home[0], home[1] + dy], t0 + durSec, home, influence || 88);
    fade(layer, t0, t0 + durSec * 0.8, 0, toOpacity === undefined ? 100 : toOpacity);
    return layer;
  }
  function fade(layer, t0, t1, from, to) {
    var op = layer.property("ADBE Transform Group").property("ADBE Opacity");
    op.setValueAtTime(t0, from);
    op.setValueAtTime(t1, to);
    return op;
  }

  // Parenting to a null inherits TRANSFORM ONLY — opacity does not propagate.
  // Fading a rig null does nothing to its children. These touch every member
  // and preserve each one's own resting opacity.
  function fadeInGroup(layers, t0, t1) {
    for (var i = 0; i < layers.length; i++) {
      var op = layers[i].property("ADBE Transform Group").property("ADBE Opacity");
      var rest = op.value;
      op.setValueAtTime(t0, 0);
      op.setValueAtTime(t1, rest);
    }
  }
  function fadeOutGroup(layers, t0, t1) {
    for (var j = 0; j < layers.length; j++) {
      var o2 = layers[j].property("ADBE Transform Group").property("ADBE Opacity");
      o2.setValueAtTime(t0, o2.value);
      o2.setValueAtTime(t1, 0);
    }
  }

  // A null to move a group as one object.
  function rig(comp, name, cx, cy, members) {
    var r = comp.layers.addNull(comp.duration);
    r.name = name;
    r.property("ADBE Transform Group").property("ADBE Position").setValue([cx, cy]);
    if (members) for (var i = 0; i < members.length; i++) members[i].parent = r;
    return r;
  }

  // ============================================================
  // GRADIENTS
  // ============================================================
  // AE shape-layer gradient STOPS are PropertyValueType.NO_VALUE and cannot be
  // written from ExtendScript at all. So a 2-stop alpha gradient is built on a
  // solid as: Ramp -> Levels -> Shift Channels -> Fill.
  //   Ramp           writes a luminance wedge
  //   Levels         (optional) repositions the first stop / shapes falloff
  //   Shift Channels turns that luminance into ALPHA
  //   Fill           restores the real colour, preserving the new alpha
  //
  //   o = { w, h, cx, cy, shape:'linear'|'radial', p0:[x,y], p1:[x,y],
  //         color, alpha, inBlack, gamma, opacity, blur, inset, feather }
  // p0/p1 are LAYER coordinates (origin at the layer's top-left). p0 is opaque.
  //
  // Caveat: masks render BEFORE effects, so `feather` cannot soften anything
  // Shift Channels later rewrites. For a soft-edged glow use shape:'radial'
  // and size the layer so the ramp reaches zero inside the layer bounds.
  function gradLayer(comp, name, o) {
    var l = comp.layers.addSolid([1, 1, 1], name, o.w, o.h, 1);
    l.property("ADBE Transform Group").property("ADBE Position").setValue([o.cx, o.cy]);

    var fxp = l.property("ADBE Effect Parade");
    var rp = fxp.addProperty("ADBE Ramp");
    rp.property("ADBE Ramp-0001").setValue(o.p0);
    rp.property("ADBE Ramp-0002").setValue([1, 1, 1, 1]);
    rp.property("ADBE Ramp-0003").setValue(o.p1);
    rp.property("ADBE Ramp-0004").setValue([0, 0, 0, 1]);
    rp.property("ADBE Ramp-0005").setValue(o.shape === 'radial' ? 2 : 1);

    if (o.inBlack || o.gamma) {
      var lv = fxp.addProperty("ADBE Easy Levels2");
      if (o.inBlack) lv.property("ADBE Easy Levels2-0003").setValue(o.inBlack);
      if (o.gamma)   lv.property("ADBE Easy Levels2-0005").setValue(o.gamma);
    }
    var sc = fxp.addProperty("ADBE Shift Channels");
    sc.property("ADBE Shift Channels-0001").setValue(5);      // Take Alpha From = Luminance

    var fl = fxp.addProperty("ADBE Fill");
    fl.property("ADBE Fill-0002").setValue(rgba(o.color));    // Color
    fl.property("ADBE Fill-0005").setValue(o.alpha === undefined ? 1 : o.alpha);

    if (o.feather) {
      var ins = o.inset || [0, 0];
      var mk = l.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
      var msh = new Shape();
      var x0 = ins[0], y0 = ins[1], x1 = o.w - ins[0], y1 = o.h - ins[1];
      msh.vertices = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      msh.inTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
      msh.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
      msh.closed = true;
      mk.property("ADBE Mask Shape").setValue(msh);
      mk.property("ADBE Mask Feather").setValue(o.feather);
    }
    if (o.blur) {
      var gb = fxp.addProperty("ADBE Gaussian Blur 2");
      gb.property("ADBE Gaussian Blur 2-0001").setValue(o.blur);
    }
    l.property("ADBE Transform Group").property("ADBE Opacity")
      .setValue((o.opacity === undefined ? 1 : o.opacity) * 100);
    return l;
  }

  // Soft radial glow / light pool with no rectangular seam. squash < 1 makes it
  // elliptical (a shaft rather than a disc).
  function glow(comp, name, cx, cy, radius, color, opacity, squash, gamma) {
    var side = radius * 2;
    var l = gradLayer(comp, name, {
      w: side, h: side, cx: cx, cy: cy,
      shape: 'radial', p0: [radius, radius], p1: [side, radius],
      gamma: gamma || 1.45, color: color, alpha: 1,
      opacity: opacity, blur: Math.max(20, radius * 0.12)
    });
    if (squash && squash !== 1) {
      l.property("ADBE Transform Group").property("ADBE Scale").setValue([100, squash * 100]);
    }
    return l;
  }

  // ============================================================
  // COMPS + PROJECT PANEL HYGIENE
  // ============================================================
  function findComp(proj, needle) {
    for (var i = 1; i <= proj.numItems; i++) {
      var it = proj.item(i);
      if (it instanceof CompItem && it.name.indexOf(needle) === 0) return it;
    }
    return null;
  }
  // Remove any comp whose name starts with prefix. Call before rebuilding a
  // scene so reruns replace rather than accumulate.
  function wipe(proj, namePrefix) {
    for (var i = proj.numItems; i >= 1; i--) {
      var it = proj.item(i);
      if (it instanceof CompItem && it.name.indexOf(namePrefix) === 0) it.remove();
    }
  }
  function sceneComp(proj, name, durFrames) {
    for (var i = proj.numItems; i >= 1; i--) {
      if (proj.item(i).name === name) proj.item(i).remove();
    }
    var c = proj.items.addComp(name, CFG.W, CFG.H, 1, durFrames / CFG.FPS, CFG.FPS);
    c.motionBlur = true;
    return c;
  }

  // Reuse-by-name for comps SHARED between scenes. Rebuilding a shared precomp
  // inside a scene builder orphans the layers of every scene built earlier, so
  // shared assets must only be regenerated deliberately (force = true).
  function sharedComp(proj, name, w, h, durSec, force) {
    for (var i = 1; i <= proj.numItems; i++) {
      var it = proj.item(i);
      if (it instanceof CompItem && it.name === name) {
        if (!force) return { comp: it, existed: true };
        it.remove();
        break;
      }
    }
    return { comp: proj.items.addComp(name, w, h, 1, durSec || 4, CFG.FPS), existed: false };
  }

  function findFolder(proj, name, parent) {
    for (var i = 1; i <= proj.numItems; i++) {
      var it = proj.item(i);
      if (it instanceof FolderItem && it.name === name) {
        if (!parent || it.parentFolder === parent) return it;
      }
    }
    return null;
  }
  function folder(proj, name, parent) {
    var found = findFolder(proj, name, parent);
    if (found) return found;
    var fo = proj.items.addFolder(name);
    if (parent) fo.parentFolder = parent;
    return fo;
  }

  // Call at the end of EVERY build. Idempotent. Sorting convention:
  //   <prefix>_MASTER...      -> project folder root
  //   name contains " · "     -> scenes folder      (top-level scene comps)
  //   other <prefix>_ comps   -> precomps folder
  //   solids and nulls        -> solids folder
  function organize(proj) {
    // Rebuilding a scene drops its comp but leaves that comp's solids and nulls
    // behind as orphans, so the Solids folder grows every run. Sweep first.
    try { proj.removeUnusedFootage(); } catch (e) {}

    var root   = folder(proj, CFG.folder);
    var fScene = folder(proj, CFG.sceneFolder, root);
    var fPre   = folder(proj, CFG.precompFolder, root);
    var fSol   = folder(proj, CFG.solidFolder, root);

    var moved = 0;
    var masterRe = new RegExp("^" + CFG.prefix + "_MASTER");
    var mineRe   = new RegExp("^" + CFG.prefix + "_");
    for (var i = 1; i <= proj.numItems; i++) {
      var it = proj.item(i);
      if (!(it instanceof CompItem)) continue;
      if (masterRe.test(it.name))               { it.parentFolder = root;   moved++; }
      else if (it.name.indexOf(" · ") > 0) { it.parentFolder = fScene; moved++; }
      else if (mineRe.test(it.name))            { it.parentFolder = fPre;   moved++; }
    }
    // AE drops every new solid into an auto "Solids" folder at the root.
    // Sweep its contents across, then bin the empty shell.
    for (var pass = 0; pass < 4; pass++) {
      var auto = null;
      for (var k = 1; k <= proj.numItems; k++) {
        var f2 = proj.item(k);
        if (f2 instanceof FolderItem && f2.name === "Solids" && f2 !== fSol) { auto = f2; break; }
      }
      if (!auto) break;
      for (var n = auto.numItems; n >= 1; n--) { auto.item(n).parentFolder = fSol; moved++; }
      if (auto.numItems === 0) auto.remove();
    }
    return moved;
  }

  // Lay scenes end to end on one timeline. cuts = [["PREFIX_S1", 0], ...] in
  // SECONDS. Added in reverse so the cut reads top-to-bottom in the timeline.
  function master(proj, name, totalSec, cuts, bgColor) {
    for (var r = proj.numItems; r >= 1; r--) {
      if (proj.item(r).name === name) proj.item(r).remove();
    }
    var m = proj.items.addComp(name, CFG.W, CFG.H, 1, totalSec, CFG.FPS);
    if (bgColor) m.bgColor = bgColor;
    m.motionBlur = true;
    var missing = [];
    for (var k = cuts.length - 1; k >= 0; k--) {
      var src = findComp(proj, cuts[k][0]);
      if (!src) { missing.push(cuts[k][0]); continue; }
      var L = m.layers.add(src);
      L.startTime = cuts[k][1];
      L.inPoint = cuts[k][1];
      L.outPoint = cuts[k][1] + src.duration;
    }
    return { comp: m, missing: missing };
  }

  function log(file, msg) {
    var fl = new File(file);
    fl.open("w"); fl.write(msg); fl.close();
  }

  return {
    configure: configure, CFG: CFG,
    f: f, rgba: rgba, hex: hex, track: track,
    shapeLayer: shapeLayer, rootGrp: rootGrp, addGroup: addGroup,
    addRect: addRect, addEllipse: addEllipse, addPath: addPath,
    addFill: addFill, addStroke: addStroke, addTrim: addTrim,
    rectLayer: rectLayer, ellipseLayer: ellipseLayer,
    vecsOf: vecsOf, rectOf: rectOf,
    roundRectShape: roundRectShape, clipCard: clipCard, rotatedCentre: rotatedCentre,
    shadow: shadow, elevate: elevate, elevateAnim: elevateAnim,
    setElevation: setElevation, ELEV: ELEV,
    textLayer: textLayer, animator: animator, trackIn: trackIn,
    easeOutAt: easeOutAt, easeAll: easeAll,
    ramp2: ramp2, pop: pop, rise: rise, fade: fade,
    fadeInGroup: fadeInGroup, fadeOutGroup: fadeOutGroup, rig: rig,
    gradLayer: gradLayer, glow: glow,
    findComp: findComp, wipe: wipe, sceneComp: sceneComp, sharedComp: sharedComp,
    folder: folder, organize: organize, master: master, log: log
  };
})();

"ae-lib loaded";
