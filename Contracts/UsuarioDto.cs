using System.Text.Json.Serialization;
using TRG2._0_VNET.Models;

namespace TRG2._0_VNET.Contracts;

public sealed record UsuarioDto(
    [property: JsonPropertyName("Id")] int Id,
    [property: JsonPropertyName("UserName")] string UserName,
    [property: JsonPropertyName("Nombre_Completo")] string? NombreCompleto,
    [property: JsonPropertyName("Fecha_Creacion")] DateTime FechaCreacion,
    [property: JsonPropertyName("Fecha_Actualizacion")] DateTime FechaActualizacion)
{
    public static UsuarioDto From(Administrador u) => new(u.Id, u.UserName, u.Nombre_Completo,
        u.Fecha_Creacion, u.Fecha_Actualizacion);
}
