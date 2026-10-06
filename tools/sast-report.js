'use strict';

// Convierte semgrep.json en un resumen legible (semgrep.txt).
// Uso: node tools/sast-report.js [directorio-salida]
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2] || 'semgrep-results';
const jsonPath = path.join(outDir, 'semgrep.json');
const txtPath = path.join(outDir, 'semgrep.txt');

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const results = data.results || [];
const errors = data.errors || [];

const bySeverity = {};
for (const r of results) {
  const sev = (r.extra && r.extra.severity) || 'UNKNOWN';
  bySeverity[sev] = (bySeverity[sev] || 0) + 1;
}

const lines = [];
lines.push('Semgrep SAST - resumen');
lines.push(`Hallazgos: ${results.length} | Errores de escaneo: ${errors.length}`);
for (const [sev, n] of Object.entries(bySeverity)) {
  lines.push(`  ${sev}: ${n}`);
}
lines.push('');
for (const r of results) {
  lines.push(`[${(r.extra || {}).severity}] ${r.check_id}`);
  lines.push(`  ${r.path}:${r.start && r.start.line}`);
  lines.push(`  ${(r.extra || {}).message}`);
  lines.push('');
}
for (const e of errors) {
  lines.push(`[SCAN-ERROR] ${JSON.stringify(e)}`);
}

fs.writeFileSync(txtPath, lines.join('\n'));
console.log(`Hallazgos: ${results.length} ${JSON.stringify(bySeverity)}`);
console.log(`Reporte en ${txtPath} y ${jsonPath}`);
