import { CommonModule } from '@angular/common';
import { Component, HostListener, signal, Signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppDialog, DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-dialog-host',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dialog-host.component.html',
  styleUrl: './dialog-host.component.css'
})
export class DialogHostComponent {
  readonly dialog: Signal<AppDialog | null>;
  readonly promptValue = signal('');

  constructor(private readonly dialogService: DialogService) {
    this.dialog = dialogService.currentDialog;
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    if (this.dialog()) {
      this.dialogService.close(null);
      this.promptValue.set('');
    }
  }

  cerrar(): void {
    this.dialogService.close(null);
    this.promptValue.set('');
  }

  aceptar(dialog: AppDialog): void {
    if (dialog.kind === 'prompt') {
      const value = this.promptValue().trim();
      if (!value) {
        return;
      }
      this.dialogService.close(value);
    } else {
      this.dialogService.close(true);
    }
    this.promptValue.set('');
  }
}
