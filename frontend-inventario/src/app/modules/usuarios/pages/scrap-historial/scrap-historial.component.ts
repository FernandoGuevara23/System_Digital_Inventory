import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReporteScrap, ResumenScrap } from '../../../../models/scrap.model';
import { ReportesService } from '../../../../services/reportes.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { tablerListDetails } from '@ng-icons/tabler-icons';
import { fluentDocumentPdf } from '@ng-icons/fluent-ui';
import {lucideArrowLeft as remixArrowLeftLine} from '@ng-icons/lucide';

@Component({
  selector: 'app-scrap-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, AlertComponent, NgIconComponent],
  viewProviders: [provideIcons({ tablerListDetails, fluentDocumentPdf, remixArrowLeftLine })],
  templateUrl: './scrap-historial.component.html',
  styleUrl: './scrap-historial.component.css'
})
export class ScrapHistorialComponent implements OnInit {
  private readonly meses = [
    { valor: '01', nombre: 'Enero' },
    { valor: '02', nombre: 'Febrero' },
    { valor: '03', nombre: 'Marzo' },
    { valor: '04', nombre: 'Abril' },
    { valor: '05', nombre: 'Mayo' },
    { valor: '06', nombre: 'Junio' },
    { valor: '07', nombre: 'Julio' },
    { valor: '08', nombre: 'Agosto' },
    { valor: '09', nombre: 'Septiembre' },
    { valor: '10', nombre: 'Octubre' },
    { valor: '11', nombre: 'Noviembre' },
    { valor: '12', nombre: 'Diciembre' },
  ];
  registros: ReporteScrap[] = [];
  termino = '';
  anioSeleccionado = '';
  mesSeleccionado = '';
  ordenAbierta: ReporteScrap | null = null;
  resumen: ResumenScrap | null = null;
  error = '';
  cargando = true;

  constructor(private reportesService: ReportesService, private location: Location, private changeDetectorRef: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.reportesService.obtenerReportes().subscribe({
      next: respuesta => {
        this.registros = respuesta.data ?? [];
        this.registros = this.registros.reverse();
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudo cargar el historial de Scrap';
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
    this.reportesService.obtenerResumenScrap().subscribe({
      next: respuesta => {
        this.resumen = respuesta.data ?? null;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  aplicarFiltro(event: Event): void {
    this.termino = (event.target as HTMLInputElement).value.trim().toLowerCase();
  }

  get aniosDisponibles(): string[] {
    return [...new Set(this.registros
      .map(orden => this.partesFecha(orden.Fecha)?.anio)
      .filter((anio): anio is string => anio !== undefined))]
      .sort((a, b) => Number(b) - Number(a));
  }

  get mesesDisponibles(): typeof this.meses {
    return this.meses;
  }

  registrosFiltrados(): ReporteScrap[] {
    return this.registros.filter(orden => {
      const coincideTexto = !this.termino || [
        orden.Orden_Id,
        orden.Fecha,
        orden.Usuario,
        orden.Comentario,
        orden.Total_Equipos,
        ...orden.Equipos.flatMap(equipo => [
          equipo.Service_Tag,
          equipo.Nombre_Empleado_Anterior,
          equipo.Payroll_Anterior
        ])
      ].some(valor => String(valor ?? '').toLowerCase().includes(this.termino));

      if (!coincideTexto) return false;

      const fecha = this.partesFecha(orden.Fecha);
      if (!fecha) return !this.anioSeleccionado && !this.mesSeleccionado;

      return (!this.anioSeleccionado || fecha.anio === this.anioSeleccionado)
        && (!this.mesSeleccionado || fecha.mes === this.mesSeleccionado);
    });
  }

  private partesFecha(fecha: string): { anio: string; mes: string } | null {
    const fechaLocal = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(fecha);
    if (fechaLocal) {
      return { anio: fechaLocal[3], mes: fechaLocal[2].padStart(2, '0') };
    }

    const fechaIso = /^(\d{4})-(\d{2})-\d{2}/.exec(fecha);
    return fechaIso ? { anio: fechaIso[1], mes: fechaIso[2] } : null;
  }

  abrirOrden(orden: ReporteScrap): void { this.ordenAbierta = orden; }
  cerrarOrden(): void { this.ordenAbierta = null; }

  descargarOrden(orden: ReporteScrap): void {
    this.reportesService.descargarReporteScrap(orden.ids).subscribe({
      next: archivo => {
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `reporte_scrap_orden_${orden.Orden_Id}.pdf`;
        enlace.click();
        URL.revokeObjectURL(url);
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudo descargar el reporte PDF';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  regresar(): void { this.location.back(); }

}
