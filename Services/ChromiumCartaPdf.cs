using System.Diagnostics;
using System.Net;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
namespace TRG2._0_VNET.Services;

public sealed class ChromiumCartaPdf(IConfiguration configuration) : ICartaPdf
{
    private string? Browser
    {
        get
        {
            var configured = configuration["Cartas:BrowserPath"];
            if (!string.IsNullOrWhiteSpace(configured)) return File.Exists(configured) ? configured : null;
            var candidates = new List<string> { @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", @"C:\Program Files\Microsoft\Edge\Application\msedge.exe", @"C:\Program Files\Google\Chrome\Application\chrome.exe", "/usr/bin/microsoft-edge", "/usr/bin/google-chrome", "/usr/bin/chromium" };
            foreach (var folder in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator)) foreach (var name in new[] { "msedge.exe", "msedge", "microsoft-edge", "google-chrome", "chromium" }) candidates.Add(Path.Combine(folder, name));
            return candidates.FirstOrDefault(File.Exists);
        }
    }
    public bool Available => Browser != null;
    public string Html(JsonObject s)
    {
        var html = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Cartas", "FO-ITS-005_IT_Asset_Agreement_R04.html"));
        var person = s["titular"] as JsonObject ?? new(); var signatures = s["firmas"] as JsonObject ?? new();
        var people = (s["co_responsables"] as JsonArray)?.OfType<JsonObject>().ToArray() ?? [];
        var map = new Dictionary<string, string> { ["full_name"] = CartasService.Pick(s, "nombre_titular") is { Length: > 0 } name ? name : CartasService.S(person["nombre"]), ["employee_number"] = CartasService.Pick(s, "payroll_titular") is { Length: > 0 } payroll ? payroll : CartasService.S(person["payroll"]), ["position"] = CartasService.S(person["position"]), ["department"] = CartasService.S(person["department"]), ["brand_model"] = CartasService.Pick(s, "brand_model") is { Length: > 0 } brand ? brand : $"{CartasService.S(s["marca"])} {CartasService.S(s["modelo"])}".Trim(), ["hardware_description"] = CartasService.S(s["hardware_description"]), ["accessories"] = CartasService.S(s["accesorios"]), ["notes"] = people.Length > 0 ? CartasService.Notes(people) : CartasService.Pick(s, "notas", "observaciones"), ["assignment_date"] = CartasService.S(s["fecha_asignacion"]) is { Length: > 0 } date ? date : "Not recorded" };
        var state = CartasService.S(s["estado"]);
        html = Regex.Replace(html, @"\{% if estado_carta == 'FIRMADA' %\}(.*?)\{% elif estado_carta == 'CERRADA' %\}(.*?)\{% endif %\}", m => state == "FIRMADA" ? m.Groups[1].Value : state == "CERRADA" ? m.Groups[2].Value : "", RegexOptions.Singleline);
        html = Regex.Replace(html, @"\{\{\s*(.*?)\s*\}\}", m => {
            var expression = m.Groups[1].Value;
            var match = Regex.Match(expression, @"^firmas\.get\('([^']+)', ''\)$");
            var value = match.Success ? CartasService.S(signatures[match.Groups[1].Value]) : map.GetValueOrDefault(expression.Split(" or ")[0], "");
            return WebUtility.HtmlEncode(value);
        });
        return html;
    }
    public async Task<byte[]> Render(JsonObject snapshot)
    {
        var browser = Browser ?? throw new InvalidOperationException("No se encontró Edge o Chromium para generar el PDF.");
        var directory = Path.Combine(Path.GetTempPath(), "inventario-carta-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(directory);
        try
        {
            var input = Path.Combine(directory, "carta.html"); var output = Path.Combine(directory, "carta.pdf");
            await File.WriteAllTextAsync(input, Html(snapshot));
            var start = new ProcessStartInfo(browser) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardOutput = true, RedirectStandardError = true };
            foreach (var argument in new[] { "--headless", "--disable-gpu", "--no-first-run", "--no-pdf-header-footer", "--user-data-dir=" + Path.Combine(directory, "profile"), "--print-to-pdf=" + output, new Uri(input).AbsoluteUri }) start.ArgumentList.Add(argument);
            using var process = Process.Start(start) ?? throw new InvalidOperationException("No se pudo iniciar el generador PDF.");
            var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(60));
            try { await process.WaitForExitAsync(timeout.Token); }
            catch (OperationCanceledException) { process.Kill(true); await process.WaitForExitAsync(); throw new TimeoutException("El generador PDF excedió 60 segundos."); }
            await Task.WhenAll(stdout, stderr);
            if (process.ExitCode != 0 || !File.Exists(output)) throw new InvalidOperationException("El navegador no generó el PDF de la plantilla.");
            return await File.ReadAllBytesAsync(output);
        }
        finally
        {
            
            var full = Path.GetFullPath(directory); var root = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (full.StartsWith(root, StringComparison.OrdinalIgnoreCase) && Path.GetFileName(full).StartsWith("inventario-carta-", StringComparison.Ordinal))
                try { Directory.Delete(full, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
    }
}
