using System;
using System.Collections.Generic;

namespace TRG2._0_VNET.Models;

public partial class Administrador
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    public string Password_Hash { get; set; } = null!;

    public DateTime Fecha_Creacion { get; set; }

    public DateTime Fecha_Actualizacion { get; set; }

    public string? Nombre_Completo { get; set; }
}
