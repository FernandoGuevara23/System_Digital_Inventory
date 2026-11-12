import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, Equipo } from '../models/equipos.model';
import { Donacion, HistorialDonacion } from '../models/donaciones.models';

@Injectable({ providedIn: 'root' })
export class DonacionesService {
  private apiUrl = '/api/donaciones';

  constructor(private http: HttpClient) {}

  crear(serviceTag: string): Observable<ApiResponse<Donacion>> {
    return this.http.post<ApiResponse<Donacion>>(`${this.apiUrl}/equipos`, { Service_Tag: serviceTag });
  }

  obtenerEquiposDisponibles(): Observable<ApiResponse<Equipo[]>> {
    return this.http.get<ApiResponse<Equipo[]>>(`${this.apiUrl}/equipos-disponibles`);
  }

  obtenerEquiposEnDonacion(): Observable<ApiResponse<Equipo[]>> {
    return this.http.get<ApiResponse<Equipo[]>>(`${this.apiUrl}/equipos`);
  }

  liberarEquipo(equipo: Equipo | string, detalle: string): Observable<ApiResponse<Donacion>> {
    const serviceTag = typeof equipo === 'string' ? equipo : equipo.Service_Tag;
    return this.http.request<ApiResponse<Donacion>>('DELETE', `${this.apiUrl}/equipos/${encodeURIComponent(serviceTag)}`, {
      body: { Detalle: detalle }
    });
  }

  liberarTodos(detalle: string): Observable<ApiResponse<Donacion[]>> {
    return this.http.request<ApiResponse<Donacion[]>>('DELETE', `${this.apiUrl}/equipos`, {
      body: { Detalle: detalle }
    });
  }

  obtenerRegistros(): Observable<ApiResponse<HistorialDonacion[]>> {
    return this.http.get<ApiResponse<HistorialDonacion[]>>(`${this.apiUrl}/`);
  }

  enviarEquipos(equipos: Equipo[] | string[]): Observable<ApiResponse<Donacion[]>> {
    return this.http.post<ApiResponse<Donacion[]>>(`${this.apiUrl}/enviar`, {
      Service_Tags: this.serviceTags(equipos)
    });
  }
  HistorialDonacion(): Observable<ApiResponse<HistorialDonacion[]>> {
     return this.http.get<ApiResponse<HistorialDonacion[]>>(`${this.apiUrl}/historial`);
   }
 

  liberarSeleccionados(equipos: Equipo[] | string[], detalle: string): Observable<ApiResponse<Donacion[]>> {
    return this.http.post<ApiResponse<Donacion[]>>(`${this.apiUrl}/equipos/liberar-seleccionados`, {
      Service_Tags: this.serviceTags(equipos),
      Detalle: detalle
    });
  }

  private serviceTags(equipos: Equipo[] | string[]): string[] {
    return equipos.map(equipo => typeof equipo === 'string' ? equipo : equipo.Service_Tag);
  }
}
