import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DepartamentosService } from './departamentos.service';
import { TiposEquipoService } from './tipos_equipo.service';
import { ProyectosService } from './proyectos.service';
import { authInterceptor } from '../interceptors/auth.interceptor';

describe('Catálogos: contratos Flask/.NET', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('departamentos conserva campos, rutas, cookie y métodos CRUD', () => {
    const service = TestBed.inject(DepartamentosService);
    const data = { Id: 3, Nombre_Departamento: 'Sistemas', Manager_Asignado: 'María' };
    service.obtenerTodos().subscribe(r => expect(r.data).toEqual([data]));
    const list = http.expectOne('/api/departamentos/');
    expect(list.request.withCredentials).toBe(true);
    list.flush({ success: true, data: [data], total: 1 });
    service.crear(data).subscribe();
    const create = http.expectOne('/api/departamentos/');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(data);
    create.flush({ success: true, data });
    service.actualizar(3, { Manager_Asignado: 'Otro' }).subscribe();
    const edit = http.expectOne('/api/departamentos/3');
    expect(edit.request.method).toBe('PUT');
    expect(edit.request.body).toEqual({ Manager_Asignado: 'Otro' });
    edit.flush({ success: true, data });
    service.eliminar(3).subscribe();
    const remove = http.expectOne('/api/departamentos/3');
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ success: true, message: 'Departamento eliminado correctamente' });
  });

  it('tipos utiliza tipo_equipos y Nombre_Tipo_Equipo', () => {
    const service = TestBed.inject(TiposEquipoService);
    service.obtenerTodos().subscribe();
    const list = http.expectOne('/api/tipo_equipos/');
    expect(list.request.withCredentials).toBe(true);
    list.flush({ success: true, data: [], total: 0 });
    service.crear('Laptop').subscribe();
    const create = http.expectOne('/api/tipo_equipos/');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ Nombre_Tipo_Equipo: 'Laptop' });
    create.flush({ success: true, data: { Id: 1, Nombre_Tipo_Equipo: 'Laptop' } });
    service.actualizar(1, 'Portátil').subscribe();
    const edit = http.expectOne('/api/tipo_equipos/1');
    expect(edit.request.method).toBe('PUT');
    expect(edit.request.body).toEqual({ Nombre_Tipo_Equipo: 'Portátil' });
    edit.flush({ success: true });
    service.eliminar(1).subscribe();
    const remove = http.expectOne('/api/tipo_equipos/1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ success: true });
  });

  it('proyectos admite lista sin total y devuelve conflicto 409 a la pantalla', () => {
    const service = TestBed.inject(ProyectosService);
    service.obtenerTodos().subscribe(r => expect(r.data?.length).toBe(1));
    const list = http.expectOne('/api/proyectos/');
    expect(list.request.withCredentials).toBe(true);
    list.flush({ success: true, data: [{ Id: 1, Nombre_Proyecto: 'Alfa' }] });
    service.crear('Alfa').subscribe();
    const create = http.expectOne('/api/proyectos/');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ Nombre_Proyecto: 'Alfa' });
    create.flush({ success: true });
    service.actualizar(1, 'Beta').subscribe();
    const edit = http.expectOne('/api/proyectos/1');
    expect(edit.request.method).toBe('PUT');
    expect(edit.request.body).toEqual({ Nombre_Proyecto: 'Beta' });
    edit.flush({ success: true });
    service.eliminar(1).subscribe({ error: e => {
      expect(e.status).toBe(409);
      expect(e.error.error).toBe('No se puede eliminar un proyecto con equipos asignados');
    } });
    const remove = http.expectOne('/api/proyectos/1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ success: false, error: 'No se puede eliminar un proyecto con equipos asignados' }, { status: 409, statusText: 'Conflict' });
  });
});
