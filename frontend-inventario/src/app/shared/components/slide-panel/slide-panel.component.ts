import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-slide-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './slide-panel.component.html',
  styleUrls: ['./slide-panel.component.css'],
})
export class SlidePanelComponent {
  @Input() title = '';
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEsc() { this.closed.emit(); }
}
