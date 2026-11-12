import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideUsers as remixGroupFill,
  lucideRecycle as remixRecycleLine,
  lucideLayoutDashboard as remixDashboardLine,
  lucideHistory as remixHistoryLine,
  lucideArrowLeft as remixArrowLeftLine,
  lucideArrowRight as remixArrowRightLine,
  lucideMailPlus,
  lucideSettings as aspectsConfiguration,
  lucideLogOut as aspectsLogout,
} from '@ng-icons/lucide';
import { phosphorDevicesLight } from '@ng-icons/phosphor-icons/light';
import { phosphorGiftDuotone, phosphorDeviceMobileDuotone  } from '@ng-icons/phosphor-icons/duotone';
import { phosphorPhoneCallBold } from '@ng-icons/phosphor-icons/bold';
import { lucideRocket, lucideShoppingBag  } from '@ng-icons/lucide';
import { aspectsHome, aspectsDashboard, aspectsBundle } from '@ng-icons/ux-aspects';

export type Screen =
  | 'dashboard'
  | 'empleados'
  | 'equipos'
  | 'lineas'
  | 'modelos'
  | 'scrap'
  | 'donaciones'
  | 'produccion'
  | 'ventas'
  | 'historial'
  | 'cartas-responsivas'
  | 'configuracion'
  | 'salir';


export interface NavItem {
  id: Screen;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  viewProviders: [provideIcons({ remixGroupFill, phosphorDevicesLight, aspectsBundle, remixRecycleLine, phosphorGiftDuotone, aspectsHome, phosphorDeviceMobileDuotone, phosphorPhoneCallBold, lucideMailPlus, lucideRocket, remixDashboardLine, remixHistoryLine, aspectsConfiguration, aspectsLogout, aspectsDashboard, remixArrowLeftLine, remixArrowRightLine, lucideShoppingBag })],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent {
  @Input() active: Screen = 'dashboard';
  @Input() collapsed = false;
  @Output() navigate = new EventEmitter<Screen>();
  @Output() toggleCollapse = new EventEmitter<void>();

 navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'remixDashboardLine' },
    { id: 'empleados', label: 'Empleados', icon: 'remixGroupFill' },
    { id: 'equipos', label: 'Equipos', icon: 'phosphorDevicesLight' },
    { id: 'lineas', label: 'Líneas', icon: 'phosphorPhoneCallBold' },
    { id: 'modelos', label: 'Modelos', icon: 'aspectsBundle' },
    { id: 'scrap', label: 'Scrap', icon: 'remixRecycleLine' },
    { id: 'donaciones', label: 'Donaciones', icon: 'phosphorGiftDuotone' },
    { id: 'produccion', label: 'Producción', icon: 'aspectsDashboard' },
    { id: 'ventas', label: 'Ventas', icon: 'lucideShoppingBag ' },
    { id: 'cartas-responsivas', label: 'Cartas Responsivas', icon: 'lucideMailPlus' },
    { id: 'historial', label: 'Historial', icon: 'remixHistoryLine' },
    { id: 'configuracion', label: 'Configuración', icon: 'aspectsConfiguration' },
    { id: 'salir', label: 'Salir', icon: 'aspectsLogout' },
  ];

  go(id: Screen) { this.navigate.emit(id); }
}
