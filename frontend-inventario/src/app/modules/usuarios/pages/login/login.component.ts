import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import { UsuarioService } from '../../../../services/usuario.service';
import { LoginRequest } from '../../../../models/usuario.model';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AlertComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  cargando = false;
  error: string | null = null;
  cargandoRecuperacion = false;
  recuperarForm: any;

  constructor(
    private fb: FormBuilder,
    private usuarioService: UsuarioService,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.recuperarForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  ngOnInit(): void {
    this.cargando = true;
    this.usuarioService.validarSesion().subscribe({
      next: (respuesta) => {
        this.cargando = false;
        if (respuesta.success && respuesta.data) {
          void this.router.navigate(['/dashboard'], { replaceUrl: true });
        }
        this.changeDetectorRef.markForCheck();
      },
      error: (err) => {
        this.cargando = false;
        if (!(err instanceof HttpErrorResponse && err.status === 401)) {
          this.error = 'No se pudo validar la sesión con el servidor.';
        }
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  onLogin(): void {
    if (this.loginForm.invalid) {
      this.error = 'Por favor completa todos los campos correctamente';
      this.loginForm.reset();
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.cargando = true;
    this.error = null;

    const credenciales: LoginRequest = this.loginForm.value;

    this.usuarioService.login(credenciales).subscribe({
      next: (respuesta) => {
        this.cargando = false;
        
        if (respuesta.success && respuesta.data) {
          void this.router.navigate(['/dashboard'], { replaceUrl: true });
        } else {
          this.error = respuesta.error || 'Error en la autenticación';
          this.loginForm.reset();
          console.error('Error de autenticación:', respuesta.error);
        }
        this.changeDetectorRef.markForCheck();
      },
      error: (err) => {
        this.cargando = false;
        if (err instanceof TimeoutError) {
          this.error = 'El servidor no respondió a tiempo. Intenta nuevamente.';
        } else if (err instanceof HttpErrorResponse && err.status === 401) {
          this.error = 'Credenciales incorrectas';
        } else if (err instanceof HttpErrorResponse && err.status >= 500) {
          this.error = 'El servidor presentó un error. Intenta nuevamente.';
        } else {
          this.error = 'Error de conexión con el servidor';
        }
        this.loginForm.reset();
        console.error('Error:', err);
        this.changeDetectorRef.markForCheck();
      }
    });
  }
  onRecuperar(): void {
    if (this.recuperarForm.invalid) {
      this.recuperarForm.markAllAsTouched();
      this.error = 'Ingresa un nombre de usuario válido.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.cargandoRecuperacion = true;
    this.error = null;
    const username = String(this.recuperarForm.get('username')?.value ?? '').trim();

    this.usuarioService.recuperarContrasenia(username).subscribe({
      next: (respuesta) => {
        this.cargandoRecuperacion = false;
        this.error = respuesta.success
          ? 'La solicitud de recuperación fue procesada.'
          : (respuesta.error ?? 'No se pudo recuperar la contraseña.');
        this.changeDetectorRef.markForCheck();
      },
      error: (err) => {
        this.cargandoRecuperacion = false;
        this.error = err instanceof HttpErrorResponse && err.status === 404
          ? 'Usuario no encontrado.'
          : 'No se pudo recuperar la contraseña.';
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  recuperarContrasenia(): void {
    const username = this.loginForm.get('username')?.value;
    if (!username) {
      this.error = 'Por favor ingresa tu nombre de usuario para recuperar la contraseña.';
      this.changeDetectorRef.markForCheck();
      return;
    }
    this.usuarioService.recuperarContrasenia(username).subscribe({
      next: (respuesta) => {
        if (respuesta.success) {
          this.error = 'Se ha enviado un correo con la nueva contraseña.';
        } else {
          this.error = respuesta.error || 'Error al recuperar la contraseña.';
        }
        this.changeDetectorRef.markForCheck();
      },
      error: (err) => {
        this.error = 'Error al recuperar la contraseña.';
        console.error(' Error:', err);
        this.changeDetectorRef.markForCheck();
      }
    });
  }
mostrarFormularioRecuperacion = false;
  alternarFormularioRecuperacion(): void {
    this.mostrarFormularioRecuperacion = !this.mostrarFormularioRecuperacion;
    this.error = null;
    this.recuperarForm.reset();
    this.cargandoRecuperacion = false;
    this.loginForm.reset();
    this.changeDetectorRef.markForCheck();
  }
}