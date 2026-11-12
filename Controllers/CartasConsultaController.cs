using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
namespace TRG2._0_VNET.Controllers;

// Consulta compartida por inventario, empleados y administración de cartas.
[ApiController]
[Route("api/cartas")]
public sealed class CartasConsultaController(InventarioDbContext db) : ControllerBase
{
    [HttpGet("resumen-equipos")]
    public async Task<IActionResult> LatestByEquipment()
    {
        var payroll = Request.Query["payroll"].FirstOrDefault()?.Trim();
        var serviceTag = Request.Query["service_tag"].FirstOrDefault()?.Trim().ToLowerInvariant();
        var latestIds = db.cartas_responsivas
            .GroupBy(c => c.service_tag)
            .Select(group => group.Max(c => c.id));
        var query = db.cartas_responsivas.AsNoTracking().Where(c => latestIds.Contains(c.id));
        if (!string.IsNullOrEmpty(serviceTag))
            query = query.Where(c => c.service_tag.ToLower() == serviceTag);
        if (!string.IsNullOrEmpty(payroll))
        {
            query = query.Where(c => c.payroll_titular == payroll
                || c.payroll_secundario == payroll
                || EF.Functions.Like(c.datos_json!.Replace(" ", ""), "%\"payroll\":\"" + payroll + "\",%")
                || EF.Functions.Like(c.datos_json!.Replace(" ", ""), "%\"payroll\":\"" + payroll + "\"}%")
                || EF.Functions.Like(c.datos_json!.Replace(" ", ""), "%\"payroll\":" + payroll + ",%")
                || EF.Functions.Like(c.datos_json!.Replace(" ", ""), "%\"payroll\":" + payroll + "}%"));
        }

        var rows = await query.OrderByDescending(c => c.id).ToListAsync();
        var data = rows.Select(c => {
            var dto = new Dictionary<string, object?>();
            foreach (var key in new[] { "id", "service_tag", "device_type", "hostname", "payroll_titular", "nombre_titular", "payroll_secundario", "nombre_secundario", "tipo_carta", "estado", "fecha_envio", "fecha_firma", "observaciones" }) dto[key] = c.GetType().GetProperty(key)!.GetValue(c);
            dto["Hostname"] = c.hostname;
            dto["datos_json"] = string.IsNullOrEmpty(c.datos_json) ? null : JsonSerializer.Deserialize<JsonElement>(c.datos_json);
            return dto;
        }).ToArray();
        return Ok(new { success = true, data });
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        string P(string key, string? alias = null) => (Request.Query[key].FirstOrDefault() ?? (alias == null ? null : Request.Query[alias].FirstOrDefault()) ?? "").Trim();
        var query = db.cartas_responsivas.AsNoTracking();
        var tag = P("service_tag", "serviceTag").ToLowerInvariant(); var host = P("hostname", "Hostname").ToLowerInvariant();
        var payroll = P("payroll"); var state = P("estado").ToUpperInvariant(); var type = P("tipo_carta", "tipoCarta").ToUpperInvariant(); var search = "%" + P("q").ToLowerInvariant() + "%";
        if (tag != "") query = query.Where(c => EF.Functions.Like(c.service_tag.ToLower(), "%" + tag + "%"));
        if (host != "") query = query.Where(c => EF.Functions.Like(c.hostname!.ToLower(), "%" + host + "%"));
        if (state != "") query = query.Where(c => c.estado == state);
        if (type != "") query = query.Where(c => c.tipo_carta == type);
        if (payroll != "") query = query.Where(c => c.payroll_titular == payroll || c.payroll_secundario == payroll || EF.Functions.Like(c.datos_json!.Replace(" ", ""), "%\"payroll\":\"" + payroll + "\",%") || EF.Functions.Like(c.datos_json!.Replace(" ", ""), "%\"payroll\":\"" + payroll + "\"}%") || EF.Functions.Like(c.datos_json!.Replace(" ", ""), "%\"payroll\":" + payroll + ",%") || EF.Functions.Like(c.datos_json!.Replace(" ", ""), "%\"payroll\":" + payroll + "}%"));
        if (P("q") != "") query = query.Where(c => EF.Functions.Like(c.service_tag.ToLower(), search) || EF.Functions.Like(c.hostname!.ToLower(), search) || EF.Functions.Like(c.device_type.ToLower(), search) || EF.Functions.Like(c.nombre_titular.ToLower(), search) || EF.Functions.Like(c.payroll_titular.ToLower(), search) || EF.Functions.Like(c.nombre_secundario!.ToLower(), search) || EF.Functions.Like(c.payroll_secundario!.ToLower(), search) || EF.Functions.Like(c.datos_json!.ToLower(), search) || EF.Functions.Like(c.id.ToString(), search));
        var paged = Request.Query.ContainsKey("page") || Request.Query.ContainsKey("page_size"); var page = 1; var size = 25;
        if (paged)
        {
            if (!int.TryParse(Request.Query["page"].FirstOrDefault() ?? "1", out page) || !int.TryParse(Request.Query["page_size"].FirstOrDefault() ?? "25", out size)) return BadRequest(new { success = false, error = "La página y el tamaño de página deben ser números enteros." });
            if (page < 1 || size < 1 || size > 100) return BadRequest(new { success = false, error = "La página debe ser positiva y el tamaño debe estar entre 1 y 100." });
        }
        var total = await query.CountAsync(); query = query.OrderByDescending(x => x.id);
        if (paged) query = query.Skip((int)Math.Min((long)(page - 1) * size, int.MaxValue)).Take(size);
        var rows = await query.ToListAsync();
        var data = rows.Select(c => {
            var dto = new Dictionary<string, object?>();
            foreach (var key in new[] { "id", "service_tag", "device_type", "hostname", "payroll_titular", "nombre_titular", "payroll_secundario", "nombre_secundario", "tipo_carta", "estado", "fecha_envio", "fecha_firma", "observaciones" }) dto[key] = c.GetType().GetProperty(key)!.GetValue(c);
            dto["Hostname"] = c.hostname; dto["datos_json"] = string.IsNullOrEmpty(c.datos_json) ? null : JsonSerializer.Deserialize<JsonElement>(c.datos_json); return dto;
        }).ToArray();
        if (!paged) return Ok(new { success = true, data });
        return Ok(new { success = true, data, pagination = new { page, page_size = size, total, total_pages = (int)Math.Ceiling(total / (double)size) } });
    }
}

