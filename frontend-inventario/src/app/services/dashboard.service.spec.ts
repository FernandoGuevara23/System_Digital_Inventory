import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardService } from './dashboard.service';
import { authInterceptor } from '../interceptors/auth.interceptor';

describe('Dashboard: contrato .NET', () => {
  let http: HttpTestingController;
  let service: DashboardService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DashboardService);
  });
  afterEach(() => http.verify());
  it('consulta el resumen con cookie y conserva conteos numéricos y movimientos Flask', () => {
    const data = {
      empleados: { total: 2, activos: 1 }, equipos: { inventario: 3, asignados: 2 },
      lineas: { total: 5, activas: 2 }, pendientes: { scrap: 3, donaciones: 2, produccion: 1, ventas: 0 },
      movimientos: [{ Id: 6, Service_Tag: 'A', Hostname: null, Accion: 'ASIGNACION', Detalle: 'Prueba', Payroll_Anterior: null, Payroll_Nuevo: 10, Usuario: null, Fecha: '2026-01-01T12:00:00' }]
    };
    service.obtenerResumen().subscribe(r => { expect(r.success).toBe(true); expect(r.data).toEqual(data); });
    const req = http.expectOne('/api/dashboard');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true, data });
  });
  it('propaga el error de Flask sin sustituirlo por ceros', () => {
    service.obtenerResumen().subscribe({ next: () => { throw new Error('No debe emitir resumen'); }, error: e => {
      expect(e.status).toBe(500); expect(e.error.error).toBe('No se pudo obtener el resumen del dashboard.');
    } });
    http.expectOne('/api/dashboard').flush({ success: false, error: 'No se pudo obtener el resumen del dashboard.' }, { status: 500, statusText: 'Server Error' });
  });
});
