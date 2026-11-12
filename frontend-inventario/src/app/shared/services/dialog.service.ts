import { Injectable, signal } from '@angular/core';

export type DialogKind = 'alert' | 'confirm' | 'prompt';
export type DialogSeverity = 'success' | 'error' | 'warning' | 'info' | 'orange';

export interface AppDialog {
  id: number;
  kind: DialogKind;
  title: string;
  message: string;
  placeholder: string;
  severity: DialogSeverity;
  resolve: (value: boolean | string | null) => void;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly currentDialog = signal<AppDialog | null>(null);
  private readonly queue: AppDialog[] = [];
  private nextId = 0;

  alert(message: string, title = 'Aviso', severity: DialogSeverity = 'info'): Promise<void> {
    return this.open('alert', message, title, severity).then(() => undefined);
  }

  confirm(
    message: string,
    title = 'Confirmar acción',
    severity: DialogSeverity = 'warning'
  ): Promise<boolean> {
    return this.open('confirm', message, title, severity).then((result) => result === true);
  }

  prompt(message: string, title = 'Agregar comentario', placeholder = 'Escribe el motivo'): Promise<string | null> {
    return this.open('prompt', message, title, 'info', placeholder).then((result) =>
      typeof result === 'string' ? result : null
    );
  }

  close(result: boolean | string | null): void {
    const active = this.currentDialog();
    if (!active) {
      return;
    }
    this.currentDialog.set(null);
    active.resolve(result);
    this.currentDialog.set(this.queue.shift() ?? null);
  }

  private open(
    kind: DialogKind,
    message: string,
    title: string,
    severity: DialogSeverity,
    placeholder = ''
  ): Promise<boolean | string | null> {
    return new Promise((resolve) => {
      const dialog: AppDialog = {
        id: ++this.nextId,
        kind,
        title,
        message,
        placeholder,
        severity,
        resolve
      };
      if (this.currentDialog()) {
        this.queue.push(dialog);
      } else {
        this.currentDialog.set(dialog);
      }
    });
  }
}
