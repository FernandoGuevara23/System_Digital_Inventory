using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;
namespace TRG2._0_VNET.Services;

public sealed class DonacionException(string message) : Exception(message);

public sealed class DonacionService(InventarioDbContext db, EquiposService equipos)
{
    private static readonly string[] Outside = ["inactivo", "scrap", "donacion", "donación", "donado", "reciclado", "produccion", "producción", "venta", "ventas"];
    public static string Text(JsonNode? value) => value?.ToString().Trim() ?? "";
    public static string[] Tags(JsonObject payload)
    {
        var node = payload["Service_Tags"];
        if (node == null && payload["Service_Tag"] != null) node = new JsonArray(payload["Service_Tag"]!.DeepClone());
        if (node is not JsonArray list || list.Count == 0) throw new DonacionException("Selecciona al menos un equipo");
        var tags = list.Select(v => v == null ? "None" : Text(v)).ToArray();
        if (tags.Any(string.IsNullOrEmpty)) throw new DonacionException("Los Service Tags no pueden estar vacíos");
        if (tags.Distinct().Count() != tags.Length) throw new DonacionException("La selección contiene Service Tags duplicados");
        return tags;
    }
    private async Task<Donacione?> Pending(string tag)
    {
        var last = await db.Donaciones.AsNoTracking().Where(s => s.Service_Tag == tag && (s.Accion == "ENVIO_A_DONACION" || s.Accion == "ENVIADO_A_DONACION")).OrderByDescending(s => s.Fecha).ThenByDescending(s => s.id).FirstOrDefaultAsync();
        return last is { Accion: "ENVIO_A_DONACION", Fecha_Liberacion: null } ? last : null;
    }
    private async Task CheckScrap(string tag)
    {
        var last = await db.Scraps.AsNoTracking().Where(s => s.Service_Tag == tag && (s.Accion == "ENVIO_A_SCRAP" || s.Accion == "ENVIADO_A_RECICLADORA")).OrderByDescending(s => s.Fecha).ThenByDescending(s => s.id).FirstOrDefaultAsync();
        if (last is { Accion: "ENVIO_A_SCRAP", Fecha_Liberacion: null }) throw new DonacionException($"El equipo {tag} tiene un proceso de Scrap pendiente");
    }
    public static Dictionary<string, object?> Dto(object row) => row.GetType().GetProperties().Where(p => p.Name != "Datos_Equipo").ToDictionary(p => p.Name, p => p.GetValue(row));
    private async Task<JsonObject> History(Equipo e)
    {
        var data = new JsonObject();
        foreach (var key in new[] { "Marca", "Modelo", "Tipo_Equipo", "IMEI", "MQ_Asset", "Location", "Comments", "Accesorios", "Payroll", "Hostname", "MAC" }) data[key] = JsonSerializer.SerializeToNode(typeof(Equipo).GetProperty(key)!.GetValue(e));
        var phone = await db.Telefonos.FindAsync(e.Service_Tag);
        foreach (var key in new[] { "Numero_Telefono", "Account", "Apple_ID", "Total_cuenta" }) data[key] = phone == null ? null : JsonSerializer.SerializeToNode(typeof(Telefono).GetProperty(key)!.GetValue(phone));
        data["Estado_Telefono"] = phone?.Estado;
        return data;
    }
    private async Task<JsonObject> Snapshot(Donacione entry, Equipo? e)
    {
        JsonObject? data;
        try { data = JsonNode.Parse(entry.Datos_Equipo ?? "{}") as JsonObject; } catch (JsonException) { data = null; }
        return data is { Count: > 0 } ? data : e != null ? await History(e) : new JsonObject();
    }
    public async Task<object[]> Available() => await equipos.Dtos(await equipos.Query.Where(e => !Outside.Contains(e.Estado.Trim().ToLower())).OrderBy(e => e.Service_Tag).ToListAsync());
    public async Task<List<Donacione>> PendingEntries()
    {
        var entries = await db.Donaciones.AsNoTracking().Where(s => s.Accion == "ENVIO_A_DONACION" || s.Accion == "ENVIADO_A_DONACION").OrderByDescending(s => s.Fecha).ThenByDescending(s => s.id).ToListAsync();
        return entries.GroupBy(s => s.Service_Tag).Select(g => g.First()).Where(s => s.Accion == "ENVIO_A_DONACION" && s.Fecha_Liberacion == null).ToList();
    }
    public async Task<object[]> PendingDtos()
    {
        var result = new List<object>();
        foreach (var entry in await PendingEntries())
        {
            var e = await db.Equipos.FindAsync(entry.Service_Tag); var snapshot = await Snapshot(entry, e);
            var dto = new Dictionary<string, object?> { ["Service_Tag"] = entry.Service_Tag, ["Hostname"] = e != null ? e.Hostname : snapshot["Hostname"], ["Estado"] = "Fuera del inventario", ["Payroll_Anterior"] = entry.Payroll_Anterior, ["Nombre_Empleado_Anterior"] = entry.Nombre_Empleado_Anterior, ["Trace"] = Text(snapshot["Trace"]) is { Length: > 0 } trace ? trace : entry.Detalle };
            foreach (var key in new[] { "MAC", "Marca", "Modelo", "Tipo_Equipo", "IMEI" }) dto[key] = snapshot[key];
            result.Add(dto);
        }
        return result.ToArray();
    }
    public async Task<object[]> HistoryDtos()
    {
        var rows = await db.Donaciones.AsNoTracking().Where(s => s.Accion == "ENVIADO_A_DONACION" && s.Fecha_Liberacion != null).OrderByDescending(s => s.Fecha_Liberacion).ToListAsync();
        return rows.GroupBy(s => (s.Fecha_Liberacion, s.Detalle)).Select(g => (object)new Dictionary<string, object?> { ["Fecha_Liberacion"] = g.Key.Fecha_Liberacion, ["Detalle"] = g.Key.Detalle, ["Total_Equipos"] = g.Count(), ["Equipos"] = g.Select(Dto).ToArray() }).ToArray();
    }
    public async Task<List<Donacione>> Send(string[] tags, string? actor)
    {
        var rows = await equipos.Query.Where(e => tags.Contains(e.Service_Tag)).ToListAsync();
        var missing = tags.Except(rows.Select(e => e.Service_Tag)).ToArray();
        if (missing.Length > 0) throw new DonacionException("No se encontraron los equipos: " + string.Join(", ", missing));
        foreach (var e in rows)
        {
            if (Outside.Contains(e.Estado.Trim().ToLowerInvariant())) throw new DonacionException($"El equipo {e.Service_Tag} ya está inactivo o en disposición final");
            if ((await db.Telefonos.FindAsync(e.Service_Tag))?.Estado.Trim().ToLowerInvariant() == "activa") throw new DonacionException($"No se puede enviar el equipo {e.Service_Tag} a Donación: tiene una línea telefónica Activa. Suspende la línea antes de continuar.");
            if (await Pending(e.Service_Tag) != null) throw new DonacionException($"El equipo {e.Service_Tag} ya tiene un proceso de Donación pendiente");
            await CheckScrap(e.Service_Tag);
        }
        var result = new List<Donacione>();
        foreach (var e in rows)
        {
            foreach (var card in await db.cartas_responsivas.Where(c => c.service_tag == e.Service_Tag && CartasService.Active.Contains(c.estado)).ToListAsync())
            {
                card.estado = "CERRADA";
                var host = string.IsNullOrEmpty(e.Hostname) ? card.hostname : e.Hostname;
                var detail = $"Administrador:{actor ?? "Sistema"} Cerró Carta {(card.tipo_carta == "COMPARTIDA" ? "Compartida" : "Individual")} - Service tag: {e.Service_Tag} - Hostname: {host ?? "Sin hostname"}";
                if (e.Payroll != null) detail += $" - Payroll anterior: {e.Payroll}";
                detail += " - Motivo: Equipo enviado a Donación";
                db.Movimientos_Equipos.Add(new Movimientos_Equipo { Service_Tag = e.Service_Tag, Hostname = host, Accion = "CARTA_CERRADA", Detalle = detail, Payroll_Anterior = e.Payroll, Usuario = actor, Fecha = DateTime.UtcNow });
            }
            var snapshot = await History(e);
            snapshot["Trace"] = $"{DateTime.UtcNow:dd-MM-yyyy} - Donacion:{e.Service_Tag}";
            var entry = new Donacione { Service_Tag = e.Service_Tag, Hostname = e.Hostname, Datos_Equipo = snapshot.ToJsonString(), Accion = "ENVIO_A_DONACION", Detalle = "Pendiente de liberación", Payroll_Anterior = e.Payroll, Nombre_Empleado_Anterior = e.PayrollNavigation?.Full_Name, Usuario = actor, Fecha = DateTime.UtcNow };
            db.Donaciones.Add(entry); result.Add(entry);
            equipos.Movement(e, "ENVIO_A_DONACION", $"Envio a Donación |Hostname: {e.Hostname ?? "None"} | Empleado anterior: {e.PayrollNavigation?.Full_Name ?? "Sin asignar"} | Payroll anterior: {e.Payroll?.ToString() ?? "Sin payroll"}", e.Payroll, null, actor);
            db.Equipos.Remove(e);
        }
        await db.SaveChangesAsync();
        return result;
    }
    public async Task<List<Equipos_liberado>> Release(string[]? tags, string detail, string? actor)
    {
        if (string.IsNullOrWhiteSpace(detail)) throw new DonacionException("Indica el motivo de la liberación");
        if (detail.Length > 1000) throw new DonacionException("El motivo no puede exceder 1000 caracteres");
        tags ??= (await PendingEntries()).Select(s => s.Service_Tag).ToArray();
        var result = new List<Equipos_liberado>(); var now = DateTime.UtcNow;
        await using var transaction = await db.Database.BeginTransactionAsync();
        foreach (var tag in tags)
        {
            var e = await db.Equipos.FindAsync(tag);
            var entry = await Pending(tag) ?? throw new DonacionException($"El equipo {tag} no tiene un proceso de Donación pendiente");
            await CheckScrap(tag);

            var claimed = await db.Donaciones.Where(s => s.id == entry.id && s.Fecha_Liberacion == null).ExecuteUpdateAsync(setters => setters.SetProperty(s => s.Fecha_Liberacion, now));
            if (claimed != 1) throw new DonacionException($"El equipo {tag} ya fue liberado de Donación");
            var snapshot = await Snapshot(entry, e);
            if (snapshot.Count == 0) throw new DonacionException($"No hay datos históricos suficientes para cerrar la Donación del equipo {tag}");
            string? V(string key) => snapshot[key]?.ToString();
            var host = e != null ? e.Hostname : V("Hostname");
            var released = new Equipos_liberado { Service_Tag = tag, Hostname = host, MAC = V("MAC"), Accion = "LIBERACION", Detalle = detail, Payroll_Anterior = entry.Payroll_Anterior, Nombre_Empleado_Anterior = entry.Nombre_Empleado_Anterior, Tipo_Liberacion = "DONACION", Marca = V("Marca"), Modelo = V("Modelo"), IMEI = V("IMEI"), Tipo_Equipo = V("Tipo_Equipo"), MQ_Asset = V("MQ_Asset"), Location = V("Location"), Numero_Telefono = V("Numero_Telefono"), Account = V("Account"), Apple_ID = V("Apple_ID"), Total_cuenta = snapshot["Total_cuenta"]?.GetValue<decimal>(), Estado_Telefono = V("Estado_Telefono"), Fecha_Liberacion = now, Fecha = now };
            db.Equipos_liberados.Add(released); result.Add(released);
            db.Donaciones.Add(new Donacione { Service_Tag = tag, Hostname = host, Datos_Equipo = snapshot.ToJsonString(), Accion = "ENVIADO_A_DONACION", Detalle = detail, Payroll_Anterior = entry.Payroll_Anterior, Nombre_Empleado_Anterior = entry.Nombre_Empleado_Anterior, Usuario = actor, Fecha_Liberacion = now, Fecha = now });
            db.Movimientos_Equipos.Add(new Movimientos_Equipo { Service_Tag = tag, Hostname = host, Accion = "ENVIADO_A_DONACION", Detalle = $"Hostname: {host ?? "None"} | Motivo: {detail} | Empleado anterior: {entry.Nombre_Empleado_Anterior ?? "Sin asignar"} | Payroll anterior: {entry.Payroll_Anterior?.ToString() ?? "Sin payroll"}", Payroll_Anterior = entry.Payroll_Anterior, Usuario = actor, Fecha = now });
        }
        await db.SaveChangesAsync(); await transaction.CommitAsync();
        return result;
    }
}
