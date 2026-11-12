import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TiposEquipoService } from '../../../../services/tipos_equipo.service';
import { DepartamentosService } from '../../../../services/departamentos.service';
import { ProyectosService } from '../../../../services/proyectos.service';
import { TipoEquipo } from '../../../../models/tipos_equipo.models';
import { Departamento } from '../../../../models/departamento.model';
import { Proyecto } from '../../../../models/proyecto.model';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import type { AlertType } from '../../../../shared/components/alert/alert.component';
import { DialogService } from '../../../../shared/services/dialog.service';

@Component({
  selector: 'app-catalogos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AlertComponent],
  templateUrl: './catalogos.component.html',
  styleUrl: './catalogos.component.css',
})
export class CatalogosComponent implements OnInit {
  tiposEquipo: TipoEquipo[] = [];
  departamentos: Departamento[] = [];
  proyectos: Proyecto[] = [];
  tipoForm!: FormGroup;
  proyectoForm!: FormGroup;
  departamentoForm!: FormGroup;
  editando: { tipo?: TipoEquipo; proyecto?: Proyecto; departamento?: Departamento } = {};
  mensaje = '';
  tipoMensaje: AlertType = 'success';
  error = '';

  constructor(
    private fb: FormBuilder,
    private tipos: TiposEquipoService,
    private deps: DepartamentosService,
    private proys: ProyectosService,
    private readonly dialogs: DialogService,
    private location: Location,
    private cd: ChangeDetectorRef,
  ) {
    this.tipoForm = this.fb.group({ nombre: ['', Validators.required] });
    this.proyectoForm = this.fb.group({ nombre: ['', Validators.required] });
    this.departamentoForm = this.fb.group({ nombre: ['', Validators.required], manager: ['', Validators.required] });
  }

  ngOnInit(): void {
    this.cargar();
  }

  regresar(): void {
    this.location.back();
  }

  cargar(): void {
    this.tipos.obtenerTodos().subscribe((r) => {
      this.tiposEquipo = r.data ?? [];
      this.cd.markForCheck();
    }, () => {
      this.error = 'No se pudieron cargar los tipos de equipo';
      this.cd.markForCheck();
    });
    this.deps.obtenerTodos().subscribe((r) => {
      this.departamentos = r.data ?? [];
      this.cd.markForCheck();
    }, () => {
      this.error = 'No se pudieron cargar los departamentos';
      this.cd.markForCheck();
    });
    this.proys.obtenerTodos().subscribe((r) => {
      this.proyectos = r.data ?? [];
      this.cd.markForCheck();
    }, () => {
      this.error = 'No se pudieron cargar los proyectos';
      this.cd.markForCheck();
    });
  }

  guardarTipo(): void {
    const n = this.tipoForm.value.nombre?.trim();
    if (!n) {
      this.error = 'Escribe el nombre del tipo de equipo.';
      this.mensaje = '';
      return;
    }
    const tipoEditado = this.editando.tipo;
    const op = tipoEditado ? this.tipos.actualizar(tipoEditado.Id, n) : this.tipos.crear(n);
    op.subscribe({
      next: () => {
        this.tipoMensaje = tipoEditado ? 'warning' : 'success';
        this.mensaje = 'Tipo guardado; los equipos existentes conservan su asignación con el nombre actualizado';
        this.error = '';
        this.tipoForm.reset();
        this.editando = {};
        this.cargar();
      },
      error: (error: HttpErrorResponse) => this.manejarError(error, 'No se pudo guardar el tipo de equipo'),
    });
  }

  guardarProyecto(): void {
    const n = this.proyectoForm.value.nombre?.trim();
    if (!n) {
      this.error = 'Escribe el nombre del proyecto.';
      this.mensaje = '';
      return;
    }
    const proyectoEditado = this.editando.proyecto;
    const op = proyectoEditado ? this.proys.actualizar(proyectoEditado.Id, n) : this.proys.crear(n);
    op.subscribe({
      next: () => {
        this.tipoMensaje = proyectoEditado ? 'warning' : 'success';
        this.mensaje = 'Proyecto guardado; los equipos asignados conservan la relación actualizada';
        this.error = '';
        this.proyectoForm.reset();
        this.editando = {};
        this.cargar();
      },
      error: (error: HttpErrorResponse) => this.manejarError(error, 'No se pudo guardar el proyecto'),
    });
  }

  guardarDepartamento(): void {
    const v = this.departamentoForm.getRawValue();
    if (!v.nombre || !v.manager) {
      this.error = 'Completa el nombre del departamento y el manager.';
      this.mensaje = '';
      return;
    }
    const datos = { Nombre_Departamento: v.nombre.trim(), Manager_Asignado: v.manager.trim() };
    const departamentoEditado = this.editando.departamento;
    const op = departamentoEditado ? this.deps.actualizar(departamentoEditado.Id, datos) : this.deps.crear(datos);
    op.subscribe({
      next: () => {
        this.tipoMensaje = departamentoEditado ? 'warning' : 'success';
        this.mensaje = 'Departamento y manager guardados; se actualizaron los empleados relacionados';
        this.error = '';
        this.departamentoForm.reset();
        this.editando = {};
        this.cargar();
      },
      error: (error: HttpErrorResponse) => this.manejarError(error, 'No se pudo guardar el departamento'),
    });
  }

  editarTipo(t: TipoEquipo): void {
    this.editando = { tipo: t };
    this.tipoForm.setValue({ nombre: t.Nombre_Tipo_Equipo });
  }

  editarProyecto(p: Proyecto): void {
    this.editando = { proyecto: p };
    this.proyectoForm.setValue({ nombre: p.Nombre_Proyecto });
  }

  editarDepartamento(d: Departamento): void {
    this.editando = { departamento: d };
    this.departamentoForm.setValue({ nombre: d.Nombre_Departamento, manager: d.Manager_Asignado });
  }

  async eliminarTipo(t: TipoEquipo): Promise<void> {
    if (await this.dialogs.confirm(`¿Eliminar el tipo de equipo ${t.Nombre_Tipo_Equipo}?`, 'Eliminar tipo de equipo', 'error')) {
      this.tipos.eliminar(t.Id).subscribe({
        next: () => this.cargar(),
        error: (error: HttpErrorResponse) => this.manejarError(error, 'No se pudo eliminar el tipo de equipo'),
      });
    }
  }

  async eliminarProyecto(p: Proyecto): Promise<void> {
    if (await this.dialogs.confirm(`¿Eliminar el proyecto ${p.Nombre_Proyecto}?`, 'Eliminar proyecto', 'error')) {
      this.proys.eliminar(p.Id).subscribe({
        next: () => this.cargar(),
        error: (error: HttpErrorResponse) => this.manejarError(error, 'No se pudo eliminar el proyecto'),
      });
    }
  }

  async eliminarDepartamento(d: Departamento): Promise<void> {
    if (await this.dialogs.confirm(`¿Eliminar el departamento ${d.Nombre_Departamento}?`, 'Eliminar departamento', 'error')) {
      this.deps.eliminar(d.Id).subscribe({
        next: () => this.cargar(),
        error: (error: HttpErrorResponse) => this.manejarError(error, 'No se pudo eliminar el departamento'),
      });
    }
  }

  private manejarError(error: HttpErrorResponse, mensajePredeterminado: string): void {
    this.error = error.error?.error ?? mensajePredeterminado;
    this.mensaje = '';
    this.cd.markForCheck();
  }
}
