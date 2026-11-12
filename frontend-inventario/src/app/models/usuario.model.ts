export interface Usuario {
  Id: number;
  UserName: string;
  Nombre_Completo: string | null;
  Email?: string;
  Password?: string;
  Fecha_Creacion: Date;
  Fecha_Actualizacion: Date;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}