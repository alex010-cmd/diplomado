#!/usr/bin/env bash
# SAST con Semgrep. Prefiere semgrep instalado localmente; si no, usa Docker.
# Genera semgrep.json (una sola salida) y deriva semgrep.txt con Node.
# Por defecto usa solo las reglas propias (rapido y determinista).
# Para anadir el ruleset del registro: SEMGREP_EXTRA_CONFIG=auto npm run sast
set -euo pipefail
cd "$(dirname "$0")/.."

OUT_DIR="semgrep-results"
mkdir -p "$OUT_DIR"

EXTRA_ARGS=()
if [ -n "${SEMGREP_EXTRA_CONFIG:-}" ]; then
  EXTRA_ARGS=(--config "$SEMGREP_EXTRA_CONFIG")
fi

if command -v semgrep >/dev/null 2>&1; then
  semgrep scan --config tools/semgrep.yaml "${EXTRA_ARGS[@]}" \
    --json --output "$OUT_DIR/semgrep.json" \
    backend/src backend/public || true
elif command -v docker >/dev/null 2>&1; then
  if [ "${#EXTRA_ARGS[@]}" -gt 0 ]; then
    echo "AVISO: SEMGREP_EXTRA_CONFIG se ignora en modo Docker (solo reglas propias)." >&2
  fi
  docker run --rm -v "$PWD:/src:z" -w /src returntocorp/semgrep \
    semgrep scan --config tools/semgrep.yaml \
    --json --output "$OUT_DIR"/semgrep.json \
    backend/src backend/public || true
else
  echo "ERROR: instala semgrep (pip install semgrep) o Docker." >&2
  exit 1
fi

node tools/sast-report.js "$OUT_DIR"
