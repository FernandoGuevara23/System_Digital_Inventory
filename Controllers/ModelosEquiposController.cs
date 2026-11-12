using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TRG2._0_VNET.Services;

namespace TRG2._0_VNET.Controllers;

[ApiController]
[Authorize]
[Route("api/equipos")]
public sealed class ModelosEquiposController(ModelosEquiposService service, ILogger<ModelosEquiposController> logger) : ControllerBase
{
    [HttpGet("dashboard")]
    [HttpGet("modelos")]
    public async Task<IActionResult> Summary() => Ok(new { success = true, data = await service.Summary() });

    [HttpGet("modelos/equipos")]
    public async Task<IActionResult> Details()
    {
        var model = Request.Query["modelo"].FirstOrDefault() ?? "";
        if (string.IsNullOrWhiteSpace(model)) return BadRequest(new { success = false, error = "Se requiere el nombre del modelo." });
        try
        {
            var data = await service.Details(model);
            return Ok(new { success = true, data, total = data.Count });
        }
        catch (System.Data.Common.DbException error)
        {
            logger.LogError(error, "Error consultando equipos por modelo");
            return StatusCode(500, new { success = false, error = "No se pudieron consultar los equipos del modelo." });
        }
    }
}
