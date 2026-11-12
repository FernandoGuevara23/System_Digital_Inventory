using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;

namespace TRG2._0_VNET.Services;

public sealed class EquipoValidationException(string message, int status = 400) : Exception(message)
{ public int Status { get; } = status; }

public sealed class EquiposService(InventarioDbContext db)
{
    public IQueryable<Equipo> Query => db.Equipos.Include(x => x.PayrollNavigation).Include(x => x.Id_ProyectoNavigation);
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string Py(object? value) => value?.ToString() ?? "None";
    public static string? Value(Dictionary<string, JsonElement> data, string key) => data.TryGetValue(key, out var v) && v.ValueKind != JsonValueKind.Null ? v.ToString() : null;
    internal static bool PhoneType(string? value) => new[] { "telefono", "teléfono", "teléfonos", "celular", "smartphone", "iphone" }.Any(x => (value ?? "").Trim().ToLowerInvariant().Contains(x));
    private async Task<Equipo> Find(string tag, int status = 400) => await Query.FirstOrDefaultAsync(x => x.Service_Tag == tag) ?? throw new EquipoValidationException("Equipo no encontrado", status);
    internal async Task CheckCc(int? payroll)
    {
        if (!await db.Empleados.AnyAsync(x => x.Payroll == payroll && x.Estado && x.CC != null))
            throw new EquipoValidationException("El teléfono debe estar asignado a un empleado activo con CC.");
    }
    internal async Task<string> PhoneNumber(string value, string? except = null)
    {
        var number = Regex.Replace(value, "[^0-9]", "");
        if (number.Length == 0) throw new EquipoValidationException("El número de teléfono es obligatorio.");
        if (number.Length > 20) throw new EquipoValidationException("El número de teléfono no puede exceder 20 dígitos.");
        var numbers = await db.Telefonos.Where(x => x.Service_Tag != except && x.Numero_Telefono != null).Select(x => x.Numero_Telefono!).ToListAsync();
        const string separators = " -()+./:\\\t\r\n\u00a0";
        if (numbers.Any(x => new string(x.Trim().Where(c => !separators.Contains(c)).ToArray()) == number))
            throw new EquipoValidationException("El número de teléfono ya está registrado en otra línea.");
        return number;
    }
    internal async Task CheckMac(string? mac, string? except)
    {
        if (mac == null) return;
        var key = mac.ToUpperInvariant().Replace(":", "").Replace("-", "").Replace(".", "").Replace(" ", "");
        if (await db.Equipos.AnyAsync(x => x.Service_Tag != except && x.MAC != null && x.MAC.Trim().ToUpper().Replace(":", "").Replace("-", "").Replace(".", "").Replace(" ", "") == key))
            throw new EquipoValidationException("La dirección MAC ya está registrada en otro equipo");
    }
    private async Task<Catalogos_Tipos_Equipo> Type(string? name)
    {
        var key = (name ?? "").Trim().ToLowerInvariant();
        return await db.Catalogos_Tipos_Equipos.FirstOrDefaultAsync(x => x.Nombre_Tipo_Equipo.Trim().ToLower() == key)
            ?? throw new EquipoValidationException("El tipo de equipo seleccionado no existe en el catálogo");
    }
    private async Task<int?> Project(string? name)
    {
        name = Clean(name);
        if (name == null) return null;
        return (await db.Proyectos.FirstOrDefaultAsync(x => x.Nombre_Proyecto == name))?.Id
            ?? throw new EquipoValidationException("El proyecto seleccionado no existe");
    }
    public void Movement(Equipo e, string action, string detail, int? before, int? after, string? actor)
        => db.Movimientos_Equipos.Add(new Movimientos_Equipo { Service_Tag = e.Service_Tag, Hostname = e.Hostname, Accion = action, Detalle = detail, Payroll_Anterior = before, Payroll_Nuevo = after, Usuario = Clean(actor), Fecha = DateTime.UtcNow });
    internal void ValidateLengths(object entity)
    {
        var metadata = db.Model.FindEntityType(entity.GetType())!;
        foreach (var p in metadata.GetProperties())
        {
            var value = p.PropertyInfo?.GetValue(entity);
            if (value is string text && p.GetMaxLength() is int max && text.Length > max)
                throw new EquipoValidationException(p.Name == "Hostname" ? "El Hostname no puede exceder 50 caracteres" : $"El campo {p.Name} no puede exceder {max} caracteres");
            if (!p.IsNullable && p.ClrType == typeof(string) && value == null)
                throw new EquipoValidationException($"El campo {p.Name} es obligatorio");
        }
    }
    internal async Task CheckTag(string tag)
    {
        var key = tag.ToLowerInvariant();
        if (await db.Equipos.AnyAsync(x => x.Service_Tag.Trim().ToLower() == key)) throw new EquipoValidationException($"El Service Tag ya existe: {tag}");
        if (await db.Equipos_liberados.AnyAsync(x => x.Service_Tag.Trim().ToLower() == key)) throw new EquipoValidationException($"El Service Tag {tag} ya aparece en la tabla de liberaciones y no se puede volver a registrar");
        if (await db.Movimientos_Equipos.AnyAsync(x => x.Service_Tag.Trim().ToLower() == key && x.Accion.ToLower() == "creacion")) throw new EquipoValidationException($"El Service Tag {tag} ya tiene un registro de creación en el historial y no se puede volver a registrar");
    }
    public async Task<string> Create(Dictionary<string, JsonElement> data, string? actor)
    {
        string? V(string key) => Value(data, key);
        if (new[] { "Service_Tag", "Marca", "Modelo", "Tipo_Equipo" }.Any(k => string.IsNullOrEmpty(V(k)))) throw new EquipoValidationException("Se requieren Service Tag, marca, modelo y tipo de equipo");
        var tag = Clean(V("Service_Tag")) ?? throw new EquipoValidationException("Se requiere Service Tag");
        await CheckTag(tag);
        int? payroll = null;
        if (Clean(V("Payroll")) is string raw) payroll = int.TryParse(raw, out var p) ? p : throw new EquipoValidationException("El Payroll no es válido");
        var type = await Type(V("Tipo_Equipo"));
        var e = new Equipo { Service_Tag = tag, Payroll = payroll, Hostname = Clean(V("Hostname")), MAC = Clean(V("MAC")), Tipo_Equipo = type.Nombre_Tipo_Equipo, Tipo_Equipo_Id = type.Id, Id_Proyecto = await Project(V("Proyecto")), Marca = V("Marca")!, Modelo = V("Modelo")!, MQ_Asset = V("MQ_Asset"), IMEI = V("IMEI"), Location = V("Location"), Comments = V("Comments"), Accesorios = V("Accesorios"), Trace = V("Trace"), Estado = "Disponible", Fecha_Creacion = DateTime.UtcNow };
        await CheckMac(e.MAC, null); ValidateLengths(e);
        var number = Clean(V("Numero_Telefono"));
        if (number != null)
        {
            number = await PhoneNumber(number); await CheckCc(payroll);
            if (!PhoneType(e.Tipo_Equipo)) throw new EquipoValidationException("Solo se pueden asociar números telefónicos a equipos de tipo teléfono.");
        }
        if (new[] { number, V("Account"), V("Apple_ID"), V("Password_apple") }.Any(x => x != null))
        {
            var phone = new Telefono { Service_Tag = tag, Numero_Telefono = number, Account = V("Account"), Apple_ID = V("Apple_ID"), Password_apple = V("Password_apple"), Estado = "Activa" };
            ValidateLengths(phone); db.Telefonos.Add(phone);
        }
        db.Equipos.Add(e);
        Movement(e, "CREACION", $"Equipo agregado: Service Tag: {tag}, Marca: {e.Marca}, Modelo: {e.Modelo}, Hostname: {Py(e.Hostname)}", null, payroll, actor);
        await db.SaveChangesAsync(); return tag;
    }
    public async Task Update(string tag, Dictionary<string, JsonElement> data, string? actor)
    {
        var e = await Find(tag);
        if (new[] { "Service_Tag", "Payroll", "Trace" }.Any(data.ContainsKey)) throw new EquipoValidationException("Service Tag, Payroll y Trace no se pueden editar");
        if (data.ContainsKey("Estado")) throw new EquipoValidationException("El estado solo puede cambiarse mediante una operación de inventario");
        var values = data.ToDictionary(x => x.Key, x => Value(data, x.Key));
        var phone = await db.Telefonos.FindAsync(tag);
        if (values.TryGetValue("Numero_Telefono", out var number) && number != null)
        {
            if (Clean(number) != null)
            {
                if (!PhoneType(values.GetValueOrDefault("Tipo_Equipo", e.Tipo_Equipo))) throw new EquipoValidationException("Solo se pueden asociar números telefónicos a equipos de tipo teléfono.");
                values["Numero_Telefono"] = await PhoneNumber(number, tag); await CheckCc(e.Payroll);
            }
            else values["Numero_Telefono"] = null;
        }
        else if (values.ContainsKey("Tipo_Equipo") && !string.IsNullOrEmpty(phone?.Numero_Telefono) && !PhoneType(values["Tipo_Equipo"])) throw new EquipoValidationException("No se puede cambiar a otro tipo un equipo que conserva una línea telefónica.");
        foreach (var key in new[] { "Hostname", "MAC" }) if (values.ContainsKey(key)) values[key] = Clean(values[key]);
        if (values.ContainsKey("MAC")) await CheckMac(values["MAC"], tag);
        var changes = new List<string>();
        string[] allowed = ["Hostname", "Marca", "Modelo", "MAC", "IMEI", "MQ_Asset", "Accesorios", "Location", "Comments"];
        foreach (var (key, value) in values)
        {
            if (key == "Proyecto") { var id = await Project(value); if (e.Id_Proyecto != id) changes.Add(key); e.Id_Proyecto = id; }
            else if (key == "Tipo_Equipo") { var type = await Type(value); if (e.Tipo_Equipo_Id != type.Id) changes.Add(key); e.Tipo_Equipo_Id = type.Id; e.Tipo_Equipo = type.Nombre_Tipo_Equipo; }
            else if (allowed.Contains(key)) { var prop = typeof(Equipo).GetProperty(key)!; if (!Equals(prop.GetValue(e), value)) changes.Add(key); prop.SetValue(e, value); }
        }
        string[] phoneFields = ["Numero_Telefono", "Account", "Apple_ID", "Password_apple"];
        if (phoneFields.Any(values.ContainsKey))
        {
            if (Clean(phone?.Numero_Telefono) != null && !(values.ContainsKey("Numero_Telefono") && Clean(values["Numero_Telefono"]) == null)) await CheckCc(e.Payroll);
            if (phone == null) { phone = new Telefono { Service_Tag = tag, Estado = "Activa" }; db.Telefonos.Add(phone); }
            foreach (var key in phoneFields.Where(values.ContainsKey)) { var prop = typeof(Telefono).GetProperty(key)!; if (!Equals(prop.GetValue(phone), values[key])) changes.Add(key); prop.SetValue(phone, values[key]); }
            ValidateLengths(phone);
        }
        ValidateLengths(e);
        if (changes.Count > 0)
        {
            e.Trace = $"{DateTime.UtcNow:dd-MM-yyyy}  - Actualización: {string.Join(", ", changes)}";
            Movement(e, "ACTUALIZACION", $"Equipo modificado: Service Tag {tag}; {string.Join(", ", changes)}", e.Payroll, e.Payroll, actor);
        }
        await db.SaveChangesAsync();
    }
    public async Task Reassign(string tag, int payroll, string actor)
    {
        var e = await Find(tag, 404);
        if (new[] { "inactivo", "scrap", "donacion", "donación", "donado", "reciclado", "produccion", "producción", "venta", "ventas" }.Contains(e.Estado.Trim().ToLowerInvariant())) throw new EquipoValidationException("No se puede reasignar un equipo fuera de servicio");
        if (e.Payroll == payroll) throw new EquipoValidationException("No puedes reasignar el equipo al mismo empleado");
        var employee = await db.Empleados.FirstOrDefaultAsync(x => x.Payroll == payroll && x.Estado) ?? throw new EquipoValidationException("El empleado destino no existe o está inactivo", 404);
        var phone = await db.Telefonos.FindAsync(tag);
        if (!string.IsNullOrEmpty(phone?.Numero_Telefono)) await CheckCc(payroll);
        var before = e.PayrollNavigation?.Payroll;
        var name = e.PayrollNavigation == null ? "Sin asignar" : Py(e.PayrollNavigation.Full_Name);
        foreach (var card in await db.cartas_responsivas.Where(x => x.service_tag == tag && (x.estado == "SIN_ENVIAR" || x.estado == "ENVIADO" || x.estado == "FIRMADA")).ToListAsync())
        {
            card.estado = "CERRADA";
            Movement(e, "CARTA_CERRADA", $"Administrador:{actor} Cerro Carta {(card.tipo_carta == "COMPARTIDA" ? "Compartida" : "Individual")} - Service tag: {tag} - Hostname: {Py(e.Hostname)} - Payroll: {Py(before)} - Nombre: {name}", before, null, actor);
        }
        e.Payroll = employee.Payroll; e.Estado = "Reasignado";
        e.Trace = $"Administrador:{actor}: Reasigno Equipo: {tag} - Hostname: {Py(e.Hostname)} - PrevOw: {Py(before)} PresOw: {payroll} ";
        Movement(e, "Reasignación", e.Trace, before, payroll, actor);
        await db.SaveChangesAsync();
    }
    public async Task Activate(string tag, string? actor)
    {
        var e = await Find(tag);
        if (e.Estado.Trim().ToLowerInvariant() != "inactivo") throw new EquipoValidationException("Solo se pueden reactivar equipos inactivos");
        if (await db.Scraps.AnyAsync(x => x.Service_Tag == tag)) throw new EquipoValidationException("Un equipo enviado a Scrap no puede reactivarse");
        if (await db.Donaciones.AnyAsync(x => x.Service_Tag == tag)) throw new EquipoValidationException("Un equipo enviado a Donación no puede reactivarse");
        if (await db.Produccions.AnyAsync(x => x.Service_Tag == tag)) throw new EquipoValidationException("Un equipo enviado a Producción no puede reactivarse");
        if (await db.Ventas.AnyAsync(x => x.Service_Tag == tag)) throw new EquipoValidationException("Un equipo enviado a Ventas no puede reactivarse");
        if (!string.IsNullOrEmpty((await db.Telefonos.FindAsync(tag))?.Numero_Telefono)) throw new EquipoValidationException("No se puede reactivar el equipo mientras conserve una línea telefónica. Transfiere o elimina la línea primero.");
        var before = e.Payroll; e.Payroll = null; e.Estado = "Disponible"; e.Trace = $"{DateTime.UtcNow:yyyy-MM-dd} - Equipo reactivado";
        Movement(e, "REACTIVACION", "Equipo reactivado y devuelto a inventario", before, null, actor);
        await db.SaveChangesAsync();
    }
    public async Task Delete(string tag)
    {
        var e = await Find(tag, 404);
        if (!string.IsNullOrEmpty((await db.Telefonos.FindAsync(tag))?.Numero_Telefono)) throw new EquipoValidationException("No se puede eliminar el equipo mientras tenga una línea telefónica. Transfiere o elimina la línea primero.", 404);
        Movement(e, "BAJA", "Equipo eliminado", e.Payroll, null, null); db.Equipos.Remove(e); await db.SaveChangesAsync();
    }
    public async Task<object[]> Dtos(IEnumerable<Equipo> equipment)
    {
        var rows = equipment.ToArray(); var tags = rows.Select(x => x.Service_Tag).ToArray();
        var phones = await db.Telefonos.AsNoTracking().Where(x => tags.Contains(x.Service_Tag)).ToDictionaryAsync(x => x.Service_Tag);
        return rows.Select(e => {
            var dto = new Dictionary<string, object?>();
            foreach (var key in new[] { "Service_Tag", "Payroll", "Hostname", "Marca", "Modelo", "Tipo_Equipo", "Tipo_Equipo_Id", "Id_Proyecto", "MQ_Asset", "IMEI", "Location", "Accesorios", "Trace", "Comments", "Estado", "MAC" }) dto[key] = typeof(Equipo).GetProperty(key)!.GetValue(e);
            dto["Proyecto"] = e.Id_ProyectoNavigation?.Nombre_Proyecto;
            dto["Empleado"] = e.PayrollNavigation == null ? null : new Dictionary<string, object?> { ["Payroll"] = e.PayrollNavigation.Payroll, ["Full_Name"] = e.PayrollNavigation.Full_Name };
            if (phones.TryGetValue(e.Service_Tag, out var phone)) foreach (var key in new[] { "Numero_Telefono", "Account", "Apple_ID", "Password_apple", "Total_cuenta" }) dto[key] = typeof(Telefono).GetProperty(key)!.GetValue(phone);
            return (object)dto;
        }).ToArray();
    }
}
