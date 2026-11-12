import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EquiposService } from '../../../../services/equipos.service';
import { MovimientoEquipo } from '../../../../models/equipos.model';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, BadgeComponent],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.css'],
})
export class HistorialComponent implements OnInit {
  registros: MovimientoEquipo[] = [];
  termino = '';
  filtroAccion = 'Todas';
  filtroModulo = 'Todos';
  filtroUsuario = 'Todos';
  error: string | null = null;
  cargando = true;
  exportandoExcel = false;
  paginaActual = 1;
  readonly accionesPorPagina = 1000;
  totalAcciones = 0;
  totalPaginas = 0;
  readonly modulosDisponibles = ['Todos', 'Equipos', 'Cartas responsivas', 'Scrap', 'Donaciones', 'Producción', 'Ventas', 'Líneas', 'Empleados'];
  private readonly busquedaSubject = new Subject<void>();

  constructor(
    private readonly equiposService: EquiposService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.busquedaSubject.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.paginaActual = 1;
      this.cargarHistorial();
    });
    this.cargarHistorial();
  }

  private cargarHistorial(): void {
    this.cargando = true;
    this.equiposService.getHistorial(undefined, this.paginaActual, this.accionesPorPagina, this.termino.trim(), this.filtroModulo).subscribe({
      next: (respuesta) => {
        this.registros = Array.isArray(respuesta.data) ? respuesta.data : [];
        this.totalAcciones = respuesta.pagination?.total ?? this.registros.length;
        this.totalPaginas = respuesta.pagination?.total_pages ?? 1;
        this.error = respuesta.success === false && respuesta.error ? respuesta.error : null;
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = 'No se pudo cargar el historial.';
        this.registros = [];
        this.totalAcciones = 0;
        this.totalPaginas = 0;
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  buscar(): void {
    this.busquedaSubject.next();
  }

  cambiarModulo(modulo: string): void {
    this.filtroModulo = modulo;
    this.paginaActual = 1;
    this.cargarHistorial();
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas || this.cargando) return;
    this.paginaActual = pagina;
    this.cargarHistorial();
  }

  descargarExcel(): void {
    if (this.exportandoExcel) return;
    this.exportandoExcel = true;
    this.error = null;
    this.equiposService.exportarHistorial().subscribe({
      next: (archivo) => {
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'historial_general.xlsx';
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.exportandoExcel = false;
        this.changeDetectorRef.markForCheck();
      },
      error: async (respuesta) => {
        let mensaje = 'No se pudo exportar el historial general a Excel.';
        if (respuesta.error instanceof Blob) {
          try {
            const errorApi = JSON.parse(await respuesta.error.text());
            mensaje = errorApi.error ?? mensaje;
          } catch {
            mensaje = `No se pudo exportar el historial general a Excel (HTTP ${respuesta.status}).`;
          }
        }
        this.error = mensaje;
        this.exportandoExcel = false;
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  /*get accionesDisponibles(): string[] {
    const map = new Map<string, string>();
    this.registros.forEach((registro) => {
      const label = this.mapAccion(registro.Accion);
      map.set(label, label);
    });
    return ['Todas', ...Array.from(map.values())];
  }*/

  get usuariosDisponibles(): string[] {
    const set = new Set<string>();
    this.registros.forEach((registro) => {
      const usuario = registro.Usuario || this.extractUsuario(registro.Detalle);
      if (usuario) set.add(usuario);
    });
    return ['Todos', ...Array.from(set)];
  }

  get registrosFiltrados(): MovimientoEquipo[] {
    const termino = this.termino.trim().toLowerCase();

    return this.registros.filter((registro) => {
      return true;
    });
  }

  numeroRegistro(registro: MovimientoEquipo): number {
    const indice = this.registros.findIndex((movimiento) => movimiento.Id === registro.Id);
    return this.totalAcciones - ((this.paginaActual - 1) * this.accionesPorPagina) - indice;
  }

  getModulo(registro: MovimientoEquipo): string {
    const normalizar = (valor: string): string => valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const detalle = normalizar(registro.Detalle ?? '');
    const accion = normalizar(registro.Accion ?? '');
    const serviceTag = (registro.Service_Tag ?? '').toUpperCase();

    if (accion.startsWith('carta_') || serviceTag.startsWith('CARTA-') || detalle.includes('carta responsiva')) {
      return 'Cartas responsivas';
    }
    if (accion.includes('scrap') || accion.includes('recicladora')) return 'Scrap';
    if (accion.includes('donacion')) return 'Donaciones';
    if (accion.includes('produccion')) return 'Producción';
    if (accion.includes('venta')) return 'Ventas';
    if (accion.includes('linea')) return 'Líneas';
    if (serviceTag.startsWith('SCRAP-')) return 'Scrap';
    if (serviceTag.startsWith('DONACION-')) return 'Donaciones';
    if (serviceTag.startsWith('PRODUCCION-')) return 'Producción';
    if (serviceTag.startsWith('VENTA-')) return 'Ventas';
    if (serviceTag.startsWith('LINEA-') || detalle.includes('linea')) return 'Líneas';
    if (serviceTag.startsWith('EMPLEADO-') || detalle.includes('empleado')) return 'Empleados';
    if (detalle.includes('scrap')) return 'Scrap';
    if (detalle.includes('donacion')) return 'Donaciones';
    if (detalle.includes('produccion')) return 'Producción';
    if (detalle.includes('venta')) return 'Ventas';
    return 'Equipos';
  }

  getEquipoReferenciado(registro: MovimientoEquipo): string {
    if (registro.Accion?.trim().toUpperCase() === 'CARGA_MASIVA') return '';

    const serviceTag = (registro.Service_Tag ?? '').trim();
    const tagNormalizado = serviceTag.toUpperCase();
    if (!serviceTag || tagNormalizado.endsWith('-ORDEN')) return '';

    for (const prefijo of ['SCRAP-', 'DONACION-', 'PRODUCCION-', 'VENTA-', 'LINEA-', 'EMPLEADO-', 'CARTA-']) {
      if (tagNormalizado.startsWith(prefijo)) {
        return serviceTag.slice(prefijo.length);
      }
    }

    return serviceTag;
  }

  mapAccion(accion: string): string {
    const valor = (accion ?? '').trim().toUpperCase();
    const map: Record<string, string> = {
      CREACION: 'Agregado',
      ACTUALIZACION: 'Editado',
      CARGA_MASIVA: 'Carga masiva',
      REASIGNACION: 'Asignación',
      LIBERACION: 'Dado de baja',
      DONACION: 'Donado',
      ENVIO_A_DONACION: 'Envío a donación',
      ENVIADO_A_DONACION: 'Donado',
      ENVIO_A_PRODUCCION: 'Envío a producción',
      ENVIADO_A_PRODUCCION: 'Enviado a producción',
      ENVIO_A_VENTA: 'Envío a ventas',
      ENVIADO_A_VENTA: 'Enviado a ventas',
      ENVIO_A_SCRAP: 'Envío a Scrap',
      ENVIADO_A_RECICLADORA: 'Enviado a recicladora',
      ELIMINACION_LINEA: 'Línea eliminada',
      CANCELACION: 'Cancelado',
      PROCESADO: 'Procesado',
      'DADO DE BAJA': 'Dado de baja',
      'ASIGNACION': 'Asignación',
      'EDITADO': 'Editado',
      'AGREGADO': 'Agregado',
      'CARTA_ENVIADA': 'Carta responsiva enviada',
      'CARTA_CREADA': 'Carta responsiva creada',
      'CARTA_CERRADA': 'Carta responsiva cerrada',
    };

    return map[valor] ?? (accion || 'Sin acción');
  }

  extractUsuario(detalle: string): string | null {
    if (!detalle) return null;

    const prefijo = detalle.split(' - ')[0]?.trim();
    if (prefijo && /^[A-Za-z0-9_.-]+$/.test(prefijo)) {
      return prefijo;
    }

    const usuarioMatch = detalle.match(/(?:Usuario|UserName|usuario)\s*[:=]\s*([A-Za-z0-9_.-]+)/i);
    if (usuarioMatch?.[1]) {
      return usuarioMatch[1];
    }

    const match = detalle.match(/\b(?:Admin|Soporte|Usuario|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
    if (!match) return null;
    return match[0];
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return 'Sin fecha';
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return fecha;
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  reverseddatos(): MovimientoEquipo[] {
    return [...this.registros].sort((a, b) => {
      const fechaA = new Date(a.Fecha).getTime();
      const fechaB = new Date(b.Fecha).getTime();
      if (fechaA !== fechaB) {
        return fechaB - fechaA;
      }
      return b.Id - a.Id;
    }); 
}
}
