using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json.Nodes;
namespace TRG2._0_VNET.Services;

public static class ReportesHtml
{
    public static string E(object? value) => WebUtility.HtmlEncode(Convert.ToString(value, CultureInfo.InvariantCulture) ?? "");
    public static string Money(object? value) => "$ " + Convert.ToDecimal(value ?? 0, CultureInfo.InvariantCulture).ToString("N2", CultureInfo.InvariantCulture);
    public static string Label(string kind) => kind switch { "scrap" => "Scrap", "donaciones" => "Donación", "produccion" => "Producción", _ => "Ventas" };
    private static StringBuilder Start(string title, string? date, bool landscape = false)
    {
        var b = new StringBuilder("<!doctype html><html lang='es'><meta charset='utf-8'><style>@page{size:letter " + (landscape ? "landscape" : "portrait") + ";margin:36pt}body{font:10pt Arial,sans-serif;color:#202020}header{display:flex;align-items:center;justify-content:space-between}header img{width:108pt;height:auto}h1{font-size:18pt;text-align:center;margin:18pt 0}h2{font-size:12pt;color:#1d5d57;margin-top:18pt}p{line-height:1.4;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;table-layout:fixed;margin:10pt 0}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:.5pt solid #999;padding:5pt;vertical-align:top;overflow-wrap:anywhere;font-size:8pt}th{background:#1d5d57;color:white;text-align:left}tbody tr:nth-child(even){background:#eef5f3}.employee{border:1pt solid #1d5d57;background:#f8f9fa;padding:10pt}.employee{break-inside:avoid}.employee~h2{break-after:avoid}.employee-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8pt 16pt;margin-top:10pt}.employee-field{min-width:0;overflow-wrap:anywhere;line-height:1.4}.employee-wide{grid-column:span 2}</style><body><header>");
        var logo = Path.Combine(AppContext.BaseDirectory,"Cartas","Marquardt.jpg");
        if (File.Exists(logo)) b.Append("<img alt='Marquardt' src='data:image/jpeg;base64,").Append(Convert.ToBase64String(File.ReadAllBytes(logo))).Append("'>");
        if (date != null) b.Append("<span>Fecha: ").Append(E(date)).Append("</span>");
        return b.Append("</header><h1>").Append(E(title)).Append("</h1>");
    }
    public static void Table(StringBuilder b, string[] headers, IEnumerable<object?[]> rows)
    {
        b.Append("<table><thead><tr>"); foreach (var h in headers) b.Append("<th>").Append(E(h)).Append("</th>"); b.Append("</tr></thead><tbody>");
        foreach (var row in rows) { b.Append("<tr>"); foreach (var cell in row) b.Append("<td>").Append(E(cell)).Append("</td>"); b.Append("</tr>"); } b.Append("</tbody></table>");
    }
    private static string Finish(StringBuilder b) => b.Append("</body></html>").ToString();
    public static string Disposition(string kind, List<Dictionary<string, object?>> orders)
    {
        var first = orders[0]; var b = Start("Reporte de equipos enviados a " + Label(kind),first["Fecha"]?.ToString());
        b.Append("<p><b>Orden ").Append(E(Label(kind))).Append(":</b> ").Append(E(first["Orden_Id"])).Append("<br><b>Administrador:</b> ").Append(E(first["Nombre_Usuario"])).Append("<br><b>Comentario:</b> ").Append(E(first["Comentario"])).Append("</p>");
        var rows = orders.SelectMany(o => (List<Dictionary<string, object?>>)o["Equipos"]!);
        var macFirst = kind is "produccion" or "ventas";
        Table(b,macFirst ? ["Service Tag","MAC","Hostname O IMEI","Empleado anterior","Payroll anterior","Marca","Modelo"] : ["Service Tag","Hostname O IMEI","MAC","Empleado anterior","Payroll anterior","Marca","Modelo"],rows.Select(r => new object?[] {r["Service_Tag"],macFirst ? r["MAC"] ?? "Sin MAC" : r["Hostname"] ?? r["IMEI"] ?? "Sin hostname/IMEI",macFirst ? r["Hostname"] ?? r["IMEI"] ?? "Sin hostname/IMEI" : r["MAC"] ?? "Sin MAC",r["Nombre_Empleado_Anterior"] ?? "Sin empleado",r["Payroll_Anterior"] ?? "Sin payroll",r["Marca"] ?? "Sin marca",r["Modelo"] ?? "Sin modelo"}));
        return Finish(b);
    }
    public static string Lines(List<Dictionary<string, object?>> rows, string mode)
    {
        var title = "Reporte de líneas telefónicas" + (mode == "cc" ? " por CC" : mode == "hc" ? " por CC y HC" : ""); var b = Start(title,ReportesService.Day(DateTime.Now));
        if (mode == "detail") Table(b,["Service Tag","Cuenta","Teléfono","Total Cuenta"],rows.Count == 0 ? [new object?[] {"Sin registros","","","$0.00"}] : rows.Select(r => new object?[] {r["Service_Tag"],r["Account"],r["Numero_Telefono"],Money(r["Total_cuenta"])}));
        else {
            var centers = ReportesService.Centers(rows); var totals = new List<object?[]>();
            foreach (var (cc, value) in centers) totals.Add(mode == "hc" ? [cc,value.HC,Money(value.Total)] : [cc,Money(value.Total)]);
            if (centers.Count == 0) totals.Add(mode == "hc" ? ["Sin registros",0,"$0.00"] : ["Sin registros","$0.00"]);
            else if (mode == "hc") totals.Add(["TOTAL GENERAL",centers.Values.Sum(v => v.HC),Money(centers.Values.Sum(v => v.Total))]);
            Table(b,mode == "hc" ? ["CC","HC","Total Cuenta"] : ["CC","Total Cuenta"],totals);
        }
        return Finish(b);
    }
    public static string Employee(Dictionary<string,object?> data)
    {
        var b = Start("Reporte de equipos por empleado",ReportesService.Day(DateTime.Now),true);
        var person = data["empleado"] as Dictionary<string,object?> ?? new(); b.Append("<div class='employee'><b>DATOS DEL EMPLEADO</b><div class='employee-grid'>");
        foreach (var key in new[] {"Payroll","Nombre","Departamento","Area","Puesto","CC","Correo"}) b.Append("<div class='employee-field").Append(key is "Nombre" or "Correo" ? " employee-wide" : "").Append("'><b>").Append(E(key)).Append(":</b> ").Append(E(person.GetValueOrDefault(key))).Append("</div>"); b.Append("</div></div>");
        var rows = (List<Dictionary<string,object?>>)data["equipos"]!; var shared = (List<Dictionary<string,object?>>)data["equipos_compartidos"]!;
        var phones = rows.Where(r => EquiposService.PhoneType(r["Tipo_Equipo"]?.ToString())).ToList(); var other = rows.Except(phones).ToList();
        if (other.Count > 0) { b.Append("<h2>Equipos: ").Append(other.Count).Append("</h2>"); Table(b,["Service Tag","Hostname","Marca","Modelo"],other.Select(r => new object?[] {r["Service_Tag"],r["Hostname"],r["Marca"],r["Modelo"]})); }
        if (phones.Count > 0) { b.Append("<h2>Teléfonos: ").Append(phones.Count).Append("</h2>"); Table(b,["Service Tag","IMEI","Marca","Modelo","Teléfono"],phones.Select(r => new object?[] {r["Service_Tag"],r["IMEI"],r["Marca"],r["Modelo"],r["Numero_Telefono"]})); }
        if (shared.Count > 0) { b.Append("<h2>Equipos compartidos: ").Append(shared.Count).Append("</h2>"); Table(b,["Service Tag","Hostname o IMEI","Marca","Modelo","Titular principal"],shared.Select(r => { var owner = (Dictionary<string,object?>)r["Principal"]!; return new object?[] {r["Service_Tag"],r["Hostname"] ?? r["IMEI"],r["Marca"],r["Modelo"],$"{owner["Nombre"] ?? "Sin nombre"} (Payroll: {owner["Payroll"] ?? "Sin payroll"})"}; })); }
        if (rows.Count == 0 && shared.Count == 0) b.Append("<p>No hay equipos disponibles para reportar.</p>"); return Finish(b);
    }
    public static string Generic(string title, JsonArray rows)
    {
        var b = Start(title,null);
        if (rows.Count == 0) b.Append("<p>No hay datos disponibles.</p>");
        else Table(b,rows[0]!.AsObject().Select(p => p.Key).ToArray(),rows.OfType<JsonObject>().Select(r => r.Select(p => (object?)p.Value).ToArray()));
        return Finish(b);
    }
}
