using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Services;
namespace TRG2._0_VNET.Controllers;
[ApiController]
[Route("api/lineas")]
public sealed class LineasController(LineasService lines, LineasExcel excel, ILogger<LineasController> logger) : ControllerBase
{
    private string? Actor => User.FindFirstValue(ClaimTypes.Name);
    private IActionResult Error(int status, string error) => StatusCode(status, new { success = false, error });
    private static string? Number(Dictionary<string, JsonElement> body)
    {
        if (body.TryGetValue("Numero_Telefono", out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number) && number == decimal.Truncate(number))
            return number.ToString("0", System.Globalization.CultureInfo.InvariantCulture);
        return EquiposService.Value(body, "Numero_Telefono");
    }
    private async Task<Dictionary<string, JsonElement>> Body()
    {
        try { return await JsonSerializer.DeserializeAsync<Dictionary<string, JsonElement>>(Request.Body) ?? []; }
        catch (JsonException) { throw new EquipoValidationException("Se requiere un objeto JSON"); }
    }
    private async Task<IActionResult> Run(Func<Task<IActionResult>> action, int? errorStatus = null)
    {
        try { return await action(); }
        catch (EquipoValidationException e) { return Error(errorStatus ?? (e.Message.Contains("número de teléfono ya está registrado", StringComparison.OrdinalIgnoreCase) ? 409 : e.Status), e.Message); }
        catch (DbUpdateException e) { logger.LogWarning(e, "No se pudo guardar línea"); if (e.InnerException?.Message.Contains("UX_Telefonos_Numero_Telefono_NotNull") == true || e.InnerException?.Message.Contains("UNIQUE constraint failed: Telefonos.Numero_Telefono") == true) return Error(errorStatus ?? 409, "El número de teléfono ya está registrado en otra línea."); return Error(errorStatus ?? 400, "No se pudo guardar la línea telefónica. Comprueba duplicados, referencias y límites de campos."); }
    }
    [HttpGet("exportar")]
    public async Task<IActionResult> Export()
    {
        try { return File(await excel.Export(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "lineas_telefonicas.xlsx"); }
        catch (EquipoValidationException e) { return Error(404, e.Message); }
        catch (Exception e) when (e is not OperationCanceledException) { logger.LogWarning(e, "Error al exportar líneas"); return Error(404, "Error al exportar las líneas telefónicas a Excel."); }
    }
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
            return Ok(await excel.Import(stream));
        }
        catch (EquipoValidationException e) { return Error(400, e.Message); }
        catch (Exception e) when (e is not OperationCanceledException) { logger.LogWarning(e, "Error al importar líneas"); return Error(400, "Error al procesar el archivo Excel: comprueba el archivo, referencias y límites de campos."); }
    }
    [HttpGet]
    public async Task<IActionResult> List() { var data = await lines.List(); return Ok(new { success = true, data, total = data.Length }); }
    [HttpGet("buscar")]
    public async Task<IActionResult> Search([FromQuery] string termino = "") => Ok(new { success = true, data = await lines.List(termino) });
    [HttpGet("equipos-telefono")]
    public async Task<IActionResult> Available() { var data = await lines.Available(); return Ok(new { success = true, data, total = data.Length }); }
    [HttpGet("{tag}")]
    public Task<IActionResult> Get(string tag) => Run(async () => { await lines.Get(tag); return Ok(new { success = true, data = await lines.Dto(tag) }); });
    [HttpPost]
    public Task<IActionResult> Create() => Run(async () => {
        var body = await Body(); string? V(string key) => EquiposService.Value(body, key);
        var tag = V("Service_Tag") ?? V("service_tag"); var account = V("Account"); var number = Number(body);
        if (string.IsNullOrEmpty(tag)) throw new EquipoValidationException("Se requiere el Service Tag");
        if (string.IsNullOrEmpty(account)) throw new EquipoValidationException("Se requiere el Account");
        if (string.IsNullOrEmpty(number)) throw new EquipoValidationException("Se requiere el Número de Teléfono");
        await lines.Create(tag, account, number, V("Total_cuenta"), Actor);
        return StatusCode(201, new { success = true, data = await lines.Dto(tag) });
    });
    [HttpPut("{tag}")]
    public Task<IActionResult> Update(string tag) => Run(async () => {
        var body = await Body(); string? V(string key) => EquiposService.Value(body, key);
        var target = new[] { V("Nuevo_Service_Tag"), V("nuevo_service_tag"), V("Service_Tag") }.FirstOrDefault(x => !string.IsNullOrEmpty(x));
        var result = await lines.Update(tag, target, V("Account"), Number(body), V("Total_cuenta"), V("Estado"), Actor);
        return Ok(new { success = true, data = await lines.Dto(result) });
    });
    [HttpPost("transferir")]
    public Task<IActionResult> Transfer() => Run(async () => {
        var body = await Body(); var origin = (EquiposService.Value(body, "Service_Tag_Origen") ?? "").Trim(); var target = (EquiposService.Value(body, "Service_Tag_Destino") ?? "").Trim();
        if (origin == "" || target == "") throw new EquipoValidationException("Se requieren Service Tag origen y destino");
        if (origin == target) throw new EquipoValidationException("No puedes transferir la línea al mismo equipo");
        await lines.Transfer(origin, target, Actor);
        return Ok(new { success = true, data = await lines.Dto(target), message = "Línea transferida correctamente" });
    });
    [HttpDelete("{tag}")]
    public Task<IActionResult> Delete(string tag) => Run(async () => { await lines.Delete(tag, Actor); return Ok(new { success = true, message = "Línea telefónica eliminada correctamente" }); }, 404);
}


