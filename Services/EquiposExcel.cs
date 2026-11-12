using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using ExcelDataReader;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;

namespace TRG2._0_VNET.Services;

public sealed class EquiposExcel(InventarioDbContext db, EquiposService equipment)
{
    public static readonly string[] Headers = ["DeviceType", "serviceTag", "hostname", "brand", "model", "mac", "comments", "location", "accesorios"];
    private static readonly HashSet<string> Missing = ["", "#N/A", "#N/A N/A", "#NA", "-1.#IND", "-1.#QNAN", "-NaN", "-nan", "1.#IND", "1.#QNAN", "<NA>", "N/A", "NA", "NULL", "NaN", "None", "n/a", "nan", "null"];
    private static string? Text(object? value) => value is null ? null : Convert.ToString(value, CultureInfo.InvariantCulture);
    private static string Key(string value) => value.Trim().ToLowerInvariant().Replace(' ', '_');
    private static string MacKey(string value) => value.ToUpperInvariant().Replace(":", "").Replace("-", "").Replace(".", "").Replace(" ", "");
    public async Task<int> Import(Stream stream, string? actor)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        using var reader = ExcelReaderFactory.CreateReader(stream, new ExcelReaderConfiguration { LeaveOpen = true });
        var columns = new Dictionary<string, int>();
        if (reader.Read()) for (var i = 0; i < reader.FieldCount; i++) if (reader.GetValue(i) is { } v) columns[Key(Text(v)!)] = i;
        var required = new (string Name, string[] Aliases)[]
        {
            ("DeviceType", new[] { "devicetype", "device_type", "tipo_equipo" }),
            ("serviceTag", new[] { "servicetag", "service_tag" }),
            ("brand", new[] { "brand", "marca" }),
            ("model", new[] { "model", "modelo" })
        };
        var missing = required.Where(x => !x.Aliases.Any(columns.ContainsKey)).Select(x => x.Name).ToArray();
        if (missing.Length > 0) throw new EquipoValidationException("Faltan columnas requeridas: " + string.Join(", ", missing));

        var rows = new List<object?[]>();
        while (reader.Read()) { var row = new object?[reader.FieldCount]; for (var i = 0; i < row.Length; i++) row[i] = reader.GetValue(i); rows.Add(row); }
        while (rows.Count > 0 && rows[^1].All(v => v == null || v is string s && s.Length == 0)) rows.RemoveAt(rows.Count - 1);
        var tags = new HashSet<string>(StringComparer.OrdinalIgnoreCase); var hostnames = new HashSet<string>(StringComparer.OrdinalIgnoreCase); var macs = new HashSet<string>();
        var records = new List<(Equipo Equipment, Telefono Phone)>();
        for (var index = 0; index < rows.Count; index++)
        {
            var row = rows[index]; var number = index + 2;
            object? Get(params string[] names)
            {
                foreach (var name in names) if (columns.TryGetValue(name, out var col) && row[col] is { } v && !(v is string s && Missing.Contains(s))) return v;
                return null;
            }
            string? S(params string[] names) => Text(Get(names));
            var tag = S("service_tag", "servicetag")?.Trim(); var typeName = S("tipo_equipo", "devicetype", "device_type")?.Trim(); var brand = S("brand", "marca")?.Trim(); var model = S("model", "modelo")?.Trim();
            if (new[] { tag, typeName, brand, model }.Any(string.IsNullOrEmpty)) throw new EquipoValidationException($"La fila {number} tiene campos requeridos vacíos");
            if (!tags.Add(tag!)) throw new EquipoValidationException($"El Service Tag ya existe: {tag}");
            await equipment.CheckTag(tag!);
            var host = S("hostname")?.Trim(); if (host == "") host = null;
            if (host?.Length > 50) throw new EquipoValidationException($"Fila {number}: El Hostname no puede exceder 50 caracteres");
            if (host != null)
            {
                if (!hostnames.Add(host) || await db.Equipos.AnyAsync(x => x.Hostname != null && x.Hostname.Trim().ToLower() == host.ToLowerInvariant()))
                    throw new EquipoValidationException($"El Hostname ya existe: {host}");
            }
            var mac = S("mac", "mac_address")?.Trim(); if (mac == "") mac = null;
            if (mac != null)
            {
                if (!macs.Add(MacKey(mac))) throw new EquipoValidationException($"Fila {number}: la dirección MAC está duplicada en el archivo");
                try { await equipment.CheckMac(mac, null); } catch (EquipoValidationException e) { throw new EquipoValidationException($"Fila {number}: {e.Message}"); }
            }
            var normalizedType = typeName!.ToLowerInvariant();
            var type = await db.Catalogos_Tipos_Equipos.FirstOrDefaultAsync(x => x.Nombre_Tipo_Equipo.ToLower() == normalizedType)
                ?? throw new EquipoValidationException($"El Tipo_Equipo '{typeName}' de la fila {number} no existe en el catálogo");
            int? payroll = null;
            if (Get("payroll") is { } raw)
            {
                try { payroll = raw is double d ? checked((int)Math.Truncate(d)) : raw is bool b ? (b ? 1 : 0) : int.Parse(Text(raw)!, CultureInfo.InvariantCulture); }
                catch (Exception e) when (e is FormatException or OverflowException) { throw new EquipoValidationException($"Error al procesar Excel: Payroll no válido en fila {number}"); }
            }
       
            var entity = new Equipo { Service_Tag = tag!, Hostname = host, MAC = mac, Payroll = payroll, Tipo_Equipo = type.Nombre_Tipo_Equipo, Marca = brand!, Modelo = model!, IMEI = S("imei"), MQ_Asset = S("mq_asset", "asset"), Accesorios = S("accesorios"), Location = S("location", "ubicacion"), Comments = S("comments", "comentarios"), Estado = (S("estado") ?? "Disponible").Trim(), Trace = S("trace"), Fecha_Creacion = DateTime.UtcNow };
            if (!new[] { "Disponible", "Inactivo", "Reasignado" }.Contains(entity.Estado)) throw new EquipoValidationException($"Error al procesar Excel: Estado no válido en fila {number}");
            equipment.ValidateLengths(entity);
            records.Add((entity, new Telefono { Service_Tag = tag!, Numero_Telefono = S("numero_telefono", "telefono"), Account = S("account"), Apple_ID = S("apple_id"), Password_apple = S("password_apple"), Estado = "Activa" }));
        }
        var numbers = new HashSet<string>();
        foreach (var (entity, phone) in records)
        {
            if (string.IsNullOrWhiteSpace(phone.Numero_Telefono)) continue;
            if (!EquiposService.PhoneType(entity.Tipo_Equipo)) throw new EquipoValidationException($"El equipo {entity.Service_Tag} tiene un número telefónico pero no es de tipo teléfono.");
            try { phone.Numero_Telefono = await equipment.PhoneNumber(phone.Numero_Telefono); }
            catch (EquipoValidationException e) { throw new EquipoValidationException($"Fila de equipo {entity.Service_Tag}: {e.Message}"); }
            if (!numbers.Add(phone.Numero_Telefono)) throw new EquipoValidationException($"El número de teléfono está duplicado en el archivo: {phone.Numero_Telefono}");
            try { await equipment.CheckCc(entity.Payroll); }
            catch (EquipoValidationException e) { throw new EquipoValidationException($"Fila de equipo {entity.Service_Tag}: {e.Message}"); }
        }
        foreach (var (entity, phone) in records)
        {
            db.Equipos.Add(entity);
            if (EquiposService.PhoneType(entity.Tipo_Equipo) && new[] { phone.Numero_Telefono, phone.Account, phone.Apple_ID, phone.Password_apple }.Any(x => x != null)) { equipment.ValidateLengths(phone); db.Telefonos.Add(phone); }
            equipment.Movement(entity, "CREACION", $"Equipo agregado desde Excel: Service Tag: {entity.Service_Tag}, Marca: {entity.Marca}, Modelo: {entity.Modelo}, Hostname: {entity.Hostname ?? "None"}, MAC: {entity.MAC ?? "None"}", null, null, actor);
        }
        await db.SaveChangesAsync();
        return records.Count;
    }

    public async Task<byte[]> ExportHistory()
    {
        var records = await db.Movimientos_Equipos.AsNoTracking()
            .OrderBy(x => x.Fecha).ThenBy(x => x.Id).ToListAsync();
        var values = new List<object?[]>();
        values.Add(new object?[] { "No.", "Fecha", "Usuario", "Service Tag", "Acción", "Detalle" });
        values.AddRange(records.Select(x => new object?[]
        {
            x.Id,
            x.Fecha.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
            x.Usuario,
            x.Service_Tag,
            x.Accion,
            x.Detalle
        }));

        using var output = new MemoryStream();
        output.Write(Template());
        output.Position = 0;
        using (var zip = new ZipArchive(output, ZipArchiveMode.Update, true))
        {
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            var sheetData = new XElement(ns + "sheetData");
            for (var r = 0; r < values.Count; r++)
            {
                var row = new XElement(ns + "row", new XAttribute("r", r + 1));
                for (var c = 0; c < values[r].Length; c++)
                {
                    var value = values[r][c];
                    if (value == null) continue;
                    var cell = new XElement(ns + "c", new XAttribute("r", $"{(char)('A' + c)}{r + 1}"), new XAttribute("t", value is int ? "n" : "inlineStr"));
                    cell.Add(value is int
                        ? new XElement(ns + "v", Text(value))
                        : new XElement(ns + "is", new XElement(ns + "t", new XAttribute(XNamespace.Xml + "space", "preserve"), Text(value))));
                    row.Add(cell);
                }
                sheetData.Add(row);
            }
            var columns = new XElement(ns + "cols", Enumerable.Range(0, values[0].Length).Select(c =>
                new XElement(ns + "col", new XAttribute("min", c + 1), new XAttribute("max", c + 1),
                    new XAttribute("width", Math.Clamp(values.Max(row => Text(row[c])?.Length ?? 0) + 3, 14, 60)), new XAttribute("customWidth", 1))));
            var sheet = new XElement(ns + "worksheet", columns, sheetData);
            XDocument workbook;
            using (var input = zip.GetEntry("xl/workbook.xml")!.Open()) workbook = XDocument.Load(input);
            workbook.Descendants(ns + "sheet").Single().SetAttributeValue("name", "Historial General");
            void Replace(string path, XNode xml)
            {
                zip.GetEntry(path)!.Delete();
                using var writer = new StreamWriter(zip.CreateEntry(path).Open(), new UTF8Encoding(false));
                writer.Write(xml.ToString());
            }
            Replace("xl/workbook.xml", workbook);
            Replace("xl/worksheets/sheet1.xml", sheet);
        }
        return output.ToArray();
    }

    public static byte[] Template()
    {
        using var output = new MemoryStream();
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, true))
        {
            void Add(string path, string xml) { using var writer = new StreamWriter(zip.CreateEntry(path).Open(), new UTF8Encoding(false)); writer.Write(xml); }
            Add("[Content_Types].xml", "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
            Add("_rels/.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            Add("xl/workbook.xml", "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Equipos\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
            Add("xl/_rels/workbook.xml.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>");
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            var sheet = new XElement(ns + "worksheet", new XElement(ns + "sheetData", new XElement(ns + "row", new XAttribute("r", 1), Headers.Select((h, i) => new XElement(ns + "c", new XAttribute("r", $"{(char)('A' + i)}1"), new XAttribute("t", "inlineStr"), new XElement(ns + "is", new XElement(ns + "t", h)))))));
            sheet.AddFirst(new XElement(ns + "cols", Headers.Select((h, i) => new XElement(ns + "col",
                new XAttribute("min", i + 1), new XAttribute("max", i + 1), new XAttribute("width", Math.Max(16, h.Length + 3)), new XAttribute("customWidth", 1)))));
            Add("xl/worksheets/sheet1.xml", sheet.ToString());
        }
        return output.ToArray();
    }
}
