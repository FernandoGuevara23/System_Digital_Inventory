using Microsoft.AspNetCore.Mvc;
using TRG2._0_VNET.Data;
using TRG2._0_VNET.Models;

namespace TRG2._0_VNET.Services
{
    public sealed class AuditoriaService(InventarioDbContext db)
    {
        public void RegistrarMovimiento(
            string etiqueta,
            string accion,
            string detalle,
            int? nominaAnterior,
            int? nominaNueva,
            string? usuario)
        {
            db.Movimientos_Equipos.Add(new Movimientos_Equipo
            {
                Service_Tag = etiqueta,
                Accion = accion,
                Detalle = detalle,
                Payroll_Anterior = nominaAnterior,
                Payroll_Nuevo = nominaNueva,
                Usuario = usuario,
                Fecha = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified)
            });
        }
    }
}
