using System;
using System.Collections.Generic;

namespace TRG2._0_VNET.Models;

public partial class Catalogos_Departamento
{
    public int Id { get; set; }

    public string Nombre_Departamento { get; set; } = null!;

    public string Manager_Asignado { get; set; } = null!;

    public virtual ICollection<Empleado> Empleados { get; set; } = new List<Empleado>();
}
