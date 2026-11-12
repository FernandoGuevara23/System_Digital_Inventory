import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {Departamento } from '../models/departamento.model';
import { ApiResponse } from '../models/empleados.model';

@Injectable({
  providedIn: 'root'
})
export class DepartamentosService {
  constructor(private http: HttpClient) {}

  obtenerTodos(): Observable<ApiResponse<Departamento[]>> {
    return this.http.get<ApiResponse<Departamento[]>>(
      '/api/departamentos/'
    );
  }

  crear(datos: Partial<Departamento>): Observable<ApiResponse<Departamento>> {
    return this.http.post<ApiResponse<Departamento>>('/api/departamentos/', datos);
  }
  actualizar(id: number, datos: Partial<Departamento>): Observable<ApiResponse<Departamento>> {
    return this.http.put<ApiResponse<Departamento>>(`/api/departamentos/${id}`, datos);
  }
  eliminar(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`/api/departamentos/${id}`);
  }
}