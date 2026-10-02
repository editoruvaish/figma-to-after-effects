#!/bin/bash
# ============================================================
# doctor.sh — check the After Effects connection before you build anything.
#
# There is no "After Effects MCP". The connection is AppleScript talking to a
# running copy of AE, so four things have to be true. This checks all four and
# tells you exactly how to fix whichever one is missing.
#
#   ./doctor.sh
#   AE_APP="Adobe After Effects 2025" ./doctor.sh
# ============================================================
D="$(cd "$(dirname "$0")" && pwd)/"
PASS=0; FAIL=0
ok()   { echo "  [ok]   $1"; PASS=$((PASS+1)); }
bad()  { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
note() { echo "         $1"; }

echo
echo "=== 1. After Effects installed ==="
APPS=(); while IFS= read -r line; do APPS+=("$line"); done < <(ls -d /Applications/Adobe\ After\ Effects* 2>/dev/null)
if [ ${#APPS[@]} -eq 0 ]; then
  bad "no After Effects found in /Applications"
  note "install it from Creative Cloud, then rerun."
  echo; exit 1
fi
for a in "${APPS[@]}"; do ok "$(basename "$a")"; done
# the AppleScript name is the .app basename, not the bundle name ("After Effects")
DEFAULT_APP="$(basename "${APPS[${#APPS[@]}-1]}")"
APP="${AE_APP:-$DEFAULT_APP}"
note "using: \"$APP\"   (override with AE_APP=\"...\")"

echo
echo "=== 2. After Effects running ==="
if pgrep -f "Adobe After Effects [0-9]" >/dev/null 2>&1; then
  ok "process is up"
else
  bad "After Effects is not running"
  note "open it first — these scripts drive a live app, they do not launch one."
  note "  open -a \"$APP\""
fi

echo
echo "=== 3. macOS Automation permission ==="
LINK_OK=0
VER_OUT="$(osascript -e "tell application \"$APP\" to get version" 2>&1)"
# must be a bare version number — an osascript error line also starts with
# digits ("51:58: execution error: ..."), so anchor the whole string.
if echo "$VER_OUT" | grep -qE '^[0-9]+(\.[0-9]+)*$'; then
  ok "AppleScript reachable — AE reports version $VER_OUT"
  LINK_OK=1
elif echo "$VER_OUT" | grep -q -- "-1743"; then
  bad "your terminal is not authorised to send Apple events to After Effects"
  note "System Settings > Privacy & Security > Automation > <your terminal app>"
  note "and tick \"$APP\". If it is not listed there, reset the prompt with:"
  note "  tccutil reset AppleEvents"
  note "then rerun this script and click OK when macOS asks."
elif echo "$VER_OUT" | grep -q -- "-1728"; then
  bad "AppleScript cannot find an app called \"$APP\""
  note "the name must match the .app basename exactly. Installed here:"
  for a in "${APPS[@]}"; do note "  AE_APP=\"$(basename "$a")\" ./doctor.sh"; done
elif echo "$VER_OUT" | grep -qi "isn't running\|Application isn't"; then
  bad "\"$APP\" is installed but not running"
  note "  open -a \"$APP\""
else
  bad "unexpected AppleScript response:"
  note "$VER_OUT"
fi

echo
echo "=== 4. Scripting allowed to write files ==="
# The functional test beats grepping the prefs file: AE only flushes prefs to
# disk on quit, so the file can lag behind the checkbox for a whole session.
if [ "$LINK_OK" -ne 1 ]; then
  echo "  [skip] cannot test until step 3 passes — it runs over the same link."
  echo
  echo "============================================"
  echo "  $FAIL check(s) failed, $PASS passed. Fix the notes above and rerun."
  echo "============================================"
  echo
  exit 1
fi
rm -f "${D}_doctor.log"
cat > "${D}_doctor.jsx" <<EOF
(function () {
  try {
    var f = new File("${D}_doctor.log");
    f.open("w");
    f.write("AE " + app.version + " | project=" +
            (app.project.file ? app.project.file.name : "(unsaved)") +
            " | items=" + app.project.numItems);
    f.close();
    return "wrote";
  } catch (e) { return "ERR " + e.toString(); }
})();
EOF
osascript -e "tell application \"$APP\" to DoScriptFile \"${D}_doctor.jsx\"" >/dev/null 2>&1
sleep 1
if [ -f "${D}_doctor.log" ]; then
  ok "scripts can run and write files"
  note "$(cat "${D}_doctor.log")"
else
  bad "the script did not write its file"
  note "After Effects > Settings > Scripting & Expressions >"
  note "tick \"Allow Scripts to Write Files and Access Network\", then rerun."
  note "(If step 3 also failed, fix that first — this test depends on it.)"
fi
rm -f "${D}_doctor.jsx" "${D}_doctor.log"

echo
echo "=== 5. ffmpeg (contact sheets) ==="
if command -v ffmpeg >/dev/null 2>&1; then ok "$(ffmpeg -version 2>/dev/null | head -1 | cut -c1-40)"
else
  bad "ffmpeg not found"
  note "only needed for sheet.sh. install with: brew install ffmpeg"
fi

echo
echo "============================================"
if [ "$FAIL" -eq 0 ]; then
  echo "  all checks passed — try: ./go.sh build-scene.jsx scene.log"
else
  echo "  $FAIL check(s) failed, $PASS passed. Fix the notes above and rerun."
fi
echo "============================================"
echo
[ "$FAIL" -eq 0 ]
