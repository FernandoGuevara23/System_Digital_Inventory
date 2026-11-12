using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;
namespace TRG2._0_VNET.Services;

public sealed class EquiposLiberadosService(InventarioDbContext db, ILogger<EquiposLiberadosService> logger)
{
    private static readonly string[] PhoneTypes = ["telefono", "telefonos", "teléfono", "teléfonos", "celular", "smartphone", "iphone"];
    private static readonly string[] ExcludedStates = ["inactivo", "scrap", "donacion", "donación", "liberado", "reciclado", "donado"];
    private static readonly string[] SnapshotFields = ["Marca", "Modelo", "Tipo_Equipo", "Numero_Telefono", "Account", "Apple_ID", "Password_apple", "Total_cuenta", "Estado_Telefono", "MQ_Asset", "IMEI", "Location"];
    public static Dictionary<string, object?> Dto(Equipos_liberado row) => typeof(Equipos_liberado).GetProperties().ToDictionary(p => p.Name, p => p.GetValue(row));
    public async Task<object[]> List(string? tag = null)
    {
        var query = db.Equipos_liberados.AsNoTracking();
        if (tag != null) query = query.Where(e => e.Service_Tag == tag);
        return (await query.OrderByDescending(e => e.Fecha).ToListAsync()).Select(e => (object)Dto(e)).ToArray();
    }
    private Task<List<Equipos_liberado>> Phones() => db.Equipos_liberados.AsNoTracking().Where(e => e.Tipo_Equipo != null && PhoneTypes.Contains(e.Tipo_Equipo.Trim().ToLower())).OrderByDescending(e => e.Fecha_Liberacion).ThenByDescending(e => e.Fecha).ToListAsync();
    public async Task<object[]> PhoneDtos() => (await Phones()).Select(e => (object)Dto(e)).ToArray();
    public async Task<object[]> Catalog()
    {
        var result = new List<object>();
        var current = await db.Equipos.AsNoTracking().Include(e => e.PayrollNavigation).Where(e => PhoneTypes.Contains(e.Tipo_Equipo.Trim().ToLower()) && !ExcludedStates.Contains(e.Estado.Trim().ToLower())).OrderBy(e => e.Service_Tag).ToListAsync();
        var tags = current.Select(e => e.Service_Tag).ToArray();
        var phones = await db.Telefonos.AsNoTracking().Where(p => tags.Contains(p.Service_Tag)).ToDictionaryAsync(p => p.Service_Tag);
        foreach (var e in current)
        {
            phones.TryGetValue(e.Service_Tag, out var phone);
            var dto = new Dictionary<string, object?> { ["id"] = "actual-" + e.Service_Tag, ["Origen"] = "Actual", ["Service_Tag"] = e.Service_Tag, ["Hostname"] = e.Hostname, ["Accion"] = null, ["Detalle"] = e.Comments, ["Payroll_Anterior"] = e.Payroll, ["Nombre_Empleado_Anterior"] = e.PayrollNavigation?.Full_Name, ["Tipo_Liberacion"] = null, ["Fecha"] = e.Fecha_Creacion, ["Fecha_Liberacion"] = null, ["Estado_Equipo"] = e.Estado, ["Estado_Telefono"] = phone?.Estado };
            foreach (var key in new[] { "Marca", "Modelo", "Tipo_Equipo", "MQ_Asset", "IMEI", "Location" }) dto[key] = typeof(Equipo).GetProperty(key)!.GetValue(e);
            foreach (var key in new[] { "Numero_Telefono", "Account", "Apple_ID", "Password_apple", "Total_cuenta" }) dto[key] = phone == null ? null : typeof(Telefono).GetProperty(key)!.GetValue(phone);
            result.Add(dto);
        }
        foreach (var entry in await Phones())
        {
            if (entry.Tipo_Liberacion.Trim().ToLowerInvariant() == "donacion") continue;
            var dto = Dto(entry); dto["Origen"] = "Histórico"; dto["Estado_Equipo"] = "Liberado"; result.Add(dto);
        }

        var scraps = await db.Scraps.AsNoTracking().Where(s => s.Accion == "ENVIO_A_SCRAP").OrderByDescending(s => s.Fecha).ToListAsync();
        foreach (var s in scraps) AddDisposition(result, "Scrap", s.id, s.Service_Tag, s.Hostname, s.Accion, s.Detalle, s.Payroll_Anterior, s.Nombre_Empleado_Anterior, s.Fecha, s.Fecha_Liberacion, s.Datos_Equipo);
        var donations = await db.Donaciones.AsNoTracking().Where(s => s.Accion == "ENVIO_A_DONACION").OrderByDescending(s => s.Fecha).ToListAsync();
        foreach (var s in donations) AddDisposition(result, "Donación", s.id, s.Service_Tag, s.Hostname, s.Accion, s.Detalle, s.Payroll_Anterior, s.Nombre_Empleado_Anterior, s.Fecha, s.Fecha_Liberacion, s.Datos_Equipo);
        return result.ToArray();
    }
    private void AddDisposition(List<object> result, string origin, int id, string tag, string? host, string action, string detail, int? payroll, string? name, DateTime date, DateTime? released, string? json)
    {
        JsonObject? snapshot;
        try { snapshot = JsonNode.Parse(string.IsNullOrEmpty(json) ? "{}" : json) as JsonObject; }
        catch (JsonException) { logger.LogWarning("Snapshot inválido de teléfono {Tag} en {Origin} #{Id}", tag, origin, id); return; }
        if (snapshot == null) { logger.LogWarning("Snapshot de teléfono no es objeto: {Tag} en {Origin} #{Id}", tag, origin, id); return; }
        if (!PhoneTypes.Contains(snapshot["Tipo_Equipo"]?.ToString().Trim().ToLowerInvariant())) return;
        var dto = new Dictionary<string, object?> { ["id"] = origin.ToLowerInvariant() + "-" + id, ["Origen"] = origin, ["Service_Tag"] = tag, ["Hostname"] = host, ["Accion"] = action, ["Detalle"] = detail, ["Payroll_Anterior"] = payroll, ["Nombre_Empleado_Anterior"] = name, ["Tipo_Liberacion"] = origin.ToUpperInvariant(), ["Fecha"] = date, ["Fecha_Liberacion"] = released, ["Estado_Equipo"] = origin };
        foreach (var key in SnapshotFields) dto[key] = snapshot[key];
        result.Add(dto);
    }
    public async Task<bool> Delete(int id)
    {
        var row = await db.Equipos_liberados.FindAsync(id);
        if (row == null) return false;
        db.Equipos_liberados.Remove(row); await db.SaveChangesAsync(); return true;
    }
}
