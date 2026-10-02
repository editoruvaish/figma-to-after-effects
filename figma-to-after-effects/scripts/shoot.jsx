// ============================================================
// shoot.jsx — render check frames straight to PNG.
//
// comp.saveFrameToPng() writes a single frame without touching the render
// queue or aerender, which makes it fast enough to use as an inner verify
// loop. Build -> shoot -> LOOK AT THE FRAMES -> fix -> repeat.
//
// Edit PREFIX and FRAMES, then: ./go.sh shoot.jsx
// Frames land in ../frames/ ; pair with sheet.sh to view several at once.
//
// It also dumps the layer stack, which is how you catch inverted z-order:
// comp.layers.add*() always inserts at index 1, so the LAST layer you create
// sits on top and backgrounds must be built first.
// ============================================================
(function () {
  var BASE = "__BASE__";
  var OUTDIR = BASE + "../frames/";
  var PREFIX = "PROJ_S1";
  var FRAMES = [0, 12, 24, 40, 60];

  var out = [];
  var comp = null;
  for (var i = 1; i <= app.project.numItems; i++) {
    var it = app.project.item(i);
    if (it instanceof CompItem && it.name.indexOf(PREFIX) === 0) { comp = it; break; }
  }
  if (!comp) {
    out.push("COMP NOT FOUND for prefix " + PREFIX);
  } else {
    var fps = 1 / comp.frameDuration;
    new Folder(OUTDIR).create();
    for (var k = 0; k < FRAMES.length; k++) {
      var t = FRAMES[k] / fps;
      if (t >= comp.duration) t = comp.duration - comp.frameDuration;
      var fl = new File(OUTDIR + PREFIX + "_f" + FRAMES[k] + ".png");
      try { comp.saveFrameToPng(t, fl); out.push("saved f" + FRAMES[k]); }
      catch (e) { out.push("ERR f" + FRAMES[k] + ": " + e.toString()); }
    }
    out.push("comp=" + comp.name + "  layers=" + comp.numLayers +
             "  dur=" + comp.duration + "  fps=" + fps);
    out.push("--- layer stack, top to bottom ---");
    for (var n = 1; n <= comp.numLayers; n++) out.push("  L" + n + " " + comp.layer(n).name);
  }
  var lg = new File(BASE + "shoot.log");
  lg.open("w"); lg.write(out.join("\r\n")); lg.close();
  return "shot";
})();
