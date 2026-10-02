// ============================================================
// build-scene.jsx — runnable template + smoke test.
//
// Run it as-is to confirm the whole pipeline works end to end:
//     ./go.sh build-scene.jsx scene.log
//     ./go.sh shoot.jsx
//     ./sheet.sh PROJ_S1 2 0 12 24 40 60
//
// Then copy this file per scene and replace the geometry with numbers pulled
// out of Figma. Structure every builder the same way:
//   1. config + library
//   2. wipe + create the comp
//   3. build layers BACK TO FRONT
//   4. animate, grouped under a clear heading
//   5. organize() + log()
// ============================================================
(function buildScene() {

  // ---------- 1. setup ----------
  var BASE = "__BASE__";
  $.evalFile(new File(BASE + "ae-lib.jsx"));
  var A = $.global.AEB;

  A.configure({
    W: 1920, H: 1080, FPS: 30,
    prefix: "PROJ",
    folder: "My Project"
  });

  var f = A.f;
  var INK   = A.hex("#141414");
  var PAPER = A.hex("#FFFFFF");
  var CREAM = A.hex("#F2EFE9");

  app.beginUndoGroup("Scene 1");
  var proj = app.project;
  A.wipe(proj, "PROJ_S1");

  // ---------- 2. comp ----------
  var comp = A.sceneComp(proj, "PROJ_S1 · Card Lift", 90);   // 90 frames = 3s
  comp.bgColor = CREAM;

  // ---------- 3. layers, BACK TO FRONT ----------
  // comp.layers.add*() always inserts at index 1, so the LAST layer created
  // ends up on top. Build the background first.
  var bg = comp.layers.addSolid(CREAM, "BG_Base", A.CFG.W, A.CFG.H, 1);
  bg.property("ADBE Transform Group").property("ADBE Position").setValue([960, 540]);

  // soft overhead pool — radial so there is no rectangular seam to hide
  var pool = A.glow(comp, "BG_Light_Pool", 960, 430, 600, PAPER, 0.75, 0.62);

  // a card, built as a precomp at NATIVE size so any scale move is a clean
  // transform on one shared source rather than a differently-sized rebuild
  var card = (function () {
    var made = A.sharedComp(proj, "PROJ_Card", 520, 320, 4);
    if (made.existed) return made.comp;
    var c = made.comp;
    A.rectLayer(c, "Card_Body", 0, 0, 520, 320, 22, PAPER, 1, INK, 1, 0.08);
    A.rectLayer(c, "Rule", 0, 64, 520, 1, 0, INK, 0.08);
    // glyph groups BEFORE the well behind them — group 1 renders in front
    var badge = A.shapeLayer(c, "Badge");
    var gv = A.addGroup(A.rootGrp(badge), "glyph");
    A.addPath(gv, [[-9, 1], [-3, 7], [9, -6]],
                  [[0, 0], [0, 0], [0, 0]], [[0, 0], [0, 0], [0, 0]], false);
    A.addStroke(gv, PAPER, 2.6, 1, true);
    var wv = A.addGroup(A.rootGrp(badge), "well");
    A.addEllipse(wv, 44, 44, 0, 0);
    A.addFill(wv, INK, 1);
    badge.property("ADBE Transform Group").property("ADBE Position").setValue([54, 32]);
    A.textLayer(c, { name: "Title", str: "Approved", font: "SFPro-Semibold",
      size: 30, tracking: A.track(-0.6, 30), color: INK, opacity: 0.95,
      align: 'L', x: 32, y: 120 });
    A.textLayer(c, { name: "Sub", str: "38 of 47 drafts", font: "SFPro-Regular",
      size: 17, tracking: 0, color: INK, opacity: 0.45, align: 'L', x: 32, y: 164 });
    for (var i = 0; i < 3; i++) {
      A.rectLayer(c, "Rule_" + (i + 1), 32, 214 + i * 26, [360, 300, 220][i], 10, 5, INK, 0.09);
    }
    return c;
  })();

  var cardL = comp.layers.add(card);
  cardL.name = "Card";
  cardL.motionBlur = true;
  var ct = cardL.property("ADBE Transform Group");
  ct.property("ADBE Anchor Point").setValue([260, 160]);   // precomp centre
  ct.property("ADBE Position").setValue([960, 620]);
  A.elevate(cardL, 1, INK);                                // three stacked shadows

  var title = A.textLayer(comp, {
    name: "Title", str: "Everything in one place", font: "SFPro-Semibold",
    size: 58, tracking: A.track(-1.4, 58), color: INK, opacity: 1,
    align: 'C', x: 960, y: 250
  });

  var word = A.textLayer(comp, {
    name: "Wordmark", str: "STUDIO", font: "SFPro-Medium",
    size: 22, tracking: 120, color: INK, opacity: 0.45,
    align: 'L', x: 830, y: 180          // left-anchored so a track-in grows right
  });

  // ---------- 4. animation ----------
  A.fade(pool, 0, f(30), 0, 75);

  // wordmark tracks in; animator amount is ADDITIVE over the base tracking
  A.trackIn(word, 260 - 120, 0, f(20), 88);
  A.fade(word, 0, f(12), 0, 45);

  A.rise(title, f(10), f(16), 30, 100, 88);

  // card lifts in — and its shadow grows WITH it, which is the whole illusion
  var t0 = f(20), t1 = f(46);
  A.ramp2(ct.property("ADBE Position"), t0, [960, 760], t1, [960, 620], 90);
  A.ramp2(ct.property("ADBE Scale"),    t0, [96, 96],   t1, [100, 100], 90);
  A.fade(cardL, t0, t0 + f(8), 0, 100);
  A.elevateAnim(cardL, t0, t1, 0.45, 1, 90, 1);

  // ---------- 5. finish ----------
  comp.openInViewer();
  var moved = A.organize(proj);
  app.endUndoGroup();

  A.log(BASE + "scene.log",
    "OK comp=" + comp.name + " layers=" + comp.numLayers +
    " dur=" + comp.duration + " organized=" + moved);
  return "built";
})();
