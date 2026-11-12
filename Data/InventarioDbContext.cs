using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using TRG2._0_VNET.Models;

namespace TRG2._0_VNET.Data;

public partial class InventarioDbContext : DbContext
{
    public InventarioDbContext(DbContextOptions<InventarioDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Administrador> Administradors { get; set; }

    public virtual DbSet<Catalogos_Departamento> Catalogos_Departamentos { get; set; }

    public virtual DbSet<Catalogos_Tipos_Equipo> Catalogos_Tipos_Equipos { get; set; }

    public virtual DbSet<Donacione> Donaciones { get; set; }

    public virtual DbSet<Empleado> Empleados { get; set; }

    public virtual DbSet<Equipo> Equipos { get; set; }

    public virtual DbSet<Equipos_liberado> Equipos_liberados { get; set; }

    public virtual DbSet<Movimientos_Equipo> Movimientos_Equipos { get; set; }

    public virtual DbSet<Produccion> Produccions { get; set; }

    public virtual DbSet<Proyecto> Proyectos { get; set; }

    public virtual DbSet<Scrap> Scraps { get; set; }

    public virtual DbSet<Telefono> Telefonos { get; set; }

    public virtual DbSet<Venta> Ventas { get; set; }

    public virtual DbSet<cartas_responsiva> cartas_responsivas { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Administrador>(entity =>
        {
            entity.ToTable("Administrador");

            entity.HasIndex(e => e.UserName, "UQ_Administrador_UserName").IsUnique();

            entity.Property(e => e.Fecha_Actualizacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Fecha_Creacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Nombre_Completo).HasMaxLength(150);
            entity.Property(e => e.Password_Hash)
                .HasMaxLength(256)
                .IsUnicode(false);
            entity.Property(e => e.UserName)
                .HasMaxLength(50)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Catalogos_Departamento>(entity =>
        {
            entity.HasIndex(e => e.Nombre_Departamento, "UQ_Catalogos_Departamentos_Nombre").IsUnique();

            entity.Property(e => e.Manager_Asignado)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Nombre_Departamento)
                .HasMaxLength(100)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Catalogos_Tipos_Equipo>(entity =>
        {
            entity.ToTable("Catalogos_Tipos_Equipo");

            entity.HasIndex(e => e.Nombre_Tipo_Equipo, "UQ_Catalogos_Tipos_Equipo_Nombre").IsUnique();

            entity.Property(e => e.Nombre_Tipo_Equipo)
                .HasMaxLength(100)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Donacione>(entity =>
        {
            entity.Property(e => e.Accion)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.Detalle)
                .HasMaxLength(1000)
                .IsUnicode(false);
            entity.Property(e => e.Fecha)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Fecha_Liberacion).HasColumnType("datetime");
            entity.Property(e => e.Hostname)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Nombre_Empleado_Anterior)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.Service_Tag)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Usuario).HasMaxLength(100);
        });

        modelBuilder.Entity<Empleado>(entity =>
        {
            entity.HasKey(e => e.Payroll);

            entity.HasIndex(e => e.Departamento_Id, "IX_Empleados_Departamento_Id");

            entity.Property(e => e.Payroll).ValueGeneratedNever();
            entity.Property(e => e.Area)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Correo)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Departament)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Estado).HasDefaultValue(true);
            entity.Property(e => e.Foto_URL)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.Full_Name)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.Manager)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.OUnit)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Position)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.User_Name)
                .HasMaxLength(150)
                .IsUnicode(false);

            entity.HasOne(d => d.Departamento).WithMany(p => p.Empleados)
                .HasForeignKey(d => d.Departamento_Id)
                .HasConstraintName("FK_Empleados_Catalogos_Departamentos");
        });

        modelBuilder.Entity<Equipo>(entity =>
        {
            entity.HasKey(e => e.Service_Tag);

            entity.HasIndex(e => e.Payroll, "IX_Equipos_Payroll");

            entity.HasIndex(e => e.Hostname, "UX_Equipos_Hostname_NotNull")
                .IsUnique()
                .HasFilter("([Hostname] IS NOT NULL)");

            entity.HasIndex(e => e.MAC, "UX_Equipos_MAC_NotNull")
                .IsUnique()
                .HasFilter("([MAC] IS NOT NULL)");

            entity.Property(e => e.Service_Tag)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Accesorios)
                .HasMaxLength(200)
                .IsUnicode(false);
            entity.Property(e => e.Comments)
                .HasMaxLength(200)
                .IsUnicode(false);
            entity.Property(e => e.Estado)
                .HasMaxLength(30)
                .IsUnicode(false)
                .HasDefaultValue("Disponible");
            entity.Property(e => e.Fecha_Creacion)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Hostname)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.IMEI)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Location)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.MAC)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.MQ_Asset)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Marca)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Modelo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Tipo_Equipo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Trace).IsUnicode(false);

            entity.HasOne(d => d.Id_ProyectoNavigation).WithMany(p => p.Equipos)
                .HasForeignKey(d => d.Id_Proyecto)
                .HasConstraintName("FK_Equipos_Proyectos");

            entity.HasOne(d => d.PayrollNavigation).WithMany(p => p.Equipos)
                .HasForeignKey(d => d.Payroll)
                .HasConstraintName("FK_Equipos_Empleados");

            entity.HasOne(d => d.Tipo_EquipoNavigation).WithMany(p => p.Equipos)
                .HasForeignKey(d => d.Tipo_Equipo_Id)
                .HasConstraintName("FK_Equipos_Catalogos_Tipos_Equipo");
        });

        modelBuilder.Entity<Equipos_liberado>(entity =>
        {
            entity.Property(e => e.Accion)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.Account)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Apple_ID)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Detalle)
                .HasMaxLength(1000)
                .IsUnicode(false);
            entity.Property(e => e.Estado_Telefono)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.Fecha)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Fecha_Liberacion).HasColumnType("datetime");
            entity.Property(e => e.Hostname)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.IMEI)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Location)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.MAC)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.MQ_Asset)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Marca)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Modelo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Nombre_Empleado_Anterior)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.Numero_Telefono)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.Password_apple)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Service_Tag)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Tipo_Equipo)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Tipo_Liberacion)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("SCRAP");
            entity.Property(e => e.Total_cuenta).HasColumnType("decimal(18, 6)");
        });

        modelBuilder.Entity<Movimientos_Equipo>(entity =>
        {
            entity.Property(e => e.Accion)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.Detalle)
                .HasMaxLength(1000)
                .IsUnicode(false);
            entity.Property(e => e.Fecha)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Hostname)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Service_Tag)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Usuario)
                .HasMaxLength(100)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Produccion>(entity =>
        {
            entity.ToTable("Produccion");

            entity.Property(e => e.Accion)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.Detalle)
                .HasMaxLength(1000)
                .IsUnicode(false);
            entity.Property(e => e.Fecha).HasColumnType("datetime");
            entity.Property(e => e.Fecha_Liberacion).HasColumnType("datetime");
            entity.Property(e => e.Hostname)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Nombre_Empleado_Anterior)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.Service_Tag)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Usuario).HasMaxLength(100);
        });

        modelBuilder.Entity<Proyecto>(entity =>
        {
            entity.HasIndex(e => e.Nombre_Proyecto, "UQ_Proyectos_Nombre").IsUnique();

            entity.Property(e => e.Nombre_Proyecto)
                .HasMaxLength(100)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Scrap>(entity =>
        {
            entity.ToTable("Scrap");

            entity.Property(e => e.Accion)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.Detalle)
                .HasMaxLength(1000)
                .IsUnicode(false);
            entity.Property(e => e.Fecha)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Fecha_Liberacion).HasColumnType("datetime");
            entity.Property(e => e.Hostname)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Nombre_Empleado_Anterior)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.Service_Tag)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Usuario).HasMaxLength(100);
        });

        modelBuilder.Entity<Telefono>(entity =>
        {
            entity.HasKey(e => e.Service_Tag);

            entity.HasIndex(e => e.Numero_Telefono, "UX_Telefonos_Numero_Telefono_NotNull")
                .IsUnique()
                .HasFilter("([Numero_Telefono] IS NOT NULL AND [Numero_Telefono]<>'')");

            entity.Property(e => e.Service_Tag)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Account)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Apple_ID)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.Estado)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("Activa");
            entity.Property(e => e.Numero_Telefono)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.Password_apple)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.Total_cuenta).HasColumnType("decimal(12, 2)");
        });

        modelBuilder.Entity<Venta>(entity =>
        {
            entity.Property(e => e.Accion)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.Detalle)
                .HasMaxLength(1000)
                .IsUnicode(false);
            entity.Property(e => e.Fecha).HasColumnType("datetime");
            entity.Property(e => e.Fecha_Liberacion).HasColumnType("datetime");
            entity.Property(e => e.Hostname)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Nombre_Empleado_Anterior)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.Service_Tag)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Usuario).HasMaxLength(100);
        });

        modelBuilder.Entity<cartas_responsiva>(entity =>
        {
            entity.HasIndex(e => e.payroll_titular, "IX_cartas_responsivas_Payroll_Titular");

            entity.HasIndex(e => new { e.service_tag, e.estado }, "IX_cartas_responsivas_Service_Tag_Estado");

            entity.HasIndex(e => e.Carta_Activa_Key, "UX_cartas_responsivas_carta_activa")
                .IsUnique()
                .HasFilter("([estado]<>'CERRADA')");

            entity.Property(e => e.Carta_Activa_Key)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasComputedColumnSql("(case when [estado]='FIRMADA' OR [estado]='ENVIADO' OR [estado]='SIN_ENVIAR' then [service_tag]  end)", true);
            entity.Property(e => e.device_type)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.estado)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("SIN_ENVIAR");
            entity.Property(e => e.fecha_envio).HasColumnType("datetime");
            entity.Property(e => e.fecha_firma).HasColumnType("datetime");
            entity.Property(e => e.hostname)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.nombre_secundario)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.nombre_titular)
                .HasMaxLength(150)
                .IsUnicode(false);
            entity.Property(e => e.observaciones)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.payroll_secundario)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.payroll_titular)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.service_tag)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.tipo_carta)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("INDIVIDUAL");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
