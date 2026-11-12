using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Authentication;
using TRG2._0_VNET.Controllers;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Services;

namespace TRG2._0_VNET;

public static class ApplicationSetup
{
    public static void AddApplication(WebApplicationBuilder builder)
    {
        builder.Services.AddControllers().AddApplicationPart(typeof(UsuariosController).Assembly)
            .ConfigureApiBehaviorOptions(options => options.InvalidModelStateResponseFactory = _ =>
                new BadRequestObjectResult(new { success = false, error = "El cuerpo JSON de la solicitud no es válido." }));
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();
        var connectionString = builder.Configuration.GetConnectionString("InventarioConnection")
            ?? throw new InvalidOperationException("No se encontró la cadena de conexión.");
        builder.Services.AddDbContext<InventarioDbContext>(options => options.UseSqlServer(connectionString));
        builder.Services.AddScoped<IUsuarioRepository, UsuarioRepository>();
        builder.Services.AddScoped<CatalogosService>();
        builder.Services.AddScoped<EmpleadosService>();
        builder.Services.AddScoped<EquiposService>();
        builder.Services.AddScoped<EquiposLiberadosService>();
        builder.Services.AddScoped<LineasService>();
        builder.Services.AddScoped<CartasService>();
        builder.Services.AddScoped<ScrapService>();
        builder.Services.AddScoped<DonacionService>();
        builder.Services.AddScoped<ProduccionService>();
        builder.Services.AddScoped<VentaService>();
        builder.Services.AddSingleton<ChromiumReportPdf>();
        builder.Services.AddScoped<ReportesService>();
        builder.Services.AddScoped<DashboardService>();
        builder.Services.AddScoped<ModelosEquiposService>();
        builder.Services.AddScoped<EquiposProyectosService>();
        builder.Services.AddSingleton<ICartaPdf, ChromiumCartaPdf>();
        builder.Services.AddSingleton<ICartaMail, SmtpCartaMail>();
        builder.Services.AddScoped<LineasExcel>();
        builder.Services.AddScoped<EquiposExcel>();
        builder.Services.AddScoped<EmpleadosExcel>();
        builder.Services.AddSingleton<EmpleadoPhotos>();
        builder.Services.AddSingleton<WerkzeugPasswordHasher>();
        var keys = builder.Services.AddDataProtection().SetApplicationName("TRG.Inventario");
        var keyPath = builder.Configuration["Authentication:KeyRingPath"];
        if (!string.IsNullOrWhiteSpace(keyPath)) keys.PersistKeysToFileSystem(new DirectoryInfo(keyPath));
        builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
        {
            options.Cookie.Name = "inventario_session";
            options.Cookie.Path = "/";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.None : CookieSecurePolicy.Always;
            options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
            options.SlidingExpiration = true;
  
            options.Events.OnValidatePrincipal = context => { context.ShouldRenew = true; return Task.CompletedTask; };
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = 401;
                return context.Response.WriteAsJsonAsync(new { success = false, error = "Debe iniciar sesión para acceder a esta aplicación." });
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = 403;
                return context.Response.WriteAsJsonAsync(new { success = false, error = "Acceso denegado." });
            };
        });
        builder.Services.AddAuthorization();
        var origins = (builder.Configuration["CORS_ORIGINS"] ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (origins.Length == 0 && builder.Environment.IsDevelopment())
            origins = ["http://localhost:4200", "http://127.0.0.1:4200"];
        builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
        {
            if (origins.Length > 0) policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        }));
    }

    public static void UseApplication(WebApplication app)
    {
        app.UseDefaultFiles();
        app.UseStaticFiles();
        app.Use(async (context, next) =>
        {
            try { await next(context); }
            catch (Exception error) when (!context.Response.HasStarted)
            {
                app.Logger.LogError(error, "Error en la solicitud API {Path}", context.Request.Path);
                context.Response.Clear();
                context.Response.StatusCode = 500;
                await context.Response.WriteAsJsonAsync(new { success = false, error = "Error interno del servidor" });
            }
        });
        app.UseStatusCodePages(async context =>
        {

            var response = context.HttpContext.Response;
            await response.WriteAsJsonAsync(new { success = false, error = response.StatusCode == 404
                ? "Recurso no encontrado" : "La solicitud no pudo procesarse." });
        });
        if (!app.Environment.IsDevelopment()) app.UseHttpsRedirection();
        app.UseRouting();
        app.UseCors();
        app.UseAuthentication();
        app.UseMiddleware<ApiSessionMiddleware>();
        app.UseAuthorization();
        if (app.Environment.IsDevelopment()) app.UseSwagger(options => options.RouteTemplate = "openapi/{documentName}.json");
        app.MapGet("/api/status", () => Results.Ok(new { success = true,
            message = "Servidor .NET encendido", version = "1.0.0" }));
        app.MapControllers();
        app.MapFallbackToFile("index.html");
    }
}








