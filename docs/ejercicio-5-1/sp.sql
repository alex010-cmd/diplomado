-- ============================================================================
-- [E5.1] Stored Procedure en SQL Server: encapsula la búsqueda con parámetros
-- y permisos mínimos (principio de mínimo privilegio).
-- Equivale en SQL Server a lo que `despues-seguro.js` hace con better-sqlite3:
-- el input viaja como parámetro tipado, nunca como sintaxis SQL.
-- ============================================================================

-- 1) La cuenta de la aplicación NO es db_owner: solo CONNECT + EXECUTE.
--    (Crear el login con una contraseña segura real.)
-- CREATE LOGIN siga_app WITH PASSWORD = '<contraseña-segura>';
-- USE SigaDB;
-- CREATE USER siga_app FOR LOGIN siga_app;

-- 2) SP con validación de formato en el servidor (longitud + allowlist),
--    igual que `searchQuery` (zod) y `validarBusqueda()` en la versión Node.
CREATE OR ALTER PROCEDURE dbo.BuscarUsuarios
  @q NVARCHAR(100) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  -- [E5.1: validación de formato] Rechaza `'` y cualquier símbolo fuera de la lista.
  IF @q IS NOT NULL AND (
       LEN(@q) > 100
       OR @q LIKE '%[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ @._-]%' ESCAPE '\'
     )
  BEGIN
    RAISERROR('Búsqueda inválida: caracteres no permitidos.', 16, 1);
    RETURN;
  END

  -- [E5.1: después] Parámetro enlazado; proyección mínima (sin password_hash).
  SELECT id, name AS nombre, email AS correo, role AS rol
  FROM dbo.users
  WHERE (@q IS NULL OR name LIKE '%' + @q + '%' OR email LIKE '%' + @q + '%');
END;
GO

-- 3) Permiso mínimo: solo EXECUTE sobre el SP, SIN SELECT directo a las tablas.
--    Aunque un atacante lograra inyectar algo, no puede leer las tablas por su cuenta.
GRANT EXECUTE ON dbo.BuscarUsuarios TO siga_app;
DENY SELECT ON dbo.users TO siga_app;
GO

-- Pruebas (capturas para el entregable):
--   EXEC dbo.BuscarUsuarios @q = N'Ana';          -- 1 fila (legítima)
--   EXEC dbo.BuscarUsuarios @q = N''' OR ''1''=''1'; -- RAISERROR 50000 (bloqueada)
