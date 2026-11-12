import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { CartaResponsivaService } from './cartas.service';
import { CartaGeneracionComponent } from '../modules/usuarios/pages/cartas/carta-generacion.component';
import { CartasResponsivasComponent } from '../modules/usuarios/pages/cartas/cartas.component';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { CartaResponsiva } from '../models/cartas.model';
import { Empleado, EquipoAsignado } from '../models/empleados.model';

describe('Cartas: formularios Angular con contrato .NET', () => {
  let http: HttpTestingController; let service: CartaResponsivaService;
  const cd = { markForCheck: vi.fn() }; const dialogs = { confirm: vi.fn().mockResolvedValue(true), alert: vi.fn() }; const sending = { begin: vi.fn(), end: vi.fn() };
  const owner = { Payroll: 10, Full_Name: 'Ana', Estado: true, Correo: 'ana@example.test', Departament: 'IT', Position: 'Ingeniera' } as Empleado;
  const equipo = { Service_Tag: 'A', Tipo_Equipo: 'Laptop', Marca: 'Dell', Modelo: 'M', Payroll: 10 } as EquipoAsignado;
  const card = { id: 1, service_tag: 'A', tipo_carta: 'INDIVIDUAL', estado: 'SIN_ENVIAR', payroll_titular: '10', nombre_titular: 'Ana' } as CartaResponsiva;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); service = new CartaResponsivaService(TestBed.inject(HttpClient), dialogs as any); vi.clearAllMocks(); });
  afterEach(() => http.verify());
  function generation() { const c = new CartaGeneracionComponent({} as any, service, cd as any, dialogs as any, sending as any); c.titular = owner; c.tipo = 'INDIVIDUAL'; c.equipos = [equipo]; c.equipoSeleccionado = equipo; return c; }
  function listing() { return new CartasResponsivasComponent(service, cd as any, {} as any, dialogs as any, sending as any); }
  function refresh() { http.expectOne(r => r.url === '/api/cartas').flush({ success: true, data: [], pagination: { page: 1, page_size: 25, total: 0, total_pages: 0 } }); }
  it('genera carta individual desde formulario sin enviarla', () => {
    const c = generation(); c.crearCarta(); const req = http.expectOne('/api/cartas/generar'); expect(req.request.method).toBe('POST'); expect(req.request.withCredentials).toBe(true); expect(req.request.body.payroll_titular).toBe(10); expect(req.request.body.co_responsables).toEqual([]); req.flush({ success: true, data: card }); expect(c.cartaCreada?.id).toBe(1); expect(c.cargando).toBe(false);
  });
  it('compartida incluye adicionales y consume conflicto de carta activa', () => {
    const c = generation(); c.tipo = 'COMPARTIDA'; c.seleccionados = [{ ...owner, Payroll: 20, Full_Name: 'Luis' }]; c.crearCarta(); const req = http.expectOne('/api/cartas/generar'); expect(req.request.body.co_responsables[0].payroll).toBe(20); req.flush({ success: false, error: 'El equipo ya tiene una carta activa.' }, { status: 409, statusText: 'Conflict' }); expect(c.error).toContain('carta activa'); expect(c.cargando).toBe(false);
  });
  it('envío confirma y controla indicador de correo', async () => {
    const c = generation(); c.cartaCreada = card; await c.enviarCarta(); const req = http.expectOne('/api/cartas/1/enviar'); expect(req.request.body).toEqual({ confirmar_reenvio: false }); expect(sending.begin).toHaveBeenCalled(); req.flush({ success: true, data: { ...card, estado: 'ENVIADO' } }); expect(c.cartaCreada?.estado).toBe('ENVIADO'); expect(sending.end).toHaveBeenCalled(); expect(c.enviando).toBe(false);
  });
  it('reenvío desde listado requiere confirmación y true', async () => {
    const c = listing(); await c.enviarCorreo({ ...card, estado: 'ENVIADO' }); expect(dialogs.confirm).toHaveBeenCalled(); const req = http.expectOne('/api/cartas/1/enviar'); expect(req.request.body.confirmar_reenvio).toBe(true); req.flush({ success: true, data: { ...card, estado: 'ENVIADO' } }); refresh();
  });
  it('firma usa PATCH y refresca listado', async () => {
    const c = listing(); await c.marcarFirmada({ ...card, estado: 'ENVIADO' }); const req = http.expectOne('/api/cartas/1/marcar-firmada'); expect(req.request.method).toBe('PATCH'); req.flush({ success: true, data: { ...card, estado: 'FIRMADA' } }); refresh(); expect(c.mensaje).toContain('firmada');
  });
  it('no reintenta automáticamente correo enviado pero no registrado', async () => {
    const c = listing(); await c.enviarCorreo(card); http.expectOne('/api/cartas/1/enviar').flush({ success: false, error: 'El correo se envió, pero no se pudo guardar el nuevo estado. No lo reenvíes.' }, { status: 500, statusText: 'Server error' }); expect(c.error).toContain('No lo reenvíes'); expect(c.cargandoCartaId).toBeNull();
  });
  it('PDF usa GET autenticado y Blob en ventana nueva', () => {
    const popup = { location: { href: '' }, close: vi.fn() }; const open = vi.spyOn(window, 'open').mockReturnValue(popup as any); const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    try { service.verPdf(1); const req = http.expectOne('/api/cartas/1/pdf'); expect(req.request.withCredentials).toBe(true); expect(req.request.responseType).toBe('blob'); req.flush(new Blob(['pdf'])); expect(popup.location.href).toBe('blob:pdf'); } finally { open.mockRestore(); create.mockRestore(); }
  });
});

