using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Services;
namespace TRG2._0_VNET.Controllers;

[ApiController]
[Route("api/cartas")]
public sealed class CartasController(InventarioDbContext db, CartasService cards, ICartaPdf pdf, ILogger<CartasController> logger) : ControllerBase
{
    private string? Actor => User.FindFirstValue(ClaimTypes.Name);
    private async Task<string?> FullActor() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? (await db.Administradors.FindAsync(id))?.Nombre_Completo?.Trim() is { Length: > 0 } full ? full : Actor : Actor;
    private async Task<JsonObject> Payload()
    {
        try { return await JsonNode.ParseAsync(Request.Body) as JsonObject ?? new(); }
        catch (JsonException) { return new(); }
    }
    private async Task<IActionResult> Run(Func<Task<IActionResult>> action, string error)
    {
        try { return await action(); }
        catch (CartaException e)
        {
            if (e.Status >= 500) logger.LogWarning("Cartas: {Error}", e.Message);
            return e.Code == null ? StatusCode(e.Status, new { success = false, error = e.Message }) : StatusCode(e.Status, new { success = false, error = e.Message, code = e.Code });
        }
        catch (Exception e) when (e is not OperationCanceledException)
        { logger.LogError(e, "Error en cartas responsivas"); return StatusCode(500, new { success = false, error }); }
    }
    [HttpPost("generar")]
    public Task<IActionResult> Generate() => Run(async () => {
        var payload = await Payload(); if (payload.Count == 0) throw new CartaException("No se recibieron datos para generar la carta");
        var card = await cards.Create(payload, Actor, await FullActor());
        return StatusCode(201, new { success = true, message = "Carta generada correctamente. Revisa el PDF antes de enviarla.", data = CartasService.Dto(card) });
    }, "No se pudo guardar la carta por un error de base de datos.");
    [HttpPost("{id:int}/enviar")]
    public Task<IActionResult> Send(int id) => Run(async () => {
        var payload = await Payload(); var confirm = payload["confirmar_reenvio"] is JsonValue value && value.TryGetValue<bool>(out var yes) && yes;
        var card = await cards.Send(id, confirm, Actor); return Ok(new { success = true, message = "Carta enviada correctamente", data = CartasService.Dto(card) });
    }, "No se pudo enviar la carta por un error interno.");
    [HttpPost("enviar")]
    public Task<IActionResult> CompatibilitySend() => Run(async () => {
        var payload = await Payload(); if (payload.Count == 0) throw new CartaException("No se recibieron datos para enviar la carta");
        var tag = CartasService.Pick(payload, "service_tag", "Service_Tag");
        var active = await db.cartas_responsivas.Where(c => c.service_tag == tag && CartasService.Active.Contains(c.estado)).OrderByDescending(c => c.id).ToListAsync();
        if (active.Count > 1) throw new CartaException("El equipo tiene más de una carta activa. Corrige el historial antes de generar otra carta.", 409);
        var card = active.FirstOrDefault() ?? await cards.Create(payload, Actor, await FullActor());
        var confirm = payload["confirmar_reenvio"] is JsonValue value && value.TryGetValue<bool>(out var yes) && yes;
        card = await cards.Send(card.id, confirm, Actor);
        return Ok(new { success = true, message = "Carta enviada correctamente", data = CartasService.Dto(card) });
    }, "No se pudo enviar la carta por un error interno.");
    [HttpGet("{id:int}/pdf")]
    public Task<IActionResult> Pdf(int id) => Run(async () => {
        var snapshot = await cards.Snapshot(await cards.Find(id)); var bytes = await pdf.Render(snapshot);
        var disposition = new Microsoft.Net.Http.Headers.ContentDispositionHeaderValue("inline"); disposition.SetHttpFileName(CartaPdf.Filename(snapshot)); Response.Headers.ContentDisposition = disposition.ToString();
        Response.Headers.CacheControl = "no-store";
        return File(bytes, "application/pdf");
    }, "No se pudo generar el PDF de la carta.");
    [HttpPatch("{id:int}/marcar-firmada")]
    public Task<IActionResult> Sign(int id) => Run(async () => Ok(new { success = true, data = CartasService.Dto(await cards.Sign(id)) }), "No se pudo guardar la firma de la carta.");
}
