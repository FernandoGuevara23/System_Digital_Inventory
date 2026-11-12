import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, Equipo } from '../models/equipos.model';
import { Venta, HistorialVenta} from '../models/ventas.models';

@Injectable({ providedIn: 'root' })
export class VentasService {
  private apiUrl = '/api/ventas';

  constructor(private http: HttpClient) {}

  crear(serviceTag: string): Observable<ApiResponse<Venta>> {
    return this.http.post<ApiResponse<Venta>>(`${this.apiUrl}/equipos`, { Service_Tag: serviceTag });
  }

  obtenerEquiposDisponibles(): Observable<ApiResponse<Equipo[]>> {
    return this.http.get<ApiResponse<Equipo[]>>(`${this.apiUrl}/equipos-disponibles`);
  }

  obtenerEquiposEnVentas(): Observable<ApiResponse<Equipo[]>> {
    return this.http.get<ApiResponse<Equipo[]>>(`${this.apiUrl}/equipos`);
  }

  liberarEquipo(equipo: Equipo | string, detalle: string): Observable<ApiResponse<Venta>> {
    const serviceTag = typeof equipo === 'string' ? equipo : equipo.Service_Tag;
    return this.http.request<ApiResponse<Venta>>('DELETE', `${this.apiUrl}/equipos/${encodeURIComponent(serviceTag)}`, {
      body: { Detalle: detalle }
    });
  }

  liberarTodos(detalle: string): Observable<ApiResponse<Venta[]>> {
    return this.http.request<ApiResponse<Venta[]>>('DELETE', `${this.apiUrl}/equipos`, {
      body: { Detalle: detalle }
    });
  }

  obtenerRegistros(): Observable<ApiResponse<HistorialVenta[]>> {
    return this.http.get<ApiResponse<HistorialVenta[]>>(`${this.apiUrl}/`);
  }

  enviarEquipos(equipos: Equipo[] | string[]): Observable<ApiResponse<Venta[]>> {
    return this.http.post<ApiResponse<Venta[]>>(`${this.apiUrl}/enviar`, {
      Service_Tags: this.serviceTags(equipos)
    });
  }
  HistorialVenta(): Observable<ApiResponse<HistorialVenta[]>> {
     return this.http.get<ApiResponse<HistorialVenta[]>>(`${this.apiUrl}/historial`);
   }
 

  liberarSeleccionados(equipos: Equipo[] | string[], detalle: string): Observable<ApiResponse<Venta[]>> {
    return this.http.post<ApiResponse<Venta[]>>(`${this.apiUrl}/equipos/liberar-seleccionados`, {
      Service_Tags: this.serviceTags(equipos),
      Detalle: detalle
    });
  }

  private serviceTags(equipos: Equipo[] | string[]): string[] {
    return equipos.map(equipo => typeof equipo === 'string' ? equipo : equipo.Service_Tag);
  }
}
