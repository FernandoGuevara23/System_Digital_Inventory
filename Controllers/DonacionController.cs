using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Services;
namespace TRG2._0_VNET.Controllers;

[ApiController]
[Route("api/donaciones")]
public sealed class DonacionController(DonacionService service, ILogger<DonacionController> logger) : ControllerBase
{
    private string? Actor => User.FindFirstValue(ClaimTypes.Name)?.Trim();
    private async Task<JsonObject> Payload()
    {
        try { return await JsonNode.ParseAsync(Request.Body) as JsonObject ?? new(); }
        catch (JsonException) { return new(); }
    }
    private async Task<IActionResult> Run(Func<Task<IActionResult>> action)
    {
        try { return await action(); }
        catch (DonacionException e) { return BadRequest(new { success = false, error = e.Message }); }
        catch (Exception e) when (e is DbUpdateException or System.Data.Common.DbException) { logger.LogError(e, "Error de persistencia de Donaciones"); return BadRequest(new { success = false, error = "No se pudo completar la operación de Donaciones por un error de base de datos." }); }
    }
    [HttpGet]
    [HttpGet("historial")]
    public Task<IActionResult> History() => Run(async () => Ok(new { success = true, data = await service.HistoryDtos() }));
    [HttpGet("equipos-disponibles")]
    public Task<IActionResult> Available() => Run(async () => Ok(new { success = true, data = await service.Available() }));
    [HttpGet("equipos")]
    public Task<IActionResult> Pending() => Run(async () => Ok(new { success = true, data = await service.PendingDtos() }));
    [HttpPost("enviar")]
    public Task<IActionResult> Send() => Run(async () => StatusCode(201, new { success = true, data = (await service.Send(DonacionService.Tags(await Payload()), Actor)).Select(DonacionService.Dto) }));
    [HttpPost]
    [HttpPost("equipos")]
    public Task<IActionResult> Create() => Run(async () => {
        var tags = AltaDisposicionPayload.Single(await Payload(), message => new DonacionException(message)); if (tags.Length != 1) throw new DonacionException("Se requiere un solo equipo");
        return StatusCode(201, new { success = true, data = DonacionService.Dto((await service.Send(tags, Actor))[0]) });
    });
    [HttpPost("equipos/liberar-seleccionados")]
    public Task<IActionResult> ReleaseSelected() => Run(async () => {
        var payload = await Payload(); var detail = DonacionService.Text(payload["Detalle"]);
        if (detail.Length == 0 || (payload["Service_Tags"] == null && payload["Service_Tag"] == null) || payload["Service_Tags"] is JsonArray { Count: 0 }) throw new DonacionException("Selecciona al menos un equipo e indica el motivo");
        return Ok(new { success = true, data = (await service.Release(DonacionService.Tags(payload), detail, Actor)).Select(DonacionService.Dto) });
    });
    [HttpDelete("equipos/{tag}")]
    public Task<IActionResult> ReleaseOne(string tag) => Run(async () => Ok(new { success = true, data = DonacionService.Dto((await service.Release([tag], DonacionService.Text((await Payload())["Detalle"]), Actor))[0]) }));
    [HttpDelete("equipos")]
    public Task<IActionResult> ReleaseAll() => Run(async () => Ok(new { success = true, data = (await service.Release(null, DonacionService.Text((await Payload())["Detalle"]), Actor)).Select(DonacionService.Dto) }));
}
