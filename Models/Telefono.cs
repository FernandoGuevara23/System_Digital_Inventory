using System;
using System.Collections.Generic;

namespace TRG2._0_VNET.Models;

public partial class Telefono
{
    public string Service_Tag { get; set; } = null!;

    public string? Numero_Telefono { get; set; }

    public string? Account { get; set; }

    public string? Apple_ID { get; set; }

    public string? Password_apple { get; set; }

    public decimal? Total_cuenta { get; set; }

    public string Estado { get; set; } = null!;
}
