using System;
using System.Collections.Generic;

namespace TRG2._0_VNET.Models;

public partial class Equipo
{
    public string Service_Tag { get; set; } = null!;

    public int? Payroll { get; set; }

    public int? Id_Proyecto { get; set; }

    public string Marca { get; set; } = null!;

    public string Modelo { get; set; } = null!;

    public string Tipo_Equipo { get; set; } = null!;

    public int? Tipo_Equipo_Id { get; set; }

    public string? MQ_Asset { get; set; }

    public string? IMEI { get; set; }

    public string? Location { get; set; }

    public string? Comments { get; set; }

    public string? Accesorios { get; set; }

    public string? Trace { get; set; }

    public string Estado { get; set; } = null!;

    public DateTime Fecha_Creacion { get; set; }

    public string? Hostname { get; set; }

    public string? MAC { get; set; }

    public virtual Proyecto? Id_ProyectoNavigation { get; set; }

    public virtual Empleado? PayrollNavigation { get; set; }

    public virtual Catalogos_Tipos_Equipo? Tipo_EquipoNavigation { get; set; }
}
