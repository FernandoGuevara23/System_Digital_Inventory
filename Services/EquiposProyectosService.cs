using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;

namespace TRG2._0_VNET.Services;

public sealed class EquipoProyectoException(string message) : Exception(message);

public sealed class EquiposProyectosService(InventarioDbContext db)
{
    private static Dictionary<string, object?> Dto(Equipo e, string? name) => new() {
        ["id"] = e.Service_Tag, ["equipo_id"] = e.Service_Tag,
        ["proyecto_id"] = e.Id_Proyecto, ["nombre_proyecto"] = name
    };

    private Task<Proyecto?> Project(string name)
    {
        var key = name.Trim().ToLowerInvariant();
        return db.Proyectos.AsNoTracking().FirstOrDefaultAsync(p => p.Nombre_Proyecto.Trim().ToLower() == key);
    }

    private async Task<List<Dictionary<string, object?>>> List(IQueryable<Equipo> query)
    {
        var rows = await query.AsNoTracking().Select(e => new { Equipment = e, Name = e.Id_ProyectoNavigation == null ? null : e.Id_ProyectoNavigation.Nombre_Proyecto }).ToListAsync();
        return rows.Select(r => Dto(r.Equipment, r.Name)).ToList();
    }

    public Task<List<Dictionary<string, object?>>> All() => List(db.Equipos.Where(e => e.Id_Proyecto != null));
    public Task<List<Dictionary<string, object?>>> ByEquipment(string tag) => List(db.Equipos.Where(e => e.Service_Tag == tag && e.Id_Proyecto != null && e.Id_Proyecto != 0));
    public async Task<List<Dictionary<string, object?>>> ByProject(string name)
    {
        var project = await Project(name);
        return project == null ? [] : await List(db.Equipos.Where(e => e.Id_Proyecto == project.Id));
    }

    public async Task<Dictionary<string, object?>> Assign(string tag, string name)
    {
        var equipment = await db.Equipos.AsNoTracking().SingleOrDefaultAsync(e => e.Service_Tag == tag)
            ?? throw new EquipoProyectoException("El equipo no existe");
        var project = await Project(name) ?? throw new EquipoProyectoException("El proyecto no existe");
        static void Validate(int? current, int target)
        {
            if (current == target) throw new EquipoProyectoException("El equipo ya está asignado a este proyecto");
            if (current != null) throw new EquipoProyectoException("El equipo ya está asignado a otro proyecto");
        }
        Validate(equipment.Id_Proyecto, project.Id);
  
        var changed = await db.Equipos.Where(e => e.Service_Tag == tag && e.Id_Proyecto == null)
            .ExecuteUpdateAsync(update => update.SetProperty(e => e.Id_Proyecto, project.Id));
        if (changed == 0)
        {
            var current = await db.Equipos.AsNoTracking().SingleOrDefaultAsync(e => e.Service_Tag == tag)
                ?? throw new EquipoProyectoException("El equipo no existe");
            Validate(current.Id_Proyecto, project.Id);
            throw new EquipoProyectoException("No se pudo asignar el equipo al proyecto");
        }
        equipment.Id_Proyecto = project.Id;
        return Dto(equipment, project.Nombre_Proyecto);
    }

    public async Task Remove(string tag, string name)
    {
        var project = await Project(name) ?? throw new EquipoProyectoException("El proyecto no existe");
        var changed = await db.Equipos.Where(e => e.Service_Tag == tag && e.Id_Proyecto == project.Id)
            .ExecuteUpdateAsync(update => update.SetProperty(e => e.Id_Proyecto, (int?)null));
        if (changed == 0) throw new EquipoProyectoException("Asignación equipo-proyecto no encontrada");
    }
}
