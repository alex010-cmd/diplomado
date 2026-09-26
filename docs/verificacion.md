# Verificación: SAST, DAST y plantilla de reporte

## 1. Cómo ejecutar

```bash
npm run sast   # Semgrep (SAST): reglas propias (tools/semgrep.yaml)
npm run zap    # OWASP ZAP baseline (DAST): requiere Docker y la app corriendo
npm run smoke  # Smoke tests de seguridad (node:test)
```

> **Requisito de SAST:** Semgrep solo analiza ficheros seguidos por git
> (`git ls-files`). Antes del primer scan hay que inicializar el repo:
> `git init -b main && git add -A` (sin commitear es suficiente).

- SAST genera `semgrep-results/semgrep.txt` y `semgrep.json`.
- DAST genera `zap-results/zap-report.{html,json,md}` (requiere `npm start` en
  otra terminal; variable `ZAP_TARGET` para cambiar el objetivo).

## 2. Qué cubre cada herramienta

| Herramienta | Cubre | Reglas / alcance |
|---|---|---|
| Semgrep (custom) | SQL por concatenación, secretos en logs, `localStorage`, handlers inline, `innerHTML` sin escapar, MD5/SHA1 | `tools/semgrep.yaml` |
| Semgrep (auto, opt-in) | OWASP Top 10, secretos hardcodeados, XSS, etc. | `SEMGREP_EXTRA_CONFIG=auto npm run sast` (requiere semgrep local) |
| ZAP baseline | Cabeceras (CSP, HSTS, X-Content-Type-Options), cookies (Secure/HttpOnly), métodos, versiones | scan pasivo + spider |
| Smoke tests | Login, genéricos anti-enumeración, IDOR→403, validación, rate limit | `backend/test/smoke.test.js` |

## 3. Plantilla de reporte antes/después

Copiar esta tabla al informe y rellenarla tras cada ejecución.

### 3.1 SAST (Semgrep) — antes de correcciones (resultado real)

Primera ejecución completa: **38 ficheros, 23 hallazgos (22 WARNING + 1 ERROR)**.

| ID | Sev. | Ubicación | Hallazgo | Triage |
|---|---|---|---|---|
| `tools.no-innerhtml-unescaped` | WARNING | `backend/public/js/admin.js` (11: líneas 5, 35, 89, 92, 141, 231, 234, 255, 264, 267, 287) | `innerHTML` con datos | Revisado: todo valor dinámico interpolado pasa por `escapeHtml()` (`public/js/api.js`); el resto es HTML estático. Riesgo aceptado y documentado. La regla queda como guardián ante futuro código sin escapar. |
| `tools.no-innerhtml-unescaped` | WARNING | `backend/public/js/estudiante.js` (4: líneas 5, 17, 20, 37) | `innerHTML` con datos | Idem: dinámicos escapados, resto estático. Riesgo aceptado y documentado. |
| `tools.no-innerhtml-unescaped` | WARNING | `backend/public/js/profesor.js` (7: líneas 5, 17, 20, 42, 54, 58, 84) | `innerHTML` con datos | Idem. Riesgo aceptado y documentado. |
| `tools.no-sql-concatenation` | ERROR | `backend/src/services/audit.service.js:68` y `:72` | Interpolación `${whereSql}` en SQL | **Falso positivo con corrección**: `whereSql` solo se compone de fragmentos estáticos (`'user_id = @user_id'`, `'action = @action'`); los valores van siempre en parámetros nombrados. Se refactorizó `listAudit` para componer en un único punto documentado con comentario de justificación. |

### 3.2 SAST (Semgrep) — después de correcciones (resultado real)

Re-ejecución tras la refactorización: **38 ficheros, 22 hallazgos (0 ERROR)**.

| ID | Severidad | Acción tomada | Verificación |
|---|---|---|---|
| `tools.no-sql-concatenation` | ERROR → 0 | Refactor de `listAudit` a un único punto de composición documentado | `npm run sast`: sin hallazgos ERROR |
| `tools.no-innerhtml-unescaped` | 22 WARNING restantes | Revisión manual una por una; justificación registrada arriba | Riesgo aceptado y documentado; la regla sigue activa como control preventivo |

### 3.3 DAST (OWASP ZAP) — antes de correcciones

| Alerta | Riesgo | URL | Hallazgo | Estado |
|---|---|---|---|---|
| _ej._ `Content Security Policy (CSP) Header Not Set` | Medio | `http://localhost:3000/` | — | Corregido: helmet con CSP estricta (`middleware/security.js`) |
| _ej._ `Cookie No HttpOnly Flag` | Bajo | `http://localhost:3000/` | — | Corregido: cookies `httpOnly` (`utils/http.js`) |
| _(pegar alertas reales del `zap-report.md`)_ | | | | |

### 3.4 DAST (OWASP ZAP) — después de correcciones

| Alerta | Riesgo residual | Acción tomada | Verificación |
|---|---|---|---|
| | | | Re-ejecutar `npm run zap`; adjuntar nuevo `zap-report.md` |

### 3.5 Resultado esperado tras aplicar las contramedidas

- SAST: **0 hallazgos ERROR**; los WARNING restantes justificados (ver 3.2).
- DAST: sin alertas **Altas**; las **Medias/Bajas** restantes deben
  justificarse (p. ej. HSTS solo aplica con HTTPS en producción) o corregirse.
- `npm run smoke` en verde (12 tests en 4 suites de seguridad).
