'use strict';

/**
 * [E5.1] Prueba de concepto ejecutable: mismo payload, dos resultados.
 * Uso: `node docs/ejercicio-5-1/probar-inyeccion.js`
 * También sirve como demo en vivo para la presentación oral (10 min).
 *
 * Payload clásico:  ' OR '1'='1
 * - En `antes-inseguro.js` rompe el WHERE → devuelve TODA la tabla (vulnerable).
 * - En `despues-seguro.js` se rechaza por formato (carácter `'` no permitido) y,
 *   aun sin la validación, el binding lo trataría como texto literal (0 filas).
 */

const { crearBDdemo, buscarUsuariosInseguro } = require('./antes-inseguro');
const seguro = require('./despues-seguro');

const PAYLOAD = "' OR '1'='1";

function nombres(rows) {
  return rows.map((r) => `${r.name} <${r.email}>`);
}

function main() {
  console.log(`Payload probado: ${PAYLOAD}\n`);

  // --- ANTES (vulnerable) ---
  const db1 = crearBDdemo();
  const antes = buscarUsuariosInseguro(db1, PAYLOAD);
  console.log(`[ANTES ❌] filas devueltas: ${antes.length}`);
  for (const n of nombres(antes)) console.log(`         - ${n}`);
  console.log(
    antes.length > 1
      ? '         => VULNERABLE: el OR 1=1 expuso registros ajenos a la búsqueda.\n'
      : '         => (inesperado: no hubo fuga)\n'
  );

  // --- DESPUÉS (seguro) ---
  const db2 = seguro.crearBDdemo();
  try {
    const despues = seguro.buscarUsuariosSeguro(db2, PAYLOAD);
    console.log(`[DESPUÉS ✅] filas devueltas: ${despues.length} (payload tratado como texto)`);
  } catch (err) {
    console.log(`[DESPUÉS ✅] bloqueado por validación de formato: "${err.message}"`);
  }

  // Búsqueda legítima sigue funcionando en la versión segura.
  const legit = seguro.buscarUsuariosSeguro(db2, 'Ana');
  console.log(`[DESPUÉS ✅] búsqueda legítima "Ana": ${legit.length} fila(s) -> ${nombres(legit).join(', ')}`);
}

if (require.main === module) main();
