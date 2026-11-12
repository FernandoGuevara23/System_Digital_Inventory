import { TestBed } from '@angular/core/testing';
import { DestroyRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { EquiposService } from './equipos.service';
import { EmpleadosService } from './empleados.service';
import { CartaResponsivaService } from './cartas.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { EquiposComponent } from '../modules/usuarios/pages/equipos/equipos.component';
import { EquipoDetallesComponent } from '../modules/usuarios/pages/equipo-detalles/equipo-detalles.component';
import { ReasignarEquipoComponent } from '../modules/usuarios/pages/reasignar-equipo/reasignar-equipo.component';
import { Equipo } from '../models/equipos.model';

describe('Equipos: formularios Angular y contrato .NET', () => {
  let http: HttpTestingController;
  let service: EquiposService;
  const cd = { markForCheck: vi.fn(), detectChanges: vi.fn() };
  const dialogs = { confirm: vi.fn().mockResolvedValue(true) };
  const equipment = { Service_Tag: 'A B', Marca: 'Dell', Modelo: 'M', Tipo_Equipo: 'Laptop', Estado: 'Disponible', Payroll: null } as unknown as Equipo;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController); service = TestBed.inject(EquiposService);
  });
  afterEach(() => http.verify());
  function detail() {
    const c = new EquipoDetallesComponent({} as any, {} as any, {} as any, service, {} as any, {} as any, {} as any, {} as any, {} as any, new FormBuilder(), cd as any, {} as any, dialogs as any);
    c.equipo = { ...equipment }; c.formulario.patchValue(equipment); return c;
  }
  it('alta desde formulario conserva nómina numérica y normaliza identificadores', () => {
    const c = new EquiposComponent(new FormBuilder(), {} as any, service, {} as any, cd as any, TestBed.inject(DestroyRef), {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, dialogs as any);
    c.equipoForm.patchValue({ Service_Tag: 'A', Marca: 'Dell', Modelo: 'M', Tipo_Equipo: 'Laptop', Payroll: 10, Hostname: ' host ', MAC: ' aa:bb ' });
    c.guardarEquipo();
    const req = http.expectOne('/api/equipos/');
    expect(req.request.method).toBe('POST'); expect(req.request.withCredentials).toBe(true);
    expect(req.request.body.Payroll).toBe(10); expect(req.request.body.Hostname).toBe('host'); expect(req.request.body.MAC).toBe('aa:bb');
    req.flush({ success: false, error: 'Validación' }, { status: 400, statusText: 'Bad Request' }); expect(c.error).toBe('Validación');
  });
  it('edición excluye campos inmutables y teléfono cuando es laptop', () => {
    const c = detail(); c.formulario.patchValue({ Comments: 'Cambio' }); c.guardar();
    const req = http.expectOne('/api/equipos/A%20B'); expect(req.request.method).toBe('PUT');
    for (const key of ['Service_Tag', 'Payroll', 'Trace', 'Estado', 'Numero_Telefono']) expect(req.request.body).not.toHaveProperty(key);
    req.flush({ success: true, data: { ...equipment, Comments: 'Cambio' } }); expect(c.equipo?.Comments).toBe('Cambio'); expect(c.guardando).toBe(false);
  });
  it('edición de teléfono incluye sus detalles', () => {
    const c = detail(); c.equipo = { ...equipment, Tipo_Equipo: 'Teléfono' }; c.formulario.patchValue({ Tipo_Equipo: 'Teléfono', Numero_Telefono: '52123', Account: 'a' }); c.guardar();
    const req = http.expectOne('/api/equipos/A%20B'); expect(req.request.body.Numero_Telefono).toBe('52123'); expect(req.request.body.Account).toBe('a'); req.flush({ success: true, data: c.equipo });
  });
  it('reasignación consulta cartas y empleados, confirma y envía solo Payroll', async () => {
    const cards = new CartaResponsivaService(TestBed.inject((await import('@angular/common/http')).HttpClient), dialogs as any);
    const c = new ReasignarEquipoComponent(service, TestBed.inject(EmpleadosService), cards, cd as any, dialogs as any);
    c.equipo = equipment; c.ngOnInit();
    http.expectOne('/api/cartas?service_tag=A%20B').flush({ success: true, data: [{ estado: 'FIRMADA' }] });
    http.expectOne('/api/empleados/').flush({ success: true, data: [{ Payroll: 20, Full_Name: 'Luis', Estado: true }] });
    c.seleccionarEmpleado(20); await c.guardar();
    const req = http.expectOne('/api/equipos/A%20B/reasignar'); expect(req.request.body).toEqual({ Payroll: 20 }); expect(dialogs.confirm).toHaveBeenCalled();
    req.flush({ success: true, data: { ...equipment, Payroll: 20 } }); expect(c.guardando).toBe(false); expect(c.mensaje).toBe('Equipo reasignado correctamente');
  });
  it('reactivación actualiza la ficha con la respuesta', async () => {
    const c = detail(); c.equipo!.Estado = 'Inactivo'; await c.reactivarEquipo();
    const req = http.expectOne('/api/equipos/A%20B/activar'); expect(req.request.method).toBe('PUT');
    req.flush({ success: true, data: equipment }); expect(c.esInactivo()).toBe(false);
  });
  it('listado e historial conservan rutas, filtros y cookie', () => {
    service.getEquipos({ page: 2, page_size: 25, view: 'asignados', category: 'Teléfono', q: 'Ana', carta_filter: 'SIN_ENVIAR' }).subscribe();
    const req = http.expectOne(r => r.url === '/api/equipos/'); expect(req.request.params.get('category')).toBe('Teléfono'); expect(req.request.params.get('carta_filter')).toBe('SIN_ENVIAR'); expect(req.request.withCredentials).toBe(true); req.flush({ success: true, data: [] });
    service.getHistorial('A B').subscribe();
    const history = http.expectOne(r => r.url === '/api/equipos/A%20B/historial');
    expect(history.request.params.get('page')).toBe('1');
    expect(history.request.params.get('page_size')).toBe('1000');
    expect(history.request.withCredentials).toBe(true);
    history.flush({ success: true, data: [] });
  });
  function list() {
    return new EquiposComponent(new FormBuilder(), {} as any, service, {} as any, cd as any, TestBed.inject(DestroyRef), {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, dialogs as any);
  }
  it('carga Excel envía archivo multipart y actualiza inventario y último tag', () => {
    const c = list(); const file = new File(['xlsx'], 'equipos.xlsx'); const input = { files: [file], value: 'equipos.xlsx' };
    c.archivoSeleccionado({ target: input } as unknown as Event);
    const req = http.expectOne('/api/equipos/cargar-excel');
    expect(req.request.method).toBe('POST'); expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Content-Type')).toBe(false); expect(req.request.body.get('archivo')).toBe(file);
    req.flush({ success: true, message: 'Se procesaron 2 equipos desde el archivo Excel' });
    http.expectOne(r => r.url === '/api/equipos/').flush({ success: true, data: [], total: 0, pagination: { page: 1, total_pages: 0 }, counts: {} });
    http.expectOne('/api/equipos/ultimo-service-tag').flush({ success: true, data: { Service_Tag: 'X2' } });
    expect(c.mensaje).toBe('Se procesaron 2 equipos desde el archivo Excel'); expect(c.cargandoExcel).toBe(false); expect(input.value).toBe(''); expect(c.ultimoServiceTag).toBe('X2');
  });
  it('muestra errores Excel y permite volver a seleccionar archivo', () => {
    const c = list(); const input = { files: [new File(['bad'], 'bad.xlsx')], value: 'bad.xlsx' };
    c.archivoSeleccionado({ target: input } as unknown as Event);
    http.expectOne('/api/equipos/cargar-excel').flush({ success: false, error: 'El Service Tag ya existe: X1' }, { status: 400, statusText: 'Bad Request' });
    expect(c.error).toBe('El Service Tag ya existe: X1'); expect(c.cargandoExcel).toBe(false); expect(input.value).toBe('');
  });
  it('descarga plantilla como blob con el nombre esperado', () => {
    const c = list(); const blob = new Blob(['xlsx']);
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let filename = ''; const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) { filename = this.download; });
    vi.useFakeTimers();
    try {
      c.descargarPlantilla(); c.descargarPlantilla();
      const req = http.expectOne('/api/equipos/plantilla-excel'); expect(req.request.responseType).toBe('blob'); expect(req.request.withCredentials).toBe(true); req.flush(blob);
      expect(create).toHaveBeenCalledWith(blob); expect(filename).toBe('plantilla_equipos.xlsx'); expect(c.descargandoPlantilla).toBe(false);
      vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledWith('blob:test');
    } finally { vi.useRealTimers(); create.mockRestore(); revoke.mockRestore(); click.mockRestore(); }
  });});

