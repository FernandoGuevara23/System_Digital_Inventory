using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using TRG2._0_VNET.Services;
namespace TRG2._0_VNET.Controllers;

[ApiController]
[Route("api/reportes")]
public sealed class ReportesController(ReportesService reports, ChromiumReportPdf pdf, ILogger<ReportesController> logger) : ControllerBase
{
    private static bool Ids(string? raw, out int[] ids) { var parts = (raw ?? "").Split(',',StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries); ids=[]; if(parts.Any(p=>!int.TryParse(p,out _)))return false; ids=parts.Select(int.Parse).ToArray(); return true; }
    private async Task<IActionResult> Pdf(string html,string filename)
    {
        if (!pdf.Available) return StatusCode(503,new {success=false,error="No se encontró Edge o Chromium para generar el PDF."});
        try { return File(await pdf.Render(html),"application/pdf",filename); }
        catch(Exception error) when (error is InvalidOperationException or TimeoutException or System.ComponentModel.Win32Exception or IOException) { logger.LogError(error,"Error al generar reporte PDF"); return StatusCode(503,new {success=false,error="No se pudo generar el PDF del reporte."}); }
    }
    [HttpGet("{kind:regex(^(scrap|donaciones|produccion|ventas)$)}")]
    public async Task<IActionResult> Orders(string kind,[FromQuery]string? ids) => Ids(ids,out var parsed) ? Ok(new {success=true,data=await reports.Orders(kind,parsed)}) : BadRequest(new {success=false,error="El parámetro ids no es válido"});
    [HttpGet("{kind:regex(^(scrap|donacion|produccion|ventas)$)}/resumen")]
    public async Task<IActionResult> Summary(string kind) => Ok(new {success=true,data=await reports.Summary(kind=="donacion"?"donaciones":kind)});
    [HttpGet("{kind:regex(^(scrap|donaciones|produccion|ventas)$)}/descargar")]
    public async Task<IActionResult> Download(string kind,[FromQuery]string? ids)
    {
        if(!Ids(ids,out var parsed)||parsed.Length==0) return BadRequest(new {success=false,error="Indica uno o varios id_"+ReportesService.Key(kind)});
        var orders=await reports.Orders(kind,parsed); if(orders.Count==0) return NotFound(new {success=false,error="No se encontraron reportes de "+(kind=="donaciones"?"Donaciones":ReportesHtml.Label(kind))});
        return await Pdf(ReportesHtml.Disposition(kind,orders),"reporte_"+kind+".pdf");
    }
    [HttpGet("lineas")]
    public async Task<IActionResult> Lines() => Ok(new {success=true,data=await reports.Lines()});
    [HttpGet("lineas/suma_por_cc")]
    public async Task<IActionResult> Centers() => Ok(new {success=true,data=ReportesService.Centers(await reports.Lines()).ToDictionary(p=>p.Key.ToString(),p=>p.Value.Total)});
    [HttpGet("lineas/descargar")]
    public async Task<IActionResult> LinesPdf() => await Pdf(ReportesHtml.Lines(await reports.Lines(),"detail"),"reporte_lineas.pdf");
    [HttpGet("lineas/descargar_por_cc")]
    public async Task<IActionResult> CcPdf() => await Pdf(ReportesHtml.Lines(await reports.Lines(),"cc"),"reporte_lineas_por_cc.pdf");
    [HttpGet("lineas/descargar_por_cc_hc")]
    public async Task<IActionResult> HcPdf() => await Pdf(ReportesHtml.Lines(await reports.Lines(),"hc"),"reporte_lineas_por_cc_hc.pdf");
    [HttpGet("equipos_por_empleado")]
    public async Task<IActionResult> Employee([FromQuery]string? payroll)
    {
        var data=await reports.Employee(int.TryParse(payroll,out var number)?number:null);
        return Ok(new {success=true,data,total=((List<Dictionary<string,object?>>)data["equipos"]!).Count,total_compartidos=((List<Dictionary<string,object?>>)data["equipos_compartidos"]!).Count});
    }
    [HttpGet("equipos_por_empleado/descargar")]
    public async Task<IActionResult> EmployeePdf([FromQuery]string? payroll)
    {
        if(!int.TryParse(payroll,out var number))return BadRequest(new {success=false,error="Se requiere el payroll del empleado"});
        var data=await reports.Employee(number);
        if(((List<Dictionary<string,object?>>)data["equipos"]!).Count==0 && ((List<Dictionary<string,object?>>)data["equipos_compartidos"]!).Count==0) return NotFound(new {success=false,error="No se encontraron equipos para reportar"});
        return await Pdf(ReportesHtml.Employee(data),"reporte_equipos_por_empleado.pdf");
    }
    [HttpPost("pdf")]
    public async Task<IActionResult> Generic([FromBody]JsonObject payload)
    {
        var rows=payload["data"] as JsonArray ?? new(); var title=payload["titulo"]?.ToString() ?? "Reporte";
        if(payload["data"]!=null && payload["data"] is not JsonArray || rows.Any(r=>r is not JsonObject)) return BadRequest(new {success=false,error="data debe ser una lista de objetos"});
        var filename=System.Text.RegularExpressions.Regex.Replace(title,"[<>:\"/\\\\|?*\\x00-\\x1f]","_"); if(string.IsNullOrWhiteSpace(filename))filename="Reporte";
        return await Pdf(ReportesHtml.Generic(title,rows),filename+".pdf");
    }
}
