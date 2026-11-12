import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, Equipo } from '../models/equipos.model';
import { Produccion, HistorialProduccion } from '../models/produccion.models';

@Injectable({ providedIn: 'root' })
export class ProduccionService {
  private apiUrl = '/api/produccion';

  constructor(private http: HttpClient) {}

  crear(serviceTag: string): Observable<ApiResponse<Produccion>> {
    return this.http.post<ApiResponse<Produccion>>(`${this.apiUrl}/equipos`, { Service_Tag: serviceTag });
  }

  obtenerEquiposDisponibles(): Observable<ApiResponse<Equipo[]>> {
    return this.http.get<ApiResponse<Equipo[]>>(`${this.apiUrl}/equipos-disponibles`);
  }

  obtenerEquiposEnProduccion(): Observable<ApiResponse<Equipo[]>> {
    return this.http.get<ApiResponse<Equipo[]>>(`${this.apiUrl}/equipos`);
  }

  liberarEquipo(equipo: Equipo | string, detalle: string): Observable<ApiResponse<Produccion>> {
    const serviceTag = typeof equipo === 'string' ? equipo : equipo.Service_Tag;
    return this.http.request<ApiResponse<Produccion>>('DELETE', `${this.apiUrl}/equipos/${encodeURIComponent(serviceTag)}`, {
      body: { Detalle: detalle }
    });
  }

  liberarTodos(detalle: string): Observable<ApiResponse<Produccion[]>> {
    return this.http.request<ApiResponse<Produccion[]>>('DELETE', `${this.apiUrl}/equipos`, {
      body: { Detalle: detalle }
    });
  }

  obtenerRegistros(): Observable<ApiResponse<HistorialProduccion[]>> {
    return this.http.get<ApiResponse<HistorialProduccion[]>>(`${this.apiUrl}/`);
  }

  enviarEquipos(equipos: Equipo[] | string[]): Observable<ApiResponse<Produccion[]>> {
    return this.http.post<ApiResponse<Produccion[]>>(`${this.apiUrl}/enviar`, {
      Service_Tags: this.serviceTags(equipos)
    });
  }
  HistorialProduccion(): Observable<ApiResponse<HistorialProduccion[]>> {
     return this.http.get<ApiResponse<HistorialProduccion[]>>(`${this.apiUrl}/historial`);
   }
 

  liberarSeleccionados(equipos: Equipo[] | string[], detalle: string): Observable<ApiResponse<Produccion[]>> {
    return this.http.post<ApiResponse<Produccion[]>>(`${this.apiUrl}/equipos/liberar-seleccionados`, {
      Service_Tags: this.serviceTags(equipos),
      Detalle: detalle
    });
  }

  private serviceTags(equipos: Equipo[] | string[]): string[] {
    return equipos.map(equipo => typeof equipo === 'string' ? equipo : equipo.Service_Tag);
  }
}
