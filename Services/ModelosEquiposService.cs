using System.Globalization;
using System.Numerics;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;

namespace TRG2._0_VNET.Services;

public sealed class ModelosEquiposService(InventarioDbContext db)
{
    private static readonly (string Key, string[] Matches, string Prefix)[] Categories = [
        ("latitude", ["latitude"], "MN"), ("optiplex", ["optiplex"], "MD"), ("precision", ["precision", "presicion"], "MN") ];

    private static bool Matches(string model, string[] patterns) => patterns.Any(model.Contains);

    public async Task<object> Summary()
    {
        var groups = await db.Equipos.AsNoTracking().Where(e => e.Modelo != null)
            .GroupBy(e => e.Modelo).Select(g => new { Model = g.Key, Count = g.Count() }).ToListAsync();
        var normalized = new Dictionary<string, (string Model, int Count)>(StringComparer.Ordinal);
        foreach (var group in groups)
        {
            var model = group.Model.Trim();
            if (model.Length == 0) continue;
            var key = ModelosCaseFold.Fold(model);
            normalized[key] = normalized.TryGetValue(key, out var previous) ? (previous.Model, previous.Count + group.Count) : (model, group.Count);
        }
        var models = Categories.ToDictionary(c => c.Key, _ => new List<Dictionary<string, object>>());
        var totals = Categories.ToDictionary(c => c.Key, _ => 0);
        foreach (var (model, count) in normalized.Values)
            foreach (var category in Categories)
                if (Matches(ModelosCaseFold.Fold(model), category.Matches))
                {
                    models[category.Key].Add(new() { ["Model"] = model, ["Cantidad"] = count });
                    totals[category.Key] += count;
                    break;
                }
        var hostnames = new Dictionary<string, object>();
        foreach (var category in Categories)
        {
      
            var first = category.Matches[0];
            var second = category.Matches[^1];
            var candidates = await db.Equipos.AsNoTracking().Where(e => e.Hostname != null && e.Modelo != null && (
                e.Modelo.Trim().ToLower().Contains(first) || e.Modelo.Trim().ToLower().Contains(second)))
                .Select(e => e.Hostname!).ToListAsync();
            long? maximum = null;
            foreach (var hostname in candidates)
            {
                if (!hostname.Trim(' ').StartsWith(category.Prefix, StringComparison.OrdinalIgnoreCase) || hostname.Length <= category.Prefix.Length) continue;
              
                var suffix = hostname.Substring(category.Prefix.Length, Math.Min(50, hostname.Length - category.Prefix.Length));
                if (suffix.Any(c => c < '0' || c > '9') || !long.TryParse(suffix, NumberStyles.None, CultureInfo.InvariantCulture, out var number)) continue;
                maximum = maximum.HasValue ? Math.Max(maximum.Value, number) : number;
            }
            hostnames[category.Key] = maximum is long last
                ? new { ultimo = category.Prefix + last.ToString("D4", CultureInfo.InvariantCulture), siguiente = category.Prefix + (new BigInteger(last) + 1).ToString("D4", CultureInfo.InvariantCulture) }
                : new { ultimo = "Sin registros", siguiente = category.Prefix + "5100" };
        }
        return new { modelos = models, modelos_totales = totals, hostnames };
    }

    public async Task<List<Dictionary<string, object?>>> Details(string model)
    {
        var key = ModelosCaseFold.Fold(model.Trim());
        var rows = await db.Equipos.AsNoTracking().Where(e => e.Modelo.Trim().ToLower() == key)
            .OrderBy(e => e.Tipo_Equipo.Trim().ToLower()).ThenBy(e => e.Hostname == null ? null : e.Hostname.Trim().ToLower())
            .ThenBy(e => e.Service_Tag.Trim().ToLower())
            .Select(e => new { e.Modelo, e.Tipo_Equipo, e.Hostname, e.Service_Tag }).ToListAsync();
        return rows.Select(e => new Dictionary<string, object?> { ["Modelo"] = e.Modelo, ["Tipo_Equipo"] = e.Tipo_Equipo, ["Hostname"] = e.Hostname, ["Service_Tag"] = e.Service_Tag }).ToList();
    }
}
