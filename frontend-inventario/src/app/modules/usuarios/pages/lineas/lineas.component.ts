import { CommonModule, Location } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EquipoTelefono, Linea, LineaPayload } from '../../../../models/linea.model';
import { MovimientoEquipo } from '../../../../models/equipos.model';
import { Empleado } from '../../../../models/empleados.model';
import { LineasService, ResultadoCargaLineas } from '../../../../services/lineas.service';
import { ReportesService } from '../../../../services/reportes.service';
import { EquiposService } from '../../../../services/equipos.service';
import { EmpleadosService } from '../../../../services/empleados.service';
import { finalize, timeout } from 'rxjs'
import { NgIconComponent, provideIcons } from '@ng-icons/core';

import { phosphorPhoneCallBold } from '@ng-icons/phosphor-icons/bold';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import type { AlertType } from '../../../../shared/components/alert/alert.component';
import { DialogService } from '../../../../shared/services/dialog.service';

@Component({
  selector: 'app-lineas',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AlertComponent, NgIconComponent],
  viewProviders: [provideIcons({ phosphorPhoneCallBold })],
  templateUrl: './lineas.component.html',
  styleUrl: './lineas.component.css'
})
export class LineasComponent implements OnInit {
  readonly avisoEquipoFueraInventario = 'El equipo ya no está en el inventario. Realiza un cambio de línea del equipo para reasignar.';
  lineas: Linea[] = [];
  busquedaControl = new FormControl('');
  estadoFiltro: 'Todas' | 'Activa' | 'Suspendida' | 'Sin equipo' = 'Todas';
  mostrarFormulario = false;
  editando: Linea | null = null;
  cargando = false;
  guardando = false;
  cargandoExcel = false;
  resultadoImportacion: ResultadoCargaLineas | null = null;
  generandoReporte = false;
  error = '';
  mensaje = '';
  tipoMensaje: AlertType = 'success';
  busquedaServiceTag = '';
  equiposTelefonoCatalogo: EquipoTelefono[] = [];
  equiposTelefono: EquipoTelefono[] = [];
  buscandoEquipos = false;
  errorBusquedaEquipos = '';
  mostrarCambio = false;
  terminoOrigen = '';
  lineasOrigen: Linea[] = [];
  lineaOrigen: Linea | null = null;
  errorBusquedaOrigen = '';
  terminoDestino = '';
  equiposDestino: EquipoTelefono[] = [];
  equipoDestino: EquipoTelefono | null = null;
  lineaSeleccionada: Linea | null = null;
  pestanaLinea: 'detalle' | 'trace' = 'detalle';
  editandoEnSlide = false;
  historialLinea: MovimientoEquipo[] = [];
  cargandoTrace = false;
  mostrarAsignacion = false;
  empleados: Empleado[] = [];
  busquedaEmpleado = '';
  empleadoSeleccionado: number | null = null;
  asignando = false;
  buscandoCambio = false;

  lineaForm;

  constructor(
    private formBuilder: FormBuilder,
    private lineasService: LineasService,
    private reportesService: ReportesService,
    private equiposService: EquiposService,
    private empleadosService: EmpleadosService,
    private changeDetectorRef: ChangeDetectorRef,
    private readonly dialogs: DialogService,
    private location: Location,
    private router: Router
  ) {
    this.lineaForm = this.formBuilder.nonNullable.group({
      Service_Tag: ['', [Validators.required, Validators.maxLength(50)]],
      Numero_Telefono: ['', [Validators.required, Validators.maxLength(20)]],
      Account: ['', [Validators.required, Validators.maxLength(100)]],
      Total_cuenta: [null as number | null, [
        Validators.required,
        Validators.min(0),
        Validators.max(9999999999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/)
      ]],
      Estado: ['Activa' as 'Activa' | 'Suspendida', Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarLineas();
    this.cargarEquiposTelefono();
  }

  get busqueda(): string {
    return this.busquedaControl.value ?? '';
  }

  regresar(): void {
    this.location.back();
  }

  private sincronizarLineaSeleccionada(): void {
    if (!this.lineaSeleccionada) {
      return;
    }

    const lineaActual = this.lineas.find((linea) => linea.Service_Tag === this.lineaSeleccionada?.Service_Tag);
    if (!lineaActual) {
      return;
    }

    this.lineaSeleccionada = { ...lineaActual };
    if (this.editandoEnSlide) {
      this.lineaForm.reset({
        Service_Tag: this.lineaSeleccionada.Service_Tag,
        Numero_Telefono: this.lineaSeleccionada.Numero_Telefono ?? '',
        Account: this.lineaSeleccionada.Account ?? '',
        Total_cuenta: this.lineaSeleccionada.Total_cuenta,
        Estado: this.lineaSeleccionada.Estado_Linea
      });
    }
  }

  cargarLineas(): void {
    this.cargando = true;
    this.error = '';
    this.lineasService.obtenerTodas().subscribe({
      next: (respuesta) => {
        this.lineas = respuesta.data ?? [];
        this.sincronizarLineaSeleccionada();
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudieron cargar las líneas telefónicas';
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  lineasFiltradas(): Linea[] {
    const texto = this.busqueda.trim().toLowerCase();
    return this.lineas.filter((linea) => {
      const coincideBusqueda = !texto || [
        linea.Service_Tag,
        linea.Numero_Telefono,
        linea.Account,
        linea.Estado,
        linea.Usuario,
        linea.Payroll,
        linea.CC
      ].some((valor) => String(valor ?? '').toLowerCase().includes(texto));

      return coincideBusqueda &&
        (this.estadoFiltro === 'Todas' || linea.Estado === this.estadoFiltro);
    });
  }

  abrirCrear(): void {
    this.editando = null;
    this.busquedaServiceTag = '';
    this.equiposTelefono = [];
    this.lineaForm.reset({
      Service_Tag: '',
      Numero_Telefono: '',
      Account: '',
      Total_cuenta: null,
      Estado: 'Activa'
    });
    this.buscarEquiposTelefono();
    this.mostrarFormulario = true;
    this.error = '';
  }

  abrirEditar(linea: Linea): void {
    this.editando = linea;
    this.lineaSeleccionada = linea;
    this.editandoEnSlide = false;
    this.pestanaLinea = 'detalle';
    this.busquedaServiceTag = linea.Equipo_En_Inventario ? linea.Service_Tag : '';
    this.equiposTelefono = [];
    this.lineaForm.reset({
      Service_Tag: linea.Equipo_En_Inventario ? linea.Service_Tag : '',
      Numero_Telefono: linea.Numero_Telefono ?? '',
      Account: linea.Account ?? '',
      Total_cuenta: linea.Total_cuenta,
      Estado: linea.Estado_Linea === 'Suspendida' ? 'Suspendida' : 'Activa'
    });
    this.buscarEquiposTelefono();
    this.mostrarFormulario = true;
    this.error = '';
    this.changeDetectorRef.markForCheck();
  }

  abrirLinea(linea: Linea): void {
    this.lineaSeleccionada = linea;
    this.pestanaLinea = 'detalle';
    this.editandoEnSlide = false;
    this.historialLinea = [];
    this.cargandoTrace = true;
    this.equiposService.getHistorial(linea.Service_Tag).subscribe({
      next: (respuesta) => {
        this.historialLinea = respuesta.data ?? [];
        this.cargandoTrace = false;
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.historialLinea = [];
        this.cargandoTrace = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  cerrarLinea(): void {
    this.lineaSeleccionada = null;
    this.editandoEnSlide = false;
    this.mostrarAsignacion = false;
  }

  abrirEmpleadoDesdeLinea(linea: Linea): void {
    if (linea.Payroll !== null && linea.Payroll !== undefined) {
      void this.router.navigate(['/empleados', linea.Payroll]);
    }
  }

  abrirAsignacion(): void {
    if (!this.lineaSeleccionada) return;
    if (!this.lineaSeleccionada.Equipo_En_Inventario) {
      this.error = this.avisoEquipoFueraInventario;
      return;
    }

    this.busquedaEmpleado = '';
    this.empleadoSeleccionado = null;
    this.mostrarAsignacion = true;
    this.empleadosService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.empleados = (respuesta.data ?? []).filter(
          (empleado) => empleado.Estado && empleado.CC !== null &&
            empleado.CC !== undefined && empleado.Payroll !== this.lineaSeleccionada?.Payroll
        );
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudieron cargar los empleados';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  cerrarAsignacion(): void {
    this.mostrarAsignacion = false;
    this.empleadoSeleccionado = null;
  }

  empleadosParaAsignar(): Empleado[] {
    const termino = this.busquedaEmpleado.trim().toLowerCase();
    const empleadosDisponibles = this.empleados.filter(
      (empleado) => empleado.Payroll !== this.lineaSeleccionada?.Payroll
    );

    if (!termino) return empleadosDisponibles;
    return empleadosDisponibles.filter((empleado) => [
      empleado.Payroll,
      empleado.Full_Name,
      empleado.Departament,
      empleado.Area,
      empleado.CC
    ].some((valor) => String(valor ?? '').toLowerCase().includes(termino)));
  }

  seleccionarEmpleado(payroll: number): void {
    this.empleadoSeleccionado = payroll;
  }

  asignarLinea(): void {
    if (!this.lineaSeleccionada || this.empleadoSeleccionado === null) return;
    if (!this.lineaSeleccionada.Equipo_En_Inventario) {
      this.error = this.avisoEquipoFueraInventario;
      this.cerrarAsignacion();
      return;
    }
    if (this.empleadoSeleccionado === this.lineaSeleccionada.Payroll) {
      this.error = 'La línea ya está asignada a ese empleado';
      return;
    }
    this.asignando = true;
    this.equiposService.reasignarEquipo(this.lineaSeleccionada.Service_Tag, this.empleadoSeleccionado).pipe(
      timeout(15000),
      finalize(() => {
        this.asignando = false;
        this.changeDetectorRef.markForCheck();
      })
    ).subscribe({
      next: () => {
        const payroll = this.empleadoSeleccionado!;
        const empleado = this.empleados.find((actual) => actual.Payroll === payroll);
        this.lineas = this.lineas.map((linea) => linea.Service_Tag === this.lineaSeleccionada?.Service_Tag
          ? { ...linea, Payroll: payroll, Usuario: empleado?.Full_Name ?? null }
          : linea
        );
        this.sincronizarLineaSeleccionada();
        this.mensaje = 'Línea asignada correctamente';
        this.tipoMensaje = 'info';
        this.error = '';
        this.cerrarAsignacion();
        this.cargarLineas();
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta.name === 'TimeoutError'
          ? 'La asignación tardó demasiado. Actualiza las líneas para confirmar el resultado.'
          : respuesta.error?.error ?? 'No se pudo asignar la línea';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  cancelarEdicionEnSlide(): void {
    this.editandoEnSlide = false;
    this.editando = null;
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.editando = null;
    this.lineaForm.reset({
      Service_Tag: '',
      Numero_Telefono: '',
      Account: '',
      Total_cuenta: null,
      Estado: 'Activa'
    });
    this.busquedaServiceTag = '';
    this.equiposTelefono = [];
    this.errorBusquedaEquipos = '';
  }

  actualizarBusquedaEquiposTelefono(): void {
    this.errorBusquedaEquipos = '';
    if (this.lineaForm.controls.Service_Tag.value !== this.busquedaServiceTag.trim()) {
      this.lineaForm.controls.Service_Tag.setValue('');
    }
    this.buscarEquiposTelefono();
  }

  cargarEquiposTelefono(): void {
    this.buscandoEquipos = true;
    this.lineasService.obtenerEquiposTelefonoDisponibles().pipe(
      finalize(() => {
        this.buscandoEquipos = false;
        this.buscarEquiposTelefono();
        this.buscarDestino();
        this.changeDetectorRef.markForCheck();
      })
    ).subscribe({
      next: (respuesta) => {
        this.equiposTelefonoCatalogo = respuesta.data ?? [];
        this.buscarEquiposTelefono();
      },
      error: (respuesta) => {
        this.errorBusquedaEquipos = respuesta.error?.error ?? 'No se pudieron cargar los equipos telefónicos.';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  buscarEquiposTelefono(): void {
    const termino = this.busquedaServiceTag.trim();
    const reasignandoLineaSinEquipo = !!this.editando && !this.editando.Equipo_En_Inventario;
    if (termino.length < 2) {
      this.equiposTelefono = [];
      return;
    }

    this.equiposTelefono = this.equiposTelefonoCatalogo.filter((equipo) => {
      const coincideBusqueda = [
        equipo.Service_Tag,
        equipo.Marca,
        equipo.Modelo,
        equipo.Tipo_Equipo,
        equipo.Usuario,
        equipo.Payroll,
        equipo.CC
      ].some((valor) => String(valor ?? '').toLowerCase().includes(termino.toLowerCase()));
      const disponibleParaEdicion = !reasignandoLineaSinEquipo || !equipo.Tiene_Datos_Linea;
      return coincideBusqueda && disponibleParaEdicion;
    }).slice(0, 20);
  }

  seleccionarEquipoTelefono(equipo: EquipoTelefono): void {
    if (!equipo.Puede_Registrar_Linea) return;
    this.busquedaServiceTag = equipo.Service_Tag;
    this.lineaForm.controls.Service_Tag.setValue(equipo.Service_Tag);
    this.equiposTelefono = [];
  }

  guardar(): void {
    if (this.lineaForm.invalid) {
      this.lineaForm.markAllAsTouched();
      this.error = 'Completa los campos obligatorios para guardar la línea.';
      this.mensaje = '';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.guardando = true;
    this.error = '';
    const valores = this.lineaForm.getRawValue();
    const payload: LineaPayload = {
      Numero_Telefono: valores.Numero_Telefono.trim(),
      Account: valores.Account.trim(),
      Total_cuenta: valores.Total_cuenta
    };
    if (this.editando) {
      payload.Estado = valores.Estado;
      if (!this.editando.Equipo_En_Inventario) {
        payload.Service_Tag = valores.Service_Tag.trim();
      }
    }

    const peticion = this.editando
      ? this.lineasService.actualizar(this.editando.Service_Tag, {
          ...payload,
          Service_Tag: !this.editando.Equipo_En_Inventario
            ? valores.Service_Tag.trim()
            : undefined
        })
      : this.lineasService.crear({ ...payload, Service_Tag: valores.Service_Tag.trim() });

    peticion.subscribe({
      next: (respuesta) => {
        const estabaEditando = this.editando !== null;
        const serviceTagAnterior = this.editando?.Service_Tag;
        this.tipoMensaje = estabaEditando ? 'warning' : 'success';
        this.mensaje = estabaEditando ? 'Línea actualizada correctamente' : 'Línea registrada correctamente';
        this.guardando = false;
        if (respuesta.data) {
          this.lineas = estabaEditando
            ? [
                ...this.lineas.filter((linea) => linea.Service_Tag !== serviceTagAnterior),
                respuesta.data
              ]
            : [...this.lineas, respuesta.data];
          if (estabaEditando && this.lineaSeleccionada?.Service_Tag === serviceTagAnterior) {
            this.lineaSeleccionada = respuesta.data;
            this.historialLinea = [];
          }
        } else {
          this.cargarLineas();
        }
        this.cargarEquiposTelefono();
        if (this.editandoEnSlide) {
          this.lineaSeleccionada = respuesta.data ?? this.lineaSeleccionada;
          this.editandoEnSlide = false;
          this.editando = null;
        } else {
          this.cerrarFormulario();
        }
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudo guardar la línea';
        this.guardando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  async eliminar(linea: Linea): Promise<void> {
    const confirmado = await this.dialogs.confirm(
      `¿Eliminar la línea asociada al equipo ${linea.Service_Tag}?`,
      'Eliminar línea',
      'error'
    );
    if (!confirmado) return;

    this.error = '';
    this.lineasService.eliminar(linea.Service_Tag).subscribe({
      next: () => {
        this.lineas = this.lineas.filter((actual) => actual.Service_Tag !== linea.Service_Tag);
        this.tipoMensaje = 'warning';
        this.mensaje = 'Línea eliminada correctamente';
        this.cargarEquiposTelefono();
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudo eliminar la línea';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  descargarExcel(): void {
    this.limpiarAvisos();
    this.lineasService.exportar().subscribe({
      next: (archivo) => {
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'lineas_telefonicas.xlsx';
        enlace.click();
        URL.revokeObjectURL(url);
        this.tipoMensaje = 'success';
        this.mensaje = 'Archivo Excel descargado correctamente';
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = 'No se pudo exportar el archivo de líneas';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  abrirSelectorExcel(): void {
    if (this.cargandoExcel) return;
    this.resultadoImportacion = null;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.addEventListener('change', (event) => this.cargarExcel(event), { once: true });
    input.click();
  }

  cargarExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;

    this.cargandoExcel = true;
    this.limpiarAvisos();
    this.lineasService.cargarDesdeExcel(archivo).pipe(
      finalize(() => {
        this.cargandoExcel = false;
        this.changeDetectorRef.markForCheck();
      })
    ).subscribe({
      next: (respuesta) => {
        this.cargarLineas();
        this.cargarEquiposTelefono();
        this.mensaje = respuesta.message ?? 'Se procesó el archivo de líneas.';
        this.tipoMensaje = 'success';
        if (respuesta.no_encontradas.length > 0 || respuesta.errores.length > 0) {
          this.resultadoImportacion = respuesta;
        }
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudo procesar el archivo Excel';
      }
    });
  }

  cerrarResultadoImportacion(): void {
    this.resultadoImportacion = null;
  }

  private manejarErrorReporte(error: any, mensajeFallback: string): void {
    if (error?.error && typeof error.error === 'string') {
      this.error = error.error;
      return;
    }

    if (error?.error instanceof Blob) {
      error.error.text().then((texto: string) => {
        try {
          const parsed = JSON.parse(texto);
          this.error = parsed?.error ?? mensajeFallback;
        } catch {
          this.error = mensajeFallback;
        }
        this.changeDetectorRef.markForCheck();
      }).catch(() => {
        this.error = mensajeFallback;
        this.changeDetectorRef.markForCheck();
      });
      return;
    }

    this.error = error?.error?.error ?? mensajeFallback;
  }

  descargarReporteLineas(): void {
    this.generandoReporte = true;
    this.limpiarAvisos();
    this.reportesService.descargarReporteLineas().pipe(finalize(() => {
      this.generandoReporte = false;
      this.changeDetectorRef.markForCheck();
    })).subscribe({
      next: (archivo) => {
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'reporte_lineas.pdf';
        enlace.click();
        URL.revokeObjectURL(url);
        this.mensaje = 'Reporte PDF descargado correctamente';
        this.tipoMensaje = 'success';
      },
      error: (error) => {
        this.manejarErrorReporte(error, 'No se pudo generar el reporte PDF de líneas');
      }
    });
  }
  reporteLineasPorCC(): void {
    this.generandoReporte = true;
    this.limpiarAvisos();
    this.reportesService.descargarLineasPorCC().pipe(finalize(() => {
      this.generandoReporte = false;
      this.changeDetectorRef.markForCheck();
    })).subscribe({
      next: (archivo) => {
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'lineas_por_cc.pdf';
        enlace.click();
        URL.revokeObjectURL(url);
        this.mensaje = 'Reporte PDF por CC descargado correctamente';
        this.tipoMensaje = 'success';
      },
      error: (error) => {
        this.manejarErrorReporte(error, 'No se pudo generar el reporte PDF por CC');
      }
    });
  }
  reporteLineasPorCC_HC(): void {
    this.generandoReporte = true;
    this.limpiarAvisos();
    this.reportesService.descargarLineasPorCC_HC().pipe(finalize(() => {
      this.generandoReporte = false;
      this.changeDetectorRef.markForCheck();
    })).subscribe({
      next: (archivo) => {
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'lineas_por_cc_hc.pdf';
        enlace.click();
        URL.revokeObjectURL(url);
        this.mensaje = 'Reporte PDF con cálculo por CC y HC descargado correctamente';
        this.tipoMensaje = 'success';
      },
      error: (error) => {
        this.manejarErrorReporte(error, 'No se pudo generar el reporte PDF por CC y HC');
      }
    });
  }

  limpiarAvisos(): void {
    this.mensaje = '';
    this.error = '';
  }

  abrirCambioLinea(): void {
    this.mostrarCambio = true;
    this.terminoOrigen = '';
    this.lineasOrigen = [];
    this.lineaOrigen = null;
    this.terminoDestino = '';
    this.equiposDestino = [];
    this.equipoDestino = null;
    this.errorBusquedaOrigen = '';
    this.buscarDestino();
    this.buscarCambio();
    this.limpiarAvisos();
    if (!this.buscandoEquipos) {
      this.cargarEquiposTelefono();
    }
  }

  cerrarCambioLinea(): void {
    this.mostrarCambio = false;
    this.lineaOrigen = null;
    this.equipoDestino = null;
  }

  actualizarBusquedaCambio(): void {
    this.lineaOrigen = null;
    this.buscarCambio();
  }

  buscarCambio(): void {
    const termino = this.terminoOrigen.trim().toLowerCase();
    this.errorBusquedaOrigen = '';
    if (termino.length < 2) {
      this.lineasOrigen = [];
      this.buscandoCambio = false;
      return;
    }

    this.lineasOrigen = this.lineas.filter((linea) => !termino || [
      linea.Service_Tag,
      linea.Numero_Telefono,
      linea.Account,
      linea.Estado,
      linea.Usuario,
      linea.Payroll
    ].some((valor) => String(valor ?? '').toLowerCase().includes(termino))).slice(0, 20);
    this.buscandoCambio = false;
    this.changeDetectorRef.markForCheck();
  }

  seleccionarLineaOrigen(linea: Linea): void {
    this.lineaOrigen = linea;
    this.terminoOrigen = `${linea.Service_Tag} · ${linea.Numero_Telefono}`;
    this.lineasOrigen = [];
    this.buscarDestino();
  }

  actualizarBusquedaDestino(): void {
    this.equipoDestino = null;
    this.buscarDestino();
  }

  buscarDestino(): void {
    const termino = this.terminoDestino.trim().toLowerCase();
    if (termino.length < 2) {
      this.equiposDestino = [];
      return;
    }

    this.equiposDestino = this.equiposTelefonoCatalogo.filter((equipo) =>
      [
        equipo.Service_Tag,
        equipo.Marca,
        equipo.Modelo,
        equipo.Tipo_Equipo,
        equipo.Usuario,
        equipo.Payroll,
        equipo.CC
      ].some((valor) => String(valor ?? '').toLowerCase().includes(termino))
    ).slice(0, 20);
  }

  seleccionarEquipoDestino(equipo: EquipoTelefono): void {
    if (
      !equipo.Puede_Registrar_Linea ||
      equipo.Tiene_Datos_Linea ||
      equipo.Service_Tag === this.lineaOrigen?.Service_Tag
    ) {
      return;
    }
    this.equipoDestino = equipo;
    this.terminoDestino = equipo.Service_Tag;
    this.equiposDestino = [];
  }

  cambiarLinea(): void {
    if (!this.lineaOrigen || !this.equipoDestino) {
      this.error = 'Selecciona la línea origen y el equipo destino';
      return;
    }
    if (this.lineaOrigen.Service_Tag === this.equipoDestino.Service_Tag) {
      this.error = 'No puedes transferir la línea al mismo equipo';
      return;
    }
    if (this.equipoDestino.Tiene_Datos_Linea) {
      this.error = 'El equipo destino ya tiene una línea telefónica asociada';
      return;
    }

    this.buscandoCambio = true;
    this.error = '';
    this.lineasService.transferirLinea({
      Service_Tag_Origen: this.lineaOrigen.Service_Tag,
      Service_Tag_Destino: this.equipoDestino.Service_Tag
    }).subscribe({
      next: () => {
        this.mensaje = 'Información telefónica transferida; las asignaciones de los equipos no cambiaron.';
        this.tipoMensaje = 'warning';
        this.buscandoCambio = false;
        this.cerrarCambioLinea();
        this.cargarLineas();
        this.cargarEquiposTelefono();
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudo transferir la línea';
        this.buscandoCambio = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }
  ObtenerTotalLineas():number{
      return this.lineas.length;
  }
   private Esnumerotelefono(numero: string): boolean {
    const regex = /^\d{10}$/;
    return regex.test(numero);
  }
}
