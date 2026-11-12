export interface Equipo {
  Service_Tag: string;
  Hostname?: string | null;
  MAC?: string | null;
  Payroll: number | null;
  Tipo_Equipo: string;
  Tipo_Equipo_Id?: number | null;
  Marca: string;
  Modelo: string;
  IMEI?: string;
  Numero_Telefono?: string;
  Account?: string;
  Apple_ID?: string;
  Password_apple?: string;
  MQ_Asset?: string;
  Accesorios?: string;
  Location?: string;
  Comments?: string;
  Trace?: string;
  Estado?: string;
  Payroll_Anterior?: number | null;
  Nombre_Empleado_Anterior?: string | null;
  Proyecto?: string;
  Empleado?: {
    Payroll: number;
    Full_Name: string;
  };
  Fecha_Creacion?: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface EquiposQuery {
  page: number;
  page_size: number;
  q?: string;
  view?: 'todos' | 'disponibles' | 'asignados' | 'proyectos';
  category?: string;
  carta_filter?: 'TODOS' | 'INDIVIDUAL' | 'COMPARTIDA' | 'SIN_ENVIAR';
}

export interface EquiposResponse extends ApiResponse<Equipo[]> {
  total?: number;
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
  counts?: {
    registros: number;
    total: number;
    disponibles: number;
    asignados: number;
    con_proyecto: number;
  };
}

export interface EquipoLiberado {
  id: number | string;
  Service_Tag: string;
  Hostname: string | null;
  MAC: string | null;
  Payroll: number | null;
  Nombre_Empleado: string | null;
  Accion: string;
  Detalle: string;
  Payroll_Anterior: number | null;
  Nombre_Empleado_Anterior: string | null;
  Marca: string | null;
  Modelo: string | null;
  Tipo_Equipo: string | null;
  Numero_Telefono: string | null;
  Account: string | null;
  Apple_ID: string | null;
  Password_apple: string | null;
  Total_cuenta: number | null;
  Estado_Telefono: string | null;
  MQ_Asset: string | null;
  IMEI: string | null;
  Location: string | null;
  Tipo_Liberacion: string | null;
  Fecha: string;
  Fecha_Liberacion: string | null;
  Origen?: 'Actual' | 'Histórico' | 'Scrap' | 'Donación';
  Estado_Equipo?: string | null;
}

export interface MovimientoEquipo {
  Id: number;
  Service_Tag: string;
  Hostname: string | null;
  Accion: string;
  Detalle: string;
  Payroll_Anterior: number | null;
  Nombre_Empleado_Anterior: string | null;
  Payroll_Nuevo: number | null;
  Nombre_Empleado_Nuevo: string | null;
  Usuario?: string | null;
  Fecha: string;
}

export interface ReporteEquiposPorEmpleado {
  Payroll: number;
  Full_Name: string;
  Tipo_Equipo: string;
  Marca: string;
  Modelo: string;
  Service_Tag: string;
  Fecha_Creacion: Date;
  Hostname: string | null;
}

export interface ModelosEquipos {
  Model: string;
  Cantidad: number;
}

export interface EquipoModeloDetalle {
  Modelo: string;
  Tipo_Equipo: string;
  Hostname: string | null;
  Service_Tag: string;
}

export interface ModeloEquipoHostname {
  ultimo: string;
  siguiente: string;
}

export interface ModelosEquiposDashboard {
  modelos: {
    latitude: ModelosEquipos[];
    optiplex: ModelosEquipos[];
    precision: ModelosEquipos[];
  };
  hostnames: {
    latitude: ModeloEquipoHostname;
    optiplex: ModeloEquipoHostname;
    precision: ModeloEquipoHostname;
  };
}
