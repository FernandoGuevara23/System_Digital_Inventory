using System;
using System.Collections.Generic;

namespace TRG2._0_VNET.Models;

public partial class cartas_responsiva
{
    public int id { get; set; }

    public string service_tag { get; set; } = null!;

    public string device_type { get; set; } = null!;

    public string payroll_titular { get; set; } = null!;

    public string nombre_titular { get; set; } = null!;

    public string? payroll_secundario { get; set; }

    public string? nombre_secundario { get; set; }

    public string tipo_carta { get; set; } = null!;

    public string estado { get; set; } = null!;

    public DateTime? fecha_envio { get; set; }

    public DateTime? fecha_firma { get; set; }

    public string? observaciones { get; set; }

    public string? datos_json { get; set; }

    public string? Carta_Activa_Key { get; set; }

    public string? hostname { get; set; }
}
