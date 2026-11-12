using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;
namespace TRG2._0_VNET.Services;

public sealed class ReportesService(InventarioDbContext db)
{
    public static string Day(DateTime date) => date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
    public static JsonObject Object(string? json) { try { return JsonNode.Parse(json ?? "{}") as JsonObject ?? new(); } catch (JsonException) { return new(); } }
    private static string? First(params object?[] values) => values.Select(v => v?.ToString()).FirstOrDefault(v => !string.IsNullOrEmpty(v));
    public async Task<List<Dictionary<string, object?>>> Lines()
    {
        var rows = await db.Telefonos.AsNoTracking().Where(p => p.Estado.Trim().ToLower() == "activa" && p.Account != null && p.Account.Trim() != "" && p.Numero_Telefono != null && p.Numero_Telefono.Trim() != "" && p.Total_cuenta != null).ToListAsync();
        var tags = rows.Select(p => p.Service_Tag).ToArray();
        var devices = await db.Equipos.AsNoTracking().Include(e => e.PayrollNavigation).Where(e => tags.Contains(e.Service_Tag)).ToDictionaryAsync(e => e.Service_Tag);
        return rows.Where(p => !devices.TryGetValue(p.Service_Tag, out var e) || EquiposService.PhoneType(e.Tipo_Equipo)).OrderBy(p => devices.GetValueOrDefault(p.Service_Tag)?.Service_Tag, StringComparer.Ordinal).Select(p => {
            var e = devices.GetValueOrDefault(p.Service_Tag); var person = e?.PayrollNavigation;
            return new Dictionary<string, object?> { ["Service_Tag"] = p.Service_Tag, ["Numero_Telefono"] = p.Numero_Telefono, ["Account"] = p.Account, ["Total_cuenta"] = p.Total_cuenta, ["Estado"] = First(p.Estado, e?.Estado), ["Fecha_Registro"] = e == null ? "" : Day(e.Fecha_Creacion), ["Fecha_Liberacion"] = "", ["Usuario_Id"] = e?.Payroll, ["Usuario"] = First(person?.Full_Name, person?.User_Name, "No asignado"), ["Marca"] = e?.Marca, ["Modelo"] = e?.Modelo, ["CC"] = person?.CC };
        }).ToList();
    }
    public static Dictionary<int, (int HC, decimal Total)> Centers(IEnumerable<Dictionary<string, object?>> rows)
    {
        var result = new Dictionary<int, (int HC, decimal Total)>();
        foreach (var r in rows) if (r["CC"] is int cc && !string.IsNullOrWhiteSpace(r["Account"]?.ToString()) && r["Total_cuenta"] is decimal total) { var old = result.GetValueOrDefault(cc); result[cc] = (old.HC + 1, old.Total + total); }
        return result;
    }
    public async Task<Dictionary<string, object?>> Employee(int? payroll)
    {
        var person = payroll == null ? null : await db.Empleados.FindAsync(payroll);
        var query = db.Equipos.AsNoTracking().Include(e => e.PayrollNavigation).AsQueryable();
        if (payroll != null) query = query.Where(e => e.Payroll == payroll);
        var rows = await query.OrderBy(e => e.Payroll).ThenBy(e => e.Service_Tag).ToListAsync(); var tags = rows.Select(e => e.Service_Tag).ToArray();
        var phones = await db.Telefonos.AsNoTracking().Where(p => tags.Contains(p.Service_Tag)).ToDictionaryAsync(p => p.Service_Tag);
        var devices = rows.Select(e => { var p = phones.GetValueOrDefault(e.Service_Tag); return new Dictionary<string, object?> { ["Service_Tag"] = e.Service_Tag, ["Hostname"] = e.Hostname, ["Tipo_Equipo"] = e.Tipo_Equipo, ["Marca"] = e.Marca, ["Modelo"] = e.Modelo, ["Usuario"] = First(e.PayrollNavigation?.Full_Name, e.PayrollNavigation?.User_Name, "No asignado"), ["Payroll"] = e.Payroll, ["Tiene_Linea"] = p != null && !string.IsNullOrWhiteSpace(p.Account) && !string.IsNullOrWhiteSpace(p.Numero_Telefono) && p.Total_cuenta != null, ["Account"] = p?.Account, ["Numero_Telefono"] = p?.Numero_Telefono, ["Total_cuenta"] = p?.Total_cuenta, ["IMEI"] = e.IMEI }; }).ToList();
        var shared = new List<Dictionary<string, object?>>();
        if (payroll != null)
        {
            var cards = await db.cartas_responsivas.AsNoTracking().Where(c => c.tipo_carta == "COMPARTIDA" && CartasService.Active.Contains(c.estado)).OrderByDescending(c => c.id).ToListAsync();
            var cardTags = cards.Select(c => c.service_tag).ToArray(); var equipment = await db.Equipos.AsNoTracking().Where(e => cardTags.Contains(e.Service_Tag)).ToDictionaryAsync(e => e.Service_Tag); var seen = new HashSet<string>();
            foreach (var c in cards)
            {
                var s = Object(c.datos_json); var owner = s["titular"] as JsonObject ?? new JsonObject { ["payroll"] = s["payroll_titular"]?.DeepClone() ?? JsonValue.Create(c.payroll_titular), ["nombre"] = s["nombre_titular"]?.DeepClone() ?? JsonValue.Create(c.nombre_titular) };
                var extras = s["co_responsables"] as JsonArray ?? (s["co_responsable"] is JsonObject co ? new JsonArray(co.DeepClone()) : new JsonArray());
                if (extras.Count == 0 && !string.IsNullOrEmpty(c.payroll_secundario)) extras = new JsonArray(new JsonObject { ["payroll"] = c.payroll_secundario, ["nombre"] = c.nombre_secundario });
                if (!extras.OfType<JsonObject>().Any(p => p["payroll"]?.ToString() == payroll.ToString()) || seen.Contains(c.service_tag)) continue;
                var e = equipment.GetValueOrDefault(c.service_tag); var principal = First(owner["payroll"], c.payroll_titular);
                if (e == null || e.Payroll?.ToString() != principal || e.Estado.Trim().Equals("inactivo", StringComparison.OrdinalIgnoreCase)) continue;
                var nested = s["equipo"] as JsonObject ?? new();
                shared.Add(new Dictionary<string, object?> { ["Service_Tag"] = c.service_tag, ["Hostname"] = First(e.Hostname, s["hostname"], nested["hostname"], nested["Hostname"], c.hostname), ["Tipo_Equipo"] = First(e.Tipo_Equipo, s["device_type"], nested["device_type"], c.device_type), ["Marca"] = First(e.Marca, s["marca"], nested["marca"]), ["Modelo"] = First(e.Modelo, s["modelo"], nested["modelo"]), ["IMEI"] = First(e.IMEI, s["IMEI"]), ["Principal"] = new Dictionary<string, object?> { ["Payroll"] = owner["payroll"]?.DeepClone() ?? (object?)c.payroll_titular, ["Nombre"] = First(owner["nombre"], c.nombre_titular) }, ["Compartido_Con"] = extras.OfType<JsonObject>().ToArray() }); seen.Add(c.service_tag);
            }
        }
        return new Dictionary<string, object?> { ["empleado"] = person == null ? null : new Dictionary<string, object?> { ["Payroll"] = person.Payroll, ["Nombre"] = First(person.Full_Name, person.User_Name), ["Departamento"] = person.Departament, ["Area"] = person.Area, ["Puesto"] = person.Position, ["CC"] = person.CC, ["Correo"] = person.Correo }, ["equipos"] = devices, ["equipos_compartidos"] = shared };
    }
    public sealed record Entry(int Id, string Tag, string? Json, string Detail, string? User, DateTime Date, DateTime? Released, int? Payroll, string? Name);
    private async Task<List<Entry>> Entries(string kind) => kind switch {
        "scrap" => await db.Scraps.AsNoTracking().Where(s => s.Accion == "ENVIADO_A_RECICLADORA").Select(s => new Entry(s.id,s.Service_Tag,s.Datos_Equipo,s.Detalle,s.Usuario,s.Fecha,s.Fecha_Liberacion,s.Payroll_Anterior,s.Nombre_Empleado_Anterior)).ToListAsync(),
        "donaciones" => await db.Donaciones.AsNoTracking().Where(s => s.Accion == "ENVIADO_A_DONACION").Select(s => new Entry(s.id,s.Service_Tag,s.Datos_Equipo,s.Detalle,s.Usuario,s.Fecha,s.Fecha_Liberacion,s.Payroll_Anterior,s.Nombre_Empleado_Anterior)).ToListAsync(),
        "produccion" => await db.Produccions.AsNoTracking().Where(s => s.Accion == "ENVIADO_A_PRODUCCION").Select(s => new Entry(s.id,s.Service_Tag,s.Datos_Equipo,s.Detalle,s.Usuario,s.Fecha,s.Fecha_Liberacion,s.Payroll_Anterior,s.Nombre_Empleado_Anterior)).ToListAsync(),
        "ventas" => await db.Ventas.AsNoTracking().Where(s => s.Accion == "ENVIADO_A_VENTA").Select(s => new Entry(s.id,s.Service_Tag,s.Datos_Equipo,s.Detalle,s.Usuario,s.Fecha,s.Fecha_Liberacion,s.Payroll_Anterior,s.Nombre_Empleado_Anterior)).ToListAsync(),
        _ => throw new ArgumentException("Reporte no válido") };
    public static string Key(string kind) => kind switch { "donaciones" => "donacion", "ventas" => "venta", _ => kind };
    public async Task<List<Dictionary<string, object?>>> Orders(string kind, int[]? ids = null)
    {
        var entries = (await Entries(kind)).Where(e => ids is not { Length: > 0 } || ids.Contains(e.Id)).OrderBy(e => e.Released).ThenBy(e => e.Id).ToArray();
        var tags = entries.Select(e => e.Tag).ToArray(); var users = entries.Select(e => e.User).ToArray();
        var equipment = await db.Equipos.AsNoTracking().Where(e => tags.Contains(e.Service_Tag)).ToDictionaryAsync(e => e.Service_Tag);
        var admins = await db.Administradors.AsNoTracking().Where(a => users.Contains(a.UserName)).ToDictionaryAsync(a => a.UserName);
        var result = new List<Dictionary<string, object?>>();
        foreach (var group in entries.GroupBy(e => (e.Released,e.Detail,e.User))) {
            var items = new List<Dictionary<string, object?>>();
            foreach (var e in group) { var s = Object(e.Json); var device = equipment.GetValueOrDefault(e.Tag); var admin = e.User == null ? null : admins.GetValueOrDefault(e.User);
                var item = new Dictionary<string, object?> { ["id_" + Key(kind)] = e.Id, ["Service_Tag"] = e.Tag, ["Payroll_Anterior"] = e.Payroll, ["Nombre_Empleado_Anterior"] = e.Name, ["Estado_Equipo"] = "Histórico", ["Equipo_Activo"] = false, ["Fecha"] = Day(e.Released ?? e.Date), ["Comentario"] = e.Detail, ["Usuario"] = First(e.User,"No registrado"), ["Nombre_Usuario"] = First(admin?.Nombre_Completo,e.User,"No registrado") };
                foreach (var key in new[] { "Hostname","MAC","Marca","Modelo","Tipo_Equipo","IMEI" }) item[key] = First(s[key], device?.GetType().GetProperty(key)?.GetValue(device)); items.Add(item);
            }
            var first = items[0]; result.Add(new Dictionary<string, object?> { ["Orden_Id"] = result.Count + 1, ["ids"] = group.Select(e => e.Id).ToArray(), ["Fecha"] = first["Fecha"], ["Comentario"] = first["Comentario"], ["Usuario"] = first["Usuario"], ["Nombre_Usuario"] = first["Nombre_Usuario"], ["Total_Equipos"] = items.Count, ["Equipos"] = items });
        }
        return result;
    }
    public async Task<object> Summary(string kind)
    {
        var rows = await Entries(kind); var tags = rows.Select(e => e.Tag).ToArray(); var devices = await db.Equipos.AsNoTracking().Where(e => tags.Contains(e.Service_Tag)).ToDictionaryAsync(e => e.Service_Tag);
        object[] Group(IEnumerable<string?> values,string fallback) => values.GroupBy(v => v).Select(g => (object)new { categoria = string.IsNullOrEmpty(g.Key) ? fallback : g.Key, total = g.Count() }).ToArray();
        return new { por_tipo = Group(rows.Select(r => devices.GetValueOrDefault(r.Tag)?.Tipo_Equipo),"Histórico"), por_estado = Group(rows.Select(r => devices.GetValueOrDefault(r.Tag)?.Estado),"Histórico"), por_usuario = Group(rows.Select(r => r.User),"Sin usuario"), total_equipos = rows.Count, total_ordenes = (await Orders(kind)).Count };
    }
}
