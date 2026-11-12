import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormControl, ReactiveFormsModule,FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Equipo } from '../../../../models/equipos.model';
import { DonacionesService } from '../../../../services/donaciones.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { lucideHistory as remixHistoryLine,
} from '@ng-icons/lucide';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { matBorderColor } from '@ng-icons/material-icons/baseline';
import { phosphorGiftDuotone  } from '@ng-icons/phosphor-icons/duotone';
import { DialogService } from '../../../../shared/services/dialog.service';
@Component({
  selector: 'app-donaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AlertComponent, NgIconComponent],
  templateUrl: './donaciones.component.html',
  viewProviders: [provideIcons({ remixHistoryLine, matBorderColor, phosphorGiftDuotone })],
  styleUrl: '../scrap/scrap.component.css'
})
export class DonacionesComponent implements OnInit {
  equipos: Equipo[] = [];
  seleccionados = new Set<string>();
  busqueda = new FormControl('');
  mensaje = '';
  error = '';
  mostrarOrden = false;
  comentarioOrden = '';
  cargando = false;

  constructor(
    private donacionesService: DonacionesService,
    private location: Location,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private readonly dialogs: DialogService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  regresar(): void {
    this.location.back();
  }
 HistorialDonacion(): void {
    this.router.navigate(['/donaciones/historial']);
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.donacionesService.obtenerEquiposEnDonacion().subscribe({
      next: respuesta => {
        this.equipos = respuesta.data ?? [];
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron cargar los equipos enviados a Donacion';
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


  async liberarEquipo(serviceTag: string): Promise<void> {
    if (!await this.dialogs.confirm(`¿Liberar el equipo ${serviceTag} de Donación?`, 'Liberar equipo', 'orange')) return;
    const detalle = (await this.dialogs.prompt('Indica por qué se libera el equipo:'))?.trim();
    if (!detalle) return;
    const equipo = this.equipos.find(item => item.Service_Tag === serviceTag) ?? serviceTag;
    this.donacionesService.liberarEquipo(equipo, detalle).subscribe({
      next: () => {
        this.mensaje = `El equipo ${serviceTag} fue liberado a Donacion`;
        this.seleccionados.delete(serviceTag);
        this.cargar();
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudo liberar el equipo';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  async liberarTodos(): Promise<void> {
    if (!this.equipos.length) return;
    if (!await this.dialogs.confirm('¿Liberar todos los equipos de Donación?', 'Liberar todos los equipos', 'orange')) return;
    const detalle = (await this.dialogs.prompt('Indica por qué se liberan los equipos:'))?.trim();
    if (!detalle) return;
    this.donacionesService.liberarTodos(detalle).subscribe({
      next: () => {
        this.mensaje = 'Todos los equipos fueron enviados a Donacion';
        this.seleccionados.clear();
        this.cargar();
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudieron liberar todos los equipos';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  liberarSeleccionados(): void {
    const equiposSeleccionados = [...this.seleccionados];
    const detalle = this.comentarioOrden.trim();
    if (!equiposSeleccionados.length || !detalle) {
      this.error = 'Selecciona equipos e indica el comentario de la orden';
      return;
    }

    const equipos = this.equipos.filter(equipo => this.seleccionados.has(equipo.Service_Tag));
    this.donacionesService.liberarSeleccionados(equipos, detalle).subscribe({
      next: () => {
        this.mensaje = `Orden creada para ${equiposSeleccionados.length} equipo(s)`;
        this.seleccionados.clear();
        this.mostrarOrden = false;
        this.comentarioOrden = '';
        this.cargar();
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudo completar la orden de liberación';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

}
