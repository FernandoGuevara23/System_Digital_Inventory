export interface Notificacion {
  id: string;
  tipo: string;
  categoria: string;
  titulo: string;
  mensaje: string;
  estado?: string;
  url: string;
}

export interface NotificacionesResponse {
  success: boolean;
  data?: {
    items: Notificacion[];
    total: number;
  };
  error?: string;
}
