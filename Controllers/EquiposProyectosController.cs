using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TRG2._0_VNET.Services;

namespace TRG2._0_VNET.Controllers;

[ApiController]
[Authorize]
[Route("api/equipos-proyectos")]
public sealed class EquiposProyectosController(EquiposProyectosService service, ILogger<EquiposProyectosController> logger) : ControllerBase
{
    public sealed record Assignment([property: JsonPropertyName("equipo_id")] string? EquipoId,
        [property: JsonPropertyName("nombre_proyecto")] string? NombreProyecto);

    [HttpGet]
    public async Task<IActionResult> All() => Ok(new { success = true, data = await service.All() });
    [HttpGet("equipo/{tag}")]
    public async Task<IActionResult> ByEquipment(string tag) => Ok(new { success = true, data = await service.ByEquipment(tag) });
    [HttpGet("proyecto/{name}")]
    public async Task<IActionResult> ByProject(string name) => Ok(new { success = true, data = await service.ByProject(name) });

    [HttpPost]
    public Task<IActionResult> Assign([FromBody] Assignment data) => Run(async () => {
        if (string.IsNullOrEmpty(data.EquipoId) || string.IsNullOrEmpty(data.NombreProyecto))
            throw new EquipoProyectoException("Faltan datos requeridos");
        return StatusCode(201, new { success = true, data = await service.Assign(data.EquipoId, data.NombreProyecto) });
    }, "crear equipo-proyecto");

    [HttpDelete("{tag}/{name}")]
    public Task<IActionResult> Remove(string tag, string name) => Run(async () => {
        await service.Remove(tag, name);
        return Ok(new { success = true, message = "Asignación equipo-proyecto eliminada correctamente" });
    }, "eliminar asignación equipo-proyecto");

    private async Task<IActionResult> Run(Func<Task<IActionResult>> action, string operation)
    {
        try { return await action(); }
        catch (EquipoProyectoException error) { return BadRequest(new { success = false, error = error.Message }); }
        catch (System.Data.Common.DbException error)
        {
            logger.LogError(error, "Error al {Operation}", operation);
            return BadRequest(new { success = false, error = $"Error al {operation}: no se pudo completar la operación de base de datos." });
        }
    }
}
