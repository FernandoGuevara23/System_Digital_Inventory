import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UsuarioService } from './usuario.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { Usuario } from '../models/usuario.model';

describe('UsuarioService: contrato Flask/.NET', () => {
  let service: UsuarioService;
  let http: HttpTestingController;
  const usuario: Usuario = {
    Id: 1, UserName: 'admin', Nombre_Completo: 'Administración',
    Fecha_Creacion: new Date(), Fecha_Actualizacion: new Date(),
  };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    ] });
    service = TestBed.inject(UsuarioService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('inicia sesión usando cookies y conserva el DTO con mayúsculas', () => {
    service.login({ username: 'admin', password: 'Prueba123' }).subscribe();
    const req = http.expectOne('/api/usuarios/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ username: 'admin', password: 'Prueba123' });
    req.flush({ success: true, data: usuario });
    expect(service.obtenerUsuarioActual()?.UserName).toBe('admin');
  });

  it('restaura sesión al recargar y la limpia ante 401', () => {
    service.validarSesion().subscribe();
    http.expectOne('/api/usuarios/session').flush({ success: true, data: usuario });
    expect(service.estaLogeado()).toBe(true);
    service.validarSesion().subscribe({ error: () => {} });
    http.expectOne('/api/usuarios/session').flush({ success: false, error: 'No hay sesión activa' }, { status: 401, statusText: 'Unauthorized' });
    expect(service.estaLogeado()).toBe(false);
  });

  it('traduce el formulario de alta a los campos esperados', () => {
    service.crear({ UserName: 'nuevo', Password: 'Prueba123', Nombre_Completo: 'Nombre' }).subscribe();
    const req = http.expectOne('/api/usuarios/');
    expect(req.request.body).toEqual({ username: 'nuevo', password: 'Prueba123', Nombre_Completo: 'Nombre' });
    req.flush({ success: true, data: usuario });
  });

  it('edita por username codificado y cambia contraseña por ID', () => {
    service.actualizarPerfil('admin prueba', { Nombre_Completo: 'Nombre' }).subscribe();
    const req = http.expectOne('/api/usuarios/admin%20prueba');
    expect(req.request.method).toBe('PUT');
    req.flush({ success: true, data: usuario });
    service.actualizarContraseña(1, 'Cambio123').subscribe();
    const password = http.expectOne('/api/usuarios/1/cambiar-contraseña');
    expect(password.request.body).toEqual({ nuevaContraseña: 'Cambio123' });
    password.flush({ success: true });
  });

  it('cierra sesión y elimina por ID', () => {
    service.validarSesion().subscribe();
    http.expectOne('/api/usuarios/session').flush({ success: true, data: usuario });
    service.logout().subscribe();
    const logout = http.expectOne('/api/usuarios/logout');
    expect(logout.request.method).toBe('POST');
    logout.flush({ success: true });
    expect(service.estaLogeado()).toBe(false);
    service.eliminar(2).subscribe();
    const deletion = http.expectOne('/api/usuarios/2');
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush({ success: true });
  });
});
