#!/bin/bash
# ============================================================
# go.sh <script.jsx> [extra-log-to-print]
#
# Runs a .jsx inside After Effects through the error-capturing wrapper and
# prints the result. This is the ONLY way you should invoke a builder — a bare
# DoScriptFile on a script that throws fails silently.
#
#   ./go.sh build-scene.jsx scene.log
#   ./go.sh shoot.jsx
#
# Set AE_APP if you are not on After Effects 2026, e.g.
#   AE_APP="Adobe After Effects 2025" ./go.sh build-scene.jsx
# ============================================================
set -e
D="$(cd "$(dirname "$0")" && pwd)/"
APP="${AE_APP:-Adobe After Effects 2026}"

if [ -z "$1" ]; then
  echo "usage: ./go.sh <script.jsx> [logfile]" >&2
  exit 1
fi
if [ ! -f "$D$1" ]; then
  echo "no such script: $D$1" >&2
  exit 1
fi

# Stamp the absolute path into the wrapper and the target, and point the
# wrapper at this run. __BASE__ placeholders are replaced on first use, so the
# skill folder works from wherever it is dropped.
python3 - "$D" "$1" <<'PY'
import io, os, re, sys
base, target = sys.argv[1], sys.argv[2]

# Stamp every .jsx once so scripts can also $.evalFile each other.
for name in sorted(os.listdir(base)):
    if not name.endswith(".jsx"):
        continue
    p = base + name
    s = io.open(p, encoding="utf-8").read()
    out = s.replace("__BASE__", base)
    out = re.sub(r'var BASE\s*=\s*"[^"]*";', 'var BASE = "%s";' % base, out, count=1)
    if name == "run.jsx":
        out = re.sub(r'var TARGET\s*=\s*"[^"]*";', 'var TARGET = "%s";' % target, out, count=1)
    if out != s:
        io.open(p, "w", encoding="utf-8").write(out)
PY

# Clear last run's logs so a run that never reached AE cannot print a stale
# RESULT=built from the previous one.
rm -f "${D}run.log"
[ -n "$2" ] && rm -f "${D}$2"

osascript -e "tell application \"$APP\" to DoScriptFile \"${D}run.jsx\"" >/dev/null 2>&1 || true

echo "--- run.log ---"
[ -f "${D}run.log" ] && tr '\r' '\n' < "${D}run.log" || echo "(no run.log — is After Effects open?)"
echo
if [ -n "$2" ] && [ -f "${D}$2" ]; then
  echo "--- $2 ---"
  tr '\r' '\n' < "${D}$2"
  echo
fi
