// [E5.1] Equivalencia en C# (SIGA.Api): SqlCommand con Parameters.Add().
// ANTES (vulnerable): concatenación — el payload ' OR '1'='1 rompe el WHERE.
//   var sql = "SELECT * FROM users WHERE name LIKE '%" + q + "%'";

// DESPUÉS (seguro): el SP encapsula la consulta y el input viaja como parámetro
// tipado con longitud fija. La cuenta SQL solo tiene permiso EXECUTE (ver sp.sql).
using System.Data;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

static readonly Regex BusquedaRegex =
    new(@"^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ @._-]{0,100}$", RegexOptions.Compiled);

public async Task<IEnumerable<Usuario>> BuscarUsuariosAsync(string q)
{
    // [E5.1: validación de formato en servidor] capa adicional de defensa.
    if (q is null || q.Length > 100 || !BusquedaRegex.IsMatch(q))
        throw new ArgumentException("Búsqueda inválida.");

    using var conn = new SqlConnection(_connectionString);
    // [E5.1: después] Stored Procedure + Parameters.Add(): sin concatenación.
    using var cmd = new SqlCommand("dbo.BuscarUsuarios", conn)
    {
        CommandType = CommandType.StoredProcedure
    };
    cmd.Parameters.Add("@q", SqlDbType.NVarChar, 100).Value = (object)q ?? DBNull.Value;

    await conn.OpenAsync();
    using var reader = await cmd.ExecuteReaderAsync();
    var lista = new List<Usuario>();
    while (await reader.ReadAsync())
    {
        lista.Add(new Usuario(
            reader.GetInt32(0), reader.GetString(1),
            reader.GetString(2), reader.GetString(3)));
    }
    return lista;
}
