using System;
using System.Collections.Generic;

namespace TRG2._0_VNET.Models;

public partial class Catalogos_Tipos_Equipo
{
    public int Id { get; set; }

    public string Nombre_Tipo_Equipo { get; set; } = null!;

    public virtual ICollection<Equipo> Equipos { get; set; } = new List<Equipo>();
}
