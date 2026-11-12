import { Component } from '@angular/core';
import { EmailSendingService } from '../../services/email-sending.service';

@Component({
  selector: 'app-email-sending',
  standalone: true,
  templateUrl: './email-sending.component.html',
  styleUrl: './email-sending.component.css'
})
export class EmailSendingComponent {
  readonly isSending: EmailSendingService['isSending'];

  constructor(private readonly emailSendingService: EmailSendingService) {
    this.isSending = emailSendingService.isSending;
  }
}
