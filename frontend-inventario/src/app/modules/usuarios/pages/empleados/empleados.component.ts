import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { aspectsEdit } from '@ng-icons/ux-aspects';
import { remixImageUploadLine } from '@ng-icons/remixicon';
import { fluentPeopleEditFilled  } from '@ng-icons/fluent-ui/filled';
import { fluentPersonEdit } from '@ng-icons/fluent-ui';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { phosphorArrowsLeftRightBold } from '@ng-icons/phosphor-icons/bold';
import { EmpleadosService } from '../../../../services/empleados.service';
import { DepartamentosService } from '../../../../services/departamentos.service';
import { Departamento } from '../../../../models/departamento.model';
import { Empleado, EquipoAsignado } from '../../../../models/empleados.model';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import type { AlertType } from '../../../../shared/components/alert/alert.component';
import { ReasignarEquipoComponent } from '../reasignar-equipo/reasignar-equipo.component';
import { CartaResponsivaService } from '../../../../services/cartas.service';
import { CartaEstado, CartaResponsiva, EquipoCompartidoCarta, PersonaCarta } from '../../../../models/cartas.model';
import { CartaGeneracionComponent } from '../cartas/carta-generacion.component';
import { matPersonAddAlt1Round } from '@ng-icons/material-icons/round';
import { phosphorMicrosoftExcelLogoLight } from '@ng-icons/phosphor-icons/light';
@Component({
  selector: 'app-empleados',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, AlertComponent, ReasignarEquipoComponent, NgIconComponent, CartaGeneracionComponent],
  viewProviders: [provideIcons({ remixImageUploadLine, aspectsEdit, phosphorArrowsLeftRightBold, fluentPeopleEditFilled, fluentPersonEdit, matPersonAddAlt1Round, phosphorMicrosoftExcelLogoLight })],
  templateUrl: './empleados.component.html',
  styleUrl: './empleados.component.css'
})
export class EmpleadosComponent implements OnInit {
  departamentos: Departamento[] = [];
  empleados: Empleado[] = [];
  busquedaControl = new FormControl('');
  mensaje = '';
  tipoMensaje: AlertType = 'success';
  error = '';
  mostrarFormulario = false;
  busquedaEmpleadosControl = new FormControl('')
  cargandoExcel = false;
  vistaEmpleados: 'todos' | 'activos' | 'inactivos' = 'todos';
  empleadoSeleccionado: Empleado | null = null;
  editandoEmpleado = false;
  guardandoEdicionEmpleado = false;
  edicionEmpleadoForm: FormGroup;
  fotosNoDisponibles = new Set<number>();
  equipoParaReasignar: any = null;
  equiposParaReasignar: any[] = [];
  empleadoForm!: FormGroup;

  mostrarModalCarta = false;
  tipoCartaModal: 'INDIVIDUAL' | 'COMPARTIDA' | null = null;
  equipoInicialCarta: EquipoAsignado | null = null;
  estadoCartaPorEquipo = new Map<string, CartaEstado>();
  cartasResponsivas: CartaResponsiva[] = [];
  cargandoEstadosCartas = true;
  errorCargaEstadosCartas = false;

  constructor(
    private formBuilder: FormBuilder,
    private empleadosService: EmpleadosService,
    private departamentosService: DepartamentosService,
    private changeDetectorRef: ChangeDetectorRef,
    private router: Router,
    private readonly cartasService: CartaResponsivaService
  ) {
    this.empleadoForm = this.formBuilder.group({
      payroll: ['', Validators.required],
      full_name: ['', Validators.required],
      foto: [null],
      departament: ['', Validators.required],
      area: [''],
      position: [''],
      ounit: [''],
      manager: [''],    
      Estado: [true],
      cc: ['',Validators.required],
      correo: ['', Validators.email]
    });
    this.edicionEmpleadoForm = this.formBuilder.group({
      Estado: [true],
      Correo: ['', Validators.email]
    });
  }

  alternarFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.empleadoForm.reset({ Estado: true });
      this.limpiarVistaPreviaFoto();
    }
    this.changeDetectorRef.markForCheck();
  }

ngOnInit(): void {
  this.cargarDepartamentos();
  this.cargarEmpleados();
  this.cargarEstadosCartas();

  this.empleadoForm.get('departament')?.valueChanges.subscribe(
    (nombreDepartamento) => {
      const departamentoSeleccionado = this.departamentos.find(
        (departamento) =>
          departamento.Nombre_Departamento === nombreDepartamento
      );

      this.empleadoForm.patchValue({
        manager: departamentoSeleccionado?.Manager_Asignado ?? ''
      });
    }

  );
}

  get busqueda(): string {
    return this.busquedaControl.value ?? '';
  }
    cargarDepartamentos(): void {
    this.departamentosService.obtenerTodos().subscribe({
        next: (respuesta) => {
        this.departamentos = respuesta.data ?? [];
        this.changeDetectorRef.markForCheck();
        },
        error: () => {
        this.error = 'No se pudieron cargar los departamentos';
        this.changeDetectorRef.markForCheck();
        }
    });
    }

  private sincronizarEmpleadoSeleccionado(): void {
    if (!this.empleadoSeleccionado) {
      return;
    }

    const actualizado = this.empleados.find(
      (empleado) => empleado.Payroll === this.empleadoSeleccionado?.Payroll
    );

    if (actualizado) {
      this.empleadoSeleccionado = actualizado;
    }
    this.changeDetectorRef.markForCheck();
  }

  private actualizarCartaEnListado(carta: CartaResponsiva): void {
    this.cartasResponsivas = [
      carta,
      ...this.cartasResponsivas.filter((existente) => existente.id !== carta.id)
    ];
  }

  cargarEmpleados(): void {
    this.empleadosService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.empleados = respuesta.data ?? [];
        this.sincronizarEmpleadoSeleccionado();
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron cargar los empleados';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  private cargarEstadosCartas(): void {
    this.cartasService.resumenEquipos().subscribe({
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

  cambiarVista(vista: 'todos' | 'activos' | 'inactivos'): void {
    this.vistaEmpleados = vista;
  }

  cantidadActivos(): number {
    return this.empleados.filter((empleado) => empleado.Estado).length;
  }

  cantidadInactivos(): number {
    return this.empleados.filter((empleado) => !empleado.Estado).length;
  }
  
  empleadosFiltrados(): Empleado[] {
    const termino = this.busqueda.trim().toLowerCase();

    return this.empleados.filter((empleado: Empleado) =>
      (this.vistaEmpleados === 'todos' ||
        (this.vistaEmpleados === 'activos' && empleado.Estado) ||
        (this.vistaEmpleados === 'inactivos' && !empleado.Estado)) &&
      [
        empleado.Full_Name,
        empleado.Payroll,
        empleado.Area,
        empleado.Departament,
        empleado.CC,
        empleado.Correo
      

      ].some((valor) => String(valor ?? '').toLowerCase().includes(termino))
    );
  }

  seleccionarEmpleado(empleado: Empleado): void {
    this.empleadoSeleccionado = empleado;
    this.editandoEmpleado = false;
  }

  cerrarPerfil(): void {
    this.empleadoSeleccionado = null;
    this.editandoEmpleado = false;
  }

  editarEmpleado(empleado: Empleado): void {
    void this.router.navigate(['/empleados', empleado.Payroll]);
  }

  iniciarEdicionEmpleado(): void {
    const empleado = this.empleadoSeleccionado;
    if (!empleado) return;
    this.edicionEmpleadoForm.reset({
      Estado: empleado.Estado,
      Correo: empleado.Correo ?? ''
    });
    this.error = '';
    this.mensaje = '';
    this.editandoEmpleado = true;
    this.changeDetectorRef.markForCheck();
  }

  cancelarEdicionEmpleado(): void {
    if (this.empleadoSeleccionado) {
      this.edicionEmpleadoForm.reset({
        Estado: this.empleadoSeleccionado.Estado,
        Correo: this.empleadoSeleccionado.Correo ?? ''
      });
    }
    this.editandoEmpleado = false;
    this.error = '';
    this.changeDetectorRef.markForCheck();
  }

  guardarEdicionEmpleado(): void {
    const empleado = this.empleadoSeleccionado;
    if (!empleado || this.guardandoEdicionEmpleado) return;
    if (this.edicionEmpleadoForm.invalid) {
      this.edicionEmpleadoForm.markAllAsTouched();
      this.error = 'El correo electrónico no es válido';
      this.changeDetectorRef.markForCheck();
      return;
    }

    const valores = this.edicionEmpleadoForm.getRawValue() as Pick<Empleado, 'Estado' | 'Correo'>;
    const correo = (valores.Correo ?? '').trim();
    const datos: Partial<Empleado> = {
      Estado: valores.Estado,
      Correo: correo
    };
    this.guardandoEdicionEmpleado = true;
    this.error = '';
    this.empleadosService.actualizar(empleado.Payroll, datos).subscribe({
      next: (respuesta) => {
        const empleadoActualizado: Empleado = {
          ...empleado,
          Estado: valores.Estado,
          Correo: correo || undefined,
          ...respuesta.data
        };
        this.empleadoSeleccionado = empleadoActualizado;
        this.empleados = this.empleados.map((existente) =>
          existente.Payroll === empleadoActualizado.Payroll ? empleadoActualizado : existente
        );
        this.editandoEmpleado = false;
        this.guardandoEdicionEmpleado = false;
        this.tipoMensaje = empleadoActualizado.Estado ? 'success' : 'error';
        this.mensaje = empleadoActualizado.Estado
          ? 'Empleado actualizado correctamente'
          : 'Empleado actualizado y marcado como inactivo.';
        this.changeDetectorRef.detectChanges();
      },
      error: (respuesta) => {
        this.guardandoEdicionEmpleado = false;
        this.error = respuesta.error?.error ?? 'No se pudo actualizar el empleado';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  abrirReasignacionGeneral(): void {
    if (!this.empleadoSeleccionado) {
      return;
    }
    this.equipoParaReasignar = null;
    this.equiposParaReasignar = (this.empleadoSeleccionado.Equipos ?? [])
      .filter((equipo) => Boolean(equipo.Service_Tag))
      .map((equipo) => ({
        ...equipo,
        Payroll: this.empleadoSeleccionado?.Payroll ?? null,
        Empleado: {
          Payroll: this.empleadoSeleccionado?.Payroll ?? 0,
          Full_Name: this.empleadoSeleccionado?.Full_Name ?? 'Sin asignar'
        }
      }));
  }

  cerrarReasignacion(): void {
    this.equipoParaReasignar = null;
    this.equiposParaReasignar = [];
  }

  finalizarReasignacion(): void {
    this.cerrarReasignacion();
    this.tipoMensaje = 'info';
    this.mensaje = 'Equipo reasignado correctamente';
    this.error = '';
    this.cargarEmpleados();
    this.cargarEstadosCartas();
  }

  abrirEquipo(serviceTag: string): void {
    void this.router.navigate(['/equipos', serviceTag]);
  }

  iniciales(empleado: Empleado): string {
    return empleado.Full_Name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((nombre) => nombre[0])
      .join('')
      .toUpperCase();
  }

  equiposDelEmpleado(empleado: Empleado): NonNullable<Empleado['Equipos']> {
    return empleado.Equipos ?? [];
  }

  equiposDisponiblesCarta(empleado: Empleado): EquipoAsignado[] {
    if (this.cargandoEstadosCartas || this.errorCargaEstadosCartas) {
      return [];
    }
    return this.equiposDelEmpleado(empleado).filter((equipo) =>
      !this.tieneCartaValida(equipo.Service_Tag)
    );
  }

  private esEquipoTelefono(equipo: EquipoAsignado): boolean {
    const tipo = (equipo.Tipo_Equipo ?? '').toLocaleLowerCase();
    return tipo.includes('teléfono') || tipo.includes('telefono') || tipo.includes('iphone');
  }

  lineasDelEmpleado(empleado: Empleado): NonNullable<Empleado['Equipos']> {
    return this.equiposDelEmpleado(empleado)
      .filter((equipo) => Boolean(equipo.Numero_Telefono));
  }

  abrirCarta(tipo: 'INDIVIDUAL' | 'COMPARTIDA', equipo?: EquipoAsignado): void {
    if (!this.empleadoSeleccionado) {
      return;
    }

    this.tipoCartaModal = tipo;
    const equipoDisponible = equipo && this.equiposDisponiblesCarta(this.empleadoSeleccionado).some(
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

  fotoSeleccionada: string | null = null;
  private fotoArchivoSeleccionado: File | null = null;

  private limpiarVistaPreviaFoto(): void {
    if (this.fotoSeleccionada?.startsWith('blob:')) {
      URL.revokeObjectURL(this.fotoSeleccionada);
    }
    this.fotoSeleccionada = null;
    this.fotoArchivoSeleccionado = null;
  }

  seleccionarFoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.limpiarVistaPreviaFoto();
      return;
    }

    if (this.fotoSeleccionada?.startsWith('blob:')) {
      URL.revokeObjectURL(this.fotoSeleccionada);
    }

    this.fotoArchivoSeleccionado = file;
    this.fotoSeleccionada = URL.createObjectURL(file);
  }
  obtenerUrlFoto(fotoUrl?: string): string {
    if (!fotoUrl) {
      return '';
    }

    const rutaFoto = fotoUrl.indexOf('/api/empleados/fotos/');
    return rutaFoto >= 0 ? fotoUrl.slice(rutaFoto) : fotoUrl;
  }

  marcarFotoNoDisponible(payroll: number): void {
    this.fotosNoDisponibles.add(payroll);
  }

  guardarEmpleado(): void {
    if (this.empleadoForm.invalid) {
      this.empleadoForm.markAllAsTouched();
      this.error = this.empleadoForm.get('correo')?.hasError('email')
        ? 'El correo electrónico no es válido'
        : 'Completa los campos obligatorios, incluido Payroll';
      this.mensaje = '';
      this.changeDetectorRef.markForCheck();
      return;
    }

    const datos = new FormData();
    const valores = this.empleadoForm.getRawValue();

    Object.entries(valores).forEach(([campo, valor]) => {
      if (campo !== 'foto' && valor !== null && valor !== undefined) {
        datos.append(campo, String(valor));
      }
    });

    if (this.fotoArchivoSeleccionado) {
      datos.append('foto', this.fotoArchivoSeleccionado);
    }

    this.empleadosService.crear(datos).subscribe({
      next: (respuesta) => {
        this.tipoMensaje = 'success';
        this.mensaje = 'Empleado creado correctamente';
        this.error = '';
        if (respuesta.data) {
          this.empleados = [...this.empleados, respuesta.data];
        }
        this.empleadoForm.reset({
          payroll: '',
          full_name: '',
          foto: null,
          departament: '',
          area: '',
          position: '',
          ounit: '',
          manager: '',
          Estado: true,
          cc: '',
          correo: ''
        });
        this.limpiarVistaPreviaFoto();
        this.mostrarFormulario = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudo crear el empleado';
        this.mensaje = '';
        this.changeDetectorRef.markForCheck();
      }
    });
  }


  archivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];

    if (!archivo) return;

    this.cargandoExcel = true;
    this.mensaje = '';
    this.error = '';
    this.changeDetectorRef.markForCheck();

    this.empleadosService.CargarExcel(archivo).subscribe({
      next: (respuesta: any) => {
        this.tipoMensaje = 'success';
        this.mensaje = respuesta.mensaje ?? 'Empleados procesados correctamente';
        this.cargandoExcel = false;
        input.value = '';
        this.cargarEmpleados();
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
    const url = 'assets/plantilla_empleados.xlsx';
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_empleados.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.tipoMensaje = 'success';
    this.mensaje = 'Plantilla de empleados descargada correctamente';
    this.error = '';
    this.changeDetectorRef.markForCheck();
  }

  mensajealerta(mensaje: string, tipo: 'exito' | 'error'): void {
    if (tipo === 'exito') {
      this.tipoMensaje = 'success';
    }
    this.mensaje = tipo === 'exito' ? mensaje : '';
    this.error = tipo === 'error' ? mensaje : '';
    this.changeDetectorRef.markForCheck();
  }

  CargarEmpleadosExcel(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    input.addEventListener('change', (event) => this.archivoSeleccionado(event));
    input.click();
  }
  ContarEquiposAsignados(empleado: Empleado): number {
    const serviceTagsAsignados = new Set(
      (empleado.Equipos ?? []).map((equipo) => this.normalizarServiceTag(equipo.Service_Tag))
    );
    const serviceTagsCompartidos = this.equiposCompartidosDeEmpleado(empleado)
      .map((equipo) => this.normalizarServiceTag(equipo.service_tag));
    return new Set([...serviceTagsAsignados, ...serviceTagsCompartidos]).size;
  }

  equiposCompartidosDeEmpleado(empleado: Empleado): EquipoCompartidoCarta[] {
    return this.cartasService.equiposCompartidosDeEmpleado(this.cartasResponsivas, empleado.Payroll);
  }

  personasCompartidasDeEquipo(serviceTag: string): PersonaCarta[] {
    return this.cartasService.personasCompartidasDeEquipo(this.cartasResponsivas, serviceTag);
  }

  nombresCompartidosDeEquipo(serviceTag: string): string {
    return this.personasCompartidasDeEquipo(serviceTag)
      .map((persona) => persona.nombre?.trim() || `Payroll ${persona.payroll}`)
      .join(', ');
  }

  abrirEquipoCompartido(serviceTag: string): void {
    void this.router.navigate(['/equipos', serviceTag], { queryParams: { compartido: 'true' } });
  }

}
