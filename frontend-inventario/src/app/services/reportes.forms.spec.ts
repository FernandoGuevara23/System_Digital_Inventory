import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { ReportesService } from './reportes.service';
import { ScrapHistorialComponent } from '../modules/usuarios/pages/scrap-historial/scrap-historial.component';
import { authInterceptor } from '../interceptors/auth.interceptor';

describe('Reportes y descargas: contrato .NET', () => {
  let http: HttpTestingController; let service: ReportesService;
  beforeEach(() => { TestBed.configureTestingModule({providers:[provideHttpClient(withInterceptors([authInterceptor])),provideHttpClientTesting()]}); http=TestBed.inject(HttpTestingController); service=TestBed.inject(ReportesService); });
  afterEach(() => http.verify());
  it('consulta órdenes por ids y conserva parámetros', () => {
    service.obtenerReportes([1,3]).subscribe(r=>expect(r.data?.length).toBe(0)); const req=http.expectOne('/api/reportes/scrap?ids=1,3'); expect(req.request.withCredentials).toBe(true); req.flush({success:true,data:[]});
  });
  it('descargas de disposición piden Blob y cookie con ids', () => {
    const methods=[()=>service.descargarReporteScrap([1]),()=>service.descargarReporteDonaciones([1]),()=>service.descargarReporteProduccion([1]),()=>service.descargarReporteVentas([1])];
    ['scrap','donaciones','produccion','ventas'].forEach((kind,i)=>{ methods[i]().subscribe(b=>expect(b.size).toBe(3)); const req=http.expectOne(`/api/reportes/${kind}/descargar?ids=1`); expect(req.request.responseType).toBe('blob'); expect(req.request.withCredentials).toBe(true); req.flush(new Blob(['pdf'])); });
  });
  it('descargas de líneas y CC/HC conservan rutas', () => {
    const methods=[()=>service.descargarReporteLineas(),()=>service.descargarLineasPorCC(),()=>service.descargarLineasPorCC_HC()];
    ['descargar','descargar_por_cc','descargar_por_cc_hc'].forEach((path,i)=>{ methods[i]().subscribe(); const req=http.expectOne(`/api/reportes/lineas/${path}`); expect(req.request.responseType).toBe('blob'); expect(req.request.withCredentials).toBe(true); req.flush(new Blob(['pdf'])); });
  });
  it('reporte de empleado incluye payroll',()=>{
    service.descargarEquiposPorEmpleado(10).subscribe(); const req=http.expectOne('/api/reportes/equipos_por_empleado/descargar?payroll=10'); expect(req.request.responseType).toBe('blob'); req.flush(new Blob(['pdf']));
  });
  it('historial descarga orden y libera URL temporal',()=>{
    const c=new ScrapHistorialComponent(service,{} as any,{markForCheck:vi.fn()} as any);
    const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test'); const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{}); const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
    try { c.descargarOrden({Orden_Id:2,ids:[7,8]} as any); http.expectOne('/api/reportes/scrap/descargar?ids=7,8').flush(new Blob(['pdf'])); expect(click).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith('blob:test'); } finally {create.mockRestore();revoke.mockRestore();click.mockRestore();}
  });
  it('error de descarga se muestra y no reintenta',()=>{
    const c=new ScrapHistorialComponent(service,{} as any,{markForCheck:vi.fn()} as any); c.descargarOrden({Orden_Id:1,ids:[999]} as any); http.expectOne('/api/reportes/scrap/descargar?ids=999').flush(new Blob(['error']),{status:404,statusText:'Not Found'}); expect(c.error).toContain('No se pudo descargar');
  });
  it('filtro de historial acepta fecha Flask dd/MM/yyyy',()=>{
    const c=new ScrapHistorialComponent(service,{} as any,{markForCheck:vi.fn()} as any); c.registros=[{Orden_Id:1,Fecha:'06/11/2026',ids:[1],Comentario:'Lote',Total_Equipos:1,Equipos:[]}]; c.anioSeleccionado='2026'; c.mesSeleccionado='11'; expect(c.registrosFiltrados().length).toBe(1); c.mesSeleccionado='12'; expect(c.registrosFiltrados()).toEqual([]);
  });
});
