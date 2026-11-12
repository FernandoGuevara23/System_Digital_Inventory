import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, MovimientoEquipo } from '../models/equipos.model';

export interface DashboardResumen {
  empleados: {
    total: number;
    activos: number;
  };
  equipos: {
    inventario: number;
    asignados: number;
  };
  lineas: {
    total: number;
    activas: number;
  };
  pendientes: {
    scrap: number;
    donaciones: number;
    produccion: number;
    ventas: number;
  };
  movimientos: MovimientoEquipo[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly apiUrl = '/api/dashboard';

  constructor(private readonly http: HttpClient) {}

  obtenerResumen(): Observable<ApiResponse<DashboardResumen>> {
    return this.http.get<ApiResponse<DashboardResumen>>(this.apiUrl);
  }
}
