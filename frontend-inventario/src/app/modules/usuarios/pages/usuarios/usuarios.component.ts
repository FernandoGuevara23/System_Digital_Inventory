import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuarioService } from '../../../../services/usuario.service';
import { Usuario } from '../../../../models/usuario.model';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import type { AlertType } from '../../../../shared/components/alert/alert.component';
import { DialogService } from '../../../../shared/services/dialog.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AlertComponent],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent implements OnInit {
  usuarios: Usuario[] = [];
  usuarioForm: FormGroup;
  busquedaControl = new FormControl('');
  mensaje = '';
  tipoMensaje: AlertType = 'success';
  error = '';
  mostrarFormulario = false;
  mostrarPassword = false;
  guardandoUsuario = false;
  usuarioSeleccionado: Usuario | null = null;
  usuarioEnEdicion: Usuario | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly usuariosService: UsuarioService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly dialogs: DialogService,
  ) {
    this.usuarioForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      full_name: ['', [Validators.required, Validators.maxLength(150)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  get busqueda(): string {
    return this.busquedaControl.value ?? '';
  }

  get usuariosFiltrados(): Usuario[] {
    const termino = this.busqueda.trim().toLowerCase();
    if (!termino) {
      return this.usuarios;
    }

    return this.usuarios.filter((usuario) =>
      usuario.UserName.toLowerCase().includes(termino)
      || (usuario.Nombre_Completo ?? '').toLowerCase().includes(termino)
    );
  }

  alternarFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.limpiarFormulario();
      return;
    }
    this.usuarioEnEdicion = null;
    this.usuarioForm.enable();
    this.usuarioForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.usuarioForm.get('password')?.updateValueAndValidity();
    this.changeDetectorRef.markForCheck();
  }

  cargarUsuarios(): void {
    this.usuariosService.obtenerTodos().subscribe({
      next: (respuesta) => {
        this.usuarios = respuesta.data ?? [];
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron cargar los usuarios';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  guardarUsuario(): void {
    if (this.guardandoUsuario) return;
    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      this.error = 'Completa los campos obligatorios del usuario';
      return;
    }

    const usuario: Partial<Usuario> = {
      UserName: this.usuarioForm.value.username.trim(),
      Nombre_Completo: this.usuarioForm.value.full_name.trim(),
      Password: this.usuarioForm.value.password,
    };

    this.guardandoUsuario = true;
    this.error = '';
    this.mensaje = '';
    this.usuariosService.crear(usuario).subscribe({
      next: () => {
        this.guardandoUsuario = false;
        this.tipoMensaje = 'success';
        this.mensaje = 'Usuario guardado correctamente';
        this.usuarioForm.reset();
        this.mostrarFormulario = false;
        this.usuarioEnEdicion = null;
        this.cargarUsuarios();
        this.error = '';
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta: HttpErrorResponse) => {
        this.guardandoUsuario = false;
        const detalle = respuesta.error as { error?: string; message?: string } | null;
        this.error = detalle?.error ?? detalle?.message ?? 'No se pudo guardar el usuario';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  async eliminarUsuario(id: number): Promise<void> {
    if (!await this.dialogs.confirm('¿Deseas eliminar este usuario?', 'Eliminar usuario', 'error')) {
      return;
    }

    this.usuariosService.eliminar(id).subscribe({
      next: () => {
        this.tipoMensaje = 'warning';
        this.mensaje = 'Usuario eliminado';
        this.cargarUsuarios();
      },
      error: () => {
        this.error = 'No se pudo eliminar el usuario';
      },
    });
  }
editarUsuario(usuario: Usuario): void {
  this.usuarioEnEdicion = usuario;
  this.mostrarFormulario = true;
  this.usuarioForm.enable();
  this.usuarioForm.get('username')?.disable();
  this.usuarioForm.get('password')?.setValidators([Validators.minLength(6)]);
  this.usuarioForm.get('password')?.updateValueAndValidity();
  this.usuarioForm.reset({
    username: usuario.UserName,
    full_name: usuario.Nombre_Completo ?? '',
    password: ''
  });
  this.error = '';
  this.mensaje = '';
}

async editarAdmin(usuario: Usuario): Promise<void> {
  if (this.guardandoUsuario) return;
  if (this.usuarioForm.invalid) {
    this.usuarioForm.markAllAsTouched();
    this.error = 'Escribe el nombre completo y revisa la contraseña';
    return;
  }

  const nombreCompleto = String(this.usuarioForm.get('full_name')?.value ?? '').trim();
  const password = String(this.usuarioForm.get('password')?.value ?? '');
  const confirmacion = password
    ? `¿Deseas guardar los cambios del usuario ${usuario.UserName}, incluida la nueva contraseña?`
    : `¿Deseas actualizar el nombre completo de ${usuario.UserName}?`;
  if (!await this.dialogs.confirm(confirmacion)) {
    return;
  }

  const datos: { Nombre_Completo: string; password?: string } = {
    Nombre_Completo: nombreCompleto,
  };
  if (password) {
    datos.password = password;
  }

  this.guardandoUsuario = true;
  this.error = '';
  this.mensaje = '';
  this.usuariosService.actualizarPerfil(usuario.UserName, datos).subscribe({
    next: (respuesta) => {
      this.guardandoUsuario = false;
      this.tipoMensaje = 'warning';
      this.mensaje = password
        ? 'Nombre completo y contraseña actualizados correctamente'
        : 'Nombre completo actualizado correctamente';
      if (respuesta.data) {
        this.usuarios = this.usuarios.map((actual) =>
          actual.Id === respuesta.data?.Id ? respuesta.data : actual
        );
      }
      this.cargarUsuarios();
      this.mostrarFormulario = false;
      this.limpiarFormulario();
      this.error = '';
      this.changeDetectorRef.markForCheck();
    },
    error: (respuesta: HttpErrorResponse) => {
      this.guardandoUsuario = false;
      const detalle = respuesta.error as { error?: string; message?: string } | null;
      this.error = detalle?.error ?? detalle?.message ?? 'No se pudieron actualizar los datos del usuario';
      this.changeDetectorRef.markForCheck();
    },
  });
}

cancelarFormulario(): void {
  this.mostrarFormulario = false;
  this.limpiarFormulario();
}

private limpiarFormulario(): void {
  this.usuarioEnEdicion = null;
  this.mostrarPassword = false;
  this.guardandoUsuario = false;
  this.usuarioForm.enable();
  this.usuarioForm.reset();
  this.usuarioForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
  this.usuarioForm.get('password')?.updateValueAndValidity();
}
 
}
