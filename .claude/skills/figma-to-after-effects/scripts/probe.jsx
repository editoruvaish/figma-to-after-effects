// ============================================================
// probe.jsx — discover real match names instead of guessing them.
//
// AE property match names are only partly documented and several are
// counter-intuitive ("ADBE Rotate Z", not "ADBE Rotation"; Fill's Color is
// -0002 while All Masks is -0007). Guessing costs a failed build per guess;
// probing costs one run and prints the truth.
//
// Add whatever you need to EFFECTS / ANIM_PROPS, run ./go.sh probe.jsx, then
// read probe.txt. The temp comp is removed afterwards.
// ============================================================
(function () {
  var BASE = "__BASE__";
  var out = [];

  // effects to dump, by match name
  var EFFECTS = ["ADBE Drop Shadow", "ADBE Ramp", "ADBE Easy Levels2",
                 "ADBE Shift Channels", "ADBE Fill", "ADBE Gaussian Blur 2"];
  // text-animator properties to test-add
  var ANIM_PROPS = ["ADBE Text Tracking Amount", "ADBE Text Track Type",
                    "ADBE Text Position 3D", "ADBE Text Opacity",
                    "ADBE Text Scale 3D", "ADBE Text Rotation", "ADBE Text Blur"];

  var proj = app.project;
  var tmp = proj.items.addComp("__PROBE__", 400, 400, 1, 1, 30);
  var s = tmp.layers.addSolid([1, 1, 1], "probe_solid", 400, 400, 1);

  for (var i = 0; i < EFFECTS.length; i++) {
    try {
      var fx = s.property("ADBE Effect Parade").addProperty(EFFECTS[i]);
      out.push("=== " + EFFECTS[i] + "  (" + fx.name + ")  props=" + fx.numProperties);
      for (var p = 1; p <= fx.numProperties; p++) {
        var pr = fx.property(p);
        var v = ""; try { v = String(pr.value); } catch (e) { v = "?"; }
        out.push("  " + p + " | " + pr.matchName + " | " + pr.name +
                 " | type=" + pr.propertyValueType + " | default=" + v);
      }
    } catch (e2) { out.push("=== " + EFFECTS[i] + " FAILED: " + e2.toString()); }
  }

  // --- text animator ---
  var t = tmp.layers.addText("Probe");
  var an = t.property("ADBE Text Properties").property("ADBE Text Animators")
            .addProperty("ADBE Text Animator");
  var props = an.property("ADBE Text Animator Properties");
  out.push("=== text animator properties");
  for (var j = 0; j < ANIM_PROPS.length; j++) {
    try {
      var ap = props.addProperty(ANIM_PROPS[j]);
      out.push("  OK   " + ANIM_PROPS[j] + " -> " + ap.name + " type=" + ap.propertyValueType);
    } catch (e3) {
      out.push("  FAIL " + ANIM_PROPS[j] + " : " + e3.toString().substr(0, 90));
    }
  }

  // --- shape layer: trim + stroke + the unsettable gradient ---
  var sl = tmp.layers.addShape();
  var g = sl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
  var vecs = g.property("ADBE Vectors Group");
  vecs.addProperty("ADBE Vector Shape - Ellipse")
      .property("ADBE Vector Ellipse Size").setValue([200, 200]);
  vecs.addProperty("ADBE Vector Graphic - Stroke");
  var trim = vecs.addProperty("ADBE Vector Filter - Trim");
  out.push("=== Trim Paths  props=" + trim.numProperties);
  for (var m = 1; m <= trim.numProperties; m++) {
    out.push("  " + m + " | " + trim.property(m).matchName + " | " + trim.property(m).name +
             " | default=" + trim.property(m).value);
  }
  var gf = vecs.addProperty("ADBE Vector Graphic - G-Fill");
  out.push("=== Gradient Fill  props=" + gf.numProperties);
  for (var q = 1; q <= gf.numProperties; q++) {
    out.push("  " + q + " | " + gf.property(q).matchName + " | " + gf.property(q).name +
             " | type=" + gf.property(q).propertyValueType);
  }
  try {
    gf.property("ADBE Vector Grad Colors").setValue([0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 0]);
    out.push("  gradient stops: WRITABLE (unexpected — check your AE version)");
  } catch (e4) {
    out.push("  gradient stops: NOT writable -> " + e4.toString().substr(0, 120));
  }

  // --- fonts: the only reliable way to test a PostScript name is to set it ---
  var CANDIDATES = ["SFPro-Regular", "SFPro-Medium", "SFPro-Semibold", "SFPro-Bold",
                    "Inter-Regular", "HelveticaNeue"];
  out.push("=== font resolution (set, then read back)");
  for (var c = 0; c < CANDIDATES.length; c++) {
    try {
      var tp = t.property("ADBE Text Properties").property("ADBE Text Document");
      var td = tp.value; td.font = CANDIDATES[c]; tp.setValue(td);
      var got = tp.value.font;
      out.push("  " + CANDIDATES[c] + " -> " + got +
               (got === CANDIDATES[c] ? "   [exact]" : "   [SUBSTITUTED]"));
    } catch (e5) { out.push("  " + CANDIDATES[c] + " -> FAIL " + e5.toString().substr(0, 60)); }
  }

  tmp.remove();
  var fl = new File(BASE + "probe.txt");
  fl.open("w"); fl.write(out.join("\r\n")); fl.close();
  return "probe done -> probe.txt";
})();
