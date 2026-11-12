import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/equipos.model';
import { Proyecto } from '../models/proyecto.model';

@Injectable({ providedIn: 'root' })
export class ProyectosService {
  private apiUrl = '/api/proyectos';
  constructor(private http: HttpClient) {}
  obtenerTodos(): Observable<ApiResponse<Proyecto[]>> {
    return this.http.get<ApiResponse<Proyecto[]>>(`${this.apiUrl}/`);
  }
  crear(nombre: string): Observable<ApiResponse<Proyecto>> {
    return this.http.post<ApiResponse<Proyecto>>(`${this.apiUrl}/`, { Nombre_Proyecto: nombre });
  }
  actualizar(id: number, nombre: string): Observable<ApiResponse<Proyecto>> {
    return this.http.put<ApiResponse<Proyecto>>(`${this.apiUrl}/${id}`, { Nombre_Proyecto: nombre });
  }
  eliminar(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }
}
