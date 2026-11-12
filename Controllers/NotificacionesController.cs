using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;

namespace TRG2._0_VNET.Controllers;

[ApiController]
[Authorize]
[Route("api/notificaciones")]
public sealed class NotificacionesController(InventarioDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var pending = db.cartas_responsivas.AsNoTracking().Where(c => c.estado == "SIN_ENVIAR" || c.estado == "ENVIADO");
        var total = await pending.CountAsync();
        var cards = await pending.OrderByDescending(c => c.id).Select(c => new {
            c.id, c.service_tag, c.hostname, c.device_type, c.nombre_titular, c.estado
        }).Take(50).ToListAsync();
        var items = cards.Select(c => new {
            id = $"carta-responsiva-{c.id}", tipo = "carta_responsiva", categoria = "Cartas responsivas",
            titulo = c.estado == "SIN_ENVIAR" ? "Carta responsiva sin enviar" : "Carta pendiente de firma",
            mensaje = $"{c.nombre_titular} · {c.device_type} · {c.service_tag} · {(string.IsNullOrEmpty(c.hostname) ? "Sin hostname" : c.hostname)}",
            estado = c.estado, url = $"/cartas-responsivas?estado={c.estado}"
        });
        return Ok(new { success = true, data = new { items, total } });
    }
}
