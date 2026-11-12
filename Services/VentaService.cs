using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;
namespace TRG2._0_VNET.Services;

public sealed class VentaException(string message) : Exception(message);

public sealed class VentaService(InventarioDbContext db, EquiposService equipos)
{
    private static readonly string[] Outside = ["inactivo", "scrap", "donacion", "donación", "donado", "reciclado", "produccion", "producción", "venta", "ventas"];

    public static string Text(JsonNode? value) => value?.ToString().Trim() ?? "";

    public static string[] Tags(JsonObject payload)
    {
        var node = payload["Service_Tags"];
        if (node == null && payload["Service_Tag"] != null) node = new JsonArray(payload["Service_Tag"]!.DeepClone());
        if (node is not JsonArray list || list.Count == 0) throw new VentaException("Selecciona al menos un equipo");
        var tags = list.Select(value => value == null ? "None" : Text(value)).ToArray();
        if (tags.Any(string.IsNullOrEmpty)) throw new VentaException("Los Service Tags no pueden estar vacíos");
        if (tags.Distinct().Count() != tags.Length) throw new VentaException("La selección contiene Service Tags duplicados");
        return tags;
    }

    private async Task<Venta?> Pending(string tag)
    {
        var last = await db.Ventas.AsNoTracking()
            .Where(item => item.Service_Tag == tag && (item.Accion == "ENVIO_A_VENTA" || item.Accion == "ENVIADO_A_VENTA"))
            .OrderByDescending(item => item.Fecha).ThenByDescending(item => item.id).FirstOrDefaultAsync();
        return last is { Accion: "ENVIO_A_VENTA", Fecha_Liberacion: null } ? last : null;
    }

    private async Task CheckScrap(string tag)
    {
        var last = await db.Scraps.AsNoTracking()
            .Where(item => item.Service_Tag == tag && (item.Accion == "ENVIO_A_SCRAP" || item.Accion == "ENVIADO_A_RECICLADORA"))
            .OrderByDescending(item => item.Fecha).ThenByDescending(item => item.id).FirstOrDefaultAsync();
        if (last is { Accion: "ENVIO_A_SCRAP", Fecha_Liberacion: null })
            throw new VentaException($"El equipo {tag} tiene un proceso de Scrap pendiente");
    }

    private async Task CheckDonation(string tag)
    {
        var last = await db.Donaciones.AsNoTracking()
            .Where(item => item.Service_Tag == tag && (item.Accion == "ENVIO_A_DONACION" || item.Accion == "ENVIADO_A_DONACION"))
            .OrderByDescending(item => item.Fecha).ThenByDescending(item => item.id).FirstOrDefaultAsync();
        if (last is { Accion: "ENVIO_A_DONACION", Fecha_Liberacion: null })
            throw new VentaException($"El equipo {tag} tiene un proceso de Donación pendiente");
    }

    private async Task CheckProduction(string tag)
    {
        var last = await db.Produccions.AsNoTracking()
            .Where(item => item.Service_Tag == tag && (item.Accion == "ENVIO_A_PRODUCCION" || item.Accion == "ENVIADO_A_PRODUCCION"))
            .OrderByDescending(item => item.Fecha).ThenByDescending(item => item.id).FirstOrDefaultAsync();
        if (last is { Accion: "ENVIO_A_PRODUCCION", Fecha_Liberacion: null })
            throw new VentaException($"El equipo {tag} tiene un proceso de Producción pendiente");
    }

    public static Dictionary<string, object?> Dto(object row) => row.GetType().GetProperties()
        .Where(property => property.Name != "Datos_Equipo")
        .ToDictionary(property => property.Name, property => property.GetValue(row));

    private async Task<JsonObject> History(Equipo equipo)
    {
        var data = new JsonObject();
        foreach (var key in new[] { "Marca", "Modelo", "Tipo_Equipo", "IMEI", "MQ_Asset", "Location", "Comments", "Accesorios", "Payroll", "Hostname", "MAC" })
            data[key] = JsonSerializer.SerializeToNode(typeof(Equipo).GetProperty(key)!.GetValue(equipo));
        var phone = await db.Telefonos.FindAsync(equipo.Service_Tag);
        foreach (var key in new[] { "Numero_Telefono", "Account", "Apple_ID", "Total_cuenta" })
            data[key] = phone == null ? null : JsonSerializer.SerializeToNode(typeof(Telefono).GetProperty(key)!.GetValue(phone));
        data["Estado_Telefono"] = phone?.Estado;
        return data;
    }

    private async Task<JsonObject> Snapshot(Venta entry, Equipo? equipo)
    {
        JsonObject? data;
        try { data = JsonNode.Parse(entry.Datos_Equipo ?? "{}") as JsonObject; }
        catch (JsonException) { data = null; }
        return data is { Count: > 0 } ? data : equipo != null ? await History(equipo) : new JsonObject();
    }

    public async Task<object[]> Available() => await equipos.Dtos(await equipos.Query
        .Where(equipo => !Outside.Contains(equipo.Estado.Trim().ToLower()))
        .OrderBy(equipo => equipo.Service_Tag).ToListAsync());

    public async Task<List<Venta>> PendingEntries()
    {
        var entries = await db.Ventas.AsNoTracking()
            .Where(item => item.Accion == "ENVIO_A_VENTA" || item.Accion == "ENVIADO_A_VENTA")
            .OrderByDescending(item => item.Fecha).ThenByDescending(item => item.id).ToListAsync();
        return entries.GroupBy(item => item.Service_Tag).Select(group => group.First())
            .Where(item => item.Accion == "ENVIO_A_VENTA" && item.Fecha_Liberacion == null).ToList();
    }

    public async Task<object[]> PendingDtos()
    {
        var result = new List<object>();
        foreach (var entry in await PendingEntries())
        {
            var equipo = await db.Equipos.FindAsync(entry.Service_Tag);
            var snapshot = await Snapshot(entry, equipo);
            var dto = new Dictionary<string, object?>
            {
                ["Service_Tag"] = entry.Service_Tag,
                ["Hostname"] = equipo != null ? equipo.Hostname : snapshot["Hostname"],
                ["Estado"] = "Fuera del inventario",
                ["Payroll_Anterior"] = entry.Payroll_Anterior,
                ["Nombre_Empleado_Anterior"] = entry.Nombre_Empleado_Anterior,
                ["Trace"] = Text(snapshot["Trace"]) is { Length: > 0 } trace ? trace : entry.Detalle
            };
            foreach (var key in new[] { "MAC", "Marca", "Modelo", "Tipo_Equipo", "IMEI" }) dto[key] = snapshot[key];
            result.Add(dto);
        }
        return result.ToArray();
    }

    public async Task<object[]> HistoryDtos()
    {
        var rows = await db.Ventas.AsNoTracking()
            .Where(item => item.Accion == "ENVIADO_A_VENTA" && item.Fecha_Liberacion != null)
            .OrderByDescending(item => item.Fecha_Liberacion).ToListAsync();
        return rows.GroupBy(item => (item.Fecha_Liberacion, item.Detalle))
            .Select(group => (object)new Dictionary<string, object?>
            {
                ["Fecha_Liberacion"] = group.Key.Fecha_Liberacion,
                ["Detalle"] = group.Key.Detalle,
                ["Total_Equipos"] = group.Count(),
                ["Equipos"] = group.Select(Dto).ToArray()
            }).ToArray();
    }

    public async Task<List<Venta>> Send(string[] tags, string? actor)
    {
        var rows = await equipos.Query.Where(equipo => tags.Contains(equipo.Service_Tag)).ToListAsync();
        var missing = tags.Except(rows.Select(equipo => equipo.Service_Tag)).ToArray();
        if (missing.Length > 0) throw new VentaException("No se encontraron los equipos: " + string.Join(", ", missing));
        foreach (var equipo in rows)
        {
            if (Outside.Contains(equipo.Estado.Trim().ToLowerInvariant()))
                throw new VentaException($"El equipo {equipo.Service_Tag} ya está inactivo o en disposición final");
            if ((await db.Telefonos.FindAsync(equipo.Service_Tag))?.Estado.Trim().ToLowerInvariant() == "activa")
                throw new VentaException($"No se puede enviar el equipo {equipo.Service_Tag} a Ventas: tiene una línea telefónica Activa. Suspende la línea antes de continuar.");
            if (await Pending(equipo.Service_Tag) != null)
                throw new VentaException($"El equipo {equipo.Service_Tag} ya tiene un proceso de Venta pendiente");
            await CheckScrap(equipo.Service_Tag);
            await CheckDonation(equipo.Service_Tag);
            await CheckProduction(equipo.Service_Tag);
        }

        var result = new List<Venta>();
        foreach (var equipo in rows)
        {
            foreach (var card in await db.cartas_responsivas
                .Where(card => card.service_tag == equipo.Service_Tag && CartasService.Active.Contains(card.estado)).ToListAsync())
            {
                card.estado = "CERRADA";
                var host = string.IsNullOrEmpty(equipo.Hostname) ? card.hostname : equipo.Hostname;
                var detail = $"Administrador:{actor ?? "Sistema"} Cerró Carta {(card.tipo_carta == "COMPARTIDA" ? "Compartida" : "Individual")} - Service tag: {equipo.Service_Tag} - Hostname: {host ?? "Sin hostname"}";
                if (equipo.Payroll != null) detail += $" - Payroll anterior: {equipo.Payroll}";
                detail += " - Motivo: Equipo enviado a Ventas";
                db.Movimientos_Equipos.Add(new Movimientos_Equipo
                {
                    Service_Tag = equipo.Service_Tag,
                    Hostname = host,
                    Accion = "CARTA_CERRADA",
                    Detalle = detail,
                    Payroll_Anterior = equipo.Payroll,
                    Usuario = actor,
                    Fecha = DateTime.UtcNow
                });
            }
            var snapshot = await History(equipo);
            snapshot["Trace"] = $"{DateTime.UtcNow:dd-MM-yyyy} - Venta:{equipo.Service_Tag}";
            var entry = new Venta
            {
                Service_Tag = equipo.Service_Tag,
                Hostname = equipo.Hostname,
                Datos_Equipo = snapshot.ToJsonString(),
                Accion = "ENVIO_A_VENTA",
                Detalle = "Pendiente de liberación",
                Payroll_Anterior = equipo.Payroll,
                Nombre_Empleado_Anterior = equipo.PayrollNavigation?.Full_Name,
                Usuario = actor,
                Fecha = DateTime.UtcNow
            };
            db.Ventas.Add(entry);
            result.Add(entry);
            equipos.Movement(equipo, "ENVIO_A_VENTA",
                $"Envio a Ventas |Hostname: {equipo.Hostname ?? "None"} | Empleado anterior: {equipo.PayrollNavigation?.Full_Name ?? "Sin asignar"} | Payroll anterior: {equipo.Payroll?.ToString() ?? "Sin payroll"}",
                equipo.Payroll, null, actor);
            db.Equipos.Remove(equipo);
        }
        await db.SaveChangesAsync();
        return result;
    }

    public async Task<List<Equipos_liberado>> Release(string[]? tags, string detail, string? actor)
    {
        if (string.IsNullOrWhiteSpace(detail)) throw new VentaException("Indica el motivo de la liberación");
        if (detail.Length > 1000) throw new VentaException("El motivo no puede exceder 1000 caracteres");
        tags ??= (await PendingEntries()).Select(item => item.Service_Tag).ToArray();
        var result = new List<Equipos_liberado>();
        var now = DateTime.UtcNow;
        await using var transaction = await db.Database.BeginTransactionAsync();
        foreach (var tag in tags)
        {
            var equipo = await db.Equipos.FindAsync(tag);
            var entry = await Pending(tag) ?? throw new VentaException($"El equipo {tag} no tiene un proceso de Venta pendiente");
            await CheckScrap(tag);
            await CheckDonation(tag);
            await CheckProduction(tag);
            var claimed = await db.Ventas.Where(item => item.id == entry.id && item.Fecha_Liberacion == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.Fecha_Liberacion, now));
            if (claimed != 1) throw new VentaException($"El equipo {tag} ya fue liberado de Ventas");
            var snapshot = await Snapshot(entry, equipo);
            if (snapshot.Count == 0) throw new VentaException($"No hay datos históricos suficientes para cerrar el proceso de Venta del equipo {tag}");
            string? Value(string key) => snapshot[key]?.ToString();
            var host = equipo != null ? equipo.Hostname : Value("Hostname");
            var released = new Equipos_liberado
            {
                Service_Tag = tag,
                Hostname = host,
                MAC = Value("MAC"),
                Accion = "LIBERACION",
                Detalle = detail,
                Payroll_Anterior = entry.Payroll_Anterior,
                Nombre_Empleado_Anterior = entry.Nombre_Empleado_Anterior,
                Tipo_Liberacion = "VENTA",
                Marca = Value("Marca"),
                Modelo = Value("Modelo"),
                IMEI = Value("IMEI"),
                Tipo_Equipo = Value("Tipo_Equipo"),
                MQ_Asset = Value("MQ_Asset"),
                Location = Value("Location"),
                Numero_Telefono = Value("Numero_Telefono"),
                Account = Value("Account"),
                Apple_ID = Value("Apple_ID"),
                Total_cuenta = snapshot["Total_cuenta"]?.GetValue<decimal>(),
                Estado_Telefono = Value("Estado_Telefono"),
                Fecha_Liberacion = now,
                Fecha = now
            };
            db.Equipos_liberados.Add(released);
            result.Add(released);
            db.Ventas.Add(new Venta
            {
                Service_Tag = tag,
                Hostname = host,
                Datos_Equipo = snapshot.ToJsonString(),
                Accion = "ENVIADO_A_VENTA",
                Detalle = detail,
                Payroll_Anterior = entry.Payroll_Anterior,
                Nombre_Empleado_Anterior = entry.Nombre_Empleado_Anterior,
                Usuario = actor,
                Fecha_Liberacion = now,
                Fecha = now
            });
            db.Movimientos_Equipos.Add(new Movimientos_Equipo
            {
                Service_Tag = tag,
                Hostname = host,
                Accion = "ENVIADO_A_VENTA",
                Detalle = $"Hostname: {host ?? "None"} | Motivo: {detail} | Empleado anterior: {entry.Nombre_Empleado_Anterior ?? "Sin asignar"} | Payroll anterior: {entry.Payroll_Anterior?.ToString() ?? "Sin payroll"}",
                Payroll_Anterior = entry.Payroll_Anterior,
                Usuario = actor,
                Fecha = now
            });
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return result;
    }
}
