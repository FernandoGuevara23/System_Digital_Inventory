import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { LineasService } from './lineas.service';
import { EquiposService } from './equipos.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { LineasComponent } from '../modules/usuarios/pages/lineas/lineas.component';
import { Linea, EquipoTelefono } from '../models/linea.model';

describe('Líneas: formularios y contrato .NET', () => {
  let http: HttpTestingController; let c: LineasComponent;
  const line = { Service_Tag: 'A B', Numero_Telefono: '123', Account: 'plan', Total_cuenta: 0, Estado: 'Activa', Estado_Linea: 'Activa', Equipo_En_Inventario: true, Payroll: 10, Usuario: 'Ana', CC: 1 } as Linea;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    c = new LineasComponent(new FormBuilder(), TestBed.inject(LineasService), {} as any, TestBed.inject(EquiposService), {} as any, { markForCheck: vi.fn() } as any, {} as any, {} as any, {} as any);
  });
  afterEach(() => http.verify());
  function refresh() { http.expectOne('/api/lineas/equipos-telefono').flush({ success: true, data: [], total: 0 }); }
  it('alta envía los campos exactos y total cero', () => {
    c.lineaForm.patchValue({ Service_Tag: 'A B', Numero_Telefono: '123', Account: ' plan ', Total_cuenta: 0 }); c.guardar();
    const req = http.expectOne('/api/lineas/'); expect(req.request.method).toBe('POST'); expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ Service_Tag: 'A B', Numero_Telefono: '123', Account: 'plan', Total_cuenta: 0 });
    req.flush({ success: true, data: line }); refresh(); expect(c.lineas[0].Service_Tag).toBe('A B'); expect(c.guardando).toBe(false);
  });
  it('suspensión usa edición completa y no cambia equipo', () => {
    c.editando = line; c.lineas = [line]; c.lineaForm.patchValue({ Service_Tag: line.Service_Tag, Numero_Telefono: "123", Account: "plan", Total_cuenta: 0, Estado: 'Suspendida' }); c.guardar();
    const req = http.expectOne('/api/lineas/A%20B'); expect(req.request.method).toBe('PUT'); expect(req.request.body.Estado).toBe('Suspendida'); expect(req.request.body.Total_cuenta).toBe(0); expect(req.request.body.Service_Tag).toBeUndefined();
    req.flush({ success: true, data: { ...line, Estado: 'Suspendida', Estado_Linea: 'Suspendida' } }); refresh(); expect(c.lineas[0].Estado).toBe('Suspendida');
  });
  it('reasociar huérfana manda Service_Tag destino', () => {
    c.editando = { ...line, Equipo_En_Inventario: false, Estado: 'Sin equipo' }; c.lineaForm.patchValue({ Service_Tag: 'DEST', Numero_Telefono: "123", Account: "plan", Total_cuenta: 0, Estado: 'Suspendida' }); c.guardar();
    const req = http.expectOne('/api/lineas/A%20B'); expect(req.request.body.Service_Tag).toBe('DEST');
    req.flush({ success: true, data: { ...line, Service_Tag: 'DEST' } }); refresh();
  });
  it('transferencia usa origen y destino y refresca ambos catálogos', () => {
    c.lineaOrigen = line; c.equipoDestino = { Service_Tag: 'DEST', Tiene_Datos_Linea: false } as EquipoTelefono; c.cambiarLinea();
    const req = http.expectOne('/api/lineas/transferir'); expect(req.request.body).toEqual({ Service_Tag_Origen: 'A B', Service_Tag_Destino: 'DEST' });
    req.flush({ success: true, data: { ...line, Service_Tag: 'DEST' } }); http.expectOne('/api/lineas/').flush({ success: true, data: [] }); refresh(); expect(c.buscandoCambio).toBe(false);
  });
  it('asignación usa ruta de equipo existente', () => {
    c.lineaSeleccionada = line; c.lineas = [line]; c.empleadoSeleccionado = 20; c.asignarLinea();
    const req = http.expectOne('/api/equipos/A%20B/reasignar'); expect(req.request.body).toEqual({ Payroll: 20 }); req.flush({ success: true, data: {} });
    http.expectOne('/api/lineas/').flush({ success: true, data: [{ ...line, Payroll: 20 }] }); expect(c.asignando).toBe(false);
  });
  it('conflicto de número se muestra y libera formulario', () => {
    c.lineaForm.patchValue({ Service_Tag: line.Service_Tag, Numero_Telefono: "123", Account: "plan", Total_cuenta: 0 }); c.guardar(); http.expectOne('/api/lineas/').flush({ success: false, error: 'El número de teléfono ya está registrado en otra línea.' }, { status: 409, statusText: 'Conflict' });
    expect(c.error).toContain('otra línea'); expect(c.guardando).toBe(false);
  });
  it('Excel conserva resultados parciales y refresca líneas y destinos', () => {
    const file = new File(['xlsx'], 'factura.xlsx'); const input = { files: [file], value: 'factura.xlsx' };
    c.cargarExcel({ target: input } as unknown as Event);
    const req = http.expectOne('/api/lineas/cargar-excel'); expect(req.request.method).toBe('POST'); expect(req.request.withCredentials).toBe(true); expect(req.request.body.get('archivo')).toBe(file); expect(req.request.headers.has('Content-Type')).toBe(false);
    const result = { success: true, message: 'Se actualizaron 1 líneas desde el archivo Excel', procesadas: 1, no_encontradas: [{ fila: 5, account: 'missing', telefono: '123' }], errores: ['Fila 6: falta la Cuenta hija.'] };
    req.flush(result); http.expectOne('/api/lineas/').flush({ success: true, data: [line] }); refresh();
    expect(c.resultadoImportacion).toEqual(result); expect(c.mensaje).toBe(result.message); expect(c.cargandoExcel).toBe(false); expect(input.value).toBe('');
  });
  it('fallo de archivo muestra error y permite reintentar', () => {
    c.cargarExcel({ target: { files: [new File(['bad'], 'bad.xls')], value: 'bad.xls' } } as unknown as Event);
    http.expectOne('/api/lineas/cargar-excel').flush({ success: false, error: 'Archivo inválido' }, { status: 400, statusText: 'Bad Request' }); expect(c.error).toBe('Archivo inválido'); expect(c.cargandoExcel).toBe(false);
  });
  it('exportación consume Blob y descarga con nombre esperado', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:lines'); const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let name = ''; const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) { name = this.download; });
    try {
      c.descargarExcel(); const req = http.expectOne('/api/lineas/exportar'); expect(req.request.responseType).toBe('blob'); expect(req.request.withCredentials).toBe(true); const blob = new Blob(['xlsx']); req.flush(blob);
      expect(create).toHaveBeenCalledWith(blob); expect(name).toBe('lineas_telefonicas.xlsx'); expect(revoke).toHaveBeenCalledWith('blob:lines'); expect(c.mensaje).toBe('Archivo Excel descargado correctamente');
    } finally { create.mockRestore(); revoke.mockRestore(); click.mockRestore(); }
  });});



