 using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;

namespace TRG2._0_VNET.Services;

public enum Catalogo { Departamentos, Tipos, Proyectos }
public sealed record CatalogoResult(int Status, object? Data = null, string? Error = null);

public sealed class CatalogosService(InventarioDbContext db, ILogger<CatalogosService> logger)
{
    private static string Field(Catalogo c) => c switch {
        Catalogo.Departamentos => "Nombre_Departamento", Catalogo.Tipos => "Nombre_Tipo_Equipo", _ => "Nombre_Proyecto" };
    private static string Missing(Catalogo c) => c switch {
        Catalogo.Departamentos => "Departamento no encontrado", Catalogo.Tipos => "Tipo de equipo no encontrado", _ => "Proyecto no encontrado" };
    private static string Duplicate(Catalogo c) => c switch {
        Catalogo.Departamentos => "El nombre del departamento ya existe", Catalogo.Tipos => "El nombre del tipo de equipo ya existe", _ => "El proyecto ya existe" };
    private static string InvalidName(Catalogo c) => c switch {
        Catalogo.Departamentos => "El nombre del departamento es obligatorio y no puede exceder 100 caracteres",
        Catalogo.Tipos => "El nombre del tipo de equipo es obligatorio y no puede exceder 100 caracteres",
        _ => "El nombre del proyecto es obligatorio y no puede exceder 100 caracteres" };
    private static string? Text(JsonElement body, string field) => body.ValueKind == JsonValueKind.Object
        && body.TryGetProperty(field, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    private static bool Has(JsonElement body, string field) => body.ValueKind == JsonValueKind.Object && body.TryGetProperty(field, out _);
    private static string Name(object entity) => entity switch {
        Catalogos_Departamento d => d.Nombre_Departamento, Catalogos_Tipos_Equipo t => t.Nombre_Tipo_Equipo, Proyecto p => p.Nombre_Proyecto,
        _ => throw new ArgumentException("Catálogo desconocido") };
    private static object Dto(object entity) => entity switch {
        Catalogos_Departamento d => new Dictionary<string, object?> { ["Id"] = d.Id, ["Nombre_Departamento"] = d.Nombre_Departamento, ["Manager_Asignado"] = d.Manager_Asignado },
        Catalogos_Tipos_Equipo t => new Dictionary<string, object?> { ["Id"] = t.Id, ["Nombre_Tipo_Equipo"] = t.Nombre_Tipo_Equipo },
        Proyecto p => new Dictionary<string, object?> { ["Id"] = p.Id, ["Nombre_Proyecto"] = p.Nombre_Proyecto },
        _ => throw new ArgumentException("Catálogo desconocido") };

    public async Task<object[]> ListAsync(Catalogo c)
    {
        IEnumerable<object> rows = c switch {
            Catalogo.Departamentos => await db.Catalogos_Departamentos.AsNoTracking().ToListAsync(),
            Catalogo.Tipos => await db.Catalogos_Tipos_Equipos.AsNoTracking().ToListAsync(),
            _ => await db.Proyectos.AsNoTracking().OrderBy(p => p.Nombre_Proyecto).ToListAsync() };
        return rows.Select(Dto).ToArray();
    }

    private async Task<object?> FindAsync(Catalogo c, int id) => c switch {
        Catalogo.Departamentos => await db.Catalogos_Departamentos.FindAsync(id),
        Catalogo.Tipos => await db.Catalogos_Tipos_Equipos.FindAsync(id),
        _ => await db.Proyectos.FindAsync(id) };

    public async Task<CatalogoResult> GetAsync(Catalogo c, int id)
    {
        var entity = await FindAsync(c, id);
        return entity is null ? new(404, Error: Missing(c)) : new(200, Dto(entity));
    }

    private Task<bool> ExistsAsync(Catalogo c, string name, int? exceptId = null) => c switch {
        Catalogo.Departamentos => db.Catalogos_Departamentos.AnyAsync(x => x.Nombre_Departamento == name && (!exceptId.HasValue || x.Id != exceptId)),
        Catalogo.Tipos => db.Catalogos_Tipos_Equipos.AnyAsync(x => x.Nombre_Tipo_Equipo == name && (!exceptId.HasValue || x.Id != exceptId)),
        _ => db.Proyectos.AnyAsync(x => x.Nombre_Proyecto == name && (!exceptId.HasValue || x.Id != exceptId)) };

    public async Task<CatalogoResult> CreateAsync(Catalogo c, JsonElement body)
    {
        var name = Text(body, Field(c));
        var manager = Text(body, "Manager_Asignado");
        if (c == Catalogo.Departamentos && (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(manager)))
            return new(400, Error: "Se requieren Nombre_Departamento y Manager_Asignado");
        if (c == Catalogo.Tipos && string.IsNullOrEmpty(name)) return new(400, Error: "Se requiere Nombre_Tipo_Equipo");
        if (c == Catalogo.Proyectos) name = (name ?? "").Trim();
        if (name!.Length > 100) return new(400, Error: InvalidName(c));
        if (c == Catalogo.Departamentos && manager!.Length > 50)
            return new(400, Error: "El manager asignado es obligatorio y no puede exceder 50 caracteres");
        if (await ExistsAsync(c, name)) return new(400, Error: Duplicate(c));
        object entity = c switch {
            Catalogo.Departamentos => new Catalogos_Departamento { Nombre_Departamento = name, Manager_Asignado = manager! },
            Catalogo.Tipos => new Catalogos_Tipos_Equipo { Nombre_Tipo_Equipo = name },
            _ => new Proyecto { Nombre_Proyecto = name } };
        db.Add(entity);
        return await SaveAsync(entity, 201, 400);
    }

    public async Task<CatalogoResult> UpdateAsync(Catalogo c, int id, JsonElement body)
    {
        if (c != Catalogo.Proyectos && (body.ValueKind != JsonValueKind.Object || !body.EnumerateObject().Any()))
            return new(400, Error: "No se proporcionaron datos para actualizar");
        var entity = await FindAsync(c, id);
        if (entity is null) return new(400, Error: Missing(c));
        var oldName = Name(entity);
        var name = (Has(body, Field(c)) || c == Catalogo.Proyectos ? Text(body, Field(c)) ?? "" : oldName).Trim();
        if (name.Length is 0 or > 100) return new(400, Error: InvalidName(c));
        if (await ExistsAsync(c, name, id)) return new(400, Error: Duplicate(c));
        if (entity is Catalogos_Departamento department)
        {
            var manager = (Has(body, "Manager_Asignado") ? Text(body, "Manager_Asignado") ?? "" : department.Manager_Asignado).Trim();
            if (manager.Length is 0 or > 50) return new(400, Error: "El manager asignado es obligatorio y no puede exceder 50 caracteres");
            var normalized = oldName.Trim().ToLowerInvariant();
            var employees = await db.Empleados.Where(x => x.Departamento_Id == id ||
                (x.Departamento_Id == null && x.Departament != null && x.Departament.Trim().ToLower() == normalized)).ToListAsync();
            department.Nombre_Departamento = name;
            department.Manager_Asignado = manager;
            foreach (var employee in employees)
            {
                employee.Departament = name; employee.Departamento_Id = id; employee.Manager = manager;
            }
        }
        else if (entity is Catalogos_Tipos_Equipo type)
        {
            var normalized = oldName.Trim().ToLowerInvariant();
            var equipment = await db.Equipos.Where(x => x.Tipo_Equipo_Id == id ||
                (x.Tipo_Equipo_Id == null && x.Tipo_Equipo.Trim().ToLower() == normalized)).ToListAsync();
            type.Nombre_Tipo_Equipo = name;
            foreach (var item in equipment) { item.Tipo_Equipo = name; item.Tipo_Equipo_Id = id; }
        }
        else ((Proyecto)entity).Nombre_Proyecto = name;
      
        return await SaveAsync(entity, 200, 400);
    }

    public async Task<CatalogoResult> DeleteAsync(Catalogo c, int id)
    {
        var entity = await FindAsync(c, id);
        var failureStatus = c == Catalogo.Departamentos ? 400 : 404;
        if (entity is null) return new(failureStatus, Error: Missing(c));
        if (c == Catalogo.Proyectos)
        {
            if (await db.Equipos.AnyAsync(x => x.Id_Proyecto == id))
                return new(409, Error: "No se puede eliminar un proyecto con equipos asignados");
            failureStatus = 409;
        }
        else if (c == Catalogo.Departamentos)
        {
          
            foreach (var employee in await db.Empleados.Where(x => x.Departamento_Id == id).ToListAsync())
                employee.Departamento_Id = null;
        }
        else
        {
            foreach (var item in await db.Equipos.Where(x => x.Tipo_Equipo_Id == id).ToListAsync())
                item.Tipo_Equipo_Id = null;
        }
        db.Remove(entity);
        return await SaveAsync(null, 200, failureStatus);
    }

    private async Task<CatalogoResult> SaveAsync(object? entity, int success, int failure)
    {
        try
        {
            await db.SaveChangesAsync();
            return new(success, entity is null ? null : Dto(entity));
        }
        catch (DbUpdateException error)
        {
            logger.LogWarning(error, "No se pudo guardar el catálogo; se revierte la operación.");
            db.ChangeTracker.Clear();
            return new(failure, Error: "No se pudo guardar el catálogo. Comprueba nombres duplicados, referencias y límites de los campos.");
        }
    }
}
