export interface Venta {
  id: number;
  Service_Tag: string;
  Hostname?: string | null;
  Accion: string;
  Detalle: string;
  Payroll_Anterior: number | null;
  Nombre_Empleado_Anterior?: string | null;
  Usuario?: string | null;
  Fecha: string;
  Fecha_Liberacion?: string | null;
}
export interface ReporteVenta {
  id_venta?: number;
  Orden_Id: number;
  ids: number[];
  Fecha: string;
  Comentario: string;
  Usuario?: string | null;
  Total_Equipos: number;
  Equipos: Array<{
    id_venta: number;
    Service_Tag: string;
    Hostname?: string | null;
    Nombre_Empleado_Anterior?: string | null;
    Payroll_Anterior?: number | null;
    Marca?: string | null;
    Modelo?: string | null;
    Tipo_Equipo?: string | null;
  }>;
}
export interface HistorialVenta {
  Fecha_Liberacion: string;
  Detalle: string;
  Total_Equipos: number;
  Equipos: Venta[];
}
export interface ResumenVenta {
  por_tipo: Array<{ categoria: string; total: number }>;
  por_estado: Array<{ categoria: string; total: number }>;
  por_usuario: Array<{ categoria: string; total: number }>;
  total_equipos: number;
  total_ordenes: number;
}
