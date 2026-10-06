# Ejercicio 5.1 — Migrar búsqueda insegura a consultas seguras

Carpeta de evidencia del entregable (código antes/después + SP + pruebas).

## Archivos

| Archivo | Qué es |
|---|---|
| `antes-inseguro.js` | [E5.1: ANTES] Búsqueda con **concatenación** (`"..." + q + "..."`). Archivo educativo: **no** lo usa la app. |
| `despues-seguro.js` | [E5.1: DESPUÉS] Prepared statement + validación de formato. Espejo de `backend/src/services/user.service.js :: listUsers`. |
| `probar-inyeccion.js` | PoC ejecutable + demo en vivo: `node docs/ejercicio-5-1/probar-inyeccion.js` |
| `sp.sql` | Stored Procedure en **SQL Server** + `GRANT EXECUTE` / `DENY SELECT` (mínimo privilegio). |
| `ejemplo-csharp.cs` | Equivalencia con `SqlCommand` + `Parameters.Add()` para SIGA.Api. |

## Prueba 1 — Versión vulnerable (payload clásico)

```
Payload probado: ' OR '1'='1

[ANTES ❌] filas devueltas: 3
         - Ana Torres <ana@universidad.edu>
         - Luis Perez <luis@universidad.edu>
         - Admin General <admin@universidad.edu>
         => VULNERABLE: el OR 1=1 expuso registros ajenos a la búsqueda.
```

La concatenación deja que el input reescriba el `WHERE`: `LIKE '%%' OR '1'='1'` es
siempre verdadero → fuga de todos los usuarios (CWE-89).

## Prueba 2 — Versión refactorizada (mismo payload)

```
[DESPUÉS ✅] bloqueado por validación de formato: "Búsqueda inválida: caracteres no permitidos."
[DESPUÉS ✅] búsqueda legítima "Ana": 1 fila(s) -> Ana Torres <ana@universidad.edu>
```

Doble barrera (defensa en profundidad):
1. **Validación de formato**: `'` no está en la allowlist → 400 sin tocar la BD.
2. **Prepared statement**: aunque pasara, `@like` viaja como dato → 0 filas.

## Prueba 3 — Stored Procedure (SQL Server, `sp.sql`)

```sql
EXEC dbo.BuscarUsuarios @q = N'Ana';              -- 1 fila (legítima)
EXEC dbo.BuscarUsuarios @q = N''' OR ''1''=''1';  -- RAISERROR 50000 (bloqueada)
```

La cuenta `siga_app` solo tiene `EXECUTE` sobre el SP y `DENY SELECT` sobre las
tablas: sin lectura directa aunque hubiera inyección.

## Dónde vive esto en la app real

- Búsqueda segura: `backend/src/services/user.service.js :: listUsers` (prepared
  + `LIKE @like`), validada por `backend/src/schemas.js :: searchQuery` (zod) y
  limitada a 30/min (`middleware/security.js :: searchLimiter`).
- Regla SAST que prohíbe regresar a la concatenación:
  `tools/semgrep.yaml :: no-sql-concatenation`.
