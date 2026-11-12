using System;
using System.Collections.Generic;

namespace TRG2._0_VNET.Models;

public partial class Movimientos_Equipo
{
    public int Id { get; set; }

    public string Service_Tag { get; set; } = null!;

    public string Accion { get; set; } = null!;

    public string Detalle { get; set; } = null!;

    public int? Payroll_Anterior { get; set; }

    public int? Payroll_Nuevo { get; set; }

    public string? Usuario { get; set; }

    public DateTime Fecha { get; set; }

    public string? Hostname { get; set; }
}
