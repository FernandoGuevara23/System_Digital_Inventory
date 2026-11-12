using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Services;

namespace TRG2._0_VNET.Controllers;

[ApiController]
[Route("api/equipos")]
public sealed class EquiposController(InventarioDbContext db, EquiposService service, EquiposExcel excel, ILogger<EquiposController> logger) : ControllerBase
{
    private IActionResult Error(int status, string error) => StatusCode(status, new { success = false, error });
    [HttpGet("plantilla-excel")]
    public IActionResult Template() => File(EquiposExcel.Template(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "plantilla_equipos.xlsx");
    [HttpPost("cargar-excel")]
    public async Task<IActionResult> Import()
    {
        if (!Request.HasFormContentType) return Error(400, "No se proporcionó ningún archivo");
        try
        {
            var form = await Request.ReadFormAsync(); var file = form.Files.GetFile("archivo");
            if (file == null) return Error(400, "No se proporcionó ningún archivo");
            if (file.FileName == "") return Error(400, "No se seleccionó ningún archivo");
            await using var stream = new MemoryStream(); await file.CopyToAsync(stream, HttpContext.RequestAborted); stream.Position = 0;
            var count = await excel.Import(stream, User.FindFirstValue(ClaimTypes.Name));
            return Ok(new { success = true, message = $"Se procesaron {count} equipos desde el archivo Excel" });
        }
        catch (EquipoValidationException e) { return Error(400, e.Message); }
        catch (Exception e) when (e is not OperationCanceledException)
        { logger.LogWarning(e, "Falló importación Excel de equipos"); return Error(400, "Error al procesar Excel: comprueba el archivo, duplicados, referencias y límites de campos."); }
    }
    [HttpGet("total")]
    public async Task<IActionResult> Total() => Ok(new { success = true, total_equipos = await db.Equipos.CountAsync() });
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var query = service.Query.AsNoTracking().Where(x => !db.Equipos_liberados.Any(l => l.Service_Tag == x.Service_Tag));
        var qs = Request.Query;
        if (!new[] { "page", "page_size", "q", "view", "category", "carta_filter" }.Any(qs.ContainsKey))
        { var all = await service.Dtos(await query.ToListAsync()); return Ok(new { success = true, data = all, total = all.Length }); }
        string Param(string key, string fallback = "") => qs.ContainsKey(key) ? qs[key].ToString() : fallback;
        if (!int.TryParse(Param("page", "1"), out var page) || !int.TryParse(Param("page_size", "25"), out var size)) return Error(400, "La página y el tamaño de página deben ser números enteros.");
        if (page < 1 || size < 1 || size > 100) return Error(400, "La página debe ser positiva y el tamaño debe estar entre 1 y 100.");
        var search = Param("q").Trim(); var view = Param("view", "todos").Trim().ToLowerInvariant(); var category = Param("category").Trim(); var card = Param("carta_filter", "TODOS").Trim().ToUpperInvariant();
        if (search.Length > 100) return Error(400, "La búsqueda no puede exceder 100 caracteres.");
        if (!new[] { "todos", "disponibles", "asignados", "proyectos" }.Contains(view)) return Error(400, "El filtro de inventario no es válido.");
        if (!new[] { "TODOS", "INDIVIDUAL", "COMPARTIDA", "SIN_ENVIAR" }.Contains(card)) return Error(400, "El filtro de carta no es válido.");
        if (category.Length > 50) return Error(400, "La categoría no puede exceder 50 caracteres.");
        var active = query.Where(x => x.Estado.Trim().ToLower() != "inactivo");
        var counts = new { registros = await query.CountAsync(), total = await active.CountAsync(), disponibles = await active.CountAsync(x => x.PayrollNavigation == null), asignados = await active.CountAsync(x => x.Payroll != null && x.PayrollNavigation != null), con_proyecto = await active.CountAsync(x => x.Id_ProyectoNavigation != null && x.Id_ProyectoNavigation.Nombre_Proyecto.Trim() != "") };
        query = active;
        if (view == "disponibles") query = query.Where(x => x.PayrollNavigation == null);
        if (view == "asignados") query = query.Where(x => x.Payroll != null && x.PayrollNavigation != null);
        if (view == "proyectos") query = query.Where(x => x.Id_ProyectoNavigation != null && x.Id_ProyectoNavigation.Nombre_Proyecto.Trim() != "");
        if (category.Length > 0)
        {
            category = new string(category.Normalize(NormalizationForm.FormD).Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray()).ToLowerInvariant();
            query = query.Where(x => x.Tipo_Equipo.Trim().ToLower().Replace("á", "a").Replace("é", "e").Replace("í", "i").Replace("ó", "o").Replace("ú", "u").Replace("ü", "u").Replace("ñ", "n") == category);
        }
        if (search.Length > 0)
        {
            var pattern = "%" + search.ToLowerInvariant() + "%";
            query = query.Where(x => EF.Functions.Like(x.Service_Tag.ToLower(), pattern) || EF.Functions.Like(x.Hostname!.ToLower(), pattern) || EF.Functions.Like(x.MAC!.ToLower(), pattern) || EF.Functions.Like(x.Estado.ToLower(), pattern) || EF.Functions.Like(x.Trace!.ToLower(), pattern) || EF.Functions.Like(x.Payroll.ToString()!, pattern) || (x.PayrollNavigation != null && (EF.Functions.Like(x.PayrollNavigation.Full_Name!.ToLower(), pattern) || EF.Functions.Like(x.PayrollNavigation.Payroll.ToString(), pattern))));
        }
        if (card != "TODOS") query = query.Where(x => db.cartas_responsivas.Any(c => c.service_tag == x.Service_Tag && c.id == db.cartas_responsivas.Where(t => t.service_tag == x.Service_Tag).Max(t => (int?)t.id) && (card == "SIN_ENVIAR" ? c.estado == card : c.tipo_carta == card)));
        var total = await query.CountAsync(); var pages = (int)Math.Ceiling(total / (double)size); page = Math.Min(page, Math.Max(pages, 1));
        var data = await service.Dtos(await query.OrderBy(x => x.Service_Tag).Skip((page - 1) * size).Take(size).ToListAsync());
        return Ok(new { success = true, data, total, pagination = new { page, page_size = size, total, total_pages = pages }, counts });
    }
    [HttpGet("ultimo-service-tag")]
    public async Task<IActionResult> Last()
    {
        var records = await db.Equipos.Select(x => new { tag = x.Service_Tag, date = x.Fecha_Creacion }).ToListAsync();
        records.AddRange(await db.Movimientos_Equipos.Where(x => x.Accion == "CREACION" && EF.Functions.Like(x.Detalle.ToLower(), "equipo agregado%")).Select(x => new { tag = x.Service_Tag, date = x.Fecha }).ToListAsync());
        return Ok(new { success = true, data = new Dictionary<string, object?> { ["Service_Tag"] = records.OrderByDescending(x => x.date).FirstOrDefault()?.tag } });
    }
    [HttpGet("{tag}")]
    public async Task<IActionResult> Get(string tag)
    {
        var rows = await service.Dtos(await service.Query.AsNoTracking().Where(x => x.Service_Tag == tag).ToListAsync());
        return rows.Length == 0 ? Error(404, "Equipo no encontrado") : Ok(new { success = true, data = rows[0] });
    }
    [HttpGet("buscar/{name}")]
    public async Task<IActionResult> Search(string name) => Ok(new { success = true, data = await service.Dtos(await service.Query.AsNoTracking().Where(x => x.PayrollNavigation != null && EF.Functions.Like(x.PayrollNavigation.Full_Name!.ToLower(), "%" + name.ToLower() + "%")).ToListAsync()) });
    [HttpGet("historial")]
    [HttpGet("{tag}/historial")]
    public async Task<IActionResult> History(string? tag = null)
    {
        if (!int.TryParse(Request.Query["page"].FirstOrDefault() ?? "1", out var page)
            || !int.TryParse(Request.Query["page_size"].FirstOrDefault() ?? "1000", out var pageSize)
            || page < 1 || pageSize < 1 || pageSize > 1000)
            return Error(400, "La página debe ser positiva y el tamaño de página debe estar entre 1 y 1,000.");

        var query = db.Movimientos_Equipos.AsNoTracking().Where(x => tag == null || x.Service_Tag == tag);
        var search = Request.Query["q"].FirstOrDefault()?.Trim().ToLowerInvariant() ?? "";
        if (search.Length > 0)
        {
            query = query.Where(x => x.Service_Tag.ToLower().Contains(search)
                || x.Accion.ToLower().Contains(search)
                || x.Detalle.ToLower().Contains(search)
                || (x.Usuario != null && x.Usuario.ToLower().Contains(search))
                || x.Id.ToString().Contains(search));
        }

        var module = Request.Query["module"].FirstOrDefault()?.Trim().ToLowerInvariant() ?? "";
        if (module != "" && module != "todos")
        {
            query = module switch
            {
                "cartas responsivas" => query.Where(x => x.Accion.ToLower().StartsWith("carta_") || x.Service_Tag.ToUpper().StartsWith("CARTA-") || x.Detalle.ToLower().Contains("carta responsiva")),
                "scrap" => query.Where(x => x.Accion.ToLower().Contains("scrap") || x.Accion.ToLower().Contains("recicladora") || x.Service_Tag.ToUpper().StartsWith("SCRAP-") || x.Detalle.ToLower().Contains("scrap")),
                "donaciones" => query.Where(x => x.Accion.ToLower().Contains("donacion") || x.Service_Tag.ToUpper().StartsWith("DONACION-") || x.Detalle.ToLower().Contains("donacion")),
                "producción" or "produccion" => query.Where(x => x.Accion.ToLower().Contains("produccion") || x.Service_Tag.ToUpper().StartsWith("PRODUCCION-") || x.Detalle.ToLower().Contains("produccion")),
                "ventas" => query.Where(x => x.Accion.ToLower().Contains("venta") || x.Service_Tag.ToUpper().StartsWith("VENTA-") || x.Detalle.ToLower().Contains("venta")),
                "líneas" or "lineas" => query.Where(x => x.Accion.ToLower().Contains("linea") || x.Service_Tag.ToUpper().StartsWith("LINEA-") || x.Detalle.ToLower().Contains("linea")),
                "empleados" => query.Where(x => x.Service_Tag.ToUpper().StartsWith("EMPLEADO-") || x.Detalle.ToLower().Contains("empleado")),
                _ => query
            };
        }

        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(x => x.Fecha).ThenByDescending(x => x.Id)
            .Skip((int)Math.Min((long)(page - 1) * pageSize, int.MaxValue)).Take(pageSize).ToListAsync();
        var data = rows.Select(x => new Dictionary<string, object?> { ["Id"] = x.Id, ["Service_Tag"] = x.Service_Tag, ["Accion"] = x.Accion, ["Hostname"] = x.Hostname, ["Detalle"] = x.Detalle, ["Payroll_Anterior"] = x.Payroll_Anterior, ["Payroll_Nuevo"] = x.Payroll_Nuevo, ["Usuario"] = x.Usuario, ["Fecha"] = x.Fecha.ToString("yyyy-MM-ddTHH:mm:ss.ffffff", CultureInfo.InvariantCulture) });
        return Ok(new { success = true, data, pagination = new { page, page_size = pageSize, total, total_pages = (int)Math.Ceiling(total / (double)pageSize) } });
    }
    [HttpGet("historial/exportar")]
    public async Task<IActionResult> ExportHistory() => File(await excel.ExportHistory(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "historial_general.xlsx");
    private async Task<IActionResult> Write(Func<Task<string>> action, string? message = null, int status = 200)
    {
        try { var tag = await action(); db.ChangeTracker.Clear(); var rows = await service.Dtos(await service.Query.AsNoTracking().Where(x => x.Service_Tag == tag).ToListAsync()); return message == null ? StatusCode(status, new { success = true, data = rows.FirstOrDefault() }) : StatusCode(status, new { success = true, message, data = rows.FirstOrDefault() }); }
        catch (EquipoValidationException e) { return Error(e.Status, e.Message); }
        catch (DbUpdateException e) { logger.LogWarning(e, "No se pudo guardar equipo"); return Error(400, "No se pudo guardar el equipo. Comprueba duplicados, referencias y límites de campos."); }
    }
    [HttpPost]
    public Task<IActionResult> Create([FromBody] Dictionary<string, JsonElement> data) => Write(() => service.Create(data, User.FindFirstValue(ClaimTypes.Name)), status: 201);
    [HttpPut("{tag}")]
    public Task<IActionResult> Update(string tag, [FromBody] Dictionary<string, JsonElement> data) => Write(async () => {
        if (data.Count == 0) throw new EquipoValidationException("No se proporcionaron datos para actualizar");
        data.Remove("UserName"); data.Remove("Usuario"); await service.Update(tag, data, User.FindFirstValue(ClaimTypes.Name)); return tag;
    }, "Equipo actualizado exitosamente");
    [HttpPut("{tag}/reasignar")]
    public Task<IActionResult> Reassign(string tag, [FromBody] Dictionary<string, JsonElement> data) => Write(async () => {
        var raw = EquiposService.Value(data, "Payroll");
        if (string.IsNullOrEmpty(raw)) throw new EquipoValidationException("Se requiere el Payroll destino");
        if (!int.TryParse(raw, out var payroll)) throw new EquipoValidationException("El Payroll destino no es válido");
        var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var actor = (await db.Administradors.FindAsync(id))?.UserName;
        if (string.IsNullOrWhiteSpace(actor)) throw new EquipoValidationException("No se recibió el usuario de la sesión");
        await service.Reassign(tag.Trim(), payroll, actor); return tag.Trim();
    }, "Equipo reasignado correctamente");
    [HttpPut("{tag}/activar")]
    public Task<IActionResult> Activate(string tag) => Write(async () => { await service.Activate(tag.Trim(), User.FindFirstValue(ClaimTypes.Name)); return tag.Trim(); }, "Equipo reactivado correctamente");
    [HttpDelete("{tag}")]
    public async Task<IActionResult> Delete(string tag)
    {
        try { await service.Delete(tag); return Ok(new { success = true, message = "Equipo eliminado correctamente" }); }
        catch (EquipoValidationException e) { return Error(e.Status, e.Message); }
        catch (DbUpdateException e) { logger.LogWarning(e, "No se pudo eliminar equipo"); return Error(404, "No se pudo eliminar el equipo."); }
    }
}


