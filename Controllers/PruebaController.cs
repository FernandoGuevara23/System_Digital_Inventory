using Microsoft.AspNetCore.Mvc;

namespace TRG2._0_VNET.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PruebaController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get()
        {
            return Ok(new
            {
                success = true,
                mensaje = "API InventarioTGR funcionando",
                tecnologia = "ASP.NET Core .NET 10"
            });
        }
    }
}