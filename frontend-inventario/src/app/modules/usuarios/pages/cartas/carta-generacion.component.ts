import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CartaResponsiva, CartaTipo } from '../../../../models/cartas.model';
import { Empleado, EquipoAsignado } from '../../../../models/empleados.model';
import { Equipo } from '../../../../models/equipos.model';
import { CartaResponsivaService } from '../../../../services/cartas.service';
import { EmpleadosService } from '../../../../services/empleados.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { fluentDocumentPdf } from '@ng-icons/fluent-ui'
import { simpleMinutemailer } from '@ng-icons/simple-icons';
import { matMarkEmailReadFillOutline } from '@ng-icons/material-symbols/outline';
import { DialogService } from '../../../../shared/services/dialog.service';
import { EmailSendingService } from '../../../../shared/services/email-sending.service';
@Component({
  selector: 'app-carta-generacion',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
   viewProviders: [provideIcons({ fluentDocumentPdf, simpleMinutemailer, matMarkEmailReadFillOutline })],
  templateUrl: './carta-generacion.component.html',
  styleUrl: './carta-generacion.component.css'
})
export class CartaGeneracionComponent implements OnInit {
  @Input() titular: Empleado | null = null;
  @Input({ required: true }) tipo!: CartaTipo;
  @Input() equipos: EquipoAsignado[] = [];
  @Input() equipoInicial: EquipoAsignado | null = null;
  @Input() equipoContexto: Equipo | null = null;
  @Input() cargandoEstados = false;
  @Input() errorCargaEstados = false;
  @Output() cancelado = new EventEmitter<void>();
  @Output() generada = new EventEmitter<CartaResponsiva>();
  @Output() enviada = new EventEmitter<CartaResponsiva>();

  equipoSeleccionado: Equipo | EquipoAsignado | null = null;
  titularSeleccionado: Empleado | null = null;
  empleados: Empleado[] = [];
  seleccionados: Empleado[] = [];
  busqueda = '';
  cargandoEmpleados = false;
  errorCargaEmpleados = false;
  cargando = false;
  enviando = false;
  error = '';
  cartaCreada: CartaResponsiva | null = null;

  constructor(
    private readonly empleadosService: EmpleadosService,
    private readonly cartasService: CartaResponsivaService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly dialogs: DialogService,
    private readonly emailSendingService: EmailSendingService
  ) {}

  ngOnInit(): void {
    if (this.equipoContexto) {
      this.equipoSeleccionado = this.equipoContexto;
      this.cargarEmpleados();
      return;
    }

    this.equipoSeleccionado = this.equipos.find(
      (equipo) => equipo.Service_Tag === this.equipoInicial?.Service_Tag
    ) ?? null;
    this.titularSeleccionado = this.titular;

    if (this.tipo === 'COMPARTIDA') {
      this.cargarEmpleados();
    }
  }

  get titularActual(): Empleado | null {
    return this.equipoContexto ? this.titularSeleccionado : this.titular;
  }

  private cargarEmpleados(): void {
    this.cargandoEmpleados = true;
    this.errorCargaEmpleados = false;
    this.empleadosService.obtenerTodos().subscribe({
      next: (respuesta) => {
        if (!respuesta.success) {
          this.error = respuesta.error ?? 'El servidor no pudo cargar los empleados.';
          this.cargandoEmpleados = false;
          this.errorCargaEmpleados = true;
          this.changeDetectorRef.markForCheck();
          return;
        }
        const empleadosActivos = (respuesta.data ?? []).filter(
          (empleado) => empleado.Estado && Boolean(empleado.Full_Name?.trim())
        );
        if (this.equipoContexto) {
          this.empleados = empleadosActivos;
          this.titularSeleccionado = empleadosActivos.find(
            (empleado) => empleado.Payroll === this.equipoContexto?.Payroll
          ) ?? null;
          if (!this.titularSeleccionado) {
            this.error = this.equipoContexto.Payroll
              ? 'No se encontró al empleado asignado al equipo. Actualiza la asignación antes de generar la carta.'
              : 'El equipo no tiene un empleado asignado y no se puede generar una carta.';
          }
        } else {
          this.empleados = empleadosActivos.filter(
            (empleado) => empleado.Payroll !== this.titular?.Payroll
          );
        }
        this.cargandoEmpleados = false;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = this.equipoContexto
          ? 'No se pudieron cargar los empleados del equipo.'
          : 'No se pudieron cargar los empleados para compartir.';
        this.cargandoEmpleados = false;
        this.errorCargaEmpleados = true;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  empleadosDisponibles(): Empleado[] {
    const termino = this.busqueda.trim().toLocaleLowerCase();
    const seleccionados = new Set([
      this.titularActual?.Payroll,
      ...this.seleccionados.map((persona) => persona.Payroll)
    ]);
    return this.empleados.filter((empleado) => {
      if (seleccionados.has(empleado.Payroll)) {
        return false;
      }
      return !termino || [
        empleado.Full_Name,
        empleado.Payroll,
        empleado.Departament,
        empleado.Position
      ].some((valor) => String(valor ?? '').toLocaleLowerCase().includes(termino));
    });
  }

  agregarEmpleado(empleado: Empleado): void {
    if (!this.seleccionados.some((persona) => persona.Payroll === empleado.Payroll)) {
      this.seleccionados = [...this.seleccionados, empleado];
    }
    this.busqueda = '';
  }

  quitarEmpleado(payroll: number): void {
    this.seleccionados = this.seleccionados.filter((persona) => persona.Payroll !== payroll);
  }

  crearCarta(): void {
    const titular = this.titularActual;
    if (!titular) {
      this.error = 'No se pudo determinar al titular asignado al equipo.';
      return;
    }
    if (this.cargandoEstados || this.errorCargaEstados) {
      this.error = 'No se pudo verificar si el equipo ya tiene una carta. Vuelve a intentarlo.';
      return;
    }
    if (!this.equipoSeleccionado || (!this.equipoContexto && !this.equipos.some(
      (equipo) => equipo.Service_Tag === this.equipoSeleccionado?.Service_Tag
    ))) {
      this.error = 'Selecciona un equipo disponible para generar la carta.';
      return;
    }
    if (this.tipo === 'COMPARTIDA' && this.seleccionados.length === 0) {
      this.error = 'Selecciona al menos un empleado adicional para la carta compartida.';
      return;
    }
    if ((this.tipo === 'COMPARTIDA' || this.equipoContexto) && this.cargandoEmpleados) {
      this.error = 'Espera a que termine la carga de empleados.';
      return;
    }
    if ((this.tipo === 'COMPARTIDA' || this.equipoContexto) && this.errorCargaEmpleados) {
      this.error = 'No se pudieron cargar los empleados. Cierra y vuelve a abrir la carta.';
      return;
    }

    this.cargando = true;
    this.error = '';
    const payload = this.cartasService.construirPayload(
      this.equipoSeleccionado,
      titular,
      this.tipo,
      this.seleccionados
    );
    this.cartasService.generar(payload).subscribe({
      next: (respuesta) => {
        if (!respuesta.success || !respuesta.data) {
          this.error = respuesta.error ?? 'El servidor no pudo generar la carta.';
          this.cargando = false;
          this.changeDetectorRef.markForCheck();
          return;
        }
        this.cartaCreada = respuesta.data;
        this.generada.emit(respuesta.data);
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta?.error?.error ?? 'No se pudo generar la carta responsiva.';
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  verPdf(): void {
    if (this.cartaCreada) {
      this.cartasService.verPdf(this.cartaCreada.id);
    }
  }

  async enviarCarta(): Promise<void> {
    if (!this.cartaCreada || this.enviando || this.cartaCreada.estado !== 'SIN_ENVIAR') {
      return;
    }

    const destinatarios = [
      this.titularActual?.Correo,
      ...this.seleccionados.map((persona) => persona.Correo)
    ].filter((correo): correo is string => Boolean(correo?.trim()));
    const detalleDestinatarios = destinatarios.length
      ? `Destinatarios: ${destinatarios.join(', ')}`
      : 'No hay correos registrados para los empleados seleccionados.';
    if (!await this.dialogs.confirm(`¿Enviar la carta ${this.cartaCreada.id} ahora?\n${detalleDestinatarios}`)) {
      return;
    }

    this.enviando = true;
    this.error = '';
    this.emailSendingService.begin();
    this.cartasService.enviarCarta(this.cartaCreada.id).subscribe({
      next: (respuesta) => {
        this.emailSendingService.end();
        if (!respuesta.success || !respuesta.data) {
          this.error = respuesta.error ?? 'El servidor no pudo enviar la carta.';
          this.enviando = false;
          this.changeDetectorRef.markForCheck();
          return;
        }

        this.cartaCreada = respuesta.data;
        this.enviada.emit(respuesta.data);
        this.enviando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.emailSendingService.end();
        this.error = respuesta?.error?.error ?? 'No se pudo enviar la carta por correo.';
        this.enviando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }
}
