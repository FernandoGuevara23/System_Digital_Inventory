import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Equipo } from '../../../../models/equipos.model';
import { ScrapService } from '../../../../services/scrap.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { lucideHistory as remixHistoryLine,
lucideRecycle as remixRecycleLine,
} from '@ng-icons/lucide';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
@Component({
  selector: 'app-scrap',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AlertComponent, NgIconComponent],
  viewProviders: [provideIcons({ remixHistoryLine, remixRecycleLine })],
  templateUrl: './scrap.component.html',
  styleUrl: './scrap.component.css'
})
export class ScrapComponent implements OnInit {
  equipos: Equipo[] = [];
  seleccionados = new Set<string>();
  busqueda = new FormControl('');
  mensaje = '';
  error = '';
  mostrarOrden = false;
  comentarioOrden = '';
  cargando = false;
  procesandoOrden = false;

  constructor(
    private scrapService: ScrapService,
    private location: Location,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.cargar();
  }

  regresar(): void {
    this.location.back();
  }

  HistorialScrap(): void {
    this.router.navigate(['/scrap/historial']);
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.scrapService.obtenerEquiposEnScrap().subscribe({
      next: respuesta => {
        this.equipos = respuesta.data ?? [];
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron cargar los equipos enviados a Scrap';
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  seleccionarTodos(): void {
    const visibles = this.equiposFiltrados();
    if (visibles.every((equipo) => this.seleccionados.has(equipo.Service_Tag))) {
      visibles.forEach((equipo) => this.seleccionados.delete(equipo.Service_Tag));
    } else {
      visibles.forEach((equipo) => this.seleccionados.add(equipo.Service_Tag));
    }
  }

  todosVisiblesSeleccionados(): boolean {
    const visibles = this.equiposFiltrados();
    return visibles.length > 0 && visibles.every((equipo) => this.seleccionados.has(equipo.Service_Tag));
  }

  equiposFiltrados(): Equipo[] {
    const termino = (this.busqueda.value ?? '').trim().toLowerCase();
    if (!termino) return this.equipos;
    return this.equipos.filter(equipo =>
      [
        equipo.Service_Tag, equipo.Hostname, equipo.Marca, equipo.Modelo,
        equipo.IMEI, equipo.Tipo_Equipo, equipo.Nombre_Empleado_Anterior,
        equipo.Payroll_Anterior
      ]
        .some(valor => String(valor ?? '').toLowerCase().includes(termino))
    );
  }

  estaSeleccionado(serviceTag: string): boolean {
    return this.seleccionados.has(serviceTag);
  }

  alternarEquipo(serviceTag: string): void {
    if (this.seleccionados.has(serviceTag)) {
      this.seleccionados.delete(serviceTag);
    } else {
      this.seleccionados.add(serviceTag);
    }
  }

  abrirOrden(): void {
    if (!this.seleccionados.size) {
      this.error = 'Selecciona al menos un equipo para crear la orden';
      return;
    }
    this.comentarioOrden = '';
    this.mostrarOrden = true;
  }

  cancelarOrden(): void {
    this.mostrarOrden = false;
    this.comentarioOrden = '';
  }

  liberarSeleccionados(): void {
    if (this.procesandoOrden) return;
    const equiposSeleccionados = [...this.seleccionados];
    const detalle = this.comentarioOrden.trim();
    if (!equiposSeleccionados.length || !detalle) {
      this.error = 'Selecciona equipos e indica el comentario de la orden';
      return;
    }

    this.procesandoOrden = true;
    const equipos = this.equipos.filter(equipo => this.seleccionados.has(equipo.Service_Tag));
    this.scrapService.liberarSeleccionados(equipos, detalle).subscribe({
      next: () => {
        this.procesandoOrden = false;
        this.mensaje = `Orden creada para ${equiposSeleccionados.length} equipo(s)`;
        this.seleccionados.clear();
        this.mostrarOrden = false;
        this.comentarioOrden = '';
        this.cargar();
      },
      error: respuesta => {
        this.procesandoOrden = false;
        this.error = respuesta.error?.error ?? 'No se pudo completar la orden de liberación';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

}
