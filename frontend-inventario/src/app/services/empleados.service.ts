import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Empleado, ApiResponse } from '../models/empleados.model';

@Injectable({
  providedIn: 'root'
})
export class EmpleadosService {
  private apiUrl = '/api/empleados';

  constructor(private http: HttpClient) {}

  obtenerTodos(): Observable<ApiResponse<Empleado[]>> {
    return this.http.get<ApiResponse<Empleado[]>>(`${this.apiUrl}/`);
  }

  obtenerPorId(payroll: number): Observable<ApiResponse<Empleado>> {
    return this.http.get<ApiResponse<Empleado >>(`${this.apiUrl}/${payroll}`);
  }

  crear(empleado: FormData): Observable<ApiResponse<Empleado>> {
    return this.http.post<ApiResponse<Empleado>>(`${this.apiUrl}/`, empleado);
  }

  actualizar(payroll: number, datos: Partial<Empleado> | FormData): Observable<ApiResponse<Empleado>> {
    return this.http.put<ApiResponse<Empleado >>(`${this.apiUrl}/${payroll}`, datos);
  }

  eliminar(payroll: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/${payroll}`);
  }
  CargarExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    

    return this.http.post<any>(`${this.apiUrl}/cargar-excel`, formData);
  }
}



