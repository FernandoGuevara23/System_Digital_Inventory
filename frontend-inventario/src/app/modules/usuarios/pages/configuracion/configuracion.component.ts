import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Usuario } from '../../../../models/usuario.model';
import { DepartamentosService } from '../../../../services/departamentos.service';
import { ProyectosService } from '../../../../services/proyectos.service';
import { TiposEquipoService } from '../../../../services/tipos_equipo.service';
import { UsuarioService } from '../../../../services/usuario.service';
import { UsuariosComponent } from '../usuarios/usuarios.component';
import { CatalogosComponent } from '../catalogos/catalogos.component';
import { HistorialAppleIdComponent } from '../Historial_AppleID/historial-apple-id.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';

import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  phosphorUsersThreeBold as remixGroupFill,
  phosphorSquaresFourBold as remixDashboardLine,
  phosphorPhoneCallBold,
} from '@ng-icons/phosphor-icons/bold';


interface ConfigModule {
  title: string;
  description: string;
  icon: string;
  accent: 'blue' | 'green' | 'purple';
  count: number;
  items: string[];
  action: string;
  route: string;
  target: 'usuarios' | 'catalogos' | 'telefonos' | 'configuracion';
}

@Component({
  selector: 'app-configuracion',
  standalone: true,
  viewProviders: [provideIcons({remixDashboardLine, remixGroupFill, phosphorPhoneCallBold})],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.css',
  imports: [CommonModule, UsuariosComponent, CatalogosComponent, HistorialAppleIdComponent, AlertComponent, NgIconComponent],
})
export class ConfiguracionComponent implements OnInit {
  usuariosCount = 0;
  tiposCount = 0;
  departamentosCount = 0;
  proyectosCount = 0;
  totalCatalogos = 0;
  errorCarga = '';
  activeModule: 'usuarios' | 'catalogos' | 'telefonos' | 'configuracion' = 'usuarios';

  modules: ConfigModule[] = [];

  catalogos = [
    { nombre: 'Tipos de equipo', detalle: 'Clasificación de activos', color: 'cyan' },
    { nombre: 'Departamentos', detalle: 'Áreas y responsables', color: 'mint' },
    { nombre: 'Proyectos', detalle: 'Proyectos activos', color: 'blue' },
  ];

  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly tiposEquipoService: TiposEquipoService,
    private readonly departamentosService: DepartamentosService,
    private readonly proyectosService: ProyectosService,
  ) {}

  get usuarioActual(): Usuario | null {
    return this.usuarioService.obtenerUsuarioActual();
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  seleccionarModulo(modulo: 'usuarios' | 'catalogos' | 'telefonos' | 'configuracion'): void {
    this.activeModule = modulo;
  }

  cargarDatos(): void {
    this.usuarioService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.usuariosCount = respuesta.data?.length ?? 0;
        this.actualizarModulos();
      },
      error: () => {
        this.errorCarga = 'No se pudieron cargar los datos de configuración. Verifica la conexión e inténtalo de nuevo.';
      },
    });

    this.tiposEquipoService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.tiposCount = respuesta.data?.length ?? 0;
        this.actualizarModulos();
      },
      error: () => {
        this.errorCarga = 'No se pudieron cargar los datos de configuración. Verifica la conexión e inténtalo de nuevo.';
      },
    });

    this.departamentosService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.departamentosCount = respuesta.data?.length ?? 0;
        this.actualizarModulos();
      },
      error: () => {
        this.errorCarga = 'No se pudieron cargar los datos de configuración. Verifica la conexión e inténtalo de nuevo.';
      },
    });

    this.proyectosService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.proyectosCount = respuesta.data?.length ?? 0;
        this.actualizarModulos();
      },
      error: () => {
        this.errorCarga = 'No se pudieron cargar los datos de configuración. Verifica la conexión e inténtalo de nuevo.';
      },
    });
  }

  private actualizarModulos(): void {
    this.totalCatalogos = this.tiposCount + this.departamentosCount + this.proyectosCount;

    this.modules = [
      {
        title: 'Usuarios',
        description: 'Administración del perfil del administrador y acceso al sistema.',
        icon: 'remixGroupFill',
        accent: 'blue',
        count: this.usuariosCount,
        items: [],
        action: 'Administrar usuarios',
        route: '/empleados',
        target: 'usuarios',
      },
      {
        title: 'Catálogos',
        description: 'Mantenimientos base del inventario y las áreas operativas.',
        icon: 'remixDashboardLine',
        accent: 'green',
        count: this.totalCatalogos,
        items: [],
        action: 'Gestionar catálogos',
        route: '/catalogos',
        target: 'catalogos',
      },
      {
        title: 'Teléfonos',
        description: 'Consulta centralizada de teléfonos actuales e históricos.',
        icon: 'phosphorPhoneCallBold',
        accent: 'purple',
        count: 0,
        items: [],
        action: 'Ver teléfonos',
        route: '/historial-apple-id',
        target: 'telefonos',
      },
    ];
  }
}
