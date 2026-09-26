#!/usr/bin/env bash
# [E5.2: verificación DAST] OWASP ZAP baseline via Docker.
# Requiere: Docker + la app corriendo (npm start en otra terminal).
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${ZAP_TARGET:-http://localhost:3000}"
OUT_DIR="zap-results"
mkdir -p "$OUT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: instala Docker para ejecutar OWASP ZAP." >&2
  exit 1
fi

if ! curl -sf "$TARGET/api/health" >/dev/null; then
  echo "ERROR: la app no responde en $TARGET (ejecuta 'npm start' primero)." >&2
  exit 1
fi

# Baseline scan (no agresivo, apto para CI y demos).
docker run --rm --network host \
  -v "$PWD/$OUT_DIR:/zap/wrk:z" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t "$TARGET" \
  -g gen.conf \
  -r zap-report.html \
  -J zap-report.json \
  -w zap-report.md \
  -I || true

echo "Reportes DAST en $OUT_DIR/ (html, json, md)"
