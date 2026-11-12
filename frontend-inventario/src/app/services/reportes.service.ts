import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ReporteScrap, ResumenScrap } from '../models/scrap.model';
import { ReporteDonacion, ResumenDonacion } from '../models/donaciones.models';
import { ReporteProduccion, ResumenProduccion } from '../models/produccion.models';
import { ReporteVenta, ResumenVenta } from '../models/ventas.models';
import { ApiResponse } from '../models/equipos.model';
import { ReporteLineas } from '../models/linea.model';

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private apiUrl = '/api/reportes';

  constructor(private http: HttpClient) {}

  obtenerReportes(ids?: number[]): Observable<ApiResponse<ReporteScrap[]>> {
    const parametros = ids?.length ? `?ids=${ids.join(',')}` : '';
    return this.http.get<ApiResponse<ReporteScrap[]>>(`${this.apiUrl}/scrap${parametros}`);
  }

  obtenerReportesDonacion(ids?: number[]): Observable<ApiResponse<ReporteDonacion[]>> {
    const parametros = ids?.length ? `?ids=${ids.join(',')}` : '';
    return this.http.get<ApiResponse<ReporteDonacion[]>>(`${this.apiUrl}/donaciones${parametros}`);
  }
  obtenerReportesProduccion(ids?: number[]): Observable<ApiResponse<ReporteProduccion[]>> {
    const parametros = ids?.length ? `?ids=${ids.join(',')}` : '';
    return this.http.get<ApiResponse<ReporteProduccion[]>>(`${this.apiUrl}/produccion${parametros}`);
  }
  obtenerReportesVentas(ids?: number[]): Observable<ApiResponse<ReporteVenta[]>> {
    const parametros = ids?.length ? `?ids=${ids.join(',')}` : '';
    return this.http.get<ApiResponse<ReporteVenta[]>>(`${this.apiUrl}/ventas${parametros}`);
  }

  obtenerResumenScrap(): Observable<ApiResponse<ResumenScrap>> {
    return this.http.get<ApiResponse<ResumenScrap>>(`${this.apiUrl}/scrap/resumen`);
  }
  obtenerResumenDonacion(): Observable<ApiResponse<ResumenDonacion>> {
    return this.http.get<ApiResponse<ResumenDonacion>>(`${this.apiUrl}/donacion/resumen`);
  }
  obtenerResumenProduccion(): Observable<ApiResponse<ResumenProduccion>> {
    return this.http.get<ApiResponse<ResumenProduccion>>(`${this.apiUrl}/produccion/resumen`);
  }
  obtenerResumenVentas(): Observable<ApiResponse<ResumenVenta>> {
    return this.http.get<ApiResponse<ResumenVenta>>(`${this.apiUrl}/ventas/resumen`);
  }

  descargarReporteScrap(ids: number[]): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/scrap/descargar?ids=${ids.join(',')}`, {
      responseType: 'blob'
    });
  }
  descargarReporteDonaciones(ids: number[]): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/donaciones/descargar?ids=${ids.join(',')}`, {
      responseType: 'blob'
    });
  }
  descargarReporteProduccion(ids: number[]): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/produccion/descargar?ids=${ids.join(',')}`, {
      responseType: 'blob'
    });
  }
  descargarReporteVentas(ids: number[]): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/ventas/descargar?ids=${ids.join(',')}`, {
      responseType: 'blob'
    });
  }
  obtenerReportesLineas(): Observable<ApiResponse<ReporteLineas[]>> {
    return this.http.get<ApiResponse<ReporteLineas[]>>(`${this.apiUrl}/lineas`);
  }

  descargarReporteLineas(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/lineas/descargar`, {
      responseType: 'blob'
    });
  }
  descargarLineasPorCC(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/lineas/descargar_por_cc`, {
      responseType: 'blob'
    });
  }
  descargarLineasPorCC_HC(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/lineas/descargar_por_cc_hc`, {
      responseType: 'blob'
    });
  }
  descargarEquiposPorEmpleado(payroll: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/equipos_por_empleado/descargar`, {
      params: { payroll: payroll.toString() },
      responseType: 'blob'
    });
  }

  obtenerEquiposPorEmpleado(payroll: number): Observable<{ success: boolean; total: number; total_compartidos: number }> {
    return this.http.get<{ success: boolean; total: number; total_compartidos: number }>(`${this.apiUrl}/equipos_por_empleado`, {
      params: { payroll: payroll.toString() }
    });
  }
}
