import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {TipoEquipo } from '../models/tipos_equipo.models';
import { ApiResponse } from '../models/equipos.model';

@Injectable({
  providedIn: 'root'
})
export class TiposEquipoService {
    constructor(private http: HttpClient) {}

    obtenerTodos(): Observable<ApiResponse<TipoEquipo[]>> {
        return this.http.get<ApiResponse<TipoEquipo[]>>(
            '/api/tipo_equipos/'
        );
    }

    crear(nombre: string): Observable<ApiResponse<TipoEquipo>> {
        return this.http.post<ApiResponse<TipoEquipo>>('/api/tipo_equipos/', { Nombre_Tipo_Equipo: nombre });
    }
    actualizar(id: number, nombre: string): Observable<ApiResponse<TipoEquipo>> {
        return this.http.put<ApiResponse<TipoEquipo>>(`/api/tipo_equipos/${id}`, { Nombre_Tipo_Equipo: nombre });
    }
    eliminar(id: number): Observable<ApiResponse<void>> {
        return this.http.delete<ApiResponse<void>>(`/api/tipo_equipos/${id}`);
    }
}