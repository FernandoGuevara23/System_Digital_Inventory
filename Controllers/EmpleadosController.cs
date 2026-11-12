using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Services;

namespace TRG2._0_VNET.Controllers;

[ApiController]
[Route("api/empleados")]
public sealed class EmpleadosController(EmpleadosService employees, EmpleadoPhotos photos, EmpleadosExcel excel,
    ILogger<EmpleadosController> logger) : ControllerBase
{
    private string? Actor => User.FindFirstValue(ClaimTypes.Name);
    private IActionResult Error(int status, string error) => StatusCode(status, new { success = false, error });
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var data = await employees.ReadAsync();
        return Ok(new { success = true, data, total = data.Length });
    }
    [HttpGet("{payroll:int:min(0)}")]
    public async Task<IActionResult> Get(int payroll)
    {
        var data = await employees.ReadAsync(payroll);
        return data.Length == 0 ? Error(404, "Empleado no encontrado") : Ok(new { success = true, data = data[0] });
    }
    [HttpGet("fotos/{**name}")]
    public IActionResult Photo(string name)
    {
        var path = photos.Find(name);
        if (path is null) return Error(404, "Recurso no encontrado");
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return PhysicalFile(path, Path.GetExtension(path).Equals(".png", StringComparison.OrdinalIgnoreCase) ? "image/png" : "image/jpeg");
    }
    [HttpPost]
    public async Task<IActionResult> Create()
    {
        if (!Request.HasFormContentType) return Error(400, "Se requiere payroll");
        IFormCollection form;
        try { form = await Request.ReadFormAsync(); }
        catch (InvalidDataException) { return Error(400, "Se requiere payroll"); }
        string? photo = null; var committed = false;
        try
        {
            photo = await photos.SaveAsync(form.Files.GetFile("foto"), HttpContext.RequestAborted);
            var payroll = await employees.CreateAsync(form, photo, Actor);
            committed = true;
            return StatusCode(201, new { success = true, message = "Empleado creado exitosamente", data = (await employees.ReadAsync(payroll))[0] });
        }
        catch (EmpleadoValidationException e) { return Error(400, e.Message); }
        catch (DbUpdateException e) { logger.LogWarning(e, "No se pudo crear empleado"); return Error(400, "No se pudo guardar el empleado. Comprueba nómina duplicada, referencias y límites de campos."); }
        finally { if (!committed) photos.RemoveNew(photo); }
    }
    [HttpPut("{payroll:int:min(0)}")]
    public async Task<IActionResult> Update(int payroll)
    {
        Dictionary<string, JsonElement> data;
        IFormFile? file = null;
        if (Request.HasFormContentType)
        {
            IFormCollection form;
            try { form = await Request.ReadFormAsync(); }
            catch (InvalidDataException) { return Error(400, "No se proporcionaron datos para actualizar"); }
            data = form.ToDictionary(x => x.Key, x => JsonSerializer.SerializeToElement(x.Value.FirstOrDefault()), StringComparer.Ordinal);
            file = form.Files.GetFile("foto");
        }
        else
        {
            try { data = await JsonSerializer.DeserializeAsync<Dictionary<string, JsonElement>>(Request.Body) ?? []; }
            catch (JsonException) { return Error(400, "No se proporcionaron datos para actualizar"); }
        }
        if (data.Count == 0) return Error(400, "No se proporcionaron datos para actualizar");
        string? photo = null; var committed = false;
        try
        {
            photo = await photos.SaveAsync(file, HttpContext.RequestAborted);
            if (photo is not null) data["Foto_URL"] = JsonSerializer.SerializeToElement(photo);
            data.Remove("UserName"); data.Remove("Usuario");
            await employees.UpdateAsync(payroll, data, Actor);
            committed = true;
            return Ok(new { success = true, message = "Empleado actualizado exitosamente", data = (await employees.ReadAsync(payroll))[0] });
        }
        catch (EmpleadoValidationException e) { return Error(400, e.Message); }
        catch (DbUpdateException e) { logger.LogWarning(e, "No se pudo actualizar empleado"); return Error(400, "No se pudo actualizar el empleado."); }
        finally { if (!committed) photos.RemoveNew(photo); }
    }
    [HttpDelete("{payroll:int:min(0)}")]
    public async Task<IActionResult> Delete(int payroll)
    {
        try
        {
            return await employees.DeactivateAsync(payroll) ? Ok(new { success = true, message = "Empleado desactivado correctamente" }) : Error(404, "Empleado no encontrado");
        }
        catch (DbUpdateException e) { logger.LogWarning(e, "No se pudo desactivar empleado"); return Error(404, "No se pudo desactivar el empleado."); }
    }
    [HttpPost("cargar-excel")]
    public async Task<IActionResult> Import()
    {
        if (!Request.HasFormContentType) return BadRequest(new { error = "No se recibió ningún archivo en la petición." });
        IFormCollection form;
        try { form = await Request.ReadFormAsync(); }
        catch (InvalidDataException) { return BadRequest(new { error = "No se recibió ningún archivo en la petición." }); }
        var file = form.Files.GetFile("archivo");
        if (file is null) return BadRequest(new { error = "No se recibió ningún archivo en la petición." });
        if (string.IsNullOrEmpty(file.FileName)) return BadRequest(new { error = "No se seleccionó ningún archivo." });
        try
        {
            await using var stream = new MemoryStream();
            await file.CopyToAsync(stream, HttpContext.RequestAborted);
            stream.Position = 0;
            var processed = await excel.ImportAsync(stream, Path.GetFileName(file.FileName), Actor);
            return Ok(new { mensaje = $"Se procesaron {processed} empleados correctamente." });
        }
        catch (EmpleadoValidationException e) { return StatusCode(500, new { error = e.Message }); }
        catch (Exception e) when (e is not OperationCanceledException)
        { logger.LogWarning(e, "Falló carga Excel de empleados"); return StatusCode(500, new { error = "Error al cargar empleados desde Excel. Comprueba el archivo, sus valores y las referencias al catálogo." }); }
    }
}
