import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, tap, timeout } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Usuario, LoginRequest, ApiResponse } from '../models/usuario.model';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private apiUrl = '/api/usuarios';
  private usuarioActual: Usuario | null = null;

  constructor(private http: HttpClient) {}

  
  login(credenciales: LoginRequest): Observable<ApiResponse<Usuario>> {
    return this.http.post<ApiResponse<Usuario>>(`${this.apiUrl}/login`, credenciales)
      .pipe(
        timeout(5000),
        tap(respuesta => {
          this.usuarioActual = respuesta.success ? respuesta.data ?? null : null;
        })
      );
  }

  validarSesion(): Observable<ApiResponse<Usuario>> {
    return this.http.get<ApiResponse<Usuario>>(`${this.apiUrl}/session`).pipe(
      timeout(5000),
      tap(respuesta => {
        this.usuarioActual = respuesta.success ? respuesta.data ?? null : null;
      }),
      catchError(error => {
        this.usuarioActual = null;
        return throwError(() => error);
      })
    );
  }

  obtenerUsuarioActual(): Usuario | null {
    return this.usuarioActual;
  }

  logout(): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(`${this.apiUrl}/logout`, {}).pipe(
      timeout(5000),
      tap(respuesta => {
        if (respuesta.success) this.usuarioActual = null;
      })
    );
  }

  estaLogeado(): boolean {
    return this.usuarioActual !== null;
  }

  obtenerTodos(): Observable<ApiResponse<Usuario[]>> {
    return this.http.get<ApiResponse<Usuario[]>>(`${this.apiUrl}/`);
  }

  obtenerPorId(id: number): Observable<ApiResponse<Usuario>> {
    return this.http.get<ApiResponse<Usuario>>(`${this.apiUrl}/${id}`);
  }

  crear(usuario: Partial<Usuario>): Observable<ApiResponse<Usuario>> {
    return this.http.post<ApiResponse<Usuario>>(`${this.apiUrl}/`, {
      username: usuario.UserName,
      password: usuario.Password,
      Nombre_Completo: usuario.Nombre_Completo,
    });
  }

  actualizar(username: string, datos: { Nombre_Completo?: string; password?: string }): Observable<ApiResponse<Usuario>> {
    return this.http.put<ApiResponse<Usuario>>(`${this.apiUrl}/${encodeURIComponent(username)}`, datos);
  }

  actualizarPerfil(
    username: string,
    datos: { Nombre_Completo: string; password?: string },
  ): Observable<ApiResponse<Usuario>> {
    return this.http.put<ApiResponse<Usuario>>(
      `${this.apiUrl}/${encodeURIComponent(username)}`,
      datos,
    ).pipe(
      tap(respuesta => {
        if (
          respuesta.success
          && respuesta.data
          && respuesta.data.UserName === this.usuarioActual?.UserName
        ) {
          this.usuarioActual = respuesta.data;
        }
      })
    );
  }

  eliminar(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/${id}`);
  }
  actualizarContraseña(id: number, nuevaContraseña: string): Observable<ApiResponse<Usuario>> {
    return this.http.put<ApiResponse<Usuario>>(`${this.apiUrl}/${id}/cambiar-contraseña`, { nuevaContraseña });
  }
  recuperarContrasenia(username: string): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.apiUrl}/recuperar-contraseña`, { username });
  }
}
