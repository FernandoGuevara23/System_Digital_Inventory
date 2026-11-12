import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DashboardComponent } from './dashboard.component';
import { DashboardResumen, DashboardService } from '../../../../services/dashboard.service';
import { UsuarioService } from '../../../../services/usuario.service';

describe('DashboardComponent', () => {
  const resumen: DashboardResumen = {
    empleados: { total: 12, activos: 10 },
    equipos: { inventario: 25, asignados: 18 },
    lineas: { total: 8, activas: 6 },
    pendientes: { scrap: 1, donaciones: 2, produccion: 3, ventas: 4 },
    movimientos: [{
      Id: 1,
      Service_Tag: 'ST-001',
      Hostname: 'PC-001',
      Accion: 'ASIGNACION',
      Detalle: 'Asignación a empleado',
      Payroll_Anterior: null,
      Nombre_Empleado_Anterior: null,
      Payroll_Nuevo: 1001,
      Nombre_Empleado_Nuevo: 'Ana Pérez',
      Fecha: '2026-10-30T12:00:00'
    }]
  };

  let obtenerUsuarioActual: ReturnType<typeof vi.fn>;
  let obtenerResumen: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    obtenerUsuarioActual = vi.fn().mockReturnValue({
      Id: 1,
      UserName: 'admin',
      Nombre_Completo: 'Administrador',
      Fecha_Creacion: new Date(),
      Fecha_Actualizacion: new Date()
    });
    obtenerResumen = vi.fn().mockReturnValue(of({ success: true, data: resumen }));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: UsuarioService, useValue: { obtenerUsuarioActual } },
        { provide: DashboardService, useValue: { obtenerResumen } }
      ]
    }).compileComponents();
  });

  it('loads the summary once and renders the counts and recent activity', () => {
    const fixture = TestBed.createComponent(DashboardComponent);

    fixture.detectChanges();

    expect(obtenerResumen).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.cargandoMovimientos).toBe(false);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.kpi-employees strong')?.textContent?.trim()).toBe('10');
    expect(element.querySelector('.kpi-equipment strong')?.textContent?.trim()).toBe('18');
    expect(element.querySelector('.kpi-lines strong')?.textContent?.trim()).toBe('6');
    expect(element.querySelector('.kpi-scrap strong')?.textContent?.trim()).toBe('1');
    expect(element.querySelector('.kpi-donations strong')?.textContent?.trim()).toBe('2');
    expect(element.querySelector('.kpi-production strong')?.textContent?.trim()).toBe('3');
    expect(element.querySelector('.kpi-sales strong')?.textContent?.trim()).toBe('4');
    expect(element.querySelector('.kpi-equipment small')?.textContent?.trim()).toBe('25 en inventario');
    expect(element.querySelector('.activity-item')?.textContent).toContain('ST-001');
    expect(element.querySelector('.activity-item strong')?.textContent).toBe('Equipo asignado');
  });

  it('redirects to login without requesting the summary when no session exists', () => {
    obtenerUsuarioActual.mockReturnValue(null);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(DashboardComponent);

    fixture.detectChanges();

    expect(obtenerResumen).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(fixture.componentInstance.error).toBe('La sesión no está disponible.');
  });

  it('shows a useful error and stops the activity spinner when the request fails', () => {
    obtenerResumen.mockReturnValue(throwError(
      () => new HttpErrorResponse({ status: 500 })
    ));
    const fixture = TestBed.createComponent(DashboardComponent);

    fixture.detectChanges();

    expect(fixture.componentInstance.cargandoMovimientos).toBe(false);
    expect(fixture.componentInstance.error).toBe(
      'No se pudieron cargar el resumen del dashboard (500).'
    );
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent)
      .toContain('(500)');
  });
});
