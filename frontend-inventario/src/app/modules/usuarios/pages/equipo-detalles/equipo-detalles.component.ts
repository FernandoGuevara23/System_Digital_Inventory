import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { EquiposService } from '../../../../services/equipos.service';
import { ProyectosService } from '../../../../services/proyectos.service';
import { Equipo } from '../../../../models/equipos.model';
import { MovimientoEquipo } from '../../../../models/equipos.model';
import { Proyecto } from '../../../../models/proyecto.model';
import { ScrapService } from '../../../../services/scrap.service';
import {Donacion} from '../../../../models/donaciones.models';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import type { AlertType } from '../../../../shared/components/alert/alert.component';
import { DonacionesService } from '../../../../services/donaciones.service';
import { ProduccionService } from '../../../../services/produccion.service';
import { VentasService } from '../../../../services/ventas.service';
import { ReasignarEquipoComponent } from '../reasignar-equipo/reasignar-equipo.component';
import { CartaGeneracionComponent } from '../cartas/carta-generacion.component';
import { CartaResponsiva, CartaTipo } from '../../../../models/cartas.model';
import { CartaResponsivaService } from '../../../../services/cartas.service';
import { DialogService } from '../../../../shared/services/dialog.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { aspectsEdit, aspectsDashboard } from '@ng-icons/ux-aspects';
import { fluentPersonEdit } from '@ng-icons/fluent-ui';
import { fluentPeopleEditFilled } from '@ng-icons/fluent-ui/filled';
import { phosphorArrowsLeftRightBold } from '@ng-icons/phosphor-icons/bold';
import { phosphorGiftDuotone } from '@ng-icons/phosphor-icons/duotone';
import { lucideRecycle, lucideShoppingBag } from '@ng-icons/lucide';
import {lucideArrowLeft as remixArrowLeftLine} from '@ng-icons/lucide';
@Component({
  selector: 'app-equipo-detalles',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AlertComponent, ReasignarEquipoComponent, CartaGeneracionComponent, NgIconComponent],
  viewProviders: [provideIcons({ aspectsEdit, aspectsDashboard, fluentPersonEdit, fluentPeopleEditFilled, phosphorArrowsLeftRightBold, phosphorGiftDuotone, lucideRecycle, lucideShoppingBag, remixArrowLeftLine })],
  templateUrl: './equipo-detalles.component.html',
  styleUrl: './equipo-detalles.component.css'
})
export class EquipoDetallesComponent implements OnInit {
  equipo: Equipo | null = null;
  proyectos: Proyecto[] = [];
  editando = false;
  guardando = false;
  soloLecturaCompartido = false;
  cargando = true;
  error = '';
  mensaje = '';
  tipoMensaje: AlertType = 'success';
  formulario;
  historial: MovimientoEquipo[] = [];
  pestana: 'detalle' | 'trace' = 'detalle';
  cargandoTrace = false;
  equipoParaReasignar: Equipo | null = null;
  tipoCartaModal: CartaTipo | null = null;
  verificandoCartaActiva = false;
  cartaMostrada: CartaResponsiva | null = null;
  cargandoCarta = true;
  errorCargaCarta = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private equiposService: EquiposService,
    private proyectosService: ProyectosService,
    private scrapService: ScrapService,
    private donacionesService: DonacionesService,
    private produccionService: ProduccionService,
    private ventasService: VentasService,
    private formBuilder: FormBuilder,
    private changeDetectorRef: ChangeDetectorRef,
    private readonly cartasService: CartaResponsivaService,
    private readonly dialogs: DialogService
  ) {
    this.formulario = this.formBuilder.group({
      Tipo_Equipo: ['', Validators.required],
      Hostname: ['', Validators.maxLength(50)],
      MAC: [''],
      Marca: ['', Validators.required],
      Modelo: ['', Validators.required],
          IMEI: [''],
      Numero_Telefono: [''],
      Account: [''],
      Apple_ID: [''],
      Password_apple: [''],
      MQ_Asset: [''],
      Accesorios: [''],
      Location: [''],
      Comments: [''],
      Proyecto: ['']
    });
  }
  regresar(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/equipos']);
    }

  }

  private cargarTrace(serviceTag: string): void {
    this.cargandoTrace = true;
    this.equiposService.getHistorial(serviceTag).subscribe({
      next: (respuesta) => {
        this.historial = respuesta.data ?? [];
        this.cargandoTrace = false;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.historial = [];
        this.cargandoTrace = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  private cargarCartaReciente(serviceTag: string): void {
    this.cargandoCarta = true;
    this.errorCargaCarta = '';
    this.cartasService.buscarCartaReciente(serviceTag).subscribe({
      next: (respuesta) => {
        if (!respuesta.success) {
          this.cartaMostrada = null;
          this.errorCargaCarta = respuesta.error ?? 'No se pudo cargar el estado de la carta.';
        } else {
          this.cartaMostrada = respuesta.data ?? null;
        }
        this.cargandoCarta = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.cartaMostrada = null;
        this.errorCargaCarta = respuesta?.error?.error ?? 'No se pudo cargar el estado de la carta.';
        this.cargandoCarta = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  estadoCartaTexto(): string {
    if (this.cargandoCarta) return 'Consultando...';
    if (!this.cartaMostrada) return 'Sin carta';
    const estados: Record<CartaResponsiva['estado'], string> = {
      SIN_ENVIAR: 'Sin enviar',
      ENVIADO: 'Enviada',
      FIRMADA: 'Firmada',
      CERRADA: 'Cerrada'
    };
    return estados[this.cartaMostrada.estado];
  }

  personasCompartidasCartaActiva(): string {
    if (!this.cartaMostrada || this.cartaMostrada.tipo_carta !== 'COMPARTIDA') {
      return '';
    }
    return this.cartasService.coResponsablesDeCarta(this.cartaMostrada)
      .map((persona) => persona.nombre?.trim() || `Payroll ${persona.payroll}`)
      .join(', ');
  }

  abrirEmpleado(): void {
    if (this.equipo?.Empleado?.Payroll) {
      void this.router.navigate(['/empleados', this.equipo.Empleado.Payroll]);
    }
  }

  abrirReasignacion(): void {
    this.equipoParaReasignar = this.equipo;
  }

  cerrarReasignacion(): void {
    this.equipoParaReasignar = null;
  }

  finalizarReasignacion(): void {
    this.equipoParaReasignar = null;
    this.tipoMensaje = 'info';
    this.mensaje = 'Equipo reasignado correctamente';
    this.error = '';
    this.ngOnInit();
  }

  abrirCarta(tipo: CartaTipo): void {
    if (!this.equipo || this.soloLecturaCompartido || this.verificandoCartaActiva) {
      return;
    }
    if (!this.equipo.Payroll || !this.equipo.Empleado) {
      this.error = 'Asigna el equipo a un empleado antes de generar una carta.';
      return;
    }
    if (this.esInactivo()) {
      this.error = 'No se puede generar una carta para un equipo inactivo.';
      return;
    }
    this.error = '';
    this.verificandoCartaActiva = true;
    const serviceTag = this.equipo.Service_Tag;
    this.cartasService.buscarCartaActiva(serviceTag).subscribe({
      next: (respuesta) => {
        this.verificandoCartaActiva = false;
        if (!respuesta.success) {
          this.error = respuesta.error ?? 'No se pudo verificar si el equipo ya tiene una carta activa.';
        } else if (respuesta.data) {
          this.error = this.mensajeCartaActiva(respuesta.data);
        } else if (this.equipo?.Service_Tag === serviceTag) {
          this.tipoCartaModal = tipo;
        }
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.verificandoCartaActiva = false;
        this.error = respuesta?.error?.error ?? 'No se pudo verificar si el equipo ya tiene una carta activa.';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  private mensajeCartaActiva(carta: CartaResponsiva): string {
    const estado = carta.estado === 'SIN_ENVIAR' ? 'sin enviar'
      : carta.estado === 'ENVIADO' ? 'enviada'
        : 'firmada';
    return `El equipo ya tiene la carta ${carta.id} ${estado}. Solo puede existir una carta activa por equipo. Cierra la carta actual antes de generar otra.`;
  }

  cerrarModalCarta(): void {
    this.tipoCartaModal = null;
    this.changeDetectorRef.markForCheck();
  }

  cartaGenerada(carta: CartaResponsiva): void {
    this.cartaMostrada = carta;
    this.errorCargaCarta = '';
    this.tipoMensaje = 'success';
    this.mensaje = `Carta ${carta.id} generada correctamente.`;
    this.error = '';
    if (this.equipo) {
      this.cargarTrace(this.equipo.Service_Tag);
    }
    this.changeDetectorRef.markForCheck();
  }

  cartaEnviada(carta: CartaResponsiva): void {
    this.cartaMostrada = carta;
    this.errorCargaCarta = '';
    this.tipoMensaje = 'success';
    this.mensaje = `Carta ${carta.id} enviada por correo correctamente.`;
    this.error = '';
    if (this.equipo) {
      this.cargarTrace(this.equipo.Service_Tag);
    }
    this.changeDetectorRef.markForCheck();
  }

  ngOnInit(): void {
    this.soloLecturaCompartido = this.route.snapshot.queryParamMap.get('compartido') === 'true';
    this.proyectosService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.proyectos = respuesta.data ?? [];
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron cargar las opciones de proyectos';
        this.changeDetectorRef.markForCheck();
      }
    });
    const serviceTag = this.route.snapshot.paramMap.get('serviceTag');
    if (!serviceTag) {
      this.error = 'El Service Tag no es válido';
      this.cargando = false;
      return;
    }

    this.equiposService.getEquipoById(serviceTag).subscribe({
      next: (respuesta) => {
        this.equipo = respuesta.data ?? null;
        if (this.equipo) {
          this.formulario.patchValue(this.equipo);
        } else {
          this.error = 'Equipo no encontrado';
        }
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = 'No se pudo cargar el equipo';
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
    this.cargarCartaReciente(serviceTag);
    this.cargarTrace(serviceTag);
  }

  esTelefono(): boolean {
    const tipo = (this.formulario.get('Tipo_Equipo')?.value ?? this.equipo?.Tipo_Equipo ?? '').toString().toLowerCase();
    return tipo.includes('teléfono') || tipo.includes('telefono') || tipo.includes('iphone');
  }

  iniciarEdicion(): void {
    if (!this.equipo || this.soloLecturaCompartido) {
      return;
    }
    this.formulario.reset(this.equipo);
    this.error = '';
    this.mensaje = '';
    this.editando = true;
    this.changeDetectorRef.detectChanges();
  }

  cancelarEdicion(): void {
    if (this.equipo) {
      this.formulario.reset(this.equipo);
    }
    this.editando = false;
    this.changeDetectorRef.markForCheck();
  }

  guardar(): void {
    if (!this.equipo) {
      this.error = 'No se pudo identificar el equipo que se desea actualizar.';
      this.changeDetectorRef.detectChanges();
      return;
    }
    if (this.guardando) {
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      const camposInvalidos = Object.entries(this.formulario.controls)
        .filter(([, control]) => control.invalid)
        .map(([campo]) => campo);
      this.error = `Revisa los campos obligatorios: ${camposInvalidos.join(', ')}.`;
      this.changeDetectorRef.detectChanges();
      return;
    }

    this.guardando = true;
    this.error = '';
    const valores = this.formulario.getRawValue() as Equipo;
    const {
      Service_Tag,
      Payroll,
      Numero_Telefono,
      Account,
      Apple_ID,
      Password_apple,
      ...camposEditables
    } = valores;
    camposEditables.Hostname = String(camposEditables.Hostname ?? '').trim();
    camposEditables.MAC = String(camposEditables.MAC ?? '').trim();
    if (this.esTelefono()) {
      Object.assign(camposEditables, {
        Numero_Telefono,
        Account,
        Apple_ID,
        Password_apple
      });
    }
    this.equiposService.updateEquipo(
      this.equipo.Service_Tag,
      camposEditables as Equipo
    ).subscribe({
      next: (respuesta) => {
        this.guardando = false;
        if (!respuesta.success || !respuesta.data) {
          this.error = respuesta.error ?? 'El servidor no confirmó la actualización del equipo.';
          this.changeDetectorRef.detectChanges();
          return;
        }
        this.equipo = respuesta.data;
        this.formulario.reset(this.equipo);
        this.editando = false;
        this.tipoMensaje = 'warning';
        this.mensaje = 'Equipo actualizado correctamente';
        this.error = '';
        this.changeDetectorRef.detectChanges();
      },
      error: (respuesta) => {
        this.guardando = false;
        this.error = respuesta.error?.error ?? respuesta.error?.message ?? 'No se pudo actualizar el equipo';
        this.changeDetectorRef.detectChanges();
      }
    });
  }
  async solicitarDonacion(): Promise<void> {
    if (!this.equipo || !await this.dialogs.confirm('¿Enviar este equipo a Donación?', 'Enviar a Donación', 'orange')) {
      return;
    }
    this.confirmarDonacion();
  }

  async solicitarScrap(): Promise<void> {
    if (!this.equipo || !await this.dialogs.confirm('¿Enviar este equipo a Scrap?', 'Enviar a Scrap', 'orange')) {
      return;
    }
    this.confirmarScrap();
  }

  esInactivo(): boolean {
    return (this.equipo?.Estado ?? '').trim().toLowerCase() === 'inactivo';
  }

  async reactivarEquipo(): Promise<void> {
    if (!this.equipo || !await this.dialogs.confirm('¿Volver a activar este equipo?', 'Reactivar equipo', 'success')) return;

    this.equiposService.activarEquipo(this.equipo.Service_Tag).subscribe({
      next: respuesta => {
        if (respuesta.data) {
          this.equipo = respuesta.data;
          this.formulario.reset(this.equipo);
        }
        this.tipoMensaje = 'success';
        this.mensaje = 'El equipo volvió a estar activo';
        this.error = '';
        this.changeDetectorRef.markForCheck();
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudo reactivar el equipo';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  confirmarScrap(): void {
    if (!this.equipo) {
      return;
    }

    this.scrapService.enviarEquipos([this.equipo.Service_Tag]).subscribe({
      next: () => {
        this.notificarMovimiento('Scrap');
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudo enviar el equipo a Scrap';
        this.changeDetectorRef.markForCheck();
      }
    });
  }
  confirmarDonacion(): void {
    if (!this.equipo) {
      return;
    }

    this.donacionesService.enviarEquipos([this.equipo.Service_Tag]).subscribe({
      next: () => {
        this.notificarMovimiento('Donación');
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudo enviar el equipo a Donacion';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  confirmarProduccion(): void {
    if (!this.equipo) return;
    this.produccionService.enviarEquipos([this.equipo.Service_Tag]).subscribe({
      next: () => {
        this.notificarMovimiento('Producción');
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudo enviar el equipo a Producción';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  async solicitarProduccion(): Promise<void> {
    if (!this.equipo || !await this.dialogs.confirm('¿Enviar este equipo a Producción?', 'Enviar a Producción', 'orange')) return;
    this.confirmarProduccion();
  }

  confirmarVenta(): void {
    if (!this.equipo) return;
    this.ventasService.enviarEquipos([this.equipo.Service_Tag]).subscribe({
      next: () => {
        this.notificarMovimiento('Ventas');
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudo enviar el equipo a Ventas';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  async solicitarVenta(): Promise<void> {
    if (!this.equipo || !await this.dialogs.confirm('¿Enviar este equipo a Ventas?', 'Enviar a Ventas', 'orange')) return;
    this.confirmarVenta();
  }

  private notificarMovimiento(destino: 'Scrap' | 'Donación' | 'Producción' | 'Ventas'): void {
    if (this.equipo) {
      this.equipo = { ...this.equipo, Estado: 'Inactivo' };
      this.formulario.reset(this.equipo);
    }
    this.tipoMensaje = 'orange';
    this.mensaje = `Equipo enviado a ${destino} correctamente. Este equipo ya no podrá modificarse desde inventario.`;
    this.error = '';
    this.changeDetectorRef.markForCheck();
  }

  passwordEnmascarada(password?: string): string {
    return password ? '••••••••' : '—';
  }
}
