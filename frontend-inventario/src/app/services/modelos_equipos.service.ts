import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, EquipoModeloDetalle, ModelosEquiposDashboard } from '../models/equipos.model';

@Injectable({
  providedIn: 'root'
})
export class ModelosEquiposService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  obtenerResumenDashboard(): Observable<ApiResponse<ModelosEquiposDashboard>> {
    return this.http.get<ApiResponse<ModelosEquiposDashboard>>(`${this.apiUrl}/equipos/dashboard`);
  }

  obtenerEquiposPorModelo(modelo: string): Observable<ApiResponse<EquipoModeloDetalle[]>> {
    return this.http.get<ApiResponse<EquipoModeloDetalle[]>>(
      `${this.apiUrl}/equipos/modelos/equipos`,
      { params: { modelo } }
    );
  }
}
