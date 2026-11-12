using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using ExcelDataReader;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
namespace TRG2._0_VNET.Services;

public sealed class LineasExcel(InventarioDbContext db, LineasService lines, EquiposService equipment)
{
    private static readonly HashSet<string> Missing = ["", "#N/A", "#N/A N/A", "#NA", "-1.#IND", "-1.#QNAN", "-NaN", "-nan", "1.#IND", "1.#QNAN", "<NA>", "N/A", "NA", "NULL", "NaN", "None", "n/a", "nan", "null"];
    private static string Text(object? v) => Convert.ToString(v, CultureInfo.InvariantCulture) ?? "";
    private static string Header(object? v) => new(Text(v).Normalize(NormalizationForm.FormKD).Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());
    public async Task<object> Import(Stream stream)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        using var reader = ExcelReaderFactory.CreateReader(stream, new ExcelReaderConfiguration { LeaveOpen = true });
        var rows = new List<object?[]>(); var width = reader.FieldCount;
        while (reader.Read())
        {
            var row = new object?[reader.FieldCount];
            for (var c = 0; c < row.Length; c++) { var v = reader.GetValue(c); row[c] = v is string s && Missing.Contains(s) ? null : v; }
            rows.Add(row);
        }
        var start = 4; int[] cols = [3, 4, 14]; var found = false;
        string[][] aliases = [["cuentahija", "account", "cuenta"], ["numerodetelefono", "telefono", "numero"], ["total", "totalcuenta"]];
        for (var r = 0; r < Math.Min(rows.Count, 10); r++)
        {
            var headers = new Dictionary<string, int>(); for (var c = 0; c < rows[r].Length; c++) headers[Header(rows[r][c])] = c;
            var detected = aliases.Select(group => group.Where(headers.ContainsKey).Select(k => (int?)headers[k]).FirstOrDefault()).ToArray();
            if (detected.All(x => x != null)) { cols = detected.Select(x => x!.Value).ToArray(); start = r + 1; found = true; break; }
        }
        if (!found && width <= 14) throw new EquipoValidationException("El archivo debe incluir Cuenta, Numero de Telefono y Total; en formato sin encabezados se esperan en las columnas 3, 5 y 15.");
        var errors = new List<string>(); var missing = new List<object>(); var accounts = new HashSet<string>(StringComparer.OrdinalIgnoreCase); var numbers = new HashSet<string>(); var count = 0;
        await using var transaction = await db.Database.BeginTransactionAsync();
        for (var r = start; r < rows.Count; r++)
        {
            var row = rows[r]; var account = Text(row[cols[0]]).Trim(); var phone = Text(row[cols[1]]).Trim(); var raw = row[cols[2]]; var n = r + 1;
            if (row[cols[1]] is double numericPhone && double.IsFinite(numericPhone) && numericPhone == Math.Truncate(numericPhone)) phone = numericPhone.ToString("0", CultureInfo.InvariantCulture);
            if (account == "" && phone == "" && raw == null) continue;
            if (account == "") { errors.Add($"Fila {n}: falta la Cuenta hija."); continue; }
            if (phone == "") { errors.Add($"Fila {n}: falta el número de teléfono."); continue; }
            decimal total;
            var totalText = Text(raw).Trim();
            if (totalText.Contains("inf", StringComparison.OrdinalIgnoreCase)) { errors.Add($"Fila {n}: El total de cuenta debe ser un importe finito."); continue; }
            if (raw == null || !decimal.TryParse(totalText, NumberStyles.Float, CultureInfo.InvariantCulture, out total)) { errors.Add($"Fila {n}: Total debe ser un importe numérico."); continue; }
            total = decimal.Round(total, 2, MidpointRounding.ToZero);
            try { total = LineasService.Total(total.ToString(CultureInfo.InvariantCulture)); }
            catch (EquipoValidationException e) { errors.Add($"Fila {n}: {e.Message}"); continue; }
            if (!accounts.Add(account)) { errors.Add($"Fila {n}: la Cuenta hija '{account}' está repetida en el archivo."); continue; }
            var key = account.ToLowerInvariant();
            var matches = await db.Telefonos.Where(p => p.Account != null && p.Account.Trim().ToLower() == key).ToListAsync();
            if (matches.Count == 0) { missing.Add(new { fila = n, account, telefono = phone }); continue; }
            if (matches.Count > 1) { errors.Add($"Fila {n}: la Cuenta hija '{account}' coincide con más de una línea y no se puede actualizar de forma segura."); continue; }
            var line = matches[0]; var tag = line.Service_Tag; var device = await db.Equipos.FindAsync(tag);
            if (device == null) { errors.Add($"Fila {n}: la línea de la Cuenta hija '{account}' no tiene un equipo asociado."); continue; }
            if (!EquiposService.PhoneType(device.Tipo_Equipo)) { errors.Add($"Fila {n}: el Service Tag '{tag}' no corresponde a un teléfono."); continue; }
            if (!LineasService.InInventory(device)) { errors.Add($"Fila {n}: el equipo '{tag}' está fuera de servicio."); continue; }
            try { await equipment.CheckCc(device.Payroll); phone = await lines.NormalizePhone(phone, tag); }
            catch (EquipoValidationException e) { errors.Add($"Fila {n}: {e.Message}"); continue; }
            if (!numbers.Add(phone)) { errors.Add($"Fila {n}: el número de teléfono está duplicado en el archivo."); continue; }
            line.Account = account; line.Numero_Telefono = phone; line.Total_cuenta = total;
            equipment.ValidateLengths(line);

            await db.SaveChangesAsync(); count++;
        }
        await transaction.CommitAsync();
        return new { success = true, message = $"Se actualizaron {count} líneas desde el archivo Excel", procesadas = count, no_encontradas = missing, errores = errors };
    }
    public async Task<byte[]> Export()
    {
        var rows = (await lines.List()).Cast<Dictionary<string, object?>>().ToArray();
        if (rows.Length == 0) throw new EquipoValidationException("No hay líneas telefónicas para exportar.", 404);
        var tags = rows.Select(r => (string)r["Service_Tag"]!).ToArray();

        var devices = await equipment.Query.AsNoTracking().Where(e => tags.Contains(e.Service_Tag)).ToDictionaryAsync(e => e.Service_Tag);
        var values = new List<object?[]> { new object?[] { "Service Tag", "Número de Teléfono", "Account", "Total Cuenta", "Estado", "CC" } };
        values.AddRange(rows.Select(r => new object?[] { r["Service_Tag"], r["Numero_Telefono"], r["Account"], r["Total_cuenta"] is decimal amount ? amount.ToString("0.00", CultureInfo.InvariantCulture) : null, r["Estado"], devices.GetValueOrDefault((string)r["Service_Tag"]!)?.PayrollNavigation?.CC }));
        using var output = new MemoryStream(); output.Write(EquiposExcel.Template()); output.Position = 0;
        using (var zip = new ZipArchive(output, ZipArchiveMode.Update, true))
        {
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            var sheetData = new XElement(ns + "sheetData");
            for (var r = 0; r < values.Count; r++)
            {
                var row = new XElement(ns + "row", new XAttribute("r", r + 1));
                for (var c = 0; c < values[r].Length; c++)
                {
                    var v = values[r][c]; if (v == null) continue;
                    var cell = new XElement(ns + "c", new XAttribute("r", $"{(char)('A' + c)}{r + 1}"), new XAttribute("t", v is int ? "n" : "inlineStr"));
                    cell.Add(v is int ? new XElement(ns + "v", Text(v)) : new XElement(ns + "is", new XElement(ns + "t", new XAttribute(XNamespace.Xml + "space", "preserve"), Text(v))));
                    row.Add(cell);
                }
                sheetData.Add(row);
            }
            var columns = new XElement(ns + "cols", Enumerable.Range(0, 6).Select(c =>
                new XElement(ns + "col", new XAttribute("min", c + 1), new XAttribute("max", c + 1),
                    new XAttribute("width", Math.Min(255, Math.Max(14, values.Max(row => Text(row[c]).Length) + 3))), new XAttribute("customWidth", 1))));
            var sheet = new XElement(ns + "worksheet", columns, sheetData);
            XDocument workbook; using (var input = zip.GetEntry("xl/workbook.xml")!.Open()) workbook = XDocument.Load(input);
            workbook.Descendants(ns + "sheet").Single().SetAttributeValue("name", "Líneas Telefónicas");
            void Replace(string path, XNode xml) { zip.GetEntry(path)!.Delete(); using var writer = new StreamWriter(zip.CreateEntry(path).Open(), new UTF8Encoding(false)); writer.Write(xml.ToString()); }
            Replace("xl/workbook.xml", workbook); Replace("xl/worksheets/sheet1.xml", sheet);
        }
        return output.ToArray();
    }
}


