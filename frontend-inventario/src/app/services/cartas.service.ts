import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  ApiResponse,
  CartaResponsiva,
  CartaResponsivaFilters,
  EquipoCompartidoCarta,
  PersonaCarta
} from '../models/cartas.model';
import { Empleado, EquipoAsignado } from '../models/empleados.model';
import { Equipo } from '../models/equipos.model';
import { DialogService } from '../shared/services/dialog.service';

@Injectable({
  providedIn: 'root'
})
export class CartaResponsivaService {
  private readonly apiUrl = '/api/cartas';

  constructor(
    private readonly http: HttpClient,
    private readonly dialogs: DialogService
  ) {}

  construirPayload(
    equipo: Equipo | EquipoAsignado,
    titular: Empleado,
    tipoCarta: 'INDIVIDUAL' | 'COMPARTIDA',
    companeros: Empleado[] = []
  ): Record<string, unknown> {
    const personas = tipoCarta === 'COMPARTIDA' ? companeros : [];
    const payload: Record<string, unknown> = {
      service_tag: equipo.Service_Tag,
      device_type: equipo.Tipo_Equipo,
      payroll_titular: titular.Payroll,
      nombre_titular: titular.Full_Name,
      position: titular.Position,
      department: titular.Departament,
      marca: equipo.Marca,
      modelo: equipo.Modelo,
      hardware_description: equipo.Comments || equipo.Tipo_Equipo,
      accesorios: equipo.Accesorios || '',
      tipo_carta: tipoCarta,
      notas: tipoCarta === 'COMPARTIDA'
        ? [
            'Equipo compartido con:',
            ...personas.map((persona) =>
              `- ${persona.Full_Name} (Payroll: ${persona.Payroll}) | Posición: ${persona.Position || 'No especificada'} | Departamento: ${persona.Departament || 'No especificado'}`
            )
          ].join('\n')
        : '',
      observaciones: tipoCarta === 'COMPARTIDA'
        ? `Compartida con ${personas.length} personas adicionales`
        : '',
      correo: titular.Correo ?? null,
      co_responsables: personas.map((persona) => ({
        payroll: persona.Payroll,
        nombre: persona.Full_Name,
        correo: persona.Correo ?? null,
        position: persona.Position,
        department: persona.Departament
      }))
    };

    if (personas.length) {
      payload['payroll_secundario'] = personas[0].Payroll;
      payload['nombre_secundario'] = personas[0].Full_Name;
      payload['correo_secundario'] = personas[0].Correo ?? null;
    }

    return payload;
  }

  listar(filtros: CartaResponsivaFilters = {}): Observable<ApiResponse<CartaResponsiva[]>> {
    let params = new HttpParams();

    if (filtros.service_tag) params = params.set('service_tag', filtros.service_tag);
    if (filtros.payroll) params = params.set('payroll', filtros.payroll);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.tipo_carta) params = params.set('tipo_carta', filtros.tipo_carta);
    if (filtros.hostname) params = params.set('hostname', filtros.hostname);
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.page !== undefined) params = params.set('page', String(filtros.page));
    if (filtros.page_size !== undefined) params = params.set('page_size', String(filtros.page_size));

    return this.http.get<ApiResponse<CartaResponsiva[]>>(this.apiUrl, { params });
  }

  resumenEquipos(payroll?: number | string, serviceTag?: string): Observable<ApiResponse<CartaResponsiva[]>> {
    let params = new HttpParams();
    if (payroll !== undefined) params = params.set('payroll', String(payroll));
    if (serviceTag) params = params.set('service_tag', serviceTag);
    return this.http.get<ApiResponse<CartaResponsiva[]>>(`${this.apiUrl}/resumen-equipos`, { params });
  }

  buscarCartaActiva(serviceTag: string): Observable<ApiResponse<CartaResponsiva | null>> {
    return this.buscarCarta(serviceTag, true);
  }

  buscarCartaReciente(serviceTag: string): Observable<ApiResponse<CartaResponsiva | null>> {
    return this.buscarCarta(serviceTag, false);
  }

  cartaRecienteDeEquipo(cartas: CartaResponsiva[], serviceTag: string): CartaResponsiva | null {
    const serviceTagNormalizado = serviceTag.trim().toLocaleUpperCase();
    return cartas
      .filter((carta) => carta.service_tag.trim().toLocaleUpperCase() === serviceTagNormalizado)
      .reduce<CartaResponsiva | null>(
        (reciente, carta) => !reciente || carta.id > reciente.id ? carta : reciente,
        null
      );
  }

  private buscarCarta(
    serviceTag: string,
    soloActiva: boolean
  ): Observable<ApiResponse<CartaResponsiva | null>> {
    const serviceTagNormalizado = serviceTag.trim().toLocaleUpperCase();
    return this.listar({ service_tag: serviceTag }).pipe(
      map((respuesta) => ({
        ...respuesta,
        data: (respuesta.data ?? []).find((carta) =>
          carta.service_tag.trim().toLocaleUpperCase() === serviceTagNormalizado
          && (!soloActiva || this.esCartaActiva(carta))
        ) ?? null
      }))
    );
  }

  equiposCompartidosDeEmpleado(
    cartas: CartaResponsiva[],
    payroll: number | string
  ): EquipoCompartidoCarta[] {
    const payrollBuscado = String(payroll).trim();
    const equiposCompartidos: EquipoCompartidoCarta[] = [];
    const serviceTags = new Set<string>();

    for (const carta of cartas) {
      if (!this.esCartaCompartidaActiva(carta)) {
        continue;
      }

      const datos = carta.datos_json;
      const coResponsables = this.coResponsablesDeCarta(carta);

      const esCompartido = coResponsables.some(
        (persona) => String(persona.payroll ?? '').trim() === payrollBuscado
      );
      const serviceTag = carta.service_tag.trim().toLocaleUpperCase();
      if (!esCompartido || serviceTags.has(serviceTag)) {
        continue;
      }

      serviceTags.add(serviceTag);
      const brandModel = datos?.brand_model
        || `${datos?.marca ?? ''} ${datos?.modelo ?? ''}`.trim();
      equiposCompartidos.push({
        id: carta.id,
        service_tag: carta.service_tag,
        device_type: carta.device_type,
        brand_model: brandModel || carta.device_type,
        payroll_titular: carta.payroll_titular,
        nombre_titular: carta.nombre_titular,
        estado: carta.estado,
        compartido_con: coResponsables
      });
    }

    return equiposCompartidos;
  }

  personasCompartidasDeEquipo(cartas: CartaResponsiva[], serviceTag: string): PersonaCarta[] {
    const serviceTagBuscado = serviceTag.trim().toLocaleUpperCase();
    const carta = cartas.find(
      (item) => this.esCartaCompartidaActiva(item)
        && item.service_tag.trim().toLocaleUpperCase() === serviceTagBuscado
    );
    return carta ? this.coResponsablesDeCarta(carta) : [];
  }

  private esCartaCompartidaActiva(carta: CartaResponsiva): boolean {
    return carta.tipo_carta === 'COMPARTIDA'
      && this.esCartaActiva(carta);
  }

  private esCartaActiva(carta: CartaResponsiva): boolean {
    return carta.estado === 'SIN_ENVIAR'
      || carta.estado === 'ENVIADO'
      || carta.estado === 'FIRMADA';
  }

  coResponsablesDeCarta(carta: CartaResponsiva): PersonaCarta[] {
    const datos = carta.datos_json;
    let coResponsables = datos?.co_responsables;
    if (!Array.isArray(coResponsables)) {
      coResponsables = datos?.co_responsable ? [datos.co_responsable] : [];
    }
    if (!coResponsables.length && carta.payroll_secundario) {
      coResponsables = [{
        payroll: carta.payroll_secundario,
        nombre: carta.nombre_secundario ?? null
      }];
    }
    return coResponsables;
  }

  enviar(payload: Partial<CartaResponsiva> & Record<string, unknown>): Observable<ApiResponse<CartaResponsiva>> {
    return this.http.post<ApiResponse<CartaResponsiva>>(`${this.apiUrl}/enviar`, payload);
  }

  generar(payload: Partial<CartaResponsiva> & Record<string, unknown>): Observable<ApiResponse<CartaResponsiva>> {
    return this.http.post<ApiResponse<CartaResponsiva>>(`${this.apiUrl}/generar`, payload);
  }

  enviarCarta(id: number, confirmarReenvio = false): Observable<ApiResponse<CartaResponsiva>> {
    return this.http.post<ApiResponse<CartaResponsiva>>(`${this.apiUrl}/${id}/enviar`, {
      confirmar_reenvio: confirmarReenvio
    });
  }

  marcarFirmada(id: number): Observable<ApiResponse<CartaResponsiva>> {
    return this.http.patch<ApiResponse<CartaResponsiva>>(`${this.apiUrl}/${id}/marcar-firmada`, {});
  }

  verPdf(id: number): void {
    const ventana = window.open('', '_blank');
    if (!ventana) {
      void this.dialogs.alert(
        'El navegador bloqueó la ventana del PDF. Permite las ventanas emergentes e inténtalo de nuevo.',
        'No se pudo abrir el PDF',
        'error'
      );
      return;
    }

    const url = `${this.apiUrl}/${id}/pdf`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const pdfUrl = URL.createObjectURL(blob);
        ventana.location.href = pdfUrl;
      },
      error: () => {
        ventana.close();
        void this.dialogs.alert('No se pudo cargar la carta PDF.', 'Error al cargar el PDF', 'error');
      }
    });
  }
}
