import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EquipoLiberado } from '../../../../models/equipos.model';
import { EquiposLiberadosService } from '../../../../services/equipos-liberados.service';

@Component({
  selector: 'app-historial-apple-id',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial-apple-id.component.html',
  styleUrl: './historial-apple-id.component.css'
})
export class HistorialAppleIdComponent implements OnInit {
  registros: EquipoLiberado[] = [];
  termino = '';
  cargando = true;
  error = '';

  constructor(
    private readonly equiposLiberadosService: EquiposLiberadosService,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.equiposLiberadosService.obtenerCatalogoTelefonos().subscribe({
      next: (respuesta) => {
        this.registros = respuesta.data ?? [];
        this.error = respuesta.success ? '' : (respuesta.error ?? 'No se pudo cargar el historial.');
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta.error?.error ?? 'No se pudo cargar el historial de teléfonos.';
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  get registrosFiltrados(): EquipoLiberado[] {
    const termino = this.termino.trim().toLowerCase();
    if (!termino) return this.registros;

    return this.registros.filter((registro) => [
      registro.Service_Tag,
      registro.Marca,
      registro.Modelo,
      registro.Numero_Telefono,
      registro.Account,
      registro.Apple_ID,
      registro.Password_apple,
      registro.IMEI,
      registro.Nombre_Empleado_Anterior,
      registro.Total_cuenta,
      registro.Tipo_Liberacion,
      registro.Origen
    ].some((valor) => String(valor ?? '').toLowerCase().includes(termino)));
  }
}
