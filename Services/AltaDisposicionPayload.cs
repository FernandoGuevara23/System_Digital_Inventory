using System.Text.Json.Nodes;
namespace TRG2._0_VNET.Services;

internal static class AltaDisposicionPayload
{
    public static string[] Single(JsonObject payload, Func<string, Exception> error)
    {
        var node = payload["Service_Tags"];
        var single = payload.ContainsKey("Service_Tag") ? payload["Service_Tag"] : payload["service_tag"];
        if (node == null && single != null) node = new JsonArray(single.DeepClone());
        if (node is not JsonArray list || list.Count == 0) throw error("Selecciona al menos un equipo");
        if (list.Count != 1) throw error("Se requiere un solo equipo");
        var value = list[0];
        var tag = value == null ? "None" : value is JsonValue scalar && scalar.TryGetValue<bool>(out var boolean) ? (boolean ? "True" : "False") : value.ToString().Trim();
        if (tag.Length == 0) throw error("Los Service Tags no pueden estar vacíos");
        return [tag];
    }
}
