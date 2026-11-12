import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EquiposProyectosService } from './equipos-proyectos.service';
import { authInterceptor } from '../interceptors/auth.interceptor';

describe('Asignaciones equipo-proyecto: contrato .NET', () => {
  let http: HttpTestingController;
  let service: EquiposProyectosService;
  const row = { id: 'EQ-1', equipo_id: 'EQ-1', proyecto_id: 2, nombre_proyecto: 'Proyecto Ágil' };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController); service = TestBed.inject(EquiposProyectosService);
  });
  afterEach(() => http.verify());
  it('consulta todos con cookie y conserva id de texto', () => {
    service.obtenerTodos().subscribe(r => expect(r.data).toEqual([row]));
    const req = http.expectOne('/api/equipos-proyectos/'); expect(req.request.method).toBe('GET'); expect(req.request.withCredentials).toBe(true); req.flush({ success: true, data: [row] });
  });
  it('asigna con los nombres de campos Flask', () => {
    service.asignar('EQ-1', 'Proyecto Ágil').subscribe(r => expect(r.data?.id).toBe('EQ-1'));
    const req = http.expectOne('/api/equipos-proyectos/'); expect(req.request.method).toBe('POST'); expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ equipo_id: 'EQ-1', nombre_proyecto: 'Proyecto Ágil' }); req.flush({ success: true, data: row }, { status: 201, statusText: 'Created' });
  });
  it('consulta por equipo y proyecto codificando los segmentos', () => {
    service.obtenerPorEquipo('EQ #1').subscribe(r => expect(r.data).toEqual([]));
    const equipment = http.expectOne('/api/equipos-proyectos/equipo/EQ%20%231'); expect(equipment.request.withCredentials).toBe(true); equipment.flush({ success: true, data: [] });
    service.obtenerPorProyecto('Proyecto Ágil').subscribe(r => expect(r.data).toEqual([row]));
    const project = http.expectOne('/api/equipos-proyectos/proyecto/Proyecto%20%C3%81gil'); expect(project.request.withCredentials).toBe(true); project.flush({ success: true, data: [row] });
  });
  it('elimina la asignación con la ruta y mensaje originales', () => {
    service.eliminar('EQ-1', 'Proyecto Ágil').subscribe(r => expect(r.message).toBe('Asignación equipo-proyecto eliminada correctamente'));
    const req = http.expectOne('/api/equipos-proyectos/EQ-1/Proyecto%20%C3%81gil'); expect(req.request.method).toBe('DELETE'); expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, message: 'Asignación equipo-proyecto eliminada correctamente' });
  });
  it('propaga conflicto de negocio HTTP 400 sin convertirlo en éxito', () => {
    service.asignar('EQ-1', 'Otro').subscribe({ next: () => { throw new Error('No debe emitir éxito'); }, error: e => { expect(e.status).toBe(400); expect(e.error.error).toBe('El equipo ya está asignado a otro proyecto'); } });
    http.expectOne('/api/equipos-proyectos/').flush({ success: false, error: 'El equipo ya está asignado a otro proyecto' }, { status: 400, statusText: 'Bad Request' });
  });
});
