using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using System.Text.Json.Nodes;
namespace TRG2._0_VNET.Services;

public sealed class SmtpCartaMail(IConfiguration configuration) : ICartaMail
{
    private string? Setting(string key) => configuration["Mail:" + key] ?? configuration[key] ?? Environment.GetEnvironmentVariable(key);
    public MailMessage Message(JsonObject snapshot, IReadOnlyCollection<string> recipients, byte[] attachment, string filename)
    {
        var sender = Setting("MAIL_DEFAULT_SENDER") ?? Setting("SMTP_USERNAME") ?? throw new InvalidOperationException("Falta configurar el remitente SMTP.");
        var message = new MailMessage { From = new MailAddress(sender), Subject = $"Carta Responsiva - {CartasService.S(snapshot["nombre_titular"])} - {CartasService.S(snapshot["hostname"])}", SubjectEncoding = Encoding.UTF8, BodyEncoding = Encoding.UTF8, Body = "Adjunto se encuentra la carta responsiva del equipo asignado." };
        try
        {
            foreach (var address in recipients.Select(r => r.Trim()).Where(r => r.Length > 0).Distinct()) message.To.Add(address);
            if (message.To.Count == 0) throw new InvalidOperationException("No se recibió ningún destinatario.");
            var addresses = new HashSet<string>(message.To.Select(address => address.Address), StringComparer.OrdinalIgnoreCase);
            foreach (var item in configuration.GetSection("Mail:CC_EMAILS").GetChildren())
            {
                if (string.IsNullOrWhiteSpace(item.Value)) continue;
                var address = new MailAddress(item.Value.Trim());
                if (addresses.Add(address.Address)) message.CC.Add(address);
            }
            var html = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Cartas", "correo.html")).Replace("{nombre}", WebUtility.HtmlEncode(CartasService.S(snapshot["nombre_titular"])));
            var view = AlternateView.CreateAlternateViewFromString(html, Encoding.UTF8, MediaTypeNames.Text.Html);
            var logo = Path.Combine(AppContext.BaseDirectory, "Cartas", "Marquardt.jpg");
            if (File.Exists(logo)) view.LinkedResources.Add(new LinkedResource(logo, MediaTypeNames.Image.Jpeg) { ContentId = "logoMarquardt" });
            message.AlternateViews.Add(view);
            message.Attachments.Add(new Attachment(new MemoryStream(attachment, writable: false), filename, MediaTypeNames.Application.Pdf));
            return message;
        }
        catch { message.Dispose(); throw; }
    }
    public async Task Send(JsonObject snapshot, IReadOnlyCollection<string> recipients, byte[] attachment, string filename)
    {
        var server = Setting("SMTP_SERVER"); var user = Setting("SMTP_USERNAME"); var password = Setting("SMTP_PASSWORD");
        if (string.IsNullOrWhiteSpace(server) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password)) throw new InvalidOperationException("Falta configurar SMTP_SERVER, SMTP_USERNAME o SMTP_PASSWORD.");
        using var message = Message(snapshot, recipients, attachment, filename);
        using var smtp = new SmtpClient(server, int.TryParse(Setting("SMTP_PORT"), out var port) ? port : 587) { EnableSsl = !new[] { "false", "0", "no" }.Contains((Setting("SMTP_USE_TLS") ?? "true").ToLowerInvariant()), UseDefaultCredentials = false, Credentials = new NetworkCredential(user, password.Replace(" ", "")), Timeout = 30000 };
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        await smtp.SendMailAsync(message, timeout.Token);
    }
}
