using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Services;
namespace TRG2._0_VNET.Controllers;

[ApiController]
[Route("api/equipos-liberados")]
public sealed class EquiposLiberadosController(EquiposLiberadosService service, ILogger<EquiposLiberadosController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List() => Ok(new { success = true, data = await service.List() });
    [HttpGet("telefonos")]
    public async Task<IActionResult> Phones() => Ok(new { success = true, data = await service.PhoneDtos() });
    [HttpGet("catalogo-telefonos")]
    public async Task<IActionResult> Catalog() => Ok(new { success = true, data = await service.Catalog() });
    [HttpGet("{tag}")]
    public async Task<IActionResult> History(string tag) => Ok(new { success = true, data = await service.List(tag) });
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        try { return await service.Delete(id) ? Ok(new { success = true, message = "Registro de liberación eliminado correctamente" }) : BadRequest(new { success = false, error = "Registro de liberación no encontrado" }); }
        catch (Exception error) when (error is DbUpdateException or System.Data.Common.DbException)
        { logger.LogError(error, "Error al eliminar liberación {Id}", id); return BadRequest(new { success = false, error = "Error al eliminar registro de liberación" }); }
    }
}
