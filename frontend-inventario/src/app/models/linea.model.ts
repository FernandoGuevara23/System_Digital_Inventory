export interface Linea {
  Service_Tag: string;
  Numero_Telefono: string | null;
  Account: string | null;
  Total_cuenta: number | null;
  Estado: 'Activa' | 'Suspendida' | 'Sin equipo';
  Estado_Linea: 'Activa' | 'Suspendida';
  Usuario: string | null;
  Payroll: number | null;
  CC: number | null;
  Equipo_En_Inventario: boolean;
}

export interface LineaPayload {
  Service_Tag?: string;
  Numero_Telefono?: string;
  Account?: string;
  Total_cuenta?: number | null;
  Estado?: 'Activa' | 'Suspendida';
}

export interface EquipoTelefono {
  Service_Tag: string;
  Tipo_Equipo: string;
  Marca: string;
  Modelo: string;
  Usuario: string | null;
  Payroll: number | null;
  CC: number | null;
  Tiene_Linea: boolean;
  Tiene_Datos_Linea: boolean;
  Puede_Registrar_Linea: boolean;
  Motivo_No_Registrable: string | null;
}

export interface LineaApiResponse<T> {
  success: boolean;
  data?: T;
  total?: number;
  message?: string;
  error?: string;
}

export interface CambioLineaPayload {
  Service_Tag_Origen: string;
  Service_Tag_Destino: string;
  UserName?: string;
}
export interface CambioLineaResponse {
  success: boolean;
  message: string;
  error?: string;
}
export interface ReporteLineas {
  Service_Tag: string;
  Numero_Telefono: string | null;
  Account: string | null;
  Total_cuenta: number | null;
  Estado: 'Activa' | 'Suspendida' | 'Sin equipo';
  Usuario: string | null;
  Payroll: number | null;
}
