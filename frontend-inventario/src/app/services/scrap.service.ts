import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, Equipo } from '../models/equipos.model';
import { HistorialScrap, Scrap } from '../models/scrap.model';

@Injectable({ providedIn: 'root' })
export class ScrapService {
  private apiUrl = '/api/scrap';

  constructor(private http: HttpClient) {}

  obtenerEquiposDisponibles(): Observable<ApiResponse<Equipo[]>> {
    return this.http.get<ApiResponse<Equipo[]>>(`${this.apiUrl}/equipos-disponibles`);
  }

  obtenerEquiposEnScrap(): Observable<ApiResponse<Equipo[]>> {
    return this.http.get<ApiResponse<Equipo[]>>(`${this.apiUrl}/equipos`);
  }

  liberarEquipo(equipo: Equipo | string, detalle: string): Observable<ApiResponse<Scrap>> {
    const serviceTag = typeof equipo === 'string' ? equipo : equipo.Service_Tag;
    return this.http.request<ApiResponse<Scrap>>('DELETE', `${this.apiUrl}/equipos/${encodeURIComponent(serviceTag)}`, {
      body: { Detalle: detalle }
    });
  }

  liberarTodos(detalle: string): Observable<ApiResponse<Scrap[]>> {
    return this.http.request<ApiResponse<Scrap[]>>('DELETE', `${this.apiUrl}/equipos`, {
      body: { Detalle: detalle }
    });
  }

  obtenerRegistros(): Observable<ApiResponse<HistorialScrap[]>> {
    return this.http.get<ApiResponse<HistorialScrap[]>>(`${this.apiUrl}/`);
  }

  enviarEquipos(
    equipos: Equipo[] | string[],
  ): Observable<ApiResponse<Scrap[]>> {
    return this.http.post<ApiResponse<Scrap[]>>(`${this.apiUrl}/enviar`, {
      Service_Tags: this.serviceTags(equipos),
    });
  }
  HistorialScrap(): Observable<ApiResponse<HistorialScrap[]>> {
    return this.http.get<ApiResponse<HistorialScrap[]>>(`${this.apiUrl}/historial`);
  }

  liberarSeleccionados(equipos: Equipo[] | string[], detalle: string): Observable<ApiResponse<Scrap[]>> {
    return this.http.post<ApiResponse<Scrap[]>>(`${this.apiUrl}/equipos/liberar-seleccionados`, {
      Service_Tags: this.serviceTags(equipos),
      Detalle: detalle
    });
  }

  private serviceTags(equipos: Equipo[] | string[]): string[] {
    return equipos.map(equipo => typeof equipo === 'string' ? equipo : equipo.Service_Tag);
  }
}
