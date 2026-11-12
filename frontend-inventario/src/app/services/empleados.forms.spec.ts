import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { EmpleadosService } from './empleados.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { EmpleadosComponent } from '../modules/usuarios/pages/empleados/empleados.component';
import { EmpleadoPerfilComponent } from '../modules/usuarios/pages/empleado-perfil/empleado-perfil.component';
import { Empleado } from '../models/empleados.model';

describe('Formularios de empleados con contrato .NET', () => {
  let http: HttpTestingController;
  let service: EmpleadosService;
  const changeDetector = { markForCheck: vi.fn() };
  const employee = { Payroll: 10, Full_Name: 'Ana', Estado: true, Correo: 'ana@demo.test', Equipos: [] } as unknown as Empleado;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(EmpleadosService);
  });
  afterEach(() => http.verify());
  function listComponent(): EmpleadosComponent {
    return new EmpleadosComponent(new FormBuilder(), service, {} as any, changeDetector as any, {} as any, {} as any);
  }

  it('el formulario de alta envía los nombres y Estado como espera Flask', () => {
    const component = listComponent();
    component.empleadoForm.patchValue({ payroll: '10', full_name: 'Ana', departament: 'IT', cc: '100', correo: 'ana@demo.test', Estado: false });
    component.guardarEmpleado();
    const request = http.expectOne('/api/empleados/');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    const form = request.request.body as FormData;
    expect(form.get('payroll')).toBe('10');
    expect(form.get('full_name')).toBe('Ana');
    expect(form.get('cc')).toBe('100');
    expect(form.get('Estado')).toBe('false');
    request.flush({ success: true, data: employee });
    expect(component.error).toBe('');
    expect(component.empleados[0].Payroll).toBe(10);
  });

  it('el formulario de perfil manda solo Estado, Correo y foto', () => {
    const component = new EmpleadoPerfilComponent({} as any, {} as any, {} as any, service, new FormBuilder(), changeDetector as any, {} as any, {} as any);
    component.empleado = employee;
    component.edicionForm.patchValue({ Estado: false, Correo: 'nueva@demo.test' });
    const photo = new File(['png'], 'foto.png', { type: 'image/png' });
    component.fotoSeleccionada = photo;
    component.guardarEdicion();
    const request = http.expectOne('/api/empleados/10');
    expect(request.request.method).toBe('PUT');
    const form = request.request.body as FormData;
    expect([...form.keys()]).toEqual(['Estado', 'Correo', 'foto']);
    expect(form.get('foto')).toBe(photo);
    expect(form.get('Estado')).toBe('false');
    request.flush({ success: true, data: { ...employee, Estado: false, Foto_URL: '/api/empleados/fotos/nueva.png' } });
    expect(component.empleado?.Estado).toBe(false);
    expect(component.error).toBe('');
  });

  it('la carga desde la pantalla usa archivo y consume mensaje sin success', () => {
    const component = listComponent();
    const file = new File(['xlsx'], 'empleados.xlsx');
    component.archivoSeleccionado({ target: { files: [file], value: 'empleados.xlsx' } } as unknown as Event);
    const request = http.expectOne('/api/empleados/cargar-excel');
    expect(request.request.method).toBe('POST');
    expect((request.request.body as FormData).get('archivo')).toBe(file);
    request.flush({ mensaje: 'Se procesaron 1 empleados correctamente.' });
    http.expectOne('/api/empleados/').flush({ success: true, data: [employee], total: 1 });
    expect(component.cargandoExcel).toBe(false);
    expect(component.mensaje).toBe('Se procesaron 1 empleados correctamente.');
  });

  it('la pantalla muestra errores de Excel con el formato heredado', () => {
    const component = listComponent();
    component.archivoSeleccionado({ target: { files: [new File(['xlsx'], 'empleados.xlsx')], value: '' } } as unknown as Event);
    http.expectOne('/api/empleados/cargar-excel').flush({ error: 'El departamento no existe' }, { status: 500, statusText: 'Server Error' });
    expect(component.error).toBe('El departamento no existe');
    expect(component.cargandoExcel).toBe(false);
  });

  it('mantiene edición JSON, consulta por Payroll y DELETE', () => {
    service.actualizar(10, { Estado: false, Correo: '' }).subscribe();
    const edit = http.expectOne('/api/empleados/10');
    expect(edit.request.body).toEqual({ Estado: false, Correo: '' });
    edit.flush({ success: true, data: employee });
    service.obtenerPorId(10).subscribe(r => expect(r.data?.Payroll).toBe(10));
    http.expectOne('/api/empleados/10').flush({ success: true, data: employee });
    service.eliminar(10).subscribe();
    const remove = http.expectOne('/api/empleados/10');
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ success: true, message: 'Empleado desactivado correctamente' });
  });
});
