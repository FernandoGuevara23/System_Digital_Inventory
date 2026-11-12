import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { EquiposLiberadosService } from './equipos-liberados.service';
import { HistorialAppleIdComponent } from '../modules/usuarios/pages/Historial_AppleID/historial-apple-id.component';
import { EquipoLiberado } from '../models/equipos.model';
import { authInterceptor } from '../interceptors/auth.interceptor';

describe('Equipos liberados: historial Angular y contrato .NET', () => {
  let http: HttpTestingController; let service: EquiposLiberadosService;
  const cd = { markForCheck: vi.fn() };
  const current = { id: 'actual-A', Service_Tag: 'A', Origen: 'Actual', Marca: 'Apple', Modelo: 'iPhone', Numero_Telefono: '555123', Account: 'Cuenta TI', Apple_ID: 'fixture@example.test', Password_apple: 'fixture', IMEI: '123456', Nombre_Empleado_Anterior: 'Ana', Total_cuenta: 0, Tipo_Liberacion: null } as EquipoLiberado;
  const historical = { ...current, id: 7, Origen: 'Histórico', Service_Tag: 'A', Tipo_Liberacion: 'SCRAP', Apple_ID: null } as EquipoLiberado;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); service = TestBed.inject(EquiposLiberadosService); });
  afterEach(() => http.verify());
  function component() { return new HistorialAppleIdComponent(service, cd as any); }
  it('carga catálogo autenticado conservando ids mixtos y registros repetidos', () => {
    const c = component(); c.ngOnInit(); const req = http.expectOne('/api/equipos-liberados/catalogo-telefonos'); expect(req.request.method).toBe('GET'); expect(req.request.withCredentials).toBe(true); req.flush({ success: true, data: [current, historical] }); expect(c.registros.length).toBe(2); expect(c.registros[0].id).toBe('actual-A'); expect(c.registros[1].id).toBe(7); expect(c.cargando).toBe(false); expect(c.error).toBe('');
  });
  it('filtros del formulario buscan campos del contrato sin llamadas adicionales', () => {
    const c = component(); c.registros = [current];
    for (const term of [' a ', 'APPLE', 'iphone', '555123', 'cuenta ti', 'fixture@example.test', 'fixture', '123456', 'ana', '0', 'actual']) { c.termino = term; expect(c.registrosFiltrados.length).toBe(1); }
    c.registros = [current, historical]; c.termino = 'scrap'; expect(c.registrosFiltrados).toEqual([historical]); c.termino = 'histórico'; expect(c.registrosFiltrados).toEqual([historical]); c.termino = 'ausente'; expect(c.registrosFiltrados).toEqual([]); http.expectNone('/api/equipos-liberados/catalogo-telefonos');
  });
  it('admite datos nulos y lista vacía', () => {
    const c = component(); c.registros = [{ id: 'donación-1', Service_Tag: 'D', Origen: 'Donación', Total_cuenta: null } as EquipoLiberado]; c.termino = 'donación'; expect(c.registrosFiltrados.length).toBe(1); c.termino = 'null'; expect(c.registrosFiltrados.length).toBe(0); c.ngOnInit(); http.expectOne('/api/equipos-liberados/catalogo-telefonos').flush({ success: true, data: [] }); expect(c.registros).toEqual([]); expect(c.cargando).toBe(false);
  });
  it('muestra error del backend y termina indicador', () => {
    const c = component(); c.ngOnInit(); http.expectOne('/api/equipos-liberados/catalogo-telefonos').flush({ success: false, error: 'Debe iniciar sesión' }, { status: 401, statusText: 'Unauthorized' }); expect(c.error).toBe('Debe iniciar sesión'); expect(c.cargando).toBe(false);
  });
  it('consulta teléfonos liberados con cookie sin transformar el DTO', () => {
    service.obtenerTelefonos().subscribe(r => expect(r.data).toEqual([historical])); const req = http.expectOne('/api/equipos-liberados/telefonos'); expect(req.request.withCredentials).toBe(true); req.flush({ success: true, data: [historical] });
  });
});
