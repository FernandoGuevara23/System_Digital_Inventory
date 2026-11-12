import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { App } from '../app';
import { authInterceptor } from '../interceptors/auth.interceptor';

describe('Notificaciones: contrato .NET y campana Angular', () => {
  let http: HttpTestingController;
  const item = { id: 'carta-responsiva-55', tipo: 'carta_responsiva', categoria: 'Cartas responsivas', titulo: 'Carta pendiente de firma', mensaje: 'Ana · Laptop · TAG · Sin hostname', estado: 'ENVIADO', url: '/cartas-responsivas?estado=ENVIADO' };
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('usa cookie y total global, muestra el mensaje y abre el filtro de cartas', () => {
    const fixture = TestBed.createComponent(App);
    const request = http.expectOne('/api/notificaciones');
    expect(request.request.method).toBe('GET'); expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, data: { items: [item], total: 55 } });
    fixture.componentInstance.notificationsOpen = true; fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.notification-badge')?.textContent?.trim()).toBe('55');
    expect(el.querySelector('.notification-overflow')?.textContent).toContain('Mostrando 1 de 55');
    expect(el.querySelector('.notification-item')?.textContent).toContain(item.mensaje);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    (el.querySelector('.notification-item') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(item.url); expect(fixture.componentInstance.notificationsOpen).toBe(false);
    fixture.destroy();
  });
  it('muestra el estado vacío y no inventa pendientes', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/notificaciones').flush({ success: true, data: { items: [], total: 0 } });
    fixture.componentInstance.notificationsOpen = true; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-empty')?.textContent).toContain('No hay notificaciones pendientes');
    expect(fixture.nativeElement.querySelector('.notification-badge')).toBeNull(); fixture.destroy();
  });
  it('detiene carga y muestra error ante fallo del servidor', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/notificaciones').flush({ success: false, error: 'Error interno del servidor' }, { status: 500, statusText: 'Server Error' });
    fixture.componentInstance.notificationsOpen = true; fixture.detectChanges();
    expect(fixture.componentInstance.notificationLoading).toBe(false);
    expect(fixture.nativeElement.querySelector('.notification-error')?.textContent).toContain('No se pudieron cargar las notificaciones'); fixture.destroy();
  });
});
