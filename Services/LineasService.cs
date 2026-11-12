using System.Globalization;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;
namespace TRG2._0_VNET.Services;

public sealed class LineasService(InventarioDbContext db, EquiposService equipment)
{
    private static readonly string[] Outside = ["inactivo", "scrap", "donacion", "donación", "donado", "reciclado", "liberado", "produccion", "producción", "venta", "ventas"];
    private const string NotFound = "No se encontró ninguna línea telefónica con el Service Tag especificado.";
    internal static bool InInventory(Equipo? e) => e != null && !Outside.Contains(e.Estado.Trim().ToLowerInvariant());
    private static bool Complete(Telefono? p) => p != null && !string.IsNullOrWhiteSpace(p.Service_Tag) && !string.IsNullOrWhiteSpace(p.Account) && !string.IsNullOrWhiteSpace(p.Numero_Telefono) && p.Total_cuenta != null;
    private static bool HasData(Telefono? p) => p != null && (new[] { p.Numero_Telefono, p.Account, p.Apple_ID, p.Password_apple }.Any(x => !string.IsNullOrWhiteSpace(x)) || p.Total_cuenta != null);
    internal static decimal Total(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) throw new EquipoValidationException("El total de cuenta es obligatorio.");
        if (new[] { "nan", "snan", "infinity", "+infinity", "-infinity", "inf", "+inf", "-inf" }.Contains(raw.Trim().ToLowerInvariant())) throw new EquipoValidationException("El total de cuenta debe ser un importe finito.");
        if (!decimal.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var value)) throw new EquipoValidationException("El total de cuenta debe ser un importe numérico válido.");
        if (value < 0) throw new EquipoValidationException("El total de cuenta no puede ser negativo.");
        if (value > 9999999999.99m) throw new EquipoValidationException("El total de cuenta no puede exceder 9,999,999,999.99.");
        if (decimal.Round(value, 2) != value) throw new EquipoValidationException("El total de cuenta no puede tener más de dos decimales.");
        return value;
    }
    internal async Task<string> NormalizePhone(string value, string? except = null)
    {
        var digits = new string(value.Where(c => c >= '0' && c <= '9').ToArray());
        if (digits.Length != 10) throw new EquipoValidationException("El número de teléfono debe tener exactamente 10 dígitos.");
        return await equipment.PhoneNumber(digits, except);
    }
    private async Task ValidateUniqueAccount(string account, string exceptTag)
    {
        var key = account.Trim().ToLowerInvariant();
        if (await db.Telefonos.AnyAsync(x => x.Service_Tag != exceptTag && x.Account != null && x.Account.Trim().ToLower() == key))
            throw new EquipoValidationException($"La cuenta '{account.Trim()}' ya está registrada en otra línea.", 409);
    }
    private IQueryable<Equipo> Phones() => equipment.Query.Where(e => e.Tipo_Equipo.Trim().ToLower().Contains("telefono") || e.Tipo_Equipo.Trim().ToLower().Contains("teléfono") || e.Tipo_Equipo.Trim().ToLower().Contains("celular") || e.Tipo_Equipo.Trim().ToLower().Contains("smartphone") || e.Tipo_Equipo.Trim().ToLower().Contains("iphone"));
    public async Task<object> Dto(string tag)
    {
        var p = await db.Telefonos.AsNoTracking().SingleAsync(x => x.Service_Tag == tag);
        var e = await equipment.Query.AsNoTracking().FirstOrDefaultAsync(x => x.Service_Tag == tag);
        return Dto(p, e);
    }
    private static object Dto(Telefono p, Equipo? e)
    {
        var active = InInventory(e); var state = p.Estado.Trim();
        return new Dictionary<string, object?> { ["Service_Tag"] = p.Service_Tag, ["Numero_Telefono"] = p.Numero_Telefono, ["Account"] = p.Account, ["Total_cuenta"] = p.Total_cuenta,
            ["Estado"] = !active ? "Sin equipo" : state.Equals("sin equipo", StringComparison.OrdinalIgnoreCase) ? "Suspendida" : state == "" ? "Activa" : state,
            ["Estado_Linea"] = new[] { "suspendida", "sin equipo" }.Contains(state.ToLowerInvariant()) ? "Suspendida" : "Activa",
            ["Usuario"] = active ? e?.PayrollNavigation?.Full_Name : null, ["Payroll"] = active ? e?.Payroll : null,
            ["CC"] = active ? e?.PayrollNavigation?.CC : null, ["Equipo_En_Inventario"] = active };
    }
    public async Task<object[]> List(string? search = null)
    {
        var phones = Phones();
        var query = db.Telefonos.AsNoTracking().Where(p => p.Account != null && p.Account.Trim() != "" && p.Numero_Telefono != null && p.Numero_Telefono.Trim() != "" && p.Total_cuenta != null && (!db.Equipos.Any(e => e.Service_Tag == p.Service_Tag) || phones.Any(e => e.Service_Tag == p.Service_Tag)));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = "%" + search.Trim().ToLowerInvariant() + "%";
            query = query.Where(p => EF.Functions.Like(p.Service_Tag.ToLower(), pattern) || EF.Functions.Like(p.Numero_Telefono!.ToLower(), pattern) || EF.Functions.Like(p.Account!.ToLower(), pattern) || db.Equipos.Any(e => e.Service_Tag == p.Service_Tag && e.PayrollNavigation != null && (EF.Functions.Like(e.PayrollNavigation.Full_Name!.ToLower(), pattern) || EF.Functions.Like(e.PayrollNavigation.Payroll.ToString(), pattern))));
        }
        if (search != null) query = query.OrderBy(p => p.Service_Tag).Take(20);
        var rows = await query.ToListAsync(); var tags = rows.Select(x => x.Service_Tag).ToArray();
        var devices = await equipment.Query.AsNoTracking().Where(e => tags.Contains(e.Service_Tag)).ToDictionaryAsync(e => e.Service_Tag);
        return rows.Select(p => Dto(p, devices.GetValueOrDefault(p.Service_Tag))).ToArray();
    }
    public async Task<object[]> Available()
    {
        var rows = await Phones().AsNoTracking().Where(e => !Outside.Contains(e.Estado.Trim().ToLower())).OrderBy(e => e.Service_Tag).ToListAsync();
        var tags = rows.Select(e => e.Service_Tag).ToArray(); var phones = await db.Telefonos.AsNoTracking().Where(p => tags.Contains(p.Service_Tag)).ToDictionaryAsync(p => p.Service_Tag);
        return rows.Select(e => { var p = phones.GetValueOrDefault(e.Service_Tag); var person = e.PayrollNavigation; var complete = Complete(p);
            return (object)new Dictionary<string, object?> { ["Service_Tag"] = e.Service_Tag, ["Tipo_Equipo"] = e.Tipo_Equipo, ["Marca"] = e.Marca, ["Modelo"] = e.Modelo, ["Usuario"] = person?.Full_Name, ["Payroll"] = e.Payroll, ["CC"] = person?.CC, ["Tiene_Linea"] = complete, ["Tiene_Datos_Linea"] = HasData(p), ["Puede_Registrar_Linea"] = !complete && person is { Estado: true, CC: not null }, ["Motivo_No_Registrable"] = complete ? "El equipo ya tiene una línea telefónica." : person == null ? "El equipo no tiene un empleado asignado." : !person.Estado ? "El empleado asignado está inactivo." : person.CC == null ? "El empleado asignado no tiene CC." : null }; }).ToArray();
    }
    public async Task Get(string tag)
    {
        var p = await db.Telefonos.FindAsync(tag); var e = await db.Equipos.FindAsync(tag);
        if (p == null || e != null && !EquiposService.PhoneType(e.Tipo_Equipo)) throw new EquipoValidationException(NotFound, 404);
    }
    public async Task Create(string tag, string account, string number, string? total, string? actor)
    {
        var amount = Total(total);
        if (string.IsNullOrWhiteSpace(tag) || string.IsNullOrWhiteSpace(account) || string.IsNullOrWhiteSpace(number)) throw new EquipoValidationException("Para registrar una línea se requieren Service Tag, Account, número de teléfono y total de cuenta.");
        var e = await db.Equipos.FindAsync(tag) ?? throw new EquipoValidationException("El Service Tag especificado no existe en los equipos.");
        if (!EquiposService.PhoneType(e.Tipo_Equipo)) throw new EquipoValidationException("El equipo indicado no es un teléfono.");
        if (!InInventory(e)) throw new EquipoValidationException("No se puede registrar una línea en un equipo fuera de servicio.");
        await equipment.CheckCc(e.Payroll); number = await NormalizePhone(number, tag);
        var p = await db.Telefonos.FindAsync(tag);
        if (Complete(p)) throw new EquipoValidationException("Este equipo ya tiene una línea telefónica asociada.");
        await ValidateUniqueAccount(account, tag);
        if (p == null) { p = new Telefono { Service_Tag = tag, Estado = "Activa" }; db.Telefonos.Add(p); }
        p.Numero_Telefono = number; p.Account = account.Trim(); p.Total_cuenta = amount; equipment.ValidateLengths(p);
        equipment.Movement(e, "CREACION", $"Línea creada para equipo {tag}: {account}", null, e.Payroll, actor);
        await db.SaveChangesAsync();
    }
    public async Task<string> Update(string tag, string? target, string? account, string? number, string? total, string? state, string? actor)
    {
        var source = await db.Telefonos.FindAsync(tag) ?? throw new EquipoValidationException(NotFound, 404);
        target = (string.IsNullOrEmpty(target) ? tag : target).Trim();
        if (target == "") throw new EquipoValidationException("Selecciona un equipo destino para la línea.");
        var e = await db.Equipos.FindAsync(target) ?? throw new EquipoValidationException("El equipo destino no existe.");
        if (!EquiposService.PhoneType(e.Tipo_Equipo)) throw new EquipoValidationException("El equipo destino no es un teléfono.");
        if (!InInventory(e)) throw new EquipoValidationException("El equipo destino está fuera de servicio.");
        await equipment.CheckCc(e.Payroll); var amount = Total(total);
        if (string.IsNullOrWhiteSpace(account) || string.IsNullOrWhiteSpace(number)) throw new EquipoValidationException("La línea debe conservar Service Tag, Account, número de teléfono y total de cuenta.");
        number = await NormalizePhone(number, tag);
        await ValidateUniqueAccount(account, tag);
        var normalized = (state ?? (string.IsNullOrEmpty(source.Estado) ? "Activa" : source.Estado)).Trim();
        if (normalized == "Sin equipo" && state == null) normalized = "Suspendida";
        if (normalized != "Activa" && normalized != "Suspendida") throw new EquipoValidationException("El estado debe ser Activa o Suspendida. 'Sin equipo' se determina automáticamente.");
        var destination = source;
        await using var transaction = await db.Database.BeginTransactionAsync();
        if (target != tag)
        {
            destination = await db.Telefonos.FindAsync(target);
            if (HasData(destination)) throw new EquipoValidationException("El Service Tag destino ya tiene una línea asociada.");
          
            var apple = source.Apple_ID; var password = source.Password_apple;
            db.Telefonos.Remove(source); await db.SaveChangesAsync();
            if (destination == null) { destination = new Telefono { Service_Tag = target, Apple_ID = apple, Password_apple = password, Estado = normalized }; db.Telefonos.Add(destination); }
        }
        destination!.Numero_Telefono = number; destination.Account = account.Trim(); destination.Total_cuenta = amount; destination.Estado = normalized;
        equipment.ValidateLengths(destination);
        equipment.Movement(e, "ACTUALIZACION", $"Línea modificada para equipo {target}: {account}", e.Payroll, e.Payroll, actor);
        await db.SaveChangesAsync(); await transaction.CommitAsync(); return target;
    }
    public async Task Transfer(string origin, string target, string? actor)
    {
        var source = await db.Telefonos.FindAsync(origin);
        if (!Complete(source)) throw new EquipoValidationException("La línea origen no existe o está incompleta.");
        var e = await db.Equipos.FindAsync(target) ?? throw new EquipoValidationException("El equipo destino no existe.");
        if (origin == target) throw new EquipoValidationException("No puedes transferir la línea al mismo equipo.");
        if (!InInventory(e)) throw new EquipoValidationException("El equipo destino está fuera de servicio.");
        if (!EquiposService.PhoneType(e.Tipo_Equipo)) throw new EquipoValidationException("El equipo destino no es un teléfono.");
        await equipment.CheckCc(e.Payroll);
        var destination = await db.Telefonos.FindAsync(target);
        if (HasData(destination)) throw new EquipoValidationException("El equipo destino ya tiene una línea telefónica asociada.");
        var number = await NormalizePhone(source!.Numero_Telefono!, origin);
        var account = source.Account!.Trim(); var amount = source.Total_cuenta; var apple = source.Apple_ID; var password = source.Password_apple; var state = source.Estado;
        await ValidateUniqueAccount(account, origin);
        await using var transaction = await db.Database.BeginTransactionAsync();
        source.Numero_Telefono = null; source.Account = null; source.Total_cuenta = null; source.Apple_ID = null; source.Password_apple = null; source.Estado = "Suspendida";
        await db.SaveChangesAsync();
        if (destination == null) { destination = new Telefono { Service_Tag = target }; db.Telefonos.Add(destination); }
        destination.Numero_Telefono = number; destination.Account = account; destination.Total_cuenta = amount; destination.Apple_ID = apple; destination.Password_apple = password; destination.Estado = state;
        var original = await db.Equipos.FindAsync(origin); actor = string.IsNullOrEmpty(actor) ? "Sistema" : actor.Trim();
        equipment.Movement(original ?? new Equipo { Service_Tag = origin }, "Cambio de línea", $"{actor}: Información telefónica transferida desde este equipo hacia {target}. La asignación del equipo no cambió.", original?.Payroll, original?.Payroll, actor);
        equipment.Movement(e, "Cambio de línea", $"{actor}: Información telefónica recibida desde {origin}. La asignación del equipo no cambió.", e.Payroll, e.Payroll, actor);
        await db.SaveChangesAsync(); await transaction.CommitAsync();
    }
    public async Task Delete(string tag, string? actor)
    {
        var p = await db.Telefonos.FindAsync(tag); var e = await db.Equipos.FindAsync(tag);
        if (!Complete(p) || e != null && !EquiposService.PhoneType(e.Tipo_Equipo)) throw new EquipoValidationException(NotFound, 404);
        equipment.Movement(e ?? new Equipo { Service_Tag = tag }, "ELIMINACION_LINEA", $"Línea eliminada del equipo {tag}", e?.Payroll, null, string.IsNullOrEmpty(actor) ? "Sistema" : actor);
        db.Telefonos.Remove(p!); await db.SaveChangesAsync();
    }
}


