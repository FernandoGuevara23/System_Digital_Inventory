using System.Globalization;
using System.Text;
using ExcelDataReader;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;

namespace TRG2._0_VNET.Services;

public sealed class EmpleadosExcel(InventarioDbContext db, EmpleadosService employees)
{
    private static readonly string[][] Required = [
        ["Número de Empleado", "Payroll"], ["Nombre", "Full_Name"],
        ["Deparment", "Departament", "Departamento"], ["Puesto", "Position"] ];

    private static readonly HashSet<string> MissingValues = ["", "#N/A", "#N/A N/A", "#NA", "-1.#IND", "-1.#QNAN", "-NaN", "-nan", "1.#IND", "1.#QNAN", "<NA>", "N/A", "NA", "NULL", "NaN", "None", "n/a", "nan", "null"];
    private static object? Clean(object? value)
    {
        if (value is null or DBNull) return null;
        if (value is string text) return MissingValues.Contains(text) || text.Trim().Length == 0 ? null : text.Trim();
        return value;
    }
    private static string? Text(object? value) => value is null ? null : Convert.ToString(value, CultureInfo.InvariantCulture);
    private static int Integer(object value, string name)
    {
        try
        {
            return value switch {
                double n => checked((int)Math.Truncate(n)), float n => checked((int)Math.Truncate(n)),
                decimal n => checked((int)Math.Truncate(n)), bool b => b ? 1 : 0,
                _ => int.Parse(Text(value)!, NumberStyles.Integer, CultureInfo.InvariantCulture) };
        }
        catch (Exception e) when (e is OverflowException or FormatException)
        { throw new EmpleadoValidationException($"{name} debe ser un número válido"); }
    }
    private static bool State(object? value, bool fallback)
    {
        if (value is null) return fallback;
        if (value is string text) return text.ToLowerInvariant() switch {
            "activo" or "activa" or "true" or "1" or "si" or "sí" => true,
            "inactivo" or "inactiva" or "false" or "0" or "no" => false, _ => text.Length > 0 };
        if (value is bool boolean) return boolean;
        return Convert.ToDouble(value, CultureInfo.InvariantCulture) != 0;
    }

    public async Task<int> ImportAsync(Stream stream, string filename, string? actor)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        using var reader = ExcelReaderFactory.CreateReader(stream, new ExcelReaderConfiguration { LeaveOpen = true });
        var columns = new Dictionary<string, int>(StringComparer.Ordinal);
        if (reader.Read())
            for (var i = 0; i < reader.FieldCount; i++)
                if (reader.GetValue(i) is not null and not DBNull) columns.TryAdd(Text(reader.GetValue(i))!, i);
        var missing = Required.Where(group => !group.Any(columns.ContainsKey)).Select(group => group[0]).ToArray();
        if (missing.Length > 0) throw new EmpleadoValidationException("Formato inválido. Faltan las siguientes columnas: " + string.Join(", ", missing));
        object? Get(params string[] keys)
        {
            foreach (var key in keys)
                if (columns.TryGetValue(key, out var index) && Clean(reader.GetValue(index)) is { } value) return value;
            return null;
        }
        var processed = 0; var added = 0; var edited = 0; var row = 1;
        while (reader.Read())
        {
            row++;
            var payrollValue = Get("Número de Empleado", "Payroll");
            if (payrollValue is null) continue;
            var name = Text(Get("Nombre", "Full_Name"));
            if (name is null) throw new EmpleadoValidationException($"La fila {row} tiene nómina, pero no contiene un nombre de empleado");
            var deptName = Text(Get("Deparment", "Departament", "Departamento"));
            var manager = Text(Get("Manager"));
            Catalogos_Departamento? dept = null;
            if (deptName is not null)
            {
                var normalized = deptName.ToLowerInvariant();
               
                dept = await db.Catalogos_Departamentos.FirstOrDefaultAsync(x => x.Nombre_Departamento.ToLower() == normalized);
                if (dept is null) throw new EmpleadoValidationException($"El departamento '{deptName}' no existe en el catálogo");
                deptName = dept.Nombre_Departamento;
            }
            if (dept is not null)
            {
                if (manager is not null && !string.Equals(manager.Trim(), dept.Manager_Asignado.Trim(), StringComparison.OrdinalIgnoreCase))
                    throw new EmpleadoValidationException($"El Manager '{manager}' no corresponde al departamento '{dept.Nombre_Departamento}'");
                manager = dept.Manager_Asignado;
            }
            else if (manager is not null) throw new EmpleadoValidationException("El Manager requiere un Departamento válido");
            var payroll = Integer(payrollValue, "Payroll");
            var employee = await db.Empleados.FindAsync(payroll);
            if (employee is null)
            {
                employee = new Empleado { Payroll = payroll, Estado = true };
                db.Empleados.Add(employee); added++;
            }
            else edited++;
            employee.Full_Name = name;
            employee.User_Name = Text(Get("User_Name")) ?? employee.User_Name;
            employee.Departament = deptName ?? employee.Departament;
            employee.Departamento_Id = dept?.Id ?? employee.Departamento_Id;
            employee.Area = Text(Get("Area")) ?? employee.Area;
            employee.Position = Text(Get("Puesto", "Position")) ?? employee.Position;
            employee.OUnit = Text(Get("OUnit")) ?? employee.OUnit;
            employee.Manager = manager ?? employee.Manager;
            employee.Estado = State(Get("Estado"), employee.Estado);
            if (Get("CC") is { } cc) employee.CC = Integer(cc, "CC");
            employee.Correo = Text(Get("Correo")) ?? employee.Correo;
            EmpleadosService.ValidateLengths(employee);
            processed++;
        }
        var detail = $"Carga masiva desde Excel ({filename}): {added} empleados agregados, {edited} empleados modificados";
        employees.Movement("Empleados-CargaMasiva", "CARGA_MASIVA", detail[..Math.Min(detail.Length, 1000)], null, null, actor);
  
        await db.SaveChangesAsync();
        return processed;
    }
}
