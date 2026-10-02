// ============================================================
// run.jsx — error-capturing wrapper.
//
// ALWAYS run builders through this. A bare `DoScriptFile` on a builder that
// throws fails SILENTLY: osascript returns 0, nothing appears in AE, and you
// have no idea why. This catches the error and writes it to run.log with a
// line number.
//
// go.sh rewrites the TARGET line, so you normally never edit this by hand.
// ============================================================
(function () {
  var BASE = "__BASE__";               // absolute path to this scripts/ folder
  var TARGET = "build-scene.jsx";      // rewritten per run by go.sh

  var out = [];
  var target = new File(BASE + TARGET);
  out.push("TARGET=" + TARGET + " exists=" + target.exists);
  try {
    var r = $.evalFile(target);
    out.push("RESULT=" + r);
  } catch (e) {
    out.push("ERROR: " + e.toString());
    out.push("LINE: " + (e.line !== undefined ? e.line : "?"));
    out.push("FILE: " + (e.fileName || "?"));
    out.push("SOURCE: " + (e.source ? String(e.source).substr(0, 200) : "?"));
  }
  var f = new File(BASE + "run.log");
  f.open("w"); f.write(out.join("\r\n")); f.close();
})();
