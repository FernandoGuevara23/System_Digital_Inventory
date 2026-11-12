export type CartaEstado = 'SIN_ENVIAR' | 'ENVIADO' | 'FIRMADA' | 'CERRADA';
export type CartaTipo = 'INDIVIDUAL' | 'COMPARTIDA';

export interface PersonaCarta {
  payroll: string | number | null;
  nombre: string | null;
  correo?: string | null;
  position?: string | null;
  department?: string | null;
}

export interface DatosSnapshotJSON {
  service_tag?: string;
  device_type?: string;
  payroll_titular?: string | number | null;
  nombre_titular?: string | null;
  hostname?: string | null;
  payroll_secundario?: string | number | null;
  nombre_secundario?: string | null;
  tipo_carta?: CartaTipo;
  estado?: CartaEstado;
  observaciones?: string | null;
  marca?: string;
  modelo?: string;
  brand_model?: string;
  titular?: PersonaCarta;
  co_responsable?: PersonaCarta | null;
  co_responsables?: PersonaCarta[];
  fecha_asignacion?: string | null;
  equipo?: {
    service_tag?: string;
    device_type?: string;
    observaciones?: string | null;
  };
  [key: string]: unknown;
}

export interface CartaResponsiva {
  id: number;
  service_tag: string;
  device_type: string;
  payroll_titular: string | number;
  nombre_titular: string;
  hostname?: string | null;
  payroll_secundario?: string | number | null;
  nombre_secundario?: string | null;
  tipo_carta: CartaTipo;
  estado: CartaEstado;
  fecha_envio?: string | null;
  fecha_firma?: string | null;
  observaciones?: string | null;
  datos_json?: DatosSnapshotJSON | null;
}

export interface EquipoCompartidoCarta {
  id: number;
  service_tag: string;
  device_type: string;
  brand_model: string;
  payroll_titular: string | number;
  nombre_titular: string;
  estado: CartaEstado;
  compartido_con: PersonaCarta[];
}

export interface CartaResponsivaFilters {
  service_tag?: string;
  payroll?: string;
  hostname?: string;
  estado?: CartaEstado | '';
  tipo_carta?: CartaTipo | '';
  q?: string;
  page?: number;
  page_size?: number;
}

export interface CartaPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  pagination?: CartaPagination;
}
