using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using TRG2._0_VNET.Services;

namespace TRG2._0_VNET.Controllers;

[ApiController]
[Route("api/{catalog:regex(^(departamentos|tipo_equipos|proyectos)$)}")]
public sealed class CatalogosController(CatalogosService service) : ControllerBase
{
    private static Catalogo Kind(string catalog) => catalog.ToLowerInvariant() switch {
        "departamentos" => Catalogo.Departamentos, "tipo_equipos" => Catalogo.Tipos, _ => Catalogo.Proyectos };
    private IActionResult Respond(CatalogoResult result) => result.Error is not null
        ? StatusCode(result.Status, new { success = false, error = result.Error })
        : StatusCode(result.Status, new { success = true, data = result.Data });

    [HttpGet]
    public async Task<IActionResult> List(string catalog)
    {
        var data = await service.ListAsync(Kind(catalog));
        return Kind(catalog) == Catalogo.Proyectos ? Ok(new { success = true, data })
            : Ok(new { success = true, data, total = data.Length });
    }

    [HttpGet("{id:int:min(0)}")]
    public async Task<IActionResult> Get(string catalog, int id) => Kind(catalog) == Catalogo.Proyectos
        ? NotFound(new { success = false, error = "Recurso no encontrado" })
        : Respond(await service.GetAsync(Kind(catalog), id));

    [HttpPost]
    public async Task<IActionResult> Create(string catalog, [FromBody] JsonElement body) => Respond(await service.CreateAsync(Kind(catalog), body));

    [HttpPut("{id:int:min(0)}")]
    public async Task<IActionResult> Update(string catalog, int id, [FromBody] JsonElement body) => Respond(await service.UpdateAsync(Kind(catalog), id, body));

    [HttpDelete("{id:int:min(0)}")]
    public async Task<IActionResult> Delete(string catalog, int id)
    {
        var kind = Kind(catalog);
        var result = await service.DeleteAsync(kind, id);
        if (result.Error is not null) return Respond(result);
        return kind == Catalogo.Proyectos ? Ok(new { success = true }) : Ok(new { success = true,
            message = kind == Catalogo.Departamentos ? "Departamento eliminado correctamente" : "Tipo de equipo eliminado correctamente" });
    }
}
