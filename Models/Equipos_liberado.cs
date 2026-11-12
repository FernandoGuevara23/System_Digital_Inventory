using System;
using System.Collections.Generic;

namespace TRG2._0_VNET.Models;

public partial class Equipos_liberado
{
    public int id { get; set; }

    public string Service_Tag { get; set; } = null!;

    public string Accion { get; set; } = null!;

    public string Detalle { get; set; } = null!;

    public int? Payroll_Anterior { get; set; }

    public string? Nombre_Empleado_Anterior { get; set; }

    public string? Marca { get; set; }

    public string? Modelo { get; set; }

    public string? Tipo_Equipo { get; set; }

    public string? Numero_Telefono { get; set; }

    public string? Account { get; set; }

    public string? Apple_ID { get; set; }

    public string? Password_apple { get; set; }

    public decimal? Total_cuenta { get; set; }

    public string? Estado_Telefono { get; set; }

    public string? MQ_Asset { get; set; }

    public string? IMEI { get; set; }

    public string? Location { get; set; }

    public string Tipo_Liberacion { get; set; } = null!;

    public DateTime Fecha { get; set; }

    public DateTime? Fecha_Liberacion { get; set; }

    public string? Hostname { get; set; }

    public string? MAC { get; set; }
}
