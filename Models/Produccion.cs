using System;
using System.Collections.Generic;

namespace TRG2._0_VNET.Models;

public partial class Produccion
{
    public int id { get; set; }

    public string Service_Tag { get; set; } = null!;

    public string? Datos_Equipo { get; set; }

    public string Accion { get; set; } = null!;

    public string Detalle { get; set; } = null!;

    public int? Payroll_Anterior { get; set; }

    public string? Nombre_Empleado_Anterior { get; set; }

    public DateTime Fecha { get; set; }

    public DateTime? Fecha_Liberacion { get; set; }

    public string? Usuario { get; set; }

    public string? Hostname { get; set; }
}
