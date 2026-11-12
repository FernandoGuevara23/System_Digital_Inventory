import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class EmailSendingService {
  readonly isSending = signal(false);
  private activeRequests = 0;

  begin(): void {
    this.activeRequests += 1;
    this.isSending.set(true);
  }

  end(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.isSending.set(this.activeRequests > 0);
  }
}
