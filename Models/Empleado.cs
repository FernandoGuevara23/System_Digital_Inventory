using System;
using System.Collections.Generic;

namespace TRG2._0_VNET.Models;

public partial class Empleado
{
    public int Payroll { get; set; }

    public string? Full_Name { get; set; }

    public string? Foto_URL { get; set; }

    public string? User_Name { get; set; }

    public string? Departament { get; set; }

    public int? Departamento_Id { get; set; }

    public string? Area { get; set; }

    public string? Position { get; set; }

    public string? OUnit { get; set; }

    public string? Manager { get; set; }

    public int? CC { get; set; }

    public bool Estado { get; set; }

    public string? Correo { get; set; }

    public virtual Catalogos_Departamento? Departamento { get; set; }

    public virtual ICollection<Equipo> Equipos { get; set; } = new List<Equipo>();
}
