using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using TRG2._0_VNET.Services;

namespace TRG2._0_VNET.Authentication;

public sealed class ApiSessionMiddleware(RequestDelegate next)
{
    private static readonly Dictionary<string, string> PublicPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        ["/api/status"] = "GET", ["/api/usuarios/login"] = "POST",
        ["/api/usuarios/session"] = "GET", ["/api/usuarios/logout"] = "POST"
    };

    public async Task InvokeAsync(HttpContext context, IUsuarioRepository usuarios)
    {
        if (HttpMethods.IsOptions(context.Request.Method)) { context.Response.StatusCode = 200; return; }
        var path = context.Request.Path.Value?.TrimEnd('/') ?? "";
     
        var isPublic = PublicPaths.TryGetValue(path, out var method) && context.Request.Method == method;
        if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) && !isPublic)
        {
            string? error = null;
            if (context.User.Identity?.IsAuthenticated != true ||
                !int.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
                error = "Debe iniciar sesión para acceder a esta aplicación.";
            else if (await usuarios.FindAsync(id) is null)
            {
                await context.SignOutAsync();
                error = "La cuenta de administrador ya no existe.";
            }
            if (error is not null)
            {
                context.Response.StatusCode = 401;
                await context.Response.WriteAsJsonAsync(new { success = false, error });
                return;
            }
        }
        await next(context);
    }
}
