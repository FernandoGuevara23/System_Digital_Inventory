using System.Diagnostics;
namespace TRG2._0_VNET.Services;

public sealed class ChromiumReportPdf(IConfiguration configuration)
{
    private string? Browser
    {
        get
        {
            var configured = configuration["Cartas:BrowserPath"];
            if (!string.IsNullOrWhiteSpace(configured)) return File.Exists(configured) ? configured : null;
            var candidates = new List<string> { @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", @"C:\Program Files\Microsoft\Edge\Application\msedge.exe", @"C:\Program Files\Google\Chrome\Application\chrome.exe", "/usr/bin/microsoft-edge", "/usr/bin/google-chrome", "/usr/bin/chromium" };
            foreach (var folder in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
                foreach (var name in new[] { "msedge.exe", "msedge", "microsoft-edge", "google-chrome", "chromium" })
                    candidates.Add(Path.Combine(folder, name));
            return candidates.FirstOrDefault(File.Exists);
        }
    }

    public bool Available => Browser != null;

    public async Task<byte[]> Render(string html)
    {
        var browser = Browser ?? throw new InvalidOperationException("No se encontró Edge o Chromium para generar el PDF.");
        var directory = Path.Combine(Path.GetTempPath(), "inventario-reporte-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try
        {
            var input = Path.Combine(directory, "reporte.html");
            var output = Path.Combine(directory, "reporte.pdf");
            await File.WriteAllTextAsync(input, html);
            var start = new ProcessStartInfo(browser) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardOutput = true, RedirectStandardError = true };
            foreach (var argument in new[] { "--headless", "--disable-gpu", "--no-first-run", "--no-pdf-header-footer", "--user-data-dir=" + Path.Combine(directory, "profile"), "--print-to-pdf=" + output, new Uri(input).AbsoluteUri }) start.ArgumentList.Add(argument);
            using var process = Process.Start(start) ?? throw new InvalidOperationException("No se pudo iniciar el generador PDF.");
            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(60));
            try { await process.WaitForExitAsync(timeout.Token); }
            catch (OperationCanceledException) { process.Kill(true); await process.WaitForExitAsync(); throw new TimeoutException("El generador PDF excedió 60 segundos."); }
            await Task.WhenAll(stdout, stderr);
            if (process.ExitCode != 0 || !File.Exists(output)) throw new InvalidOperationException("El navegador no generó el PDF del reporte.");
            return await File.ReadAllBytesAsync(output);
        }
        finally
        {
            var full = Path.GetFullPath(directory);
            var root = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (full.StartsWith(root, StringComparison.OrdinalIgnoreCase) && Path.GetFileName(full).StartsWith("inventario-reporte-", StringComparison.Ordinal))
                try { Directory.Delete(full, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
    }
}