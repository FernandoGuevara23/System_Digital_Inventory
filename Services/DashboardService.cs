using System.Globalization;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;

namespace TRG2._0_VNET.Services;

public sealed class DashboardService(InventarioDbContext db)
{
    private static readonly string[] OutsideInventory = ["inactivo", "scrap", "donacion", "donación", "donado", "reciclado", "liberado", "produccion", "producción", "venta", "ventas"];


    private static Task<int> Pending<T>(IQueryable<T> source, string sent, string completed) where T : class
    {
        var events = source.Where(x => EF.Property<string>(x, "Accion") == sent || EF.Property<string>(x, "Accion") == completed);
        return events.CountAsync(x => EF.Property<string>(x, "Accion") == sent
            && EF.Property<DateTime?>(x, "Fecha_Liberacion") == null
            && !events.Any(y => EF.Property<string>(y, "Service_Tag") == EF.Property<string>(x, "Service_Tag")
                && (EF.Property<DateTime>(y, "Fecha") > EF.Property<DateTime>(x, "Fecha")
                    || (EF.Property<DateTime>(y, "Fecha") == EF.Property<DateTime>(x, "Fecha") && EF.Property<int>(y, "id") > EF.Property<int>(x, "id")))));
    }

    public async Task<object> Summary()
    {
        var inventory = db.Equipos.AsNoTracking().Where(e => e.Estado != null && e.Estado.Trim().ToLower() != "inactivo"
            && !db.Equipos_liberados.Any(l => l.Service_Tag == e.Service_Tag));
        var equipmentTotal = await inventory.CountAsync();
        var assigned = await inventory.CountAsync(e => e.Payroll != null && db.Empleados.Any(p => p.Payroll == e.Payroll));
        var employeesTotal = await db.Empleados.CountAsync();
        var activeEmployees = await db.Empleados.CountAsync(e => e.Estado == true);
        var lines = from line in db.Telefonos.AsNoTracking()
                    join equipment in db.Equipos on line.Service_Tag equals equipment.Service_Tag into matches
                    from equipment in matches.DefaultIfEmpty()
                    where line.Account != null && line.Account.Trim() != ""
                        && line.Numero_Telefono != null && line.Numero_Telefono.Trim() != "" && line.Total_cuenta != null
                        && (equipment == null || (equipment.Tipo_Equipo != null && (
                            equipment.Tipo_Equipo.Trim().ToLower().Contains("telefono") || equipment.Tipo_Equipo.Trim().ToLower().Contains("teléfono")
                            || equipment.Tipo_Equipo.Trim().ToLower().Contains("teléfonos") || equipment.Tipo_Equipo.Trim().ToLower().Contains("celular")
                            || equipment.Tipo_Equipo.Trim().ToLower().Contains("smartphone") || equipment.Tipo_Equipo.Trim().ToLower().Contains("iphone"))))
                    select new { line, equipment };
        var totalLines = await lines.CountAsync();
        var activeLines = await lines.CountAsync(x => x.equipment != null && x.equipment.Estado != null
            && !OutsideInventory.Contains(x.equipment.Estado.Trim().ToLower())
            && (x.line.Estado == null || x.line.Estado.Trim() == "" || x.line.Estado == "Activa"));
        var scrap = await Pending(db.Scraps, "ENVIO_A_SCRAP", "ENVIADO_A_RECICLADORA");
        var donations = await Pending(db.Donaciones, "ENVIO_A_DONACION", "ENVIADO_A_DONACION");
        var production = await Pending(db.Produccions, "ENVIO_A_PRODUCCION", "ENVIADO_A_PRODUCCION");
        var sales = await Pending(db.Ventas, "ENVIO_A_VENTA", "ENVIADO_A_VENTA");
        var movements = await db.Movimientos_Equipos.AsNoTracking().OrderByDescending(x => x.Fecha).ThenByDescending(x => x.Id).Take(5).ToListAsync();
        return new {
            empleados = new { total = employeesTotal, activos = activeEmployees },
            equipos = new { inventario = equipmentTotal, asignados = assigned },
            lineas = new { total = totalLines, activas = activeLines },
            pendientes = new { scrap, donaciones = donations, produccion = production, ventas = sales },
            movimientos = movements.Select(x => new Dictionary<string, object?> {
                ["Id"] = x.Id, ["Service_Tag"] = x.Service_Tag, ["Accion"] = x.Accion, ["Hostname"] = x.Hostname,
                ["Detalle"] = x.Detalle, ["Payroll_Anterior"] = x.Payroll_Anterior, ["Payroll_Nuevo"] = x.Payroll_Nuevo,
                ["Usuario"] = x.Usuario, ["Fecha"] = x.Fecha.ToString(x.Fecha.Ticks % TimeSpan.TicksPerSecond == 0 ? "yyyy-MM-ddTHH:mm:ss" : "yyyy-MM-ddTHH:mm:ss.ffffff", CultureInfo.InvariantCulture)
            })
        };
    }
}
