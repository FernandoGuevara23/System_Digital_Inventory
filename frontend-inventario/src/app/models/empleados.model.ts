export interface Empleado {
  Payroll: number;
  Full_Name: string;
  Foto_URL?: string;
  User_Name: string;
  Departament: string;
  Departamento_Id?: number | null;
  Area: string;
  Position: string;
  OUnit: string;
  Manager: string;
  CC: number;
  Estado: boolean;
  Correo?: string;
  Fecha_Creacion: Date;
  Fecha_Actualizacion: Date;
  Equipos?: EquipoAsignado[];
}

export interface EquipoAsignado {
  Service_Tag: string;
  Payroll?: number | null;
  Tipo_Equipo: string;
  Marca: string;
  Modelo: string;
  Numero_Serie: string;
  Numero_Telefono?: string;
  Account?: string;
  Apple_ID?: string;
  Password_apple?: string;
  MQ_Asset?: string;
  Accesorios?: string;
  MAC?: string;
  Location?: string;
  Comments?: string;
  Trace?: string;
  Estado?: string;
  Empleado?: {
    Payroll?: number;
    Full_Name?: string;
  } | null;
}
export interface ApiResponse<T> {
  mensaje: string;
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}