#!/bin/bash
# ============================================================
# sheet.sh <PREFIX> <cols> <frame> <frame> ...
#
# Stitches frames rendered by shoot.jsx into one contact sheet so you can read
# a whole move in a single look instead of opening six files.
#
#   ./sheet.sh PROJ_S1 2 0 12 24 40 60
#   -> ../frames/PROJ_S1_sheet.png
#
# Needs ffmpeg. (ImageMagick's `montage` also works but errors on some macOS
# installs when it cannot find a default font.)
# ============================================================
set -e
cd "$(dirname "$0")/../frames"

PREFIX="$1"; COLS="$2"; shift 2
FRAMES=("$@")
N=${#FRAMES[@]}
if [ "$N" -eq 0 ]; then echo "usage: ./sheet.sh <PREFIX> <cols> <frames...>" >&2; exit 1; fi
ROWS=$(( (N + COLS - 1) / COLS ))

ARGS=(); FC=""; i=0
for fr in "${FRAMES[@]}"; do
  f="${PREFIX}_f${fr}.png"
  [ -f "$f" ] || { echo "missing $f — run shoot.jsx first" >&2; exit 1; }
  ARGS+=(-i "$f")
  FC+="[${i}:v]scale=640:360,drawbox=x=0:y=0:w=iw:h=ih:color=#444444:t=2[v${i}];"
  i=$((i+1))
done
# pad the final row so vstack sees equal-width rows
while [ $((i % COLS)) -ne 0 ]; do
  FC+="color=c=#111111:s=640x360:d=1[v${i}];"
  i=$((i+1))
done

r=0; ROWLBL=""
while [ $r -lt $ROWS ]; do
  ROW=""; c=0
  while [ $c -lt $COLS ]; do ROW+="[v$((r*COLS+c))]"; c=$((c+1)); done
  if [ "$COLS" -eq 1 ]; then FC+="${ROW}null[r${r}];"
  else FC+="${ROW}hstack=inputs=${COLS}[r${r}];"; fi
  ROWLBL+="[r${r}]"; r=$((r+1))
done
if [ "$ROWS" -eq 1 ]; then FC+="${ROWLBL}null[out]"
else FC+="${ROWLBL}vstack=inputs=${ROWS}[out]"; fi

ffmpeg -y -loglevel error "${ARGS[@]}" -filter_complex "$FC" -map "[out]" -frames:v 1 "${PREFIX}_sheet.png"
echo "wrote frames/${PREFIX}_sheet.png  (${N} frames, ${COLS}x${ROWS})"
