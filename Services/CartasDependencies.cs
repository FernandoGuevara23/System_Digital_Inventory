using System.Text.Json.Nodes;

namespace TRG2._0_VNET.Services;

public interface ICartaPdf
{
    bool Available { get; }
    Task<byte[]> Render(JsonObject snapshot);
}

public interface ICartaMail
{
    Task Send(JsonObject snapshot, IReadOnlyCollection<string> recipients, byte[] attachment, string filename);
}

public static class CartaPdf
{
    public static string Filename(JsonObject snapshot)
    {
        var identifier = CartasService.Phone(CartasService.S(snapshot["device_type"])) ? CartasService.S(snapshot["imei"]) : CartasService.S(snapshot["hostname"]);
        if (identifier == "") identifier = CartasService.S(snapshot["service_tag"]);
        if (identifier == "") identifier = CartasService.Phone(CartasService.S(snapshot["device_type"])) ? "IMEI" : "Hostname";
        var owner = CartasService.S(snapshot["nombre_titular"]); if (owner == "") owner = "Propietario";
        var name = System.Text.RegularExpressions.Regex.Replace($"{identifier} - {owner}", "[<>:\"/\\\\|?*\\x00-\\x1f]", "_").Trim(' ', '.');
        return (name.Length == 0 ? "carta" : name) + ".pdf";
    }
}
