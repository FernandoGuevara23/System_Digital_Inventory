import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'orange';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.css'
})
export class AlertComponent implements OnChanges, OnDestroy {
  @Input() type: AlertType = 'info';
  @Input() title = '';
  @Input() message = '';
  @Input() dismissible = true;
  @Input() duration = 4000;
  @Output() dismissed = new EventEmitter<void>();
  private timeoutId: ReturnType<typeof setTimeout> | undefined;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['message'] && this.message) {
      this.iniciarTemporizador();
    }
  }

  ngOnDestroy(): void {
    this.limpiarTemporizador();
  }

  cerrar(): void {
    this.limpiarTemporizador();
    this.dismissed.emit();
  }

  private iniciarTemporizador(): void {
    this.limpiarTemporizador();
    if (this.duration > 0) {
      this.timeoutId = setTimeout(() => this.cerrar(), this.duration);
    }
  }

  private limpiarTemporizador(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
  private Esnumerotelefono(numero: string): boolean {
    const regex = /^\d{10}$/;
    return regex.test(numero);
  }
}
