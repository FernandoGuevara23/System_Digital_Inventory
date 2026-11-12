export interface EquipoProyecto {
  id: string;
  equipo_id: string;
  proyecto_id?: number | null;
  nombre_proyecto: string | null;
}
