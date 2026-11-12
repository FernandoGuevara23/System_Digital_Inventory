import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { ScrapService } from './scrap.service';
import { ReportesService } from './reportes.service';
import { ScrapComponent } from '../modules/usuarios/pages/scrap/scrap.component';
import { ScrapHistorialComponent } from '../modules/usuarios/pages/scrap-historial/scrap-historial.component';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { Equipo } from '../models/equipos.model';

describe('Scrap: formularios y contrato .NET', () => {
  let http: HttpTestingController; let service: ScrapService;
  const cd = { markForCheck: vi.fn() };
  const equipment = { Service_Tag: 'A B', Hostname: 'HOST', Estado: 'Fuera del inventario', Nombre_Empleado_Anterior: 'Ana' } as Equipo;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); service = TestBed.inject(ScrapService); });
  afterEach(() => http.verify());
  function component() { return new ScrapComponent(service, {} as any, {} as any, cd as any); }
  it('envía tags de equipos con cookie y recibe cierre transaccional', () => {
    service.enviarEquipos([equipment]).subscribe(r => expect(r.data?.length).toBe(1)); const req = http.expectOne('/api/scrap/enviar'); expect(req.request.method).toBe('POST'); expect(req.request.withCredentials).toBe(true); expect(req.request.body).toEqual({ Service_Tags: ['A B'] }); req.flush({ success: true, data: [{ Service_Tag: 'A B', Accion: 'ENVIO_A_SCRAP' }] });
  });
  it('carga pendientes y filtra por empleado anterior', () => {
    const c = component(); c.ngOnInit(); http.expectOne('/api/scrap/equipos').flush({ success: true, data: [equipment] }); c.busqueda.setValue('ana'); expect(c.equiposFiltrados()).toEqual([equipment]); expect(c.cargando).toBe(false);
  });
  it('no libera sin motivo', () => {
    const c = component(); c.equipos = [equipment]; c.seleccionados.add('A B'); c.liberarSeleccionados(); expect(c.error).toContain('comentario'); http.expectNone('/api/scrap/equipos/liberar-seleccionados');
  });
  it('libera selección, evita doble envío y refresca pendientes', () => {
    const c = component(); c.equipos = [equipment]; c.seleccionados.add('A B'); c.comentarioOrden = ' Reciclaje '; c.liberarSeleccionados(); c.liberarSeleccionados(); const req = http.expectOne('/api/scrap/equipos/liberar-seleccionados'); expect(req.request.body).toEqual({ Service_Tags: ['A B'], Detalle: 'Reciclaje' }); req.flush({ success: true, data: [] }); http.expectOne('/api/scrap/equipos').flush({ success: true, data: [] }); expect(c.seleccionados.size).toBe(0); expect(c.procesandoOrden).toBe(false);
  });
  it('conserva selección y muestra error del lote', () => {
    const c = component(); c.equipos = [equipment]; c.seleccionados.add('A B'); c.comentarioOrden = 'Lote'; c.liberarSeleccionados(); http.expectOne('/api/scrap/equipos/liberar-seleccionados').flush({ success: false, error: 'No hay datos históricos suficientes' }, { status: 400, statusText: 'Bad Request' }); expect(c.error).toContain('históricos'); expect(c.seleccionados.size).toBe(1); expect(c.procesandoOrden).toBe(false);
  });
  it('DELETE individual y total conservan cuerpo Detalle', () => {
    service.liberarEquipo(equipment, 'Individual').subscribe(); const one = http.expectOne('/api/scrap/equipos/A%20B'); expect(one.request.method).toBe('DELETE'); expect(one.request.body.Detalle).toBe('Individual'); one.flush({ success: true, data: {} }); service.liberarTodos('Todos').subscribe(); const all = http.expectOne('/api/scrap/equipos'); expect(all.request.method).toBe('DELETE'); expect(all.request.body.Detalle).toBe('Todos'); all.flush({ success: true, data: [] });
  });
  it('historial consume órdenes y resumen de las rutas de reportes', () => {
    const c = new ScrapHistorialComponent(TestBed.inject(ReportesService), {} as any, cd as any); c.ngOnInit(); http.expectOne('/api/reportes/scrap').flush({ success: true, data: [{ Orden_Id: 1, ids: [3], Fecha: '06/11/2026', Comentario: 'Lote', Total_Equipos: 1, Equipos: [] }] }); http.expectOne('/api/reportes/scrap/resumen').flush({ success: true, data: { por_tipo: [], por_estado: [], por_usuario: [], total_equipos: 1, total_ordenes: 1 } }); expect(c.registros[0].Orden_Id).toBe(1); expect(c.resumen?.total_equipos).toBe(1); expect(c.cargando).toBe(false);
  });
});
