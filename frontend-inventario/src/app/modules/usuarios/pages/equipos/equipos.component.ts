import { ChangeDetectorRef, Component, DestroyRef, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, map } from 'rxjs';
import { EmpleadosService } from '../../../../services/empleados.service';
import { EquiposService } from '../../../../services/equipos.service';
import { TiposEquipoService } from '../../../../services/tipos_equipo.service';
import { Empleado } from '../../../../models/empleados.model';
import { Equipo } from '../../../../models/equipos.model';
import { MovimientoEquipo } from '../../../../models/equipos.model';
import { TipoEquipo } from '../../../../models/tipos_equipo.models';
import { ProyectosService } from '../../../../services/proyectos.service';
import { Proyecto } from '../../../../models/proyecto.model';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import type { AlertType } from '../../../../shared/components/alert/alert.component';
import { ReasignarEquipoComponent } from '../reasignar-equipo/reasignar-equipo.component';
import { ScrapService } from '../../../../services/scrap.service';
import { DonacionesService } from '../../../../services/donaciones.service';
import { ProduccionService } from '../../../../services/produccion.service';
import { VentasService } from '../../../../services/ventas.service';
import { CartaGeneracionComponent } from '../cartas/carta-generacion.component';
import { CartaResponsiva, CartaTipo } from '../../../../models/cartas.model';
import { CartaResponsivaService } from '../../../../services/cartas.service';
import { DialogService } from '../../../../shared/services/dialog.service';

import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { aspectsEdit } from '@ng-icons/ux-aspects';
import { remixImageUploadLine } from '@ng-icons/remixicon';
import { fluentPeopleEditFilled } from '@ng-icons/fluent-ui/filled';
import { phosphorArrowsLeftRightBold } from '@ng-icons/phosphor-icons/bold';
import { fluentPersonEdit } from '@ng-icons/fluent-ui';
import { phosphorGiftDuotone, phosphorDeviceMobileDuotone  } from '@ng-icons/phosphor-icons/duotone';
import { lucideRecycle, lucideUsers } from '@ng-icons/lucide';
import { lucideShoppingBag  } from '@ng-icons/lucide';
import { aspectsDashboard } from '@ng-icons/ux-aspects';
import { tablerDevicesPlus } from '@ng-icons/tabler-icons';
import { phosphorMicrosoftExcelLogoLight } from '@ng-icons/phosphor-icons/light';

const remixGroupFill = lucideUsers;
const remixRecycleLine = lucideRecycle;
@Component({
  selector: 'app-equipos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AlertComponent, ReasignarEquipoComponent, CartaGeneracionComponent, NgIconComponent],
  templateUrl: './equipos.component.html',
  viewProviders: [provideIcons({ lucideRecycle, lucideShoppingBag, aspectsDashboard, phosphorArrowsLeftRightBold, aspectsEdit, fluentPeopleEditFilled, fluentPersonEdit, phosphorGiftDuotone, tablerDevicesPlus, phosphorMicrosoftExcelLogoLight })],
  styleUrl: './equipos.component.css'
})
export class EquiposComponent implements OnInit {
  vistaEquipos: 'todos' | 'disponibles' | 'asignados' | 'proyectos' = 'todos';
  empleados: Empleado[] = [];
  tiposEquipo: TipoEquipo[] = [];
  equipos: Equipo[] = [];
  paginaActual = 1;
  readonly equiposPorPagina = 25;
  totalEquipos = 0;
  totalPaginas = 0;
  cargandoEquipos = false;
  equiposCargados = false;
  conteosEquipos = { registros: 0, total: 0, disponibles: 0, asignados: 0, con_proyecto: 0 };
  ultimoServiceTag: string | null = null;
  proyectos: Proyecto[] = [];
  departamentos: { Id: number; Nombre_Departamento: string; Manager_Asignado: string }[] = [];
  categoriaSeleccionada = '';
  error = '';
  mensaje = '';
  tipoMensaje: AlertType = 'success';
  mostrarFormulario = false;
  equipoParaReasignar: Equipo | null = null;
  equipoSeleccionado: Equipo | null = null;
  tipoCartaModal: CartaTipo | null = null;
  verificandoCartaActiva = false;
  filtroCarta: 'TODOS' | 'INDIVIDUAL' | 'COMPARTIDA' | 'SIN_ENVIAR' = 'TODOS';
  cartasResponsivas: CartaResponsiva[] = [];
  cargandoCartas = true;
  errorCartas = '';
  private cartasRecientesPorEquipo = new Map<string, CartaResponsiva>();
  private equiposRequestId = 0;
  private cartasRequestId = 0;
  editandoEquipo = false;
  historialEquipo: MovimientoEquipo[] = [];
  cargandoTrace = false;
  guardandoEdicionEquipo = false;
  pestanaEquipo: 'detalle' | 'trace' = 'detalle';
  busquedaEquiposControl = new FormControl('');
  empleadoBusquedaControl = new FormControl('', { nonNullable: true });
  selectorEmpleadosAbierto = false;
  cargandoExcel = false;
  descargandoPlantilla = false;

  equipoForm;
  equipoEditForm;

  constructor(
    private formBuilder: FormBuilder,
    private empleadosService: EmpleadosService,
    private equiposService: EquiposService,
    private tiposEquipoService: TiposEquipoService,
    private changeDetectorRef: ChangeDetectorRef,
    private readonly destroyRef: DestroyRef,
    private location: Location,
    private proyectosService: ProyectosService,
    private router: Router,
    private scrapService: ScrapService,
    private donacionesService: DonacionesService,
    private produccionService: ProduccionService,
    private ventasService: VentasService,
    private readonly cartasService: CartaResponsivaService,
    private readonly dialogs: DialogService
  
  ) {
    this.equipoForm = this.formBuilder.group({
      Service_Tag: ['', Validators.required],
      Hostname: ['', Validators.maxLength(50)],
      MAC: [''],
      Payroll: [null as number | null],
      Tipo_Equipo: ['', Validators.required],
      Marca: ['', Validators.required],
      Modelo: ['', Validators.required],
      IMEI: [''],
      MQ_Asset: [''],
      Accesorios: [''],
      Location: [''],
      Comments: [''],
      Proyecto: ['']
    });
    this.equipoForm.controls.Tipo_Equipo.valueChanges.subscribe((tipo) => {
      if (this.esTipoTelefono(tipo)) {
        this.equipoForm.controls.Hostname.setValue('');
      } else {
        this.equipoForm.controls.IMEI.setValue('');
      }
    });
    this.equipoEditForm = this.formBuilder.group({
      Hostname: ['', Validators.maxLength(50)],
      MAC: [''],
      Marca: ['', Validators.required],
      Modelo: ['', Validators.required],
      IMEI: [''],
      MQ_Asset: [''],
      Accesorios: [''],
      Location: [''],
      Comments: [''],
      Proyecto: ['']
    });

    this.busquedaEquiposControl.valueChanges.pipe(
      map((termino) => (termino ?? '').trim()),
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.cargarEquipos(1));
  }

  regresar(): void {
    this.location.back();
  }

  cerrarSelectorEmpleadosEnFormulario(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && !target.closest('.employee-picker-field')) {
      this.selectorEmpleadosAbierto = false;
    }
  }

  alternarFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    this.selectorEmpleadosAbierto = false;
    this.empleadoBusquedaControl.setValue('', { emitEvent: false });
    if (!this.mostrarFormulario) {
      this.equipoForm.reset();
    }
    this.changeDetectorRef.markForCheck();
  }

  abrirEquipo(equipo: Equipo): void {
    this.equipoSeleccionado = equipo;
    this.editandoEquipo = false;
    this.pestanaEquipo = 'detalle';
    this.historialEquipo = [];
    this.cargandoTrace = true;
    this.equiposService.getHistorial(equipo.Service_Tag).subscribe({
      next: (respuesta) => {
        this.historialEquipo = respuesta.data ?? [];
        this.cargandoTrace = false;
        this.changeDetectorRef.detectChanges();
      },
      error: () => {
        this.historialEquipo = [];
        this.cargandoTrace = false;
        this.changeDetectorRef.detectChanges();
      }
    });
  }

  abrirDetalleEquipo(equipo: Equipo): void {
    void this.router.navigate(['/equipos', equipo.Service_Tag]);
  }

    cerrarEquipo(): void {
      this.equipoSeleccionado = null;
      this.editandoEquipo = false;
  }

  abrirEmpleadoDesdePanel(equipo: Equipo): void {
    if (equipo.Empleado?.Payroll) {
      void this.router.navigate(['/empleados', equipo.Empleado.Payroll]);
    }
  }

  abrirCartaDesdePanel(tipo: CartaTipo): void {
    const equipo = this.equipoSeleccionado;
    if (this.verificandoCartaActiva) {
      return;
    }
    if (!equipo || !equipo.Payroll || !equipo.Empleado) {
      this.error = 'Asigna el equipo a un empleado antes de generar una carta.';
      return;
    }
    if (equipo.Estado?.trim().toLocaleLowerCase() === 'inactivo') {
      this.error = 'No se puede generar una carta para un equipo inactivo.';
      return;
    }
    this.error = '';
    this.verificandoCartaActiva = true;
    this.cartasService.buscarCartaActiva(equipo.Service_Tag).subscribe({
      next: (respuesta) => {
        this.verificandoCartaActiva = false;
        if (!respuesta.success) {
          this.error = respuesta.error ?? 'No se pudo verificar si el equipo ya tiene una carta activa.';
        } else if (respuesta.data) {
          this.error = this.mensajeCartaActiva(respuesta.data);
        } else if (this.equipoSeleccionado?.Service_Tag === equipo.Service_Tag) {
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

  private actualizarHistorialEquipo(errorMessage: string): void {
    if (!this.equipoSeleccionado) {
      return;
    }
    this.equiposService.getHistorial(this.equipoSeleccionado.Service_Tag).subscribe({
      next: (respuesta) => {
        this.historialEquipo = respuesta.data ?? [];
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = errorMessage;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  cartaGenerada(carta: CartaResponsiva): void {
    this.actualizarCartaEnListado(carta);
    this.tipoMensaje = 'success';
    this.mensaje = `Carta ${carta.id} generada correctamente.`;
    this.error = '';
    this.actualizarHistorialEquipo('La carta se generó, pero no se pudo actualizar el historial del equipo.');
    this.changeDetectorRef.markForCheck();
  }

  cartaEnviada(carta: CartaResponsiva): void {
    this.actualizarCartaEnListado(carta);
    this.tipoMensaje = 'success';
    this.mensaje = `Carta ${carta.id} enviada por correo correctamente.`;
    this.error = '';
    this.actualizarHistorialEquipo('La carta se envió, pero no se pudo actualizar el historial del equipo.');
    this.changeDetectorRef.markForCheck();
  }

  private actualizarCartaEnListado(carta: CartaResponsiva): void {
    this.cartasRequestId++;
    this.cartasResponsivas = [
      carta,
      ...this.cartasResponsivas.filter((existente) => existente.id !== carta.id)
    ].sort((a, b) => b.id - a.id);
    this.indexarCartasRecientes(this.cartasResponsivas);
    this.errorCartas = '';
    this.cargandoCartas = false;
  }

  abrirReasignacionDesdePanel(): void {
    this.equipoParaReasignar = this.equipoSeleccionado;
  }

  iniciarEdicionEquipo(): void {
    if (!this.equipoSeleccionado) return;
    this.equipoEditForm.reset(this.equipoSeleccionado);
    this.error = '';
    this.mensaje = '';
    this.editandoEquipo = true;
    this.changeDetectorRef.markForCheck();
  }

  cancelarEdicionEquipo(): void {
    if (this.equipoSeleccionado) {
      this.equipoEditForm.reset(this.equipoSeleccionado);
    }
    this.editandoEquipo = false;
    this.error = '';
    this.changeDetectorRef.markForCheck();
  }

  finalizarReasignacionDesdePanel(): void {
    const serviceTag = this.equipoParaReasignar?.Service_Tag;
    this.equipoParaReasignar = null;
    this.cerrarEquipo();
    this.tipoMensaje = 'info';
    this.mensaje = 'Equipo reasignado correctamente';
    this.error = '';
    this.cargarEquipos();
    if (serviceTag) this.cargarCartasDeEquipo(serviceTag);
    this.changeDetectorRef.markForCheck();
  }

  guardarEdicionEquipo(): void {
    const equipo = this.equipoSeleccionado;
    if (!equipo || this.guardandoEdicionEquipo) return;
    if (this.equipoEditForm.invalid) {
      this.equipoEditForm.markAllAsTouched();
      this.error = 'Completa los campos obligatorios.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    const { Hostname, IMEI, ...camposEditables } = this.equipoEditForm.getRawValue() as Equipo;
    const datos: Equipo = {
      ...camposEditables,
      ...(this.esTelefono(equipo)
        ? { IMEI: String(IMEI ?? '').trim() }
        : { Hostname: String(Hostname ?? '').trim() })
    };
    datos.MAC = String(datos.MAC ?? '').trim();
    this.guardandoEdicionEquipo = true;
    this.error = '';
    this.equiposService.updateEquipo(equipo.Service_Tag, datos).subscribe({
      next: (respuesta) => {
        const equipoActualizado: Equipo = {
          ...equipo,
          ...datos,
          ...respuesta.data
        };
        this.equipoSeleccionado = equipoActualizado;
        this.equipos = this.equipos.map((existente) =>
          existente.Service_Tag === equipoActualizado.Service_Tag ? equipoActualizado : existente
        );
        this.cargarEquipos();
        this.editandoEquipo = false;
        this.guardandoEdicionEquipo = false;
        this.tipoMensaje = 'warning';
        this.mensaje = 'Equipo actualizado correctamente';
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.guardandoEdicionEquipo = false;
        this.error = respuesta.error?.error ?? 'No se pudo actualizar el equipo';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

    async enviarAScrap(): Promise<void> {
        if (!this.equipoSeleccionado || !await this.dialogs.confirm('¿Enviar este equipo a Scrap?', 'Enviar a Scrap', 'orange')) return;
        this.scrapService.enviarEquipos([this.equipoSeleccionado.Service_Tag]).subscribe({
          next: () => {
            this.notificarMovimiento('Scrap');
          },
        error: (respuesta) => {
          this.error = respuesta.error?.error ?? 'No se pudo enviar el equipo a Scrap';
          this.changeDetectorRef.markForCheck();
  
        }
      });
    }

    async enviarADonacion(): Promise<void> {
      if (!this.equipoSeleccionado || !await this.dialogs.confirm('¿Enviar este equipo a Donación?', 'Enviar a Donación', 'orange')) return;
      this.donacionesService.enviarEquipos([this.equipoSeleccionado.Service_Tag]).subscribe({
        next: () => {
          this.notificarMovimiento('Donación');
        },
        error: (respuesta) => {
          this.error = respuesta.error?.error ?? 'No se pudo enviar el equipo a Donación';
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  async enviarAProduccion(): Promise<void> {
    if (!this.equipoSeleccionado || !await this.dialogs.confirm('¿Enviar este equipo a Producción?', 'Enviar a Producción', 'orange')) return;
    this.produccionService.enviarEquipos([this.equipoSeleccionado.Service_Tag]).subscribe({
      next: () => {
        this.notificarMovimiento('Producción');
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudo enviar el equipo a Producción';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  async enviarAVentas(): Promise<void> {
    if (!this.equipoSeleccionado || !await this.dialogs.confirm('¿Enviar este equipo a Ventas?', 'Enviar a Ventas', 'orange')) return;
    this.ventasService.enviarEquipos([this.equipoSeleccionado.Service_Tag]).subscribe({
      next: () => {
        this.notificarMovimiento('Ventas');
      },
      error: respuesta => {
        this.error = respuesta.error?.error ?? 'No se pudo enviar el equipo a Ventas';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  private notificarMovimiento(destino: 'Scrap' | 'Donación' | 'Producción' | 'Ventas'): void {
    const serviceTag = this.equipoSeleccionado?.Service_Tag;
    this.tipoMensaje = 'orange';
    this.mensaje = `Equipo enviado a ${destino} correctamente. Este equipo ya no podrá modificarse desde inventario.`;
    this.error = '';
    this.cerrarEquipo();
    this.cargarEquipos(1);
    if (serviceTag) this.cargarCartasDeEquipo(serviceTag);
    this.changeDetectorRef.markForCheck();
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargarCartas();
    this.cargarUltimoServiceTag();
    this.cargarEquipos();
    this.empleadosService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.empleados = respuesta.data ?? [];
        this.changeDetectorRef.markForCheck();
      },
      error: () => this.error = 'No se pudieron cargar los empleados'
    });
    this.tiposEquipoService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.tiposEquipo = respuesta.data ?? [];
        this.changeDetectorRef.markForCheck();
      },
      error: () => this.error = 'No se pudo cargar el catálogo de tipos de equipo'
    });
    this.proyectosService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.proyectos = respuesta.data ?? [];
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron cargar los proyectos';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  private cargarUltimoServiceTag(): void {
    this.equiposService.getUltimoServiceTag().subscribe({
      next: respuesta => {
        this.ultimoServiceTag = respuesta.data?.Service_Tag ?? null;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.ultimoServiceTag = null;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  private cargarEquipos(pagina = this.paginaActual): void {
    this.paginaActual = pagina;
    const requestId = ++this.equiposRequestId;
    this.cargandoEquipos = true;
    this.changeDetectorRef.markForCheck();
    this.equiposService.getEquipos({
      page: this.paginaActual,
      page_size: this.equiposPorPagina,
      q: (this.busquedaEquiposControl.value ?? '').trim(),
      view: this.vistaEquipos,
      category: this.categoriaSeleccionada,
      carta_filter: this.filtroCarta
    }).subscribe({
      next: (respuesta) => {
        if (requestId !== this.equiposRequestId) return;
        if (!respuesta.success || !respuesta.pagination || !respuesta.counts) {
          this.error = respuesta.error ?? 'La respuesta de equipos no incluye los datos de paginación.';
          this.cargandoEquipos = false;
          this.changeDetectorRef.markForCheck();
          return;
        }
        this.equipos = respuesta.data ?? [];
        this.paginaActual = respuesta.pagination.page;
        this.totalEquipos = respuesta.pagination.total;
        this.totalPaginas = respuesta.pagination.total_pages;
        this.conteosEquipos = respuesta.counts;
        this.equiposCargados = true;
        this.cargandoEquipos = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        if (requestId !== this.equiposRequestId) return;
        this.cargandoEquipos = false;
        this.error = respuesta.error?.error ?? 'No se pudieron cargar los equipos';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  cargarCartas(): void {
    const requestId = ++this.cartasRequestId;
    this.cargandoCartas = true;
    this.errorCartas = '';
    this.cartasService.resumenEquipos().subscribe({
      next: (respuesta) => {
        if (requestId !== this.cartasRequestId) return;
        if (!respuesta.success) {
          this.cartasResponsivas = [];
          this.indexarCartasRecientes(this.cartasResponsivas);
          this.errorCartas = respuesta.error ?? 'No se pudieron cargar las cartas de los equipos.';
        } else {
          this.cartasResponsivas = respuesta.data ?? [];
          this.indexarCartasRecientes(this.cartasResponsivas);
        }
        this.cargandoCartas = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        if (requestId !== this.cartasRequestId) return;
        this.cartasResponsivas = [];
        this.indexarCartasRecientes(this.cartasResponsivas);
        this.errorCartas = respuesta?.error?.error ?? 'No se pudieron cargar las cartas de los equipos.';
        this.cargandoCartas = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  private cargarCartasDeEquipo(serviceTag: string): void {
    const requestId = ++this.cartasRequestId;
    this.cargandoCartas = true;
    this.errorCartas = '';
    this.cartasService.resumenEquipos(undefined, serviceTag).subscribe({
      next: (respuesta) => {
        if (requestId !== this.cartasRequestId) return;
        if (!respuesta.success) {
          this.errorCartas = respuesta.error ?? 'No se pudieron actualizar las cartas del equipo.';
        } else {
          const serviceTagNormalizado = serviceTag.trim().toLocaleUpperCase();
          const cartasDelEquipo = (respuesta.data ?? []).filter(
            (carta) => carta.service_tag.trim().toLocaleUpperCase() === serviceTagNormalizado
          );
          this.cartasResponsivas = [
            ...this.cartasResponsivas.filter(
              (carta) => carta.service_tag.trim().toLocaleUpperCase() !== serviceTagNormalizado
            ),
            ...cartasDelEquipo
          ].sort((a, b) => b.id - a.id);
          this.indexarCartasRecientes(this.cartasResponsivas);
        }
        this.cargandoCartas = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        if (requestId !== this.cartasRequestId) return;
        this.errorCartas = respuesta?.error?.error ?? 'No se pudieron actualizar las cartas del equipo.';
        this.cargandoCartas = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  guardarEquipo(): void {
    if (this.equipoForm.invalid) {
      this.equipoForm.markAllAsTouched();
      this.error = 'Completa Service Tag, tipo de equipo, marca y modelo';
      this.mensaje = '';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.error = '';
    this.mensaje = '';
    const datos = this.equipoForm.getRawValue() as Equipo;
    datos.Hostname = String(datos.Hostname ?? '').trim();
    datos.MAC = String(datos.MAC ?? '').trim();
    datos.IMEI = String(datos.IMEI ?? '').trim();
    this.equiposService.createEquipo(datos).subscribe({
      next: (respuesta) => {
        this.tipoMensaje = 'success';
        this.mensaje = 'Equipo creado correctamente';
        this.cargarEquipos(1);
        this.finalizarGuardadoEquipo();
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudo crear el equipo';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  private finalizarGuardadoEquipo(): void {
    this.equipoForm.reset();
    this.mostrarFormulario = false;
    this.cargarUltimoServiceTag();
    this.changeDetectorRef.markForCheck();
  }

  empleadoLabel(empleado: Empleado): string {
    return `${empleado.Payroll} - ${empleado.Full_Name}`;
  }

  empleadosFiltrados(): Empleado[] {
    const termino = this.empleadoBusquedaControl.value.trim().toLocaleLowerCase();
    return this.empleados
      .filter((empleado) => empleado.Estado && (!termino
        || empleado.Full_Name.toLocaleLowerCase().includes(termino)
        || String(empleado.Payroll).includes(termino)
        || (empleado.Departament ?? '').toLocaleLowerCase().includes(termino)))
      .slice(0, 40);
  }

  buscarEmpleados(): void {
    this.selectorEmpleadosAbierto = true;
    this.equipoForm.controls.Payroll.setValue(null);
  }

  seleccionarEmpleado(empleado: Empleado): void {
    this.equipoForm.controls.Payroll.setValue(empleado.Payroll);
    this.empleadoBusquedaControl.setValue(empleado.Full_Name, { emitEvent: false });
    this.selectorEmpleadosAbierto = false;
  }

  limpiarEmpleadoSeleccionado(): void {
    this.equipoForm.controls.Payroll.setValue(null);
    this.empleadoBusquedaControl.setValue('');
    this.selectorEmpleadosAbierto = true;
  }

  passwordEnmascarada(password?: string): string {
    return password ? '••••••••' : '—';
  }

  esTelefono(equipo: Equipo): boolean {
    return this.esTipoTelefono(equipo.Tipo_Equipo);
  }

  esTipoTelefonoSeleccionado(): boolean {
    return this.esTipoTelefono(this.equipoForm.controls.Tipo_Equipo.value);
  }

  esTipoTelefono(tipoEquipo: string | null | undefined): boolean {
    const tipo = tipoEquipo?.toLowerCase() ?? '';
    return tipo.includes('teléfono') || tipo.includes('telefono') || tipo.includes('iphone');
  }

  equiposFiltrados(): Equipo[] {
    return this.equipos;
  }

  cambiarFiltroCarta(filtro: 'TODOS' | 'INDIVIDUAL' | 'COMPARTIDA' | 'SIN_ENVIAR'): void {
    this.filtroCarta = filtro;
    this.cargarEquipos(1);
  }

  cartaRecienteDeEquipo(serviceTag: string): CartaResponsiva | null {
    return this.cartasRecientesPorEquipo.get(serviceTag.trim().toLocaleUpperCase()) ?? null;
  }

  private indexarCartasRecientes(cartas: CartaResponsiva[]): void {
    const index = new Map<string, CartaResponsiva>();
    for (const carta of cartas) {
      const serviceTag = carta.service_tag.trim().toLocaleUpperCase();
      const reciente = index.get(serviceTag);
      if (!reciente || carta.id > reciente.id) {
        index.set(serviceTag, carta);
      }
    }
    this.cartasRecientesPorEquipo = index;
  }

  estadoCartaTexto(carta: CartaResponsiva | null): string {
    if (this.cargandoCartas) return 'Consultando...';
    if (!carta) return 'Sin carta';
    const estados: Record<CartaResponsiva['estado'], string> = {
      SIN_ENVIAR: 'Sin enviar',
      ENVIADO: 'Enviada',
      FIRMADA: 'Firmada',
      CERRADA: 'Cerrada'
    };
    return estados[carta.estado];
  }

  personasCompartidasDeCarta(carta: CartaResponsiva | null): string {
    if (!carta || carta.tipo_carta !== 'COMPARTIDA') {
      return '';
    }
    return this.cartasService.coResponsablesDeCarta(carta)
      .map((persona) => persona.nombre?.trim() || `Payroll ${persona.payroll}`)
      .join(', ');
  }

  tipoCartaTexto(carta: CartaResponsiva | null): string {
    return carta?.tipo_carta === 'COMPARTIDA' ? 'Compartida' : 'Individual';
  }
  equiposFiltradosPorTipo(tipo: string): Equipo[] {
    const tipoNormalizado = this.normalizarTipo(tipo);
    return this.equiposFiltrados().filter((equipo) => this.normalizarTipo(equipo.Tipo_Equipo) === tipoNormalizado);
  }
  cambiarVista(vista: 'todos' | 'disponibles' | 'asignados' | 'proyectos'): void {
    this.vistaEquipos = vista;
    this.busquedaEquiposControl.setValue('', { emitEvent: false });
    this.cargarEquipos(1);
  }

  cantidadActivos(): number {
    return this.conteosEquipos.total;
  }

  cantidadTotal(): number {
    return this.conteosEquipos.total;
  }

  cantidadDisponibles(): number {
    return this.conteosEquipos.disponibles;
  }

  cantidadAsignados(): number {
    return this.conteosEquipos.asignados;
  }

  cantidadInactivos(): number {
    return this.equipos.filter((equipo) => equipo.Estado?.trim().toLowerCase() === 'inactivo').length;
  }

  cantidadConProyecto(): number {
    return this.conteosEquipos.con_proyecto;
  }

  estaAsignado(equipo: Equipo): boolean {
    return equipo.Payroll !== null && equipo.Payroll !== undefined && Boolean(equipo.Empleado);
  }

  estadoVisible(equipo: Equipo): 'Asignado' | 'Disponible' | 'Inactivo' {
    if (equipo.Estado?.trim().toLowerCase() === 'inactivo') return 'Inactivo';
    return this.estaAsignado(equipo) ? 'Asignado' : 'Disponible';
  }

  departamentoDe(equipo: Equipo): string {
    const empleado = this.empleados.find((item) => item.Payroll === equipo.Payroll);
    return empleado?.Departament ?? '';
  }

  seleccionarCategoria(categoria: string): void {
    this.categoriaSeleccionada = this.categoriaSeleccionada === categoria ? '' : categoria;
    this.cargarEquipos(1);
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas || this.cargandoEquipos) return;
    this.cargarEquipos(pagina);
  }

  private normalizarTipo(valor: string | null | undefined): string {
    return (valor ?? '').trim().toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  equiposTelefonos(): Equipo[] {
    return this.equiposFiltrados().filter((equipo) => this.esTelefono(equipo));
  }

  equiposGenerales(): Equipo[] {
    return this.equiposFiltrados().filter((equipo) => !this.esTelefono(equipo));
  }

  abrirReasignacion(equipo: Equipo): void {
    this.equipoParaReasignar = equipo;

  }

  cerrarReasignacion(): void {
    this.equipoParaReasignar = null;
  }

  finalizarReasignacion(): void {
    const serviceTag = this.equipoParaReasignar?.Service_Tag;
    this.equipoParaReasignar = null;
    this.cargarEquipos();
    if (serviceTag) this.cargarCartasDeEquipo(serviceTag);
  }

  abrirSelectorExcel(input: HTMLInputElement): void {
    if (this.cargandoExcel) return;
    const inputConPicker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof inputConPicker.showPicker === 'function') {
      inputConPicker.showPicker();
      return;
    }
    input.click();
  }

 archivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];

    if (!archivo) return;

    this.cargandoExcel = true;
    this.mensaje = '';
    this.error = '';
    this.changeDetectorRef.markForCheck();

    this.equiposService.CargarExcel(archivo).subscribe({
      next: (respuesta: any) => {
        this.tipoMensaje = 'success';
        this.mensaje = respuesta.message ?? respuesta.mensaje ?? 'Equipos procesados correctamente';
        this.cargandoExcel = false;
        input.value = '';
        this.cargarEquipos(1);
        this.cargarUltimoServiceTag();
        this.changeDetectorRef.markForCheck();
      },
      error: (err: any) => {
        this.error = err.error?.error ?? 'No se pudo procesar el archivo Excel';
        this.cargandoExcel = false;
        input.value = '';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

   descargarPlantilla(): void {
     if (this.descargandoPlantilla) return;

     this.descargandoPlantilla = true;
     this.error = '';
     this.equiposService.descargarPlantillaExcel().subscribe({
       next: (archivo) => {
         const url = window.URL.createObjectURL(archivo);
         const link = document.createElement('a');
         link.href = url;
         link.download = 'plantilla_equipos.xlsx';
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
         this.descargandoPlantilla = false;
         this.tipoMensaje = 'success';
         this.mensaje = 'Plantilla de equipos descargada correctamente';
         this.error = '';
         this.changeDetectorRef.markForCheck();
       },
       error: () => {
         this.error = 'No se pudo descargar la plantilla de equipos';
         this.descargandoPlantilla = false;
         this.changeDetectorRef.markForCheck();
       }
     });
   }
  //tipos = computed(() => ['Todos', ...Array.from(new Set(this.equipos.map(e => e.tipo))).sort()]);
  elUltimoServiceTag(): string | null {
    return this.ultimoServiceTag;
  }
equiposFiltradosPorCartas(): Equipo[] {
    return this.equiposFiltrados().filter((equipo) => Boolean(equipo.Trace?.trim()));
  }
}
