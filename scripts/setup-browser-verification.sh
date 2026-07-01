#!/usr/bin/env bash
# One-time (per machine) setup for scripted Playwright browser verification.
# See docs/ARCHITECTURE.md's "Scripted Browser Verification" section for when
# to reach for this vs. clicking through the app by hand.
#
# Usage:
#   source <(scripts/setup-browser-verification.sh)
#   npx playwright install chromium   # if not already cached
#
# `source` is required (not just execute) — this script's only job is to
# print an `export LD_LIBRARY_PATH=...` line when needed, and `source`ing it
# applies that export to your current shell.
set -euo pipefail

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.playwright-libs"

# Some minimal container base images lack libasound.so.2, which Chromium's
# headless binary dynamically links even for headless-only, audio-free runs.
# Without it, `chromium.launch()` fails with "error while loading shared
# libraries: libasound.so.2: cannot open shared object file".
NEED_LIB=0
if ! ldconfig -p 2>/dev/null | grep -q libasound.so.2; then
  NEED_LIB=1
fi

if [ "$NEED_LIB" = "1" ] && [ ! -f "$LIB_DIR/libasound.so.2" ]; then
  echo "# libasound.so.2 not found on this system — downloading locally (no root needed)..." >&2
  TMP_DIR="$(mktemp -d)"
  ( cd "$TMP_DIR" && apt-get download libasound2 libasound2t64 || apt-get download libasound2 ) >&2
  mkdir -p "$LIB_DIR"
  for deb in "$TMP_DIR"/*.deb; do
    dpkg-deb -x "$deb" "$TMP_DIR/extracted"
  done
  find "$TMP_DIR/extracted" -iname "libasound.so*" -exec cp -P {} "$LIB_DIR/" \;
  rm -rf "$TMP_DIR"
  echo "# Extracted libasound to $LIB_DIR" >&2
fi

if [ -f "$LIB_DIR/libasound.so.2" ]; then
  echo "export LD_LIBRARY_PATH=\"$LIB_DIR:\${LD_LIBRARY_PATH:-}\""
else
  echo "# libasound.so.2 already available system-wide — nothing to export" >&2
fi
