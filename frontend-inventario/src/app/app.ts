import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideBell, lucideMoon, lucideSun } from '@ng-icons/lucide';
import { filter, interval, Subscription } from 'rxjs';
import { SidebarComponent, Screen } from './modules/usuarios/pages/sidebar/sidebar.component';
import { UsuarioService } from './services/usuario.service';
import { NotificacionesService } from './services/notificaciones.service';
import { Notificacion } from './models/notificaciones.model';
import { DialogHostComponent } from './shared/components/dialog-host/dialog-host.component';
import { EmailSendingComponent } from './shared/components/email-sending/email-sending.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, NgIconComponent, DialogHostComponent, EmailSendingComponent],
  viewProviders: [provideIcons({ lucideBell, lucideMoon, lucideSun })],
  template: `
    <div class="app-shell" *ngIf="!isLoginRoute(); else publicPage" (click)="notificationsOpen = false">
      <app-sidebar
        [active]="activeScreen"
        [collapsed]="sidebarCollapsed"
        (navigate)="navigateTo($event)"
        (toggleCollapse)="sidebarCollapsed = !sidebarCollapsed"
      />
      <main class="app-content">
        <div class="content-toolbar">
          <div class="toolbar-actions">
          <div class="notification-center" (click)="$event.stopPropagation()">
            <button
              type="button"
              class="notification-toggle"
              [attr.aria-expanded]="notificationsOpen"
              aria-haspopup="true"
              [attr.aria-label]="'Notificaciones: ' + notificationCount + ' pendientes'"
              (click)="notificationsOpen = !notificationsOpen"
            >
              <ng-icon name="lucideBell" size="1.7rem" aria-hidden="true" />
              <span class="notification-badge" *ngIf="notificationCount > 0">
                {{ notificationCount > 99 ? '99+' : notificationCount }}
              </span>
            </button>
            <section
              class="notification-panel"
              *ngIf="notificationsOpen"
              aria-label="Notificaciones"
            >
              <header class="notification-panel-header">
                <div>
                  <h2>Notificaciones</h2>
                  <p *ngIf="notificationCount > 0">{{ notificationCount }} pendientes</p>
                </div>
                <span class="notification-panel-count" *ngIf="notificationCount > 0">
                  {{ notificationCount > 99 ? '99+' : notificationCount }}
                </span>
              </header>
              <p class="notification-error" *ngIf="notificationError" role="alert">
                {{ notificationError }}
              </p>
              <p class="notification-empty" *ngIf="notificationLoading && !notificationError">
                Cargando notificaciones...
              </p>
              <p class="notification-empty" *ngIf="!notificationLoading && !notificationError && notifications.length === 0">
                No hay notificaciones pendientes.
              </p>
              <button
                type="button"
                class="notification-item"
                *ngFor="let notification of notifications"
                (click)="openNotification(notification)"
              >
                <span class="notification-category">{{ notification.categoria }}</span>
                <strong>{{ notification.titulo }}</strong>
                <span>{{ notification.mensaje }}</span>
              </button>
              <p class="notification-overflow" *ngIf="notificationCount > notifications.length">
                Mostrando {{ notifications.length }} de {{ notificationCount }} notificaciones.
              </p>
            </section>
          </div>
          <button
            type="button"
            class="theme-toggle"
            [attr.aria-pressed]="isDarkMode"
            [attr.aria-label]="isDarkMode ? 'Activar modo claro' : 'Activar modo oscuro'"
            [title]="isDarkMode ? 'Activar modo claro' : 'Activar modo oscuro'"
            (click)="toggleTheme()"
          >
            <ng-icon [name]="isDarkMode ? 'lucideSun' : 'lucideMoon'" size="1.35rem" aria-hidden="true" />
          </button>
          </div>
        </div>
        <div *ngIf="logoutError" class="logout-error" role="alert">
          <span>{{ logoutError }}</span>
          <button type="button" aria-label="Cerrar" (click)="logoutError = ''">×</button>
        </div>
        <router-outlet />
      </main>
    </div>
    <ng-template #publicPage>
      <router-outlet />
    </ng-template>
    <app-dialog-host />
    <app-email-sending />
  `,
  styles: [`
    :host {
      --sidebar-bg: #069b93;
      --sidebar-hover: rgba(25, 131, 108, 0.12);
      --sidebar-active: #1a1111;
      display: block;
      min-height: 100vh;
      min-height: 100dvh;
    }

    .app-shell {
      display: flex;
      min-height: 100vh;
      min-height: 100dvh;
      background: #f4f7fb;
    }

    app-sidebar {
      display: block;
      height: 100vh;
      height: 100dvh;
      position: sticky;
      top: 0;
    }

    .app-content {
      flex: 1;
      min-width: 0;
      min-height: 100vh;
      min-height: 100dvh;
      background: #f4f7fb;
    }

    .content-toolbar {
      display: flex;
      height: 58px;
      align-items: center;
      justify-content: flex-end;
      padding: 0 clamp(16px, 2vw, 28px);
    }

    .notification-center {
      position: relative;
      z-index: 5;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .notification-toggle {
      align-items: center;
      background: #eff8f2;
      border: 1px solid #cfe4d8;
      border-radius: 14px;
      box-shadow: 0 3px 9px rgba(16, 33, 62, .09);
      color: #17694f;
      cursor: pointer;
      display: flex;
      height: 50px;
      justify-content: center;
      position: relative;
      width: 50px;
      transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease;
    }

    .notification-toggle:hover {
      background: #e5f3ea;
      border-color: #8fbea4;
      box-shadow: 0 4px 12px rgba(16, 33, 62, .13);
    }

    .notification-toggle[aria-expanded="true"] {
      background: #e5f3ea;
      border-color: #8fbea4;
      box-shadow: 0 0 0 3px rgba(36, 131, 101, .12);
    }

    .notification-toggle:focus-visible {
      outline: 3px solid rgba(36, 131, 101, .25);
      outline-offset: 2px;
    }

    .theme-toggle {
      align-items: center;
      background: #eff8f2;
      border: 1px solid #cfe4d8;
      border-radius: 14px;
      box-shadow: 0 3px 9px rgba(16, 33, 62, .09);
      color: #17694f;
      cursor: pointer;
      display: flex;
      height: 50px;
      justify-content: center;
      width: 50px;
      transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease;
    }

    .theme-toggle:hover {
      background: #e5f3ea;
      border-color: #8fbea4;
      box-shadow: 0 4px 12px rgba(16, 33, 62, .13);
    }

    .theme-toggle:focus-visible {
      outline: 3px solid rgba(36, 131, 101, .25);
      outline-offset: 2px;
    }

    .notification-badge {
      align-items: center;
      background: #dc2626;
      border-radius: 999px;
      color: #fff;
      display: inline-flex;
      font-size: 10px;
      font-weight: 700;
      justify-content: center;
      min-width: 21px;
      min-height: 21px;
      line-height: 1;
      padding: 3px 5px;
      position: absolute;
      top: -5px;
      right: -6px;
      box-shadow: 0 0 0 2px #f4f7fb;
    }

    .notification-panel {
      position: absolute;
      top: calc(100% + 9px);
      right: 0;
      width: min(370px, calc(100vw - 32px));
      max-height: min(66vh, 520px);
      overflow-y: auto;
      background: #fff;
      border: 1px solid #dce5ed;
      border-radius: 13px;
      box-shadow: 0 14px 36px rgba(16, 33, 62, .18);
      padding: 0 16px 12px;
    }

    .notification-panel-header {
      position: sticky;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid #e8edf2;
      background: #fff;
      padding: 15px 0 12px;
    }

    .notification-panel-header h2 {
      margin: 0;
      color: #10213e;
      font-size: 15px;
    }

    .notification-panel-header p {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 11px;
    }

    .notification-panel-count {
      min-width: 25px;
      border-radius: 999px;
      background: #eaf5ef;
      color: #17694f;
      font-size: 11px;
      font-weight: 700;
      padding: 5px 8px;
      text-align: center;
    }

    .notification-item {
      align-items: flex-start;
      background: transparent;
      border: 0;
      border-bottom: 1px solid #eef2f7;
      color: #334155;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 13px 8px;
      text-align: left;
      transition: background-color .15s ease;
      width: 100%;
    }

    .notification-item:hover {
      background: #f5faf7;
    }

    .notification-item:focus-visible {
      outline: 2px solid #248365;
      outline-offset: -2px;
    }

    .notification-category {
      color: #17694f;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .notification-item strong {
      color: #10213e;
      font-size: 13px;
    }

    .notification-item > span:last-child,
    .notification-empty,
    .notification-overflow,
    .notification-error {
      font-size: 12px;
      line-height: 1.45;
    }

    .notification-empty,
    .notification-overflow {
      color: #64748b;
    }

    .notification-empty {
      margin: 0;
      padding: 20px 8px;
      text-align: center;
    }

    .notification-overflow {
      margin: 10px 0 2px;
    }

    .notification-error {
      margin: 12px 0;
      border-radius: 8px;
      background: #fef2f2;
      color: #b91c1c;
      padding: 10px;
    }

    .logout-error {
      align-items: center;
      background: #fee2e2;
      color: #991b1b;
      display: flex;
      gap: 12px;
      justify-content: space-between;
      margin: 12px;
      padding: 10px 14px;
    }

    .logout-error button {
      background: none;
      border: 0;
      color: inherit;
      cursor: pointer;
      font-size: 18px;
    }

    @media (max-width: 700px) {
      app-sidebar {
        width: 64px;
      }

      .content-toolbar {
        height: 56px;
        padding: 0 12px;
      }

      .toolbar-actions {
        gap: 8px;
      }

      .notification-panel {
        width: min(370px, calc(100vw - 24px));
        max-height: min(68vh, 480px);
      }
    }

    @media (max-width: 380px) {
        .content-toolbar {
          padding-right: 9px;
          padding-left: 9px;
        }

        .notification-panel {
          width: calc(100vw - 18px);
          right: -3px;
          max-height: 70dvh;
        }
    }
  `]
})
export class App implements OnDestroy {
  private static readonly themeStorageKey = 'inventario-ti-theme';
  isDarkMode = localStorage.getItem(App.themeStorageKey) === 'dark';
  sidebarCollapsed = false;
  activeScreen: Screen = 'dashboard';
  logoutError = '';
  notifications: Notificacion[] = [];
  notificationCount = 0;
  notificationError = '';
  notificationLoading = true;
  notificationsOpen = false;
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly router: Router,
    private readonly usuarioService: UsuarioService,
    private readonly notificacionesService: NotificacionesService
  ) {
    this.applyTheme();
    this.updateActiveScreen(this.router.url);
    this.subscriptions.add(this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateActiveScreen(event.urlAfterRedirects);
        this.notificationsOpen = false;
        if (!this.isLoginRoute()) this.loadNotifications();
      }));
    this.subscriptions.add(interval(60_000).subscribe(() => {
      if (!this.isLoginRoute()) this.loadNotifications();
    }));
    if (!this.isLoginRoute()) this.loadNotifications();
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem(App.themeStorageKey, this.isDarkMode ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme(): void {
    document.documentElement.dataset['theme'] = this.isDarkMode ? 'dark' : 'light';
  }

  isLoginRoute(): boolean {
    return this.router.url.startsWith('/login');
  }

  navigateTo(screen: Screen): void {
    if (screen === 'salir') {
      this.logoutError = '';
      this.usuarioService.logout().subscribe({
        next: (respuesta) => {
          if (respuesta.success) {
            void this.router.navigate(['/login'], { replaceUrl: true });
          } else {
            this.logoutError = respuesta.error ?? 'No se pudo cerrar la sesión.';
          }
        },
        error: () => {
          this.logoutError = 'No se pudo contactar al servidor para cerrar la sesión.';
        }
      });
      return;
    }

    const paths: Record<Screen, string> = {
      dashboard: '/dashboard',
      empleados: '/empleados',
      equipos: '/equipos',
      lineas: '/lineas',
      modelos: '/modelos-equipos',
      scrap: '/scrap',
      donaciones: '/donaciones',
      produccion: '/produccion',
      ventas: '/ventas',
      'cartas-responsivas': '/cartas-responsivas',
      historial: '/historial',
      configuracion: '/configuracion',
      salir: '/login',
    };

    void this.router.navigate([paths[screen]]);
  }

  openNotification(notification: Notificacion): void {
    this.notificationsOpen = false;
    void this.router.navigateByUrl(notification.url);
  }

  private loadNotifications(): void {
    this.notificationLoading = true;
    this.notificacionesService.obtener().subscribe({
      next: (respuesta) => {
        this.notificationLoading = false;
        if (!respuesta.success || !respuesta.data) {
          this.notificationError = respuesta.error ?? 'No se pudieron cargar las notificaciones.';
          return;
        }
        this.notifications = respuesta.data.items;
        this.notificationCount = respuesta.data.total;
        this.notificationError = '';
      },
      error: () => {
        this.notificationLoading = false;
        this.notificationError = 'No se pudieron cargar las notificaciones.';
      }
    });
  }

  private updateActiveScreen(url: string): void {
    if (url.startsWith('/empleados')) this.activeScreen = 'empleados';
    else if (url.startsWith('/equipos')) this.activeScreen = 'equipos';
    else if (url.startsWith('/lineas')) this.activeScreen = 'lineas';
    else if (url.startsWith('/modelos-equipos')) this.activeScreen = 'modelos';
    else if (url.startsWith('/historial')) this.activeScreen = 'historial';
    else if (url.startsWith('/configuracion')) this.activeScreen = 'configuracion';
    else if (url.startsWith('/scrap')) this.activeScreen = 'scrap';
    else if (url.startsWith('/donaciones')) this.activeScreen = 'donaciones';
    else if (url.startsWith('/produccion')) this.activeScreen = 'produccion';
    else if (url.startsWith('/ventas')) this.activeScreen = 'ventas';
    else if (url.startsWith('/cartas-responsivas')) this.activeScreen = 'cartas-responsivas';
    else if (url.startsWith('/login')) this.activeScreen = 'salir';
    else this.activeScreen = 'dashboard';
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}