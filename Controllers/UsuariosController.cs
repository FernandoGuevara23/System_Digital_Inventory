using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using TRG2._0_VNET.Contracts;
using TRG2._0_VNET.Models;
using TRG2._0_VNET.Services;

namespace TRG2._0_VNET.Controllers;

[ApiController]
[Route("api/usuarios")]
public sealed class UsuariosController(IUsuarioRepository usuarios, WerkzeugPasswordHasher passwords) : ControllerBase
{
    private static string? Text(JsonElement body, string key) =>
        body.ValueKind == JsonValueKind.Object && body.TryGetProperty(key, out var value)
        && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    private ObjectResult Error(int status, string message) => StatusCode(status, new { success = false, error = message });

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var data = (await usuarios.ListAsync()).Select(UsuarioDto.From).ToArray();
        return Ok(new { success = true, data, total = data.Length });
    }

    [HttpGet("{id:int:min(0)}")]
    public async Task<IActionResult> Get(int id)
    {
        var usuario = await usuarios.FindAsync(id);
        return usuario is null ? Error(404, "Usuario no encontrado") : Ok(new { success = true, data = UsuarioDto.From(usuario) });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] JsonElement body)
    {
        var username = Text(body, "username");
        var password = Text(body, "password");
        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            return Error(400, "Se requieren username y password");
        var usuario = await usuarios.FindAsync(username);
        if (usuario is null || !passwords.Verify(password, usuario.Password_Hash))
            return Error(401, "Credenciales inválidas");
        var identity = new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
            new Claim(ClaimTypes.Name, usuario.UserName)
        ], CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity), new AuthenticationProperties { IsPersistent = true, AllowRefresh = true });
        return Ok(new { success = true, message = "Login exitoso", data = UsuarioDto.From(usuario) });
    }

    [HttpGet("session")]
    public async Task<IActionResult> Session()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) || string.IsNullOrEmpty(User.Identity?.Name))
            return Error(401, "No hay sesión activa");
        var usuario = await usuarios.FindAsync(id);
        if (usuario is null)
        {
            await HttpContext.SignOutAsync();
            return Error(401, "Sesión inválida");
        }
        return Ok(new { success = true, data = UsuarioDto.From(usuario) });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync();
        return Ok(new { success = true, message = "Sesión cerrada correctamente" });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] JsonElement body)
    {
        var username = Text(body, "username");
        var password = Text(body, "password");
        var nombre = Text(body, "Nombre_Completo");
        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password) || string.IsNullOrEmpty(nombre))
            return Error(400, "Se requieren usuario, nombre completo y contraseña");
        username = username.Trim(); nombre = nombre.Trim();
        if (username.Length is 0 or > 50) return Error(400, "El usuario es obligatorio y no puede exceder 50 caracteres");
        if (nombre.Length is 0 or > 150) return Error(400, "El nombre completo es obligatorio y no puede exceder 150 caracteres");
        if (password.EnumerateRunes().Count() < 6) return Error(400, "La contraseña debe tener al menos 6 caracteres");
        if (await usuarios.FindAsync(username) is not null) return Error(400, "El usuario ya existe");
        var now = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
        var usuario = new Administrador { UserName = username, Nombre_Completo = nombre,
            Password_Hash = passwords.Hash(password), Fecha_Creacion = now, Fecha_Actualizacion = now };
        try { await usuarios.SaveAsync(usuario, create: true); }
        catch (UsuarioConflictException) { return Error(400, "El usuario ya existe"); }
        return StatusCode(201, new { success = true, message = "Usuario creado exitosamente", data = UsuarioDto.From(usuario) });
    }

    [HttpPut("{username}")]
    public async Task<IActionResult> Update(string username, [FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object || !body.EnumerateObject().Any())
            return Error(400, "No se proporcionaron datos para actualizar");
        var usuario = await usuarios.FindAsync(username);
        if (usuario is null) return Error(400, "Usuario no encontrado");
        var hasName = body.TryGetProperty("Nombre_Completo", out _);
        var nombre = Text(body, "Nombre_Completo")?.Trim();
        if (hasName && (string.IsNullOrEmpty(nombre) || nombre.Length > 150))
            return Error(400, "El nombre completo es obligatorio y no puede exceder 150 caracteres");
        var password = Text(body, "password");
        if (body.TryGetProperty("password", out var raw) && raw.ValueKind is not (JsonValueKind.String or JsonValueKind.Null or JsonValueKind.False)
            || !string.IsNullOrEmpty(password) && password.EnumerateRunes().Count() < 6)
            return Error(400, "La contraseña debe tener al menos 6 caracteres");
        var changed = hasName && usuario.Nombre_Completo != nombre || !string.IsNullOrEmpty(password);
        if (hasName) usuario.Nombre_Completo = nombre;
        if (!string.IsNullOrEmpty(password)) usuario.Password_Hash = passwords.Hash(password);
        if (changed)
        {
            usuario.Fecha_Actualizacion = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
            await usuarios.SaveAsync(usuario);
        }
        return Ok(new { success = true, message = "Usuario actualizado exitosamente", data = UsuarioDto.From(usuario) });
    }

    [HttpDelete("{id:int:min(0)}")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await usuarios.DeleteAsync(id, int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!));
        return result.Status == 200 ? Ok(new { success = true, message = result.Message }) : Error(result.Status, result.Message);
    }

    [HttpPut("{id:int:min(0)}/cambiar-contraseña")]
    public async Task<IActionResult> ChangePassword(int id, [FromBody] JsonElement body)
    {
        var password = Text(body, "nuevaContraseña");
        if (string.IsNullOrEmpty(password)) password = Text(body, "nueva_contraseña");
        if (password is null || password.Trim().EnumerateRunes().Count() < 6)
            return Error(400, "La contraseña debe tener al menos 6 caracteres");
        var usuario = await usuarios.FindAsync(id);
        if (usuario is null) return Error(404, "Usuario no encontrado");
        usuario.Password_Hash = passwords.Hash(password);
        usuario.Fecha_Actualizacion = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
        await usuarios.SaveAsync(usuario);
        return Ok(new { success = true, message = "Contraseña actualizada correctamente" });
    }
}
