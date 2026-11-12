import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NotificacionesResponse } from '../models/notificaciones.model';

@Injectable({
  providedIn: 'root'
})
export class NotificacionesService {
  private readonly apiUrl = '/api/notificaciones';

  constructor(private readonly http: HttpClient) {}

  obtener(): Observable<NotificacionesResponse> {
    return this.http.get<NotificacionesResponse>(this.apiUrl);
  }
}
