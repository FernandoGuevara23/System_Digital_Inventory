using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TRG2._0_VNET.Services;

namespace TRG2._0_VNET.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public sealed class DashboardController(DashboardService service, ILogger<DashboardController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        try { return Ok(new { success = true, data = await service.Summary() }); }
        catch (Exception error)
        {
            logger.LogError(error, "Error al obtener el resumen del dashboard.");
            return StatusCode(500, new { success = false, error = "No se pudo obtener el resumen del dashboard." });
        }
    }
}
