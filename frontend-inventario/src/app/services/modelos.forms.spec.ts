import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ModelosEquiposComponent } from '../modules/usuarios/pages/modelos-equipos/modelos-equipos.component';
import { authInterceptor } from '../interceptors/auth.interceptor';

describe('Modelos: contrato .NET y pantalla Angular', () => {
  let http: HttpTestingController;
  const summary = { modelos: { latitude: [{ Model: 'Latitude 5420', Cantidad: 2 }], optiplex: [], precision: [] }, modelos_totales: { latitude: 2, optiplex: 0, precision: 0 }, hostnames: { latitude: { ultimo: 'MN0099', siguiente: 'MN0100' }, optiplex: { ultimo: 'Sin registros', siguiente: 'MD5100' }, precision: { ultimo: 'Sin registros', siguiente: 'MN5100' } } };
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ModelosEquiposComponent], providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('renderiza cantidades y hostnames y consulta el detalle con cookie y parámetro modelo', () => {
    const fixture = TestBed.createComponent(ModelosEquiposComponent); fixture.detectChanges();
    const req = http.expectOne('/api/equipos/dashboard'); expect(req.request.withCredentials).toBe(true); req.flush({ success: true, data: summary }); fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.summary-copy strong')?.textContent).toBe('2');
    expect(el.querySelector('[data-category="latitude"] .hostname-item.next strong')?.textContent).toBe('MN0100');
    (el.querySelector('.model-toggle') as HTMLButtonElement).click();
    const detail = http.expectOne(r => r.url === '/api/equipos/modelos/equipos');
    expect(detail.request.params.get('modelo')).toBe('Latitude 5420'); expect(detail.request.withCredentials).toBe(true);
    detail.flush({ success: true, total: 1, data: [{ Modelo: 'Latitude 5420', Tipo_Equipo: 'Laptop', Hostname: null, Service_Tag: 'TAG-1' }] }); fixture.detectChanges();
    expect(el.querySelector('.model-detail-cell')?.textContent).toContain('TAG-1'); expect(el.querySelector('.model-detail-cell')?.textContent).toContain('Sin hostname');
    fixture.componentInstance.alternarModelo('Latitude 5420'); fixture.componentInstance.alternarModelo('Latitude 5420');
    http.expectNone(r => r.url === '/api/equipos/modelos/equipos'); fixture.destroy();
  });
  it('muestra error de detalle y permite reintentar con respuesta vacía', () => {
    const fixture = TestBed.createComponent(ModelosEquiposComponent); fixture.detectChanges();
    http.expectOne('/api/equipos/dashboard').flush({ success: true, data: summary });
    fixture.componentInstance.alternarModelo('Latitude 5420');
    http.expectOne(r => r.url === '/api/equipos/modelos/equipos').flush({ success: false, error: 'No se pudieron consultar los equipos del modelo.' }, { status: 500, statusText: 'Error' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('No se pudieron consultar');
    fixture.componentInstance.reintentarModelo('Latitude 5420');
    http.expectOne(r => r.url === '/api/equipos/modelos/equipos').flush({ success: true, data: [], total: 0 }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay equipos para este modelo.'); expect(fixture.componentInstance.modelosCargando.size).toBe(0); fixture.destroy();
  });
  it('detiene carga y presenta el error del resumen', () => {
    const fixture = TestBed.createComponent(ModelosEquiposComponent); fixture.detectChanges();
    http.expectOne('/api/equipos/dashboard').flush({ success: false, error: 'Error interno del servidor' }, { status: 500, statusText: 'Error' }); fixture.detectChanges();
    expect(fixture.componentInstance.cargando).toBe(false); expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Error interno del servidor'); fixture.destroy();
  });
});
