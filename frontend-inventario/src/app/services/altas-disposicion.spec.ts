import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DonacionesService } from './donaciones.service';
import { ProduccionService } from './produccion.service';
import { VentasService } from './ventas.service';
import { authInterceptor } from '../interceptors/auth.interceptor';

describe('Altas individuales de disposición', () => {
  let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  const cases = [
    ['donaciones', () => TestBed.inject(DonacionesService).crear('TAG-1')],
    ['produccion', () => TestBed.inject(ProduccionService).crear('TAG-1')],
    ['ventas', () => TestBed.inject(VentasService).crear('TAG-1')]
  ] as const;
  for (const [path, create] of cases) {
    it(path + ': POST /equipos usa cookie y devuelve objeto individual', () => {
      create().subscribe(r => { expect(r.success).toBe(true); expect(Array.isArray(r.data)).toBe(false); expect(r.data?.Service_Tag).toBe('TAG-1'); });
      const req = http.expectOne(`/api/${path}/equipos`); expect(req.request.method).toBe('POST'); expect(req.request.withCredentials).toBe(true); expect(req.request.body).toEqual({ Service_Tag: 'TAG-1' });
      req.flush({ success: true, data: { Service_Tag: 'TAG-1', Detalle: 'Pendiente de liberación' } }, { status: 201, statusText: 'Created' });
    });
    it(path + ': propaga error de negocio sin reintentar', () => {
      create().subscribe({ next: () => { throw new Error('No debe emitir éxito'); }, error: e => { expect(e.status).toBe(400); expect(e.error.error).toBe('Se requiere un solo equipo'); } });
      http.expectOne(`/api/${path}/equipos`).flush({ success: false, error: 'Se requiere un solo equipo' }, { status: 400, statusText: 'Bad Request' });
    });
  }
});
