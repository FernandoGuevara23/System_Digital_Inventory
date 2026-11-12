import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CambioLineaPayload, EquipoTelefono, Linea, LineaApiResponse, LineaPayload } from '../models/linea.model';

export interface ResultadoCargaLineas {
  success: boolean;
  message: string;
  procesadas: number;
  no_encontradas: Array<{ fila: number; account: string; telefono: string }>;
  errores: string[];
}

@Injectable({
  providedIn: 'root'
})
export class LineasService {
  private readonly apiUrl = '/api/lineas';

  constructor(private http: HttpClient) { }

  obtenerTodas(): Observable<LineaApiResponse<Linea[]>> {
    return this.http.get<LineaApiResponse<Linea[]>>(`${this.apiUrl}/`);
  }

  crear(linea: LineaPayload): Observable<LineaApiResponse<Linea>> {
    return this.http.post<LineaApiResponse<Linea>>(`${this.apiUrl}/`, linea);
  }

  obtenerEquiposTelefonoDisponibles(): Observable<LineaApiResponse<EquipoTelefono[]>> {
    return this.http.get<LineaApiResponse<EquipoTelefono[]>>(`${this.apiUrl}/equipos-telefono`);
  }

  buscarLineas(termino: string): Observable<LineaApiResponse<Linea[]>> {
    return this.http.get<LineaApiResponse<Linea[]>>(`${this.apiUrl}/buscar`, { params: { termino } });
  }

  transferirLinea(payload: CambioLineaPayload): Observable<LineaApiResponse<Linea>> {
    return this.http.post<LineaApiResponse<Linea>>(`${this.apiUrl}/transferir`, payload);
  }

  actualizar(serviceTag: string, linea: LineaPayload): Observable<LineaApiResponse<Linea>> {
    return this.http.put<LineaApiResponse<Linea>>(`${this.apiUrl}/${encodeURIComponent(serviceTag)}`, linea);
  }

  eliminar(serviceTag: string): Observable<LineaApiResponse<void>> {
    return this.http.delete<LineaApiResponse<void>>(`${this.apiUrl}/${encodeURIComponent(serviceTag)}`);
  }

  exportar(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/exportar`, { responseType: 'blob' });
  }

  cargarDesdeExcel(archivo: File): Observable<ResultadoCargaLineas> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<ResultadoCargaLineas>(`${this.apiUrl}/cargar-excel`, formData);
  }
}
