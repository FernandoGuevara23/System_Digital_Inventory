using TRG2._0_VNET;

var builder = WebApplication.CreateBuilder(args);
ApplicationSetup.AddApplication(builder);
var app = builder.Build();
ApplicationSetup.UseApplication(app);
app.Run();
