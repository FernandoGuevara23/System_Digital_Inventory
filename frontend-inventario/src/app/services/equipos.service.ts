import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Equipo, ApiResponse, EquiposQuery, EquiposResponse, MovimientoEquipo } from '../models/equipos.model';

@Injectable({
  providedIn: 'root'
})
export class EquiposService {
  private apiUrl = '/api/equipos';

  constructor(private http: HttpClient) { }

  getEquipos(query?: EquiposQuery): Observable<EquiposResponse> {
    let params = new HttpParams();
    if (query) {
      params = params
        .set('page', String(query.page))
        .set('page_size', String(query.page_size))
        .set('view', query.view ?? 'todos')
        .set('carta_filter', query.carta_filter ?? 'TODOS');
      if (query.q) params = params.set('q', query.q);
      if (query.category) params = params.set('category', query.category);
    }
    return this.http.get<EquiposResponse>(`${this.apiUrl}/`, { params });
  }

  getUltimoServiceTag(): Observable<ApiResponse<{ Service_Tag: string | null }>> {
    return this.http.get<ApiResponse<{ Service_Tag: string | null }>>(`${this.apiUrl}/ultimo-service-tag`);
  }

  getEquipoById(id: string): Observable<ApiResponse<Equipo>> {
    return this.http.get<ApiResponse<Equipo>>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }

  createEquipo(equipo: Equipo): Observable<ApiResponse<Equipo>> {
    return this.http.post<ApiResponse<Equipo>>(`${this.apiUrl}/`, equipo);
  }

  updateEquipo(id: string, equipo: Equipo): Observable<ApiResponse<Equipo>> {
    return this.http.put<ApiResponse<Equipo>>(`${this.apiUrl}/${encodeURIComponent(id)}`, equipo);
  }

  reasignarEquipo(serviceTag: string, payroll: number): Observable<ApiResponse<Equipo>> {
    return this.http.put<ApiResponse<Equipo>>(`${this.apiUrl}/${encodeURIComponent(serviceTag)}/reasignar`, {
      Payroll: payroll
    });
  }

  activarEquipo(serviceTag: string): Observable<ApiResponse<Equipo>> {
    return this.http.put<ApiResponse<Equipo>>(`${this.apiUrl}/${encodeURIComponent(serviceTag)}/activar`, {});
  }

  getHistorial(serviceTag?: string, page = 1, pageSize = 1000, q = '', module = ''): Observable<ApiResponse<MovimientoEquipo[]>> {
    const url = serviceTag === undefined
      ? `${this.apiUrl}/historial`
      : `${this.apiUrl}/${encodeURIComponent(serviceTag)}/historial`;
    let params = new HttpParams().set('page', page).set('page_size', pageSize);
    if (q) params = params.set('q', q);
    if (module && module !== 'Todos') params = params.set('module', module);
    return this.http.get<ApiResponse<MovimientoEquipo[]>>(url, { params });
  }

  exportarHistorial(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/historial/exportar`, { responseType: 'blob' });
  }

  deleteEquipo(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }
  CargarExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<any>(`${this.apiUrl}/cargar-excel`, formData);
  }

  descargarPlantillaExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/plantilla-excel`, {
      responseType: 'blob'
    });
  }
  
}
