import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { timeout } from 'rxjs';
import { MovimientoEquipo } from '../../../../models/equipos.model';
import { Usuario } from '../../../../models/usuario.model';
import { DashboardResumen, DashboardService } from '../../../../services/dashboard.service';
import { UsuarioService } from '../../../../services/usuario.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideHistory, lucideRecycle, lucideShoppingBag, lucideUsers } from '@ng-icons/lucide';
import { aspectsDashboard } from '@ng-icons/ux-aspects';
import { phosphorDevicesLight } from '@ng-icons/phosphor-icons/light';
import { phosphorGiftDuotone } from '@ng-icons/phosphor-icons/duotone';
import { phosphorPhoneCallBold } from '@ng-icons/phosphor-icons/bold';
import { lucideMailPlus } from '@ng-icons/lucide';

const remixGroupFill = lucideUsers;
const remixRecycleLine = lucideRecycle;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, NgIconComponent],
  viewProviders: [provideIcons({ remixGroupFill, phosphorDevicesLight, remixRecycleLine, phosphorGiftDuotone, phosphorPhoneCallBold, lucideMailPlus, lucideHistory, lucideShoppingBag, aspectsDashboard })],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  usuario: Usuario | null = null;
  resumen: DashboardResumen = {
    empleados: { total: 0, activos: 0 },
    equipos: { inventario: 0, asignados: 0 },
    lineas: { total: 0, activas: 0 },
    pendientes: { scrap: 0, donaciones: 0, produccion: 0, ventas: 0 },
    movimientos: []
  };
  cargandoMovimientos = true;
  error: string | null = null;

  readonly today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly dashboardService: DashboardService,
    private readonly router: Router,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.usuario = this.usuarioService.obtenerUsuarioActual();
    if (!this.usuario) {
      this.error = 'La sesión no está disponible.';
      void this.router.navigate(['/login']);
      return;
    }

    this.dashboardService.obtenerResumen().pipe(timeout(8000)).subscribe({
      next: (respuesta) => {
        this.cargandoMovimientos = false;
        if (!respuesta.success || !respuesta.data) {
          this.error = respuesta.error ?? 'El resumen del dashboard no está disponible.';
        } else {
          this.resumen = {
            ...respuesta.data,
            movimientos: Array.isArray(respuesta.data.movimientos)
              ? respuesta.data.movimientos
              : []
          };
        }
        this.changeDetectorRef.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.cargandoMovimientos = false;
        this.error = this.mensajeError('el resumen del dashboard', error);
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  private mensajeError(recurso: string, error: HttpErrorResponse): string {
    if (error.status === 0) {
      return `No se pudo conectar con el servidor para cargar ${recurso}.`;
    }
    return `No se pudieron cargar ${recurso} (${error.status}).`;
  }

  get empleadosActivos(): number {
    return this.resumen.empleados.activos;
  }

  get equiposAsignados(): number {
    return this.resumen.equipos.asignados;
  }

  get lineasActivas(): number {
    return this.resumen.lineas.activas;
  }

  get scrapPendiente(): number {
    return this.resumen.pendientes.scrap;
  }

  get DonacionesPendiente(): number {
    return this.resumen.pendientes.donaciones;
  }

  get ProduccionPendiente(): number {
    return this.resumen.pendientes.produccion;
  }

  get VentasPendiente(): number {
    return this.resumen.pendientes.ventas;
  }

  movimientoEtiqueta(movimiento: MovimientoEquipo): string {
    const acciones: Record<string, string> = {
      ASIGNACION: 'Equipo asignado',
      REASIGNACION: 'Equipo reasignado',
      LIBERACION: 'Equipo liberado',
      CREACION: 'Equipo agregado',
      ACTUALIZACION: 'Equipo actualizado',
      CARTA_ENVIADA: 'Carta responsiva enviada',
      CARTA_CREADA: 'Carta responsiva creada',
      DONACION: 'Equipo donado',
      CARTA_CERRADA: 'Carta responsiva cerrada',
      ENVIO_A_DONACION: 'Envío a donación',
      ENVIADO_A_DONACION: 'Enviado a donación',
      ENVIO_A_PRODUCCION: 'Envío a producción',
      ENVIADO_A_PRODUCCION: 'Enviado a producción',
      ENVIO_A_VENTA: 'Envío a ventas',
      ENVIADO_A_VENTA: 'Enviado a ventas',
      ENVIO_A_SCRAP: 'Envío a scrap',
      ENVIADO_A_RECICLADORA: 'Enviado a recicladora',
      CANCELACION: 'Cancelación de acción',
      PROCESADO: 'Procesado',
    };
    return acciones[movimiento.Accion.toUpperCase()] ?? movimiento.Accion;
  }

  get ultimosMovimientos(): MovimientoEquipo[] {
    return this.resumen.movimientos;
  }

  onLogout(): void {
    this.usuarioService.logout().subscribe({
      next: (respuesta) => {
        if (respuesta.success) {
          void this.router.navigate(['/login'], { replaceUrl: true });
        } else {
          this.error = respuesta.error ?? 'No se pudo cerrar la sesión.';
          this.changeDetectorRef.markForCheck();
        }
      },
      error: () => {
        this.error = 'No se pudo contactar al servidor para cerrar la sesión.';
        this.changeDetectorRef.markForCheck();
      }
    });
  }
}
