using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;
namespace TRG2._0_VNET.Services;

public sealed class CartaException(string message, int status = 400, string? code = null) : Exception(message)
{ public int Status { get; } = status; public string? Code { get; } = code; }
public sealed class CartasService(InventarioDbContext db, ICartaPdf pdf, ICartaMail mail)
{
    public static readonly string[] Active = ["SIN_ENVIAR", "ENVIADO", "FIRMADA"];
    public static string S(JsonNode? node) => node?.ToString().Trim() ?? "";
    public static string Pick(JsonObject obj, params string[] keys) => keys.Select(k => S(obj[k])).FirstOrDefault(s => s.Length > 0) ?? "";
    private static string? Null(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static void Set(JsonObject o, string key, JsonNode? value) => o[key] = value?.DeepClone();
    public static bool Phone(string type) { var normalized = new string(type.Normalize(NormalizationForm.FormD).Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray()).ToLowerInvariant(); return new[] { "telefono", "celular", "smartphone", "iphone" }.Any(normalized.Contains); }
    public static string Notes(IEnumerable<JsonObject> people) => "Equipo compartido con:\n" + string.Join("\n", people.Select(p => $"- {Pick(p, "nombre")} (Payroll: {Pick(p, "payroll")}) | Posición: {(S(p["position"]) == "" ? "No especificada" : S(p["position"]))} | Departamento: {(S(p["department"]) == "" ? "No especificado" : S(p["department"]))}"));
    public async Task<cartas_responsiva> Find(int id) => await db.cartas_responsivas.FindAsync(id) ?? throw new CartaException("Carta no encontrada", 404);
    public static object Dto(cartas_responsiva c)
    {
        var dto = new Dictionary<string, object?>();
        foreach (var key in new[] { "id", "service_tag", "device_type", "hostname", "payroll_titular", "nombre_titular", "payroll_secundario", "nombre_secundario", "tipo_carta", "estado", "fecha_envio", "fecha_firma", "observaciones" }) dto[key] = c.GetType().GetProperty(key)!.GetValue(c);
        dto["Hostname"] = c.hostname; dto["datos_json"] = string.IsNullOrEmpty(c.datos_json) ? null : JsonNode.Parse(c.datos_json); return dto;
    }
    private async Task<string> Hardware(Equipo e)
    {
        var result = new List<string>(); var phone = Phone(e.Tipo_Equipo); var identifier = phone ? e.IMEI : e.Hostname;
        if (Null(identifier) != null) result.Add($"{(phone ? "IMEI" : "Hostname")}: {identifier!.Trim()}");
        if (Null(e.Service_Tag) != null) result.Add("ST: " + e.Service_Tag.Trim());
        if (phone && (await db.Telefonos.FindAsync(e.Service_Tag))?.Numero_Telefono is string number && Null(number) != null) result.Add("Numero de celular: " + number.Trim());
        if (Null(e.MQ_Asset) != null) result.Add("MQ Asset: " + e.MQ_Asset!.Trim());
        if (Null(e.MAC) != null) result.Add("MAC: " + e.MAC!.Trim());
        return result.Count > 0 ? string.Join("\n", result) : e.Tipo_Equipo.Trim();
    }
    private static JsonObject Person(Empleado e) => new() { ["payroll"] = e.Payroll, ["nombre"] = e.Full_Name?.Trim(), ["correo"] = Null(e.Correo), ["position"] = e.Position?.Trim() ?? "", ["department"] = e.Departament?.Trim() ?? "" };
    public async Task<JsonObject> Validate(JsonObject payload, string? fullActor)
    {
        var tag = Pick(payload, "service_tag", "Service_Tag"); var payrollRaw = Pick(payload, "payroll_titular", "Payroll_Titular");
        if (tag == "" || payrollRaw == "") throw new CartaException("Faltan datos requeridos: service_tag y payroll_titular");
        var observations = Pick(payload, "observaciones", "Observaciones");
        if (observations.Length > 255) throw new CartaException("Las observaciones no pueden exceder 255 caracteres");
        if (!int.TryParse(payrollRaw, out var payroll)) throw new CartaException("El payroll del titular no es válido");
        var e = await db.Equipos.FindAsync(tag) ?? throw new CartaException("El equipo no existe");
        if (e.Payroll != payroll) throw new CartaException("El titular seleccionado no es el responsable actual del equipo");
        if (new[] { "inactivo", "scrap", "donacion", "donación", "donado", "reciclado", "produccion", "producción", "venta", "ventas" }.Contains(e.Estado.Trim().ToLowerInvariant())) throw new CartaException("No se puede generar una carta para un equipo fuera de servicio");
        var owner = await db.Empleados.FindAsync(payroll);
        if (owner == null || !owner.Estado || Null(owner.Full_Name) == null) throw new CartaException("El titular no existe, está inactivo o no tiene nombre registrado");
        var type = Pick(payload, "tipo_carta", "Tipo_Carta"); type = type == "" ? "INDIVIDUAL" : type.ToUpperInvariant();
        if (type != "INDIVIDUAL" && type != "COMPARTIDA") throw new CartaException("El tipo de carta no es válido");
        var additional = payload["co_responsables"]?.DeepClone();
        if (additional == null) { var second = Pick(payload, "payroll_secundario", "Payroll_Secundario"); additional = second == "" ? new JsonArray() : new JsonArray(new JsonObject { ["payroll"] = second }); }
        if (additional is not JsonArray persons) throw new CartaException("La lista de empleados adicionales no es válida");
        if (type == "INDIVIDUAL" && persons.Count > 0) throw new CartaException("Una carta individual no puede incluir empleados adicionales");
        if (type == "COMPARTIDA" && persons.Count == 0) throw new CartaException("Una carta compartida requiere al menos un empleado adicional");
        var ids = new List<int>();
        foreach (var node in persons)
        {
            if (node is not JsonObject p) throw new CartaException("La lista de empleados adicionales contiene datos no válidos");
            if (!int.TryParse(Pick(p, "payroll", "Payroll"), out var id)) throw new CartaException("Todos los empleados adicionales deben tener un payroll válido");
            if (id == payroll || ids.Contains(id)) throw new CartaException("No se puede repetir al titular ni a un empleado adicional"); ids.Add(id);
        }
        var employees = await db.Empleados.Where(p => ids.Contains(p.Payroll)).ToDictionaryAsync(p => p.Payroll);
        if (ids.Any(id => !employees.ContainsKey(id) || !employees[id].Estado)) throw new CartaException("Uno o más empleados adicionales no existen o están inactivos");
        if (ids.Any(id => Null(employees[id].Full_Name) == null)) throw new CartaException("Todos los empleados adicionales deben tener nombre registrado");
        var co = new JsonArray(ids.Select(id => (JsonNode)Person(employees[id])).ToArray());
        Catalogos_Departamento? dept = owner.Departamento_Id == null ? null : await db.Catalogos_Departamentos.FindAsync(owner.Departamento_Id);
        if (dept == null && Null(owner.Departament) != null) { var name = owner.Departament!.Trim().ToLowerInvariant(); dept = await db.Catalogos_Departamentos.FirstOrDefaultAsync(d => d.Nombre_Departamento.Trim().ToLower() == name); }
        var movement = await db.Movimientos_Equipos.Where(m => m.Service_Tag == tag && m.Payroll_Nuevo == payroll && (m.Accion == "CREACION" || m.Accion == "Reasignación")).OrderByDescending(m => m.Fecha).ThenByDescending(m => m.Id).FirstOrDefaultAsync();
        var hardware = await Hardware(e);
        var snapshot = new JsonObject { ["service_tag"] = e.Service_Tag, ["hostname"] = e.Hostname, ["device_type"] = e.Tipo_Equipo, ["imei"] = Null(e.IMEI), ["marca"] = e.Marca, ["modelo"] = e.Modelo, ["brand_model"] = $"{e.Marca} {e.Modelo}".Trim(), ["hardware_description"] = hardware, ["accesorios"] = e.Accesorios?.Trim() ?? "", ["tipo_carta"] = type, ["estado"] = "SIN_ENVIAR", ["observaciones"] = Null(observations), ["notas"] = co.Count > 0 ? Notes(co.OfType<JsonObject>()) : Pick(payload, "notas", "Notas", "observaciones", "Observaciones"), ["payroll_titular"] = payroll, ["nombre_titular"] = owner.Full_Name!.Trim(), ["payroll_secundario"] = co.FirstOrDefault()?["payroll"]?.DeepClone(), ["nombre_secundario"] = co.FirstOrDefault()?["nombre"]?.DeepClone(), ["titular"] = Person(owner), ["co_responsable"] = co.FirstOrDefault()?.DeepClone(), ["co_responsables"] = co, ["firmas"] = new JsonObject { ["empleado"] = owner.Full_Name.Trim(), ["manager"] = Null(dept?.Manager_Asignado), ["administrador"] = Null(fullActor) }, ["fecha_asignacion"] = movement?.Fecha.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) };
        var device = new JsonObject(); foreach (var key in new[] { "service_tag", "hostname", "device_type", "imei", "marca", "modelo", "brand_model", "hardware_description", "accesorios", "observaciones" }) Set(device, key, snapshot[key]); snapshot["equipo"] = device;
        return snapshot;
    }
    private async Task Trace(JsonObject snapshot, string action, string? actor)
    {
        var type = S(snapshot["tipo_carta"]) == "COMPARTIDA" ? "Carta Compartida" : "Carta Individual";
        var extra = S(snapshot["tipo_carta"]) == "COMPARTIDA" ? $" Compartido con {(snapshot["co_responsables"] as JsonArray)?.Count ?? 0} personas adicionales -" : "";
        var detail = $"Administrador({actor ?? "desconocido"}) {action} {type} a Service tag {S(snapshot["service_tag"])} Hostname {(snapshot["hostname"] == null ? "None" : S(snapshot["hostname"]))} Payroll {S(snapshot["payroll_titular"])}{extra} -{DateTime.UtcNow:dd-MM-yyyy}";
        var tag = S(snapshot["service_tag"]);
        db.Movimientos_Equipos.Add(new Movimientos_Equipo { Service_Tag = tag, Hostname = Null(S(snapshot["hostname"])), Accion = action == "Creo" ? "CARTA_CREADA" : "CARTA_ENVIADA", Detalle = detail, Payroll_Nuevo = int.TryParse(S(snapshot["payroll_titular"]), out var id) ? id : null, Usuario = Null(actor), Fecha = DateTime.UtcNow });
        if (await db.Equipos.FindAsync(tag) is { } e) e.Trace = detail;
    }
    public async Task<cartas_responsiva> Create(JsonObject payload, string? actor, string? fullActor)
    {
        var s = await Validate(payload, fullActor ?? actor); var tag = S(s["service_tag"]);
        var count = await db.cartas_responsivas.CountAsync(c => c.service_tag == tag && Active.Contains(c.estado));
        if (count > 0) throw new CartaException(count > 1 ? "El equipo tiene más de una carta activa. Corrige el historial antes de generar otra carta." : "El equipo ya tiene una carta activa.", 409);
        if (!pdf.Available) throw new CartaException("El servidor no tiene Edge o Chromium configurado para generar el PDF.", 503);
        var c = new cartas_responsiva { service_tag = tag, hostname = Null(S(s["hostname"])), device_type = S(s["device_type"]), payroll_titular = S(s["payroll_titular"]), nombre_titular = S(s["nombre_titular"]), payroll_secundario = Null(S(s["payroll_secundario"])), nombre_secundario = Null(S(s["nombre_secundario"])), tipo_carta = S(s["tipo_carta"]), estado = "SIN_ENVIAR", observaciones = Null(S(s["observaciones"])), datos_json = s.ToJsonString() };
        db.cartas_responsivas.Add(c); await Trace(s, "Creo", actor);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("UX_cartas_responsivas_carta_activa") == true || ex.InnerException?.Message.Contains("UNIQUE constraint failed: cartas_responsivas") == true) { throw new CartaException("El equipo ya tiene una carta activa.", 409); }
        catch (DbUpdateException) { throw new CartaException("No se pudo guardar la carta por un error de base de datos.", 500); }
        return c;
    }
    public async Task<JsonObject> Snapshot(cartas_responsiva c)
    {
        JsonObject s; try { s = JsonNode.Parse(c.datos_json ?? "{}") as JsonObject ?? new(); } catch { s = new(); }
        foreach (var key in new[] { "service_tag", "hostname", "device_type", "payroll_titular", "nombre_titular", "payroll_secundario", "nombre_secundario", "tipo_carta" }) if (S(s[key]) == "") s[key] = (string?)c.GetType().GetProperty(key)!.GetValue(c);
        s["estado"] = c.estado;
        if (s["co_responsables"] is not JsonArray) s["co_responsables"] = s["co_responsable"] is JsonObject co && co.Count > 0 ? new JsonArray(co.DeepClone()) : c.payroll_secundario != null ? new JsonArray(new JsonObject { ["payroll"] = c.payroll_secundario, ["nombre"] = c.nombre_secundario }) : new JsonArray();
        var signatures = s["firmas"] as JsonObject ?? new(); s["firmas"] = new JsonObject { ["empleado"] = Pick(signatures, "empleado") is { Length: > 0 } employee ? employee : S(s["nombre_titular"]), ["manager"] = Pick(signatures, "manager") is { Length: > 0 } manager ? manager : "No registrado", ["administrador"] = Pick(signatures, "administrador") is { Length: > 0 } admin ? admin : "No registrado" };
        if (s["equipo"] is not JsonObject) s["equipo"] = new JsonObject(); var device = (JsonObject)s["equipo"]!;
        if (S(s["accesorios"]) == "" || Phone(S(s["device_type"])) || !S(s["hardware_description"]).Contains("ST:"))
        {
            if (await db.Equipos.FindAsync(S(s["service_tag"])) is { } e)
            {
                if (S(s["accesorios"]) == "") { s["accesorios"] = e.Accesorios?.Trim() ?? ""; Set(device, "accesorios", s["accesorios"]); }
                if (Pick(s, "imei") == "" && Pick(device, "imei") == "") { s["imei"] = Null(e.IMEI); Set(device, "imei", s["imei"]); }
                s["hardware_description"] = await Hardware(e); Set(device, "hardware_description", s["hardware_description"]);
            }
        }
        return s;
    }
    public async Task<cartas_responsiva> Send(int id, bool confirm, string? actor)
    {
        var c = await Find(id);
        if (c.estado == "CERRADA") throw new CartaException("La carta está cerrada y no puede enviarse", 409);
        if (c.estado == "FIRMADA") throw new CartaException("La carta está firmada y no puede modificarse", 409);
        if (c.estado == "ENVIADO" && !confirm) throw new CartaException("Esta carta ya fue enviada. Confirma explícitamente si deseas reenviarla.", 409, "REQUIERE_CONFIRMACION_REENVIO");
        var s = await Snapshot(c); var people = new List<JsonNode?> { s["titular"] }; people.AddRange((JsonArray)s["co_responsables"]!);
        var invalid = people.Where(p => p is not JsonObject || !Regex.IsMatch(S(p?["correo"]), @"^[^@\s]+@[^@\s]+\.[^@\s]+$")).Select(p => p is JsonObject && S(p["payroll"]) != "" ? S(p["payroll"]) : "sin payroll").ToArray();
        if (invalid.Length > 0) throw new CartaException($"Falta un correo válido para el payroll: {string.Join(", ", invalid)}.", 409);
        var recipients = people.Select(p => S(p!["correo"])).Distinct().ToArray();
        s["estado"] = "ENVIADO"; s["fecha_envio"] = DateTime.UtcNow.ToString("O");
        var bytes = await pdf.Render(s);
        try { await mail.Send(s, recipients, bytes, CartaPdf.Filename(s)); }
        catch (Exception) { throw new CartaException("No se pudo enviar el correo. Verifica los destinatarios y el servicio de correo.", 502); }
        c.estado = "ENVIADO"; c.fecha_envio = DateTime.UtcNow; c.datos_json = s.ToJsonString(); await Trace(s, "Envio correo de", actor);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException) { throw new CartaException("El correo se envió, pero no se pudo guardar el nuevo estado. No lo reenvíes; solicita la verificación de un administrador.", 500); }
        return c;
    }
    public async Task<cartas_responsiva> Sign(int id)
    {
        var c = await Find(id); if (c.estado != "ENVIADO") throw new CartaException("La carta solo puede marcarse como firmada después de enviar el correo", 409);
        c.estado = "FIRMADA"; c.fecha_firma = DateTime.UtcNow; await db.SaveChangesAsync(); return c;
    }
}

