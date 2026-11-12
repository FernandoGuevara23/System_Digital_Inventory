import { Routes } from '@angular/router';
import { LoginComponent } from './modules/usuarios/pages/login/login.component';
import { DashboardComponent } from './modules/usuarios/pages/dashboard/dashboard.component';
import { EmpleadosComponent } from './modules/usuarios/pages/empleados/empleados.component';
import { EmpleadoPerfilComponent } from './modules/usuarios/pages/empleado-perfil/empleado-perfil.component';
import { EquiposComponent } from './modules/usuarios/pages/equipos/equipos.component';
import { EquipoDetallesComponent } from './modules/usuarios/pages/equipo-detalles/equipo-detalles.component';
import { authGuard } from './guards/auth.guard';
import { CatalogosComponent } from './modules/usuarios/pages/catalogos/catalogos.component';
import { HistorialComponent } from './modules/usuarios/pages/historial/historial.component';
import { ScrapComponent } from './modules/usuarios/pages/scrap/scrap.component';
import { ScrapHistorialComponent } from './modules/usuarios/pages/scrap-historial/scrap-historial.component';

import { DonacionesComponent } from './modules/usuarios/pages/donaciones/donaciones.component';
import { DonacionesHistorialComponent } from './modules/usuarios/pages/donaciones-historial/donaciones-historial.component';
import { ProduccionComponent } from './modules/usuarios/pages/produccion/produccion.component';
import { ProduccionHistorialComponent } from './modules/usuarios/pages/produccion-historial/produccion-historial.component';
import{ VentasComponent } from './modules/usuarios/pages/ventas/ventas.component';
import { VentasHistorialComponent } from './modules/usuarios/pages/ventas-historial/ventas-historial.component';
import { LineasComponent } from './modules/usuarios/pages/lineas/lineas.component';
import { ModelosEquiposComponent } from './modules/usuarios/pages/modelos-equipos/modelos-equipos.component';
import { CartasResponsivasComponent } from './modules/usuarios/pages/cartas/cartas.component';
import { ConfiguracionComponent } from './modules/usuarios/pages/configuracion/configuracion.component';
import { HistorialAppleIdComponent } from './modules/usuarios/pages/Historial_AppleID/historial-apple-id.component';
export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    canActivate: [authGuard],
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },
  {
    path: 'empleados',
    component: EmpleadosComponent,
    canActivate: [authGuard]
  },
  {
    path: 'empleados/:payroll',
    component: EmpleadoPerfilComponent,
    canActivate: [authGuard]
  },
  {
    path: 'equipos',
    component: EquiposComponent,
    canActivate: [authGuard]
  },
  {
    path: 'historial',
    component: HistorialComponent,
    canActivate: [authGuard]
  },
  { path: 'catalogos', component: CatalogosComponent, canActivate: [authGuard] },
  { path: 'scrap/historial', component: ScrapHistorialComponent, canActivate: [authGuard] },
  { path: 'scrap', component: ScrapComponent, canActivate: [authGuard] },
  { path: 'donaciones/historial', component: DonacionesHistorialComponent, canActivate: [authGuard] },
  { path: 'donaciones', component: DonacionesComponent, canActivate: [authGuard], pathMatch: 'full' },
  { path: 'produccion/historial', component: ProduccionHistorialComponent, canActivate: [authGuard] },
  { path: 'produccion', component: ProduccionComponent, canActivate: [authGuard] },
  { path: 'ventas/historial', component: VentasHistorialComponent, canActivate: [authGuard] },
  { path: 'ventas', component: VentasComponent, canActivate: [authGuard] },
  { path: 'lineas', component: LineasComponent, canActivate: [authGuard] },
  { path: 'modelos-equipos', component: ModelosEquiposComponent, canActivate: [authGuard] },
  { path: 'cartas-responsivas', component: CartasResponsivasComponent, canActivate: [authGuard] },
  { path: 'configuracion', component: ConfiguracionComponent, canActivate: [authGuard] },
  { path: 'historial-apple-id', component: HistorialAppleIdComponent, canActivate: [authGuard] },

  {
    path: 'equipos/:serviceTag',
    component: EquipoDetallesComponent,
    canActivate: [authGuard]
  }
];