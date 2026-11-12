import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EquiposService } from '../../../../services/equipos.service';
import { EmpleadosService } from '../../../../services/empleados.service';
import { Equipo } from '../../../../models/equipos.model';
import { Empleado } from '../../../../models/empleados.model';
import { CartaResponsivaService } from '../../../../services/cartas.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { DialogService } from '../../../../shared/services/dialog.service';

type EquipoReasignable = Partial<Equipo> & {
  Service_Tag: string;
  Hostname?: string | null;
  Marca?: string;
  Modelo?: string;
  Tipo_Equipo?: string;
  Payroll?: number | null;
  Estado?: string;
  Empleado?: { Payroll?: number; Full_Name?: string } | null;
};

@Component({
  selector: 'app-reasignar-equipo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AlertComponent],
  templateUrl: './reasignar-equipo.component.html',
  styleUrl: './reasignar-equipo.component.css'
})
export class ReasignarEquipoComponent implements OnInit {
  @Input() equipo: Equipo | null = null;
  @Input() equipos: any[] | null = null;
  @Output() cancelar = new EventEmitter<void>();
  @Output() reasignado = new EventEmitter<void>();

  empleados: Empleado[] = [];
  empleadoSeleccionado: number | null = null;
  equipoSeleccionado: EquipoReasignable | null = null;
  busqueda = new FormControl('');
  cargando = true;
  guardando = false;
  mensaje = '';
  error = '';
  cartaActivaEquipo = false;
  cargandoCarta = false;
  errorCargaCarta = false;

  constructor(
    private equiposService: EquiposService,
    private empleadosService: EmpleadosService,
    private cartasService: CartaResponsivaService,
    private changeDetectorRef: ChangeDetectorRef,
    private readonly dialogs: DialogService
  ) {}

  ngOnInit(): void {
    this.sincronizarEquipoSeleccionado();
    this.cargarEmpleados();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['equipo'] || changes['equipos']) {
      this.sincronizarEquipoSeleccionado();
    }
  }

  private sincronizarEquipoSeleccionado(): void {
    if (this.equipo) {
      this.equipoSeleccionado = this.equipo;
      this.cargarEstadoCarta();
      return;
    }

    const lista = this.equipos ?? [];
    this.equipoSeleccionado = lista.length ? lista[0] : null;
    this.empleadoSeleccionado = null;
    this.error = '';
    this.cargarEstadoCarta();
  }

  private cargarEstadoCarta(): void {
    const serviceTag = this.equipoSeleccionado?.Service_Tag;
    this.cartaActivaEquipo = false;
    this.errorCargaCarta = false;
    if (!serviceTag) {
      this.cargandoCarta = false;
      return;
    }

    this.cargandoCarta = true;
    this.cartasService.listar({ service_tag: serviceTag }).subscribe({
      next: (respuesta) => {
        this.cartaActivaEquipo = (respuesta.data ?? []).some((carta) =>
          carta.estado === 'SIN_ENVIAR' || carta.estado === 'ENVIADO' || carta.estado === 'FIRMADA'
        );
        this.cargandoCarta = false;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.cargandoCarta = false;
        this.errorCargaCarta = true;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  private cargarEmpleados(): void {
    this.empleadosService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.empleados = (respuesta.data ?? []).filter((empleado) => empleado.Estado);
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudieron cargar los empleados';
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  equiposDisponibles(): EquipoReasignable[] {
    if (this.equipo) {
      return [this.equipo];
    }
    return this.equipos ?? [];
  }

  empleadoActualAsignado(): Empleado | null {
    const payrollActual = this.equipoSeleccionado?.Payroll;
    if (payrollActual === null || payrollActual === undefined) {
      return this.equipoSeleccionado?.Empleado
        ? ({
            Payroll: this.equipoSeleccionado.Empleado.Payroll ?? payrollActual,
            Full_Name: this.equipoSeleccionado.Empleado.Full_Name ?? 'Sin asignar',
          } as Empleado)
        : null;
    }

    return this.empleados.find((empleado) => empleado.Payroll === payrollActual) ?? null;
  }

  seleccionarEquipo(equipo: EquipoReasignable): void {
    this.equipoSeleccionado = equipo;
    this.empleadoSeleccionado = null;
    this.error = '';
    this.cargarEstadoCarta();
  }

  empleadosFiltrados(): Empleado[] {
    const termino = (this.busqueda.value ?? '').trim().toLowerCase();
    const payrollActual = this.equipoSeleccionado?.Payroll;

    return this.empleados.filter((empleado) => {
      if (!empleado.Estado) {
        return false;
      }
      if (payrollActual !== null && payrollActual !== undefined && empleado.Payroll === payrollActual) {
        return false;
      }
      if (!termino) {
        return true;
      }
      return [
        empleado.Payroll,
        empleado.Full_Name,
        empleado.Area,
        empleado.Departament,
        empleado.CC
      ].some((valor) => String(valor ?? '').toLowerCase().includes(termino));
    });
  }

  seleccionarEmpleado(payroll: number): void {
    const empleadoDestino = this.empleados.find((empleado) => empleado.Payroll === payroll);

    if (!empleadoDestino || !empleadoDestino.Estado) {
      this.error = 'No se puede reasignar a un empleado inactivo';
      return;
    }

    if (this.equipoSeleccionado?.Payroll === payroll) {
      this.error = 'No puedes reasignar el equipo al mismo empleado';
      return;
    }

    this.empleadoSeleccionado = payroll;
    this.error = '';
  }

  async guardar(): Promise<void> {
    const equipoActivo = this.equipoSeleccionado ?? this.equipo;
    if (!equipoActivo || this.empleadoSeleccionado === null) {
      this.error = 'Selecciona un equipo y un empleado para completar la reasignación';
      return;
    }

    if (this.cargandoCarta) {
      this.error = 'Espera a que se verifique el estado de la carta del equipo.';
      return;
    }

    if (this.errorCargaCarta) {
      this.error = 'No se pudo verificar la carta del equipo. Intenta nuevamente.';
      return;
    }

    if (this.cartaActivaEquipo && !await this.dialogs.confirm(
      'Este equipo tiene una carta activa. Al reasignarlo, la carta se cerrará y deberás generar una nueva para el empleado destino. ¿Deseas continuar?'
    )) {
      return;
    }

    const empleadoDestino = this.empleados.find((empleado) => empleado.Payroll === this.empleadoSeleccionado);
    if (!empleadoDestino || !empleadoDestino.Estado) {
      this.error = 'No se puede reasignar a un empleado inactivo';
      return;
    }

    if (equipoActivo.Payroll === this.empleadoSeleccionado) {
      this.error = 'No puedes reasignar el equipo al mismo empleado';
      return;
    }

    this.guardando = true;
    this.error = '';
    this.equiposService.reasignarEquipo(equipoActivo.Service_Tag, this.empleadoSeleccionado).subscribe({
      next: () => {
        this.mensaje = 'Equipo reasignado correctamente';
        this.guardando = false;
        this.reasignado.emit();
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudo reasignar el equipo';
        this.guardando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  cerrar(): void {
    this.cancelar.emit();
  }
}
