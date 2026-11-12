import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badge.component.html',
  styleUrls: ['./badge.component.css'],
})
export class BadgeComponent {
  @Input() status = '';

  get cls(): string {
    const map: Record<string, string> = {
      Activo: 'badge-green',
      Inactivo: 'badge-red',
      Disponible: 'badge-green',
      'En reparación': 'badge-amber',
      Baja: 'badge-red',
      Prestado: 'badge-cyan',
      Procesado: 'badge-purple',
      Pendiente: 'badge-amber',
      Entregado: 'badge-green',
      Cancelado: 'badge-red',
      Activa: 'badge-green',
      Suspendida: 'badge-red',
      Agregado: 'badge-green',
      Editado: 'badge-yellow',
      'Dado de baja': 'badge-red',
      Donado: 'badge-orange',
      'Envío a donación': 'badge-orange',
      'Enviado a recicladora': 'badge-orange',
      'Envío a Scrap': 'badge-orange',
      Producción: 'badge-orange',
      'Enviado a producción': 'badge-orange',
      'Envío a producción': 'badge-orange',
      Ventas: 'badge-orange',
      'Envío a ventas': 'badge-orange',
      'Enviado a ventas': 'badge-orange',
      Reasignación: 'badge-blue',
      Procesado2: 'badge-purple',
      'Carga masiva': 'badge-green',
      'Cambio de línea': 'badge-yellow',
      'Carta responsiva creada': 'badge-green',
      'Carta responsiva enviada': 'badge-blue',
      'Carta responsiva cerrada': 'badge-red ',
      
    };
    return map[this.status] ?? 'badge-gray';
  }
}
