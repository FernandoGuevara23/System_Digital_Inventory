import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmpleadosService } from '../../../../services/empleados.service';
import { Empleado, EquipoAsignado } from '../../../../models/empleados.model';
import { Equipo } from '../../../../models/equipos.model';
import { ReasignarEquipoComponent } from '../reasignar-equipo/reasignar-equipo.component';
import { ReportesService } from '../../../../services/reportes.service';
import { CartaResponsivaService } from '../../../../services/cartas.service';
import { CartaEstado, CartaResponsiva, EquipoCompartidoCarta, PersonaCarta } from '../../../../models/cartas.model';
import { CartaGeneracionComponent } from '../cartas/carta-generacion.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { aspectsEdit } from '@ng-icons/ux-aspects';
import { remixImageUploadLine } from '@ng-icons/remixicon';
import { fluentPeopleEditFilled  } from '@ng-icons/fluent-ui/filled';
import { fluentPersonEdit,fluentDocumentPdf } from '@ng-icons/fluent-ui';
import {lucideArrowLeft as remixArrowLeftLine} from '@ng-icons/lucide';
import { phosphorArrowsLeftRightBold } from '@ng-icons/phosphor-icons/bold';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import type { AlertType } from '../../../../shared/components/alert/alert.component';
@Component({
  selector: 'app-empleado-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, AlertComponent, ReasignarEquipoComponent, CartaGeneracionComponent, NgIconComponent],
  templateUrl: './empleado-perfil.component.html',
  viewProviders: [provideIcons({ remixImageUploadLine,fluentDocumentPdf, aspectsEdit, phosphorArrowsLeftRightBold, fluentPeopleEditFilled, fluentPersonEdit, remixArrowLeftLine })],
  styleUrls: ['./empleado-perfil.component.css']
})
export class EmpleadoPerfilComponent implements OnInit {
  empleado: Empleado | null = null;
  cargando = true;
  error = '';
  mensaje = '';
  tipoMensaje: AlertType = 'success';
  editando = false;
  edicionForm!: FormGroup;
  fotoSeleccionada: File | null = null;
  vistaPreviaFoto = '';
  equipoParaReasignar: Equipo | null = null;
  equiposParaReasignar: EquipoAsignado[] = [];

  mostrarModalCarta = false;
  tipoCartaModal: 'INDIVIDUAL' | 'COMPARTIDA' | null = null;
  equipoInicialCarta: EquipoAsignado | null = null;
  estadoCartaPorEquipo = new Map<string, CartaEstado>();
  cartasResponsivas: CartaResponsiva[] = [];
  cargandoEstadosCartas = true;
  errorCargaEstadosCartas = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private empleadosService: EmpleadosService,
    private formBuilder: FormBuilder,
    private changeDetectorRef: ChangeDetectorRef,
    private reportesService: ReportesService,
    private readonly cartasService: CartaResponsivaService
  ) {
    this.edicionForm = this.formBuilder.group({
      Estado: [true],
      Correo: ['', Validators.email]
    });
  }

  regresar(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/empleados']);
    }
  }

  ngOnInit(): void {
    const payroll = Number(this.route.snapshot.paramMap.get('payroll'));

    if (!Number.isInteger(payroll) || payroll <= 0) {
      this.error = 'La nómina del empleado no es válida';
      this.cargando = false;
      return;
    }

    this.cargarEstadosCartas();
    this.empleadosService.obtenerPorId(payroll).subscribe({
      next: (respuesta) => {
        this.empleado = respuesta.data ?? null;
        if (!this.empleado) {
          this.error = 'Empleado no encontrado';
        }
        if (this.empleado) {
          this.edicionForm.reset({
            Estado: this.empleado.Estado,
            Correo: this.empleado.Correo ?? ''
          });
        }
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = 'No se pudo cargar el perfil del empleado';
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  private cargarEstadosCartas(): void {
    this.cartasService.resumenEquipos(this.empleado?.Payroll).subscribe({
      next: (respuesta) => {
        if (!respuesta.success) {
          this.estadoCartaPorEquipo = new Map();
          this.cartasResponsivas = [];
          this.cargandoEstadosCartas = false;
          this.errorCargaEstadosCartas = true;
          this.changeDetectorRef.markForCheck();
          return;
        }

        this.cartasResponsivas = respuesta.data ?? [];
        this.estadoCartaPorEquipo = this.estadosCartasPorEquipo(this.cartasResponsivas);
        this.cargandoEstadosCartas = false;
        this.errorCargaEstadosCartas = false;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.estadoCartaPorEquipo = new Map();
        this.cartasResponsivas = [];
        this.cargandoEstadosCartas = false;
        this.errorCargaEstadosCartas = true;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  private actualizarCartaEnListado(carta: CartaResponsiva): void {
    this.cartasResponsivas = [
      carta,
      ...this.cartasResponsivas.filter((existente) => existente.id !== carta.id)
    ];
  }

  etiquetaEstadoCarta(serviceTag: string): string {
    const estado = this.estadoCartaPorEquipo.get(this.normalizarServiceTag(serviceTag));
    if (estado === 'FIRMADA') return 'Carta firmada';
    if (estado === 'ENVIADO') return 'Carta enviada';
    if (estado === 'SIN_ENVIAR') return 'Carta sin enviar';
    if (estado === 'CERRADA') return 'Carta cerrada';
    return 'Sin carta';
  }

  claseEstadoCarta(serviceTag: string): string {
    const estado = this.estadoCartaPorEquipo.get(this.normalizarServiceTag(serviceTag));
    if (estado === 'FIRMADA') return 'carta-state-badge carta-state-badge--signed';
    if (estado === 'ENVIADO') return 'carta-state-badge carta-state-badge--sent';
    if (estado === 'SIN_ENVIAR') return 'carta-state-badge carta-state-badge--pending';
    if (estado === 'CERRADA') return 'carta-state-badge carta-state-badge--closed';
    return 'carta-state-badge carta-state-badge--none';
  }

  private estadosCartasPorEquipo(cartas: CartaResponsiva[]): Map<string, CartaEstado> {
    const estados = new Map<string, CartaEstado>();
    for (const carta of cartas) {
      const serviceTag = this.normalizarServiceTag(carta.service_tag);
      if (!estados.has(serviceTag)) {
        estados.set(serviceTag, carta.estado);
      }
    }
    return estados;
  }

  private normalizarServiceTag(serviceTag: unknown): string {
    return String(serviceTag ?? '').trim().toLocaleUpperCase();
  }

  private tieneCartaValida(serviceTag: string): boolean {
    const estado = this.estadoCartaPorEquipo.get(this.normalizarServiceTag(serviceTag));
    return estado === 'SIN_ENVIAR' || estado === 'ENVIADO' || estado === 'FIRMADA';
  }

  iniciarEdicion(): void {
    if (!this.empleado) {
      return;
    }
    this.edicionForm.reset({
      Estado: this.empleado.Estado,
      Correo: this.empleado.Correo ?? ''
    });
    this.fotoSeleccionada = null;
    this.vistaPreviaFoto = this.obtenerUrlFoto(this.empleado.Foto_URL);
    this.editando = true;
  }

  cancelarEdicion(): void {
    this.editando = false;
    this.fotoSeleccionada = null;
    this.vistaPreviaFoto = '';
    this.edicionForm.reset({ Estado: true, Correo: '' });
  }

  seleccionarFoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) {
      return;
    }

    this.fotoSeleccionada = archivo;
    const lector = new FileReader();
    lector.onload = () => {
      this.vistaPreviaFoto = typeof lector.result === 'string' ? lector.result : '';
      this.changeDetectorRef.markForCheck();
    };
    lector.readAsDataURL(archivo);
  }

  guardarEdicion(): void {
    if (!this.empleado) {
      return;
    }
    if (this.edicionForm.invalid) {
      this.edicionForm.markAllAsTouched();
      this.error = 'Correo Invalido';
      
      this.mensaje = '';
      this.changeDetectorRef.markForCheck();
      return;
    }
    const datos = new FormData();
    datos.append('Estado', String(this.edicionForm.get('Estado')?.value));
    datos.append('Correo', (this.edicionForm.get('Correo')?.value ?? '').trim());
    if (this.fotoSeleccionada) {
      datos.append('foto', this.fotoSeleccionada);
    }

    this.empleadosService.actualizar(this.empleado.Payroll, datos).subscribe({
      next: (respuesta) => {
        if (respuesta.data) {
          this.empleado = respuesta.data;
        }
        this.editando = false;
        this.fotoSeleccionada = null;
        this.vistaPreviaFoto = '';
        const empleadoInactivo = !this.empleado?.Estado;
        this.tipoMensaje = empleadoInactivo ? 'error' : 'warning';
        this.mensaje = empleadoInactivo
          ? 'Empleado actualizado y marcado como inactivo.'
          : 'Empleado actualizado correctamente';
        this.error = '';
        this.edicionForm.reset({
          Estado: this.empleado?.Estado ?? true,
          Correo: this.empleado?.Correo ?? ''
        });
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudo actualizar el empleado';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  obtenerUrlFoto(fotoUrl?: string): string {
    if (!fotoUrl) {
      return '';
    }

    return fotoUrl;
  }

  passwordEnmascarada(password?: string): string {
    return password ? '••••••••' : '—';
  }

  tiposDeEquipo(): string[] {
    const tipos = this.empleado?.Equipos?.map((equipo) => equipo.Tipo_Equipo) ?? [];
    return [...new Set(tipos.filter((tipo) => tipo.trim() !== ''))];
  }

  equiposPorTipo(tipo: string): EquipoAsignado[] {
    return this.empleado?.Equipos?.filter((equipo) => equipo.Tipo_Equipo === tipo) ?? [];
  }

  equiposGenerales(): EquipoAsignado[] {
    return (this.empleado?.Equipos ?? []).filter((equipo) => !this.esTelefono(equipo));
  }

  equiposDisponiblesCarta(): EquipoAsignado[] {
    if (this.cargandoEstadosCartas || this.errorCargaEstadosCartas) {
      return [];
    }
    return (this.empleado?.Equipos ?? []).filter((equipo) => !this.tieneCartaValida(equipo.Service_Tag));
  }

  equiposTelefono(): EquipoAsignado[] {
    return (this.empleado?.Equipos ?? []).filter((equipo) => this.esTelefono(equipo));
  }

  equiposCompartidosDelEmpleado(): EquipoCompartidoCarta[] {
    return this.empleado
      ? this.cartasService.equiposCompartidosDeEmpleado(this.cartasResponsivas, this.empleado.Payroll)
      : [];
  }

  personasCompartidasDeEquipo(serviceTag: string): PersonaCarta[] {
    return this.cartasService.personasCompartidasDeEquipo(this.cartasResponsivas, serviceTag);
  }

  nombresCompartidosDeEquipo(serviceTag: string): string {
    return this.personasCompartidasDeEquipo(serviceTag)
      .map((persona) => persona.nombre?.trim() || `Payroll ${persona.payroll}`)
      .join(', ');
  }

  totalEquiposDelEmpleado(): number {
    if (!this.empleado) {
      return 0;
    }
    const serviceTags = new Set([
      ...(this.empleado.Equipos ?? []).map((equipo) => equipo.Service_Tag.trim().toLocaleUpperCase()),
      ...this.equiposCompartidosDelEmpleado().map((equipo) => equipo.service_tag.trim().toLocaleUpperCase())
    ]);
    return serviceTags.size;
  }

  abrirEquipoCompartido(serviceTag: string): void {
    void this.router.navigate(['/equipos', serviceTag], { queryParams: { compartido: 'true' } });
  }

  lineasDelEmpleado(): EquipoAsignado[] {
    return this.equiposTelefono().filter((equipo) => Boolean(equipo.Numero_Telefono || equipo.Account));
  }

  esTelefono(equipo: EquipoAsignado): boolean {
    const tipo = (equipo.Tipo_Equipo ?? '').toLowerCase();
    return tipo.includes('teléfono') || tipo.includes('telefono') || tipo.includes('iphone');
  }

  abrirReasignacion(equipo: EquipoAsignado): void {
    this.equiposParaReasignar = [];
    this.equipoParaReasignar = {
      Service_Tag: equipo.Service_Tag,
      Payroll: this.empleado?.Payroll ?? null,
      Tipo_Equipo: equipo.Tipo_Equipo,
      Marca: equipo.Marca,
      Modelo: equipo.Modelo,
      MQ_Asset: equipo.MQ_Asset,
      Location: equipo.Location,
      Comments: equipo.Comments,
      Trace: equipo.Trace,
      Estado: equipo.Estado,
      Empleado: this.empleado
        ? {
            Payroll: this.empleado.Payroll,
            Full_Name: this.empleado.Full_Name
          }
        : undefined
    };
  }

  abrirReasignacionGeneral(): void {
    this.equipoParaReasignar = null;
    this.equiposParaReasignar = (this.empleado?.Equipos ?? [])
      .filter((equipo) => Boolean(equipo.Service_Tag))
      .map((equipo) => ({
        ...equipo,
        Payroll: this.empleado?.Payroll ?? null,
        Empleado: this.empleado
          ? {
              Payroll: this.empleado.Payroll,
              Full_Name: this.empleado.Full_Name
            }
          : undefined
      }));
  }

  abrirCarta(tipo: 'INDIVIDUAL' | 'COMPARTIDA', equipo?: EquipoAsignado): void {
    if (!this.empleado) {
      return;
    }

    this.tipoCartaModal = tipo;
    const equipoDisponible = equipo && this.equiposDisponiblesCarta().some(
      (equipoElegible) => equipoElegible.Service_Tag === equipo.Service_Tag
    );
    this.equipoInicialCarta = equipoDisponible ? equipo : null;
    this.error = '';
    this.mensaje = '';
    this.mostrarModalCarta = true;

  }

  cerrarModalCarta(): void {
    this.mostrarModalCarta = false;
    this.tipoCartaModal = null;
    this.equipoInicialCarta = null;
    this.changeDetectorRef.markForCheck();
  }

  cartaGenerada(carta: CartaResponsiva): void {
    this.actualizarCartaEnListado(carta);
    this.estadoCartaPorEquipo.set(this.normalizarServiceTag(carta.service_tag), carta.estado);
    this.tipoMensaje = 'success';
    this.mensaje = `Carta ${carta.id} generada sin enviar. Puedes revisar el PDF y enviarla desde esta ventana.`;
    this.changeDetectorRef.markForCheck();
  }

  cartaEnviada(carta: CartaResponsiva): void {
    this.actualizarCartaEnListado(carta);
    this.estadoCartaPorEquipo.set(this.normalizarServiceTag(carta.service_tag), carta.estado);
    this.tipoMensaje = 'success';
    this.mensaje = `Carta ${carta.id} enviada por correo correctamente.`;
    this.changeDetectorRef.markForCheck();
  }

  abrirDetalleEquipo(serviceTag: string): void {
    void this.router.navigate(['/equipos', serviceTag]);
  }

  cerrarReasignacion(): void {
    this.equipoParaReasignar = null;
    this.equiposParaReasignar = [];
  }

  finalizarReasignacion(): void {
    this.equipoParaReasignar = null;
    this.equiposParaReasignar = [];
    this.mensaje = 'Equipo reasignado correctamente';
    this.tipoMensaje = 'info';
    this.error = '';
    this.ngOnInit();
  }

  esTipo(tipo: string, esperado: string): boolean {
    return tipo.toLowerCase().includes(esperado);
  }
  ReportesEquiposPorEmpleado(): void {
    if (!this.empleado) {
      return;
    }

    this.reportesService.obtenerEquiposPorEmpleado(this.empleado.Payroll).subscribe({
      next: (reporte) => {
        if (reporte.total + reporte.total_compartidos === 0) {
          this.tipoMensaje = 'info';
          this.mensaje = 'Este empleado no tiene equipos para incluir en el reporte.';
          this.changeDetectorRef.markForCheck();
          return;
        }

        this.reportesService.descargarEquiposPorEmpleado(this.empleado!.Payroll).subscribe({
          next: (archivo) => {
            const url = window.URL.createObjectURL(archivo);
            const enlace = document.createElement('a');
            enlace.href = url;
            enlace.download = 'reporte_equipos_por_empleado.pdf';
            document.body.appendChild(enlace);
            enlace.click();
            document.body.removeChild(enlace);
            window.URL.revokeObjectURL(url);
            this.tipoMensaje = 'success';
            this.mensaje = 'Reporte PDF descargado correctamente';
            this.changeDetectorRef.markForCheck();
          },
          error: () => {
            this.tipoMensaje = 'error';
            this.mensaje = 'No se pudo descargar el reporte de equipos.';
            this.changeDetectorRef.markForCheck();
          }
        });
      },
      error: () => {
        this.tipoMensaje = 'error';
        this.mensaje = 'No se pudo verificar si el empleado tiene equipos para reportar.';
        this.changeDetectorRef.markForCheck();
      }
    });
  }
        
}
