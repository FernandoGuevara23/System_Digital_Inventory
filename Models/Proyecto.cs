using System;
using System.Collections.Generic;

namespace TRG2._0_VNET.Models;

public partial class Proyecto
{
    public int Id { get; set; }

    public string Nombre_Proyecto { get; set; } = null!;

    public virtual ICollection<Equipo> Equipos { get; set; } = new List<Equipo>();
}
