import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, EquipoLiberado } from '../models/equipos.model';

@Injectable({
  providedIn: 'root'
})
export class EquiposLiberadosService {
  private readonly apiUrl = '/api/equipos-liberados';

  constructor(private readonly http: HttpClient) {}

  obtenerTelefonos(): Observable<ApiResponse<EquipoLiberado[]>> {
    return this.http.get<ApiResponse<EquipoLiberado[]>>(`${this.apiUrl}/telefonos`);
  }

  obtenerCatalogoTelefonos(): Observable<ApiResponse<EquipoLiberado[]>> {
    return this.http.get<ApiResponse<EquipoLiberado[]>>(`${this.apiUrl}/catalogo-telefonos`);
  }
}
