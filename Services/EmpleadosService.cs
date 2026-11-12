using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;
namespace TRG2._0_VNET.Services;

public sealed class EmpleadoValidationException(string message) : Exception(message);

public sealed class EmpleadosService(InventarioDbContext db)
{
    private static readonly HashSet<string> ExcludedStates = ["inactivo", "scrap", "donacion", "donación", "produccion", "producción", "venta", "ventas"];
    public async Task<object[]> ReadAsync(int? payroll = null)
    {
        var employees = await db.Empleados.AsNoTracking().Where(x => payroll == null || x.Payroll == payroll)
            .Include(x => x.Equipos).AsSplitQuery().ToListAsync();
        var phones = await db.Telefonos.AsNoTracking().Where(t => db.Equipos.Any(e => e.Service_Tag == t.Service_Tag
            && e.Payroll != null && (payroll == null || e.Payroll == payroll))).ToDictionaryAsync(t => t.Service_Tag);
        return employees.Select(e => (object)new Dictionary<string, object?> {
            ["Payroll"] = e.Payroll, ["Full_Name"] = e.Full_Name, ["Foto_URL"] = e.Foto_URL,
            ["Departament"] = e.Departament, ["Departamento_Id"] = e.Departamento_Id, ["Area"] = e.Area,
            ["Position"] = e.Position, ["OUnit"] = e.OUnit, ["Manager"] = e.Manager, ["CC"] = e.CC,
            ["Estado"] = e.Estado, ["Correo"] = e.Correo,
            ["Equipos"] = e.Equipos.Where(q => q.Payroll != null && !ExcludedStates.Contains((q.Estado ?? "").Trim().ToLowerInvariant()))
                .Select(q => EquipmentDto(q, e, phones.GetValueOrDefault(q.Service_Tag))).ToArray()
        }).ToArray();
    }

    private static object EquipmentDto(Equipo q, Empleado employee, Telefono? phone) => new Dictionary<string, object?> {
        ["Service_Tag"] = q.Service_Tag, ["Payroll"] = q.Payroll, ["Hostname"] = q.Hostname, ["Tipo_Equipo"] = q.Tipo_Equipo,
        ["Marca"] = q.Marca, ["Modelo"] = q.Modelo, ["IMEI"] = q.IMEI, ["MQ_Asset"] = q.MQ_Asset,
        ["Numero_Telefono"] = phone?.Numero_Telefono, ["Account"] = phone?.Account, ["Apple_ID"] = phone?.Apple_ID,
        ["Password_apple"] = phone?.Password_apple, ["Location"] = q.Location, ["Comments"] = q.Comments,
        ["Trace"] = q.Trace, ["Estado"] = q.Estado,
        ["Empleado"] = new Dictionary<string, object?> { ["Payroll"] = employee.Payroll, ["Full_Name"] = employee.Full_Name }
    };

    public async Task<int> CreateAsync(IFormCollection form, string? photo, string? actor)
    {
        string? Get(string key) => form.TryGetValue(key, out var value) ? value.FirstOrDefault() : null;
        var payrollText = Get("payroll");
        if (string.IsNullOrEmpty(payrollText)) throw new EmpleadoValidationException("Se requiere payroll");
        if (!int.TryParse(payrollText.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var payroll))
            throw new EmpleadoValidationException("El payroll debe ser un número válido");
        var email = (Get("correo") ?? "").Trim();
        if (email.Length > 0 && (!email.Contains('@') || !email[(email.LastIndexOf('@') + 1)..].Contains('.')))
            throw new EmpleadoValidationException("El correo electrónico no es válido");
        var ccText = Get("cc");
        if (string.IsNullOrEmpty(ccText)) ccText = Get("CC");
        if (string.IsNullOrWhiteSpace(ccText)) throw new EmpleadoValidationException("Se requiere CC");
        if (!int.TryParse(ccText.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var cc))
            throw new EmpleadoValidationException("El CC debe ser un número válido");
        if (await db.Empleados.AnyAsync(x => x.Payroll == payroll)) throw new EmpleadoValidationException("El número de nómina ya existe");
        var deptName = Get("departament");
        var manager = Get("manager");
        Catalogos_Departamento? dept = null;
        if (!string.IsNullOrEmpty(deptName))
        {
            var normalized = deptName.Trim().ToLowerInvariant();
            dept = await db.Catalogos_Departamentos.FirstOrDefaultAsync(x => x.Nombre_Departamento.Trim().ToLower() == normalized);
            if (dept is null) throw new EmpleadoValidationException("El departamento no existe en el catálogo");
            if (!string.IsNullOrWhiteSpace(manager) && !string.Equals(manager.Trim(), dept.Manager_Asignado.Trim(), StringComparison.OrdinalIgnoreCase))
                throw new EmpleadoValidationException("El Manager no corresponde al departamento seleccionado");
            deptName = dept.Nombre_Departamento; manager = dept.Manager_Asignado;
        }
        else if (!string.IsNullOrWhiteSpace(manager)) throw new EmpleadoValidationException("El Manager requiere un departamento válido");
        var employee = new Empleado { Payroll = payroll, Full_Name = Get("full_name"), User_Name = Get("user_name"),
            Departament = deptName, Departamento_Id = dept?.Id, Manager = manager, Area = Get("area"), Position = Get("position"),
            OUnit = Get("ounit"), Estado = (Get("Estado") ?? "true").Trim().Equals("true", StringComparison.OrdinalIgnoreCase),
            CC = cc, Correo = email.Length == 0 ? null : email, Foto_URL = photo };
        ValidateLengths(employee);
        db.Empleados.Add(employee);
        Movement($"Empleado-{payroll}", "CREACION", $"Empleado creado: {employee.Full_Name ?? "None"} (Payroll {payroll})", null, payroll, actor);
        await db.SaveChangesAsync();
        return payroll;
    }

    public async Task UpdateAsync(int payroll, Dictionary<string, JsonElement> data, string? actor)
    {
        var employee = await db.Empleados.FindAsync(payroll) ?? throw new EmpleadoValidationException("Empleado no encontrado");
        if (data.Keys.Any(k => k is not ("Estado" or "Correo" or "Foto_URL")))
            throw new EmpleadoValidationException("Solo se pueden editar Estado, Correo y Foto_URL");
        if (data.Count == 0) throw new EmpleadoValidationException("Se requiere Estado o Correo para actualizar");
        var changes = new List<string>();
        foreach (var (key, value) in data)
        {
            if (key == "Estado")
            {
                bool? state = value.ValueKind switch { JsonValueKind.True => true, JsonValueKind.False => false,
                    JsonValueKind.String => value.GetString()!.Trim().ToLowerInvariant() switch {
                        "true" or "1" or "activo" or "activa" => true,
                        "false" or "0" or "inactivo" or "inactiva" => false, _ => null }, _ => null };
                if (state is null) throw new EmpleadoValidationException("Estado debe ser booleano");
                if (employee.Estado != state) changes.Add(key);
                employee.Estado = state.Value;
            }
            else
            {
                if (value.ValueKind is not (JsonValueKind.Null or JsonValueKind.String))
                    throw new EmpleadoValidationException($"{key} debe ser texto o null");
                var text = value.ValueKind == JsonValueKind.Null ? null : value.GetString()!.Trim();
                if (key == "Correo")
                {
                    if (text == "") text = null;
                    if (employee.Correo != text) changes.Add(key);
                    employee.Correo = text;
                }
                else { if (employee.Foto_URL != text) changes.Add(key); employee.Foto_URL = text; }
            }
        }
        ValidateLengths(employee);
        if (changes.Count > 0) Movement($"Empleado-{payroll}", "ACTUALIZACION", $"Empleado modificado: Payroll {payroll}; {string.Join(", ", changes)}", payroll, payroll, actor);
        await db.SaveChangesAsync();
    }

    public async Task<bool> DeactivateAsync(int payroll)
    {
        var employee = await db.Empleados.FindAsync(payroll);
        if (employee is null) return false;
        employee.Estado = false;
        await db.SaveChangesAsync();
        return true;
    }

    internal void Movement(string tag, string action, string detail, int? before, int? after, string? actor)
        => db.Movimientos_Equipos.Add(new Movimientos_Equipo { Service_Tag = tag, Accion = action, Detalle = detail,
            Payroll_Anterior = before, Payroll_Nuevo = after, Usuario = actor?.Trim(), Fecha = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified) });

    internal static void ValidateLengths(Empleado e)
    {
        foreach (var (name, value, max) in new (string, string?, int)[] {
            ("Full_Name",e.Full_Name,150), ("User_Name",e.User_Name,150), ("Foto_URL",e.Foto_URL,255),
            ("Departament",e.Departament,100), ("Area",e.Area,50), ("Position",e.Position,100), ("OUnit",e.OUnit,100),
            ("Manager",e.Manager,50), ("Correo",e.Correo,100) })
            if (value?.Length > max) throw new EmpleadoValidationException($"{name} no puede exceder {max} caracteres");
    }
}
