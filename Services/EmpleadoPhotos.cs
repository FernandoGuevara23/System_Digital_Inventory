namespace TRG2._0_VNET.Services;

public sealed class EmpleadoPhotos(IWebHostEnvironment environment, IConfiguration config)
{
    private string Resolve(string path) => Path.GetFullPath(path, environment.ContentRootPath);
    private string Folder => Resolve(config["Empleados:PhotoFolder"] ?? "uploads/empleados");
    private static bool IsName(string name) => !string.IsNullOrWhiteSpace(name) && name == Path.GetFileName(name)
        && name.IndexOfAny(['/', '\\', ':']) < 0 && name is not "." and not "..";
    public static bool Allowed(string filename) => Path.GetExtension(filename).ToLowerInvariant() is ".jpg" or ".jpeg" or ".png";

    public async Task<string?> SaveAsync(IFormFile? file, CancellationToken ct)
    {
        if (file is null || string.IsNullOrEmpty(file.FileName)) return null;
        if (!Allowed(file.FileName)) throw new EmpleadoValidationException("La foto debe ser JPG, JPEG o PNG");

        var name = Guid.NewGuid().ToString("N") + Path.GetExtension(file.FileName).ToLowerInvariant();
        Directory.CreateDirectory(Folder);
        var path = Path.Combine(Folder, name);
        try
        {
            await using var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            await file.CopyToAsync(output, ct);
        }
        catch { File.Delete(path); throw; }
        return "/api/empleados/fotos/" + name;
    }

    public void RemoveNew(string? url)
    {
        if (url is null) return;
        var name = url.Split('/').Last();
        if (IsName(name)) File.Delete(Path.Combine(Folder, name));
    }

    public string? Find(string name)
    {
        if (!IsName(name) || !Allowed(name)) return null;
        var path = Path.Combine(Folder, name);
        if (File.Exists(path)) return path;
        var legacy = config["Empleados:LegacyPhotoFolder"];
        if (string.IsNullOrWhiteSpace(legacy)) return null;
        path = Path.Combine(Resolve(legacy), name);
        return File.Exists(path) ? path : null;
    }
}
