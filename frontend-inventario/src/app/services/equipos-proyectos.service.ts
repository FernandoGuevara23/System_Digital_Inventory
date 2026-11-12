import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/equipos.model';
import { EquipoProyecto } from '../models/equipos-proyectos.model';

@Injectable({ providedIn: 'root' })
export class EquiposProyectosService {
  private apiUrl = '/api/equipos-proyectos';

  constructor(private http: HttpClient) {}

  obtenerTodos(): Observable<ApiResponse<EquipoProyecto[]>> {
    return this.http.get<ApiResponse<EquipoProyecto[]>>(`${this.apiUrl}/`);
  }

  asignar(equipoId: string, nombreProyecto: string): Observable<ApiResponse<EquipoProyecto>> {
    return this.http.post<ApiResponse<EquipoProyecto>>(`${this.apiUrl}/`, {
      equipo_id: equipoId,
      nombre_proyecto: nombreProyecto
    });
  }

  obtenerPorEquipo(equipoId: string): Observable<ApiResponse<EquipoProyecto[]>> {
    return this.http.get<ApiResponse<EquipoProyecto[]>>(`${this.apiUrl}/equipo/${encodeURIComponent(equipoId)}`);
  }

  obtenerPorProyecto(nombreProyecto: string): Observable<ApiResponse<EquipoProyecto[]>> {
    return this.http.get<ApiResponse<EquipoProyecto[]>>(`${this.apiUrl}/proyecto/${encodeURIComponent(nombreProyecto)}`);
  }

  eliminar(equipoId: string, nombreProyecto: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${encodeURIComponent(equipoId)}/${encodeURIComponent(nombreProyecto)}`);
  }
}
