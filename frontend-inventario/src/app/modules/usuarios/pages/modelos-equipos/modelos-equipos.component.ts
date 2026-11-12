import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { EquipoModeloDetalle, ModelosEquiposDashboard } from '../../../../models/equipos.model';
import { ModelosEquiposService } from '../../../../services/modelos_equipos.service';

@Component({
  selector: 'app-modelos-equipos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modelos-equipos.component.html',
  styleUrl: './modelos-equipos.css'
})
export class ModelosEquiposComponent implements OnInit {
  datosDashboard: ModelosEquiposDashboard | null = null;
  error = '';
  cargando = true;
  modeloExpandido: string | null = null;
  equiposPorModelo: Record<string, EquipoModeloDetalle[]> = {};
  modelosCargando = new Set<string>();
  erroresPorModelo: Record<string, string> = {};

  readonly categorias: Array<{ key: 'latitude' | 'optiplex' | 'precision'; titulo: string }> = [
    { key: 'latitude', titulo: 'Latitude' },
    { key: 'optiplex', titulo: 'OptiPlex' },
    { key: 'precision', titulo: 'Precision' }
  ];

  constructor(
    private modelosEquiposService: ModelosEquiposService,
    private location: Location,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarResumen();
  }

  regresar(): void {
    this.location.back();
  }

  cargarResumen(): void {
    this.cargando = true;
    this.error = '';

    this.modelosEquiposService.obtenerResumenDashboard().subscribe({
      next: (respuesta) => {
        this.datosDashboard = respuesta.data ?? null;
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta?.error?.error ?? 'No se pudo cargar el resumen de modelos de equipos.';
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  getModelos(categoria: 'latitude' | 'optiplex' | 'precision') {
    return this.datosDashboard?.modelos?.[categoria] ?? [];
  }

  getHostname(categoria: 'latitude' | 'optiplex' | 'precision') {
    return this.datosDashboard?.hostnames?.[categoria] ?? { ultimo: 'Sin registros', siguiente: 'Sin registros' };
  }

  alternarModelo(modelo: string): void {
    if (this.modeloExpandido === modelo) {
      this.modeloExpandido = null;
      return;
    }

    this.modeloExpandido = modelo;
    this.cargarEquiposModelo(modelo);
  }

  reintentarModelo(modelo: string): void {
    delete this.erroresPorModelo[modelo];
    this.equiposPorModelo = Object.fromEntries(
      Object.entries(this.equiposPorModelo).filter(([nombre]) => nombre !== modelo)
    );
    this.modeloExpandido = modelo;
    this.cargarEquiposModelo(modelo);
  }

  private cargarEquiposModelo(modelo: string): void {
    if (Object.prototype.hasOwnProperty.call(this.equiposPorModelo, modelo) || this.modelosCargando.has(modelo)) {
      return;
    }

    this.modelosCargando.add(modelo);
    delete this.erroresPorModelo[modelo];
    this.modelosEquiposService.obtenerEquiposPorModelo(modelo).subscribe({
      next: (respuesta) => {
        this.equiposPorModelo = {
          ...this.equiposPorModelo,
          [modelo]: respuesta.data ?? []
        };
        this.modelosCargando.delete(modelo);
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.erroresPorModelo[modelo] = respuesta?.error?.error
          ?? 'No se pudieron cargar los equipos de este modelo.';
        this.modelosCargando.delete(modelo);
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  totalModelos(categoria: 'latitude' | 'optiplex' | 'precision'): number {
    return this.getModelos(categoria).reduce((total, modelo) => total + (modelo.Cantidad ?? 0), 0);
  }
}