import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartaResponsiva, CartaEstado, CartaTipo, PersonaCarta } from '../../../../models/cartas.model';
import { CartaResponsivaService } from '../../../../services/cartas.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { DialogService } from '../../../../shared/services/dialog.service';
import { EmailSendingService } from '../../../../shared/services/email-sending.service';


@Component({
  selector: 'app-cartas-responsivas',
  standalone: true,
  imports: [CommonModule, FormsModule, AlertComponent],
  templateUrl: './cartas.component.html',
  styleUrl: './cartas.component.css'
})
export class CartasResponsivasComponent implements OnInit, OnDestroy {
  cartas: CartaResponsiva[] = [];
  cargando = true;
  cargandoCartaId: number | null = null;
  error = '';
  mensaje = '';

  termino = '';
  filtroEstado: CartaEstado | '' = '';
  filtroTipo: CartaTipo | '' = '';
  totalCartas = 0;
  paginaActual = 1;
  readonly cartasPorPagina = 50;
  totalPaginas = 0;

  estados: CartaEstado[] = ['SIN_ENVIAR', 'ENVIADO', 'FIRMADA', 'CERRADA'];
  private queryParamsSubscription?: Subscription;

  constructor(
    private readonly cartasService: CartaResponsivaService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    private readonly dialogs: DialogService,
    private readonly emailSendingService: EmailSendingService
  ) {}

  ngOnInit(): void {
    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      const estado = params.get('estado') ?? '';
      if (estado === '' || this.estados.includes(estado as CartaEstado)) {
        this.filtroEstado = estado as CartaEstado | '';
        this.cargarCartas();
      }
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
  }

  cargarCartas(): void {
    this.cargando = true;
    this.error = '';

    this.cartasService.listar({
      q: this.termino.trim(),
      estado: this.filtroEstado,
      tipo_carta: this.filtroTipo,
      page: this.paginaActual,
      page_size: this.cartasPorPagina
    }).subscribe({
      next: (respuesta) => {
        if (!respuesta.success) {
          this.cartas = [];
          this.totalCartas = 0;
          this.error = respuesta.error ?? 'El servidor no pudo cargar las cartas responsivas.';
          this.cargando = false;
          this.changeDetectorRef.markForCheck();
          return;
        }

        this.cartas = [...(Array.isArray(respuesta.data) ? respuesta.data : [])];
        this.totalCartas = respuesta.pagination?.total ?? this.cartas.length;
        this.totalPaginas = respuesta.pagination?.total_pages ?? 1;
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.cartas = [];
        this.totalCartas = 0;
        this.error = respuesta?.error?.error ?? 'No se pudieron cargar las cartas responsivas.';
        this.cargando = false;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  limpiarFiltros(): void {
    this.termino = '';
    this.filtroEstado = '';
    this.filtroTipo = '';
    this.paginaActual = 1;
    this.cargarCartas();
  }

  buscar(): void {
    this.cargarCartas();
  }

  actualizarFiltros(): void {
    this.paginaActual = 1;
    this.cargarCartas();
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas || this.cargando) return;
    this.paginaActual = pagina;
    this.cargarCartas();
  }

  cambiarTipo(tipo: CartaTipo | ''): void {
    if (this.filtroTipo === tipo) {
      return;
    }
    this.filtroTipo = tipo;
    this.actualizarFiltros();
  }

  get cartasFiltradas(): CartaResponsiva[] {
    return this.cartas;
  }

  numeroCarta(indicePagina: number): number {
    return Math.max(0, this.totalCartas - (this.paginaActual - 1) * this.cartasPorPagina - indicePagina);
  }

  async enviarCorreo(carta: CartaResponsiva): Promise<void> {
    const reenviar = carta.estado === 'ENVIADO';
    if (reenviar && !await this.dialogs.confirm(
      `La carta ${carta.id} ya fue enviada${carta.fecha_envio ? ` el ${new Date(carta.fecha_envio).toLocaleString()}` : ''}. ¿Deseas reenviarla a todos los destinatarios?`
    )) {
      return;
    }

    this.error = '';
    this.mensaje = '';
    this.enviarCorreoConfirmado(carta, reenviar);
  }

  private enviarCorreoConfirmado(carta: CartaResponsiva, confirmarReenvio: boolean): void {
    this.cargandoCartaId = carta.id;
    this.emailSendingService.begin();
    this.cartasService.enviarCarta(carta.id, confirmarReenvio).subscribe({
      next: (respuesta) => {
        this.emailSendingService.end();
        if (!respuesta.success) {
          this.error = respuesta.error ?? 'El servidor no pudo enviar la carta.';
          this.cargandoCartaId = null;
          this.changeDetectorRef.markForCheck();
          return;
        }
        this.mensaje = respuesta.message ?? 'Correo enviado correctamente.';
        this.cargandoCartaId = null;
        this.cargarCartas();
        this.changeDetectorRef.markForCheck();
      },
      error: async (respuesta) => {
        this.emailSendingService.end();
        if (respuesta?.error?.code === 'REQUIERE_CONFIRMACION_REENVIO' && !confirmarReenvio) {
          this.cargandoCartaId = null;
          const confirmar = await this.dialogs.confirm(
            'La carta ya fue enviada en otra sesión. ¿Deseas reenviarla a todos los destinatarios?'
          );
          if (confirmar) {
            this.enviarCorreoConfirmado(carta, true);
          } else {
            this.changeDetectorRef.markForCheck();
          }
          return;
        }
        this.error = respuesta?.error?.error ?? 'No se pudo enviar la carta.';
        this.cargandoCartaId = null;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  verCarta(carta: CartaResponsiva): void {
    this.cartasService.verPdf(carta.id);
  }

  async marcarFirmada(carta: CartaResponsiva): Promise<void> {
    if (!await this.dialogs.confirm(`¿Confirmas que la carta ${carta.id} ya fue firmada?`)) {
      return;
    }
    this.error = '';
    this.mensaje = '';
    this.cargandoCartaId = carta.id;
    this.cartasService.marcarFirmada(carta.id).subscribe({
      next: (respuesta) => {
        if (!respuesta.success) {
          this.error = respuesta.error ?? 'El servidor no pudo actualizar el estado de la carta.';
          this.cargandoCartaId = null;
          this.changeDetectorRef.markForCheck();
          return;
        }
        this.mensaje = 'Carta marcada como firmada correctamente.';
        this.cargandoCartaId = null;
        this.cargarCartas();
        this.changeDetectorRef.markForCheck();
      },
      error: (respuesta) => {
        this.error = respuesta?.error?.error ?? 'No se pudo marcar como firmada.';
        this.cargandoCartaId = null;
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  badgeClase(estado: CartaEstado): string {
    switch (estado) {
      case 'SIN_ENVIAR':
        return 'badge badge-danger';
      case 'ENVIADO':
        return 'badge badge-warning';
      case 'FIRMADA':
        return 'badge badge-success';
      case 'CERRADA':
        return 'badge badge-secondary';
      default:
        return 'badge';
    }
  }

  textoEstado(estado: CartaEstado): string {
    const mapa: Record<CartaEstado, string> = {
      SIN_ENVIAR: 'Sin Enviar',
      ENVIADO: 'Enviado',
      FIRMADA: 'Firmada',
      CERRADA: 'Cerrada'
    };
    return mapa[estado] ?? estado;
  }

  coResponsables(carta: CartaResponsiva): PersonaCarta[] {
    if (Array.isArray(carta.datos_json?.co_responsables)) {
      return carta.datos_json.co_responsables;
    }
    if (carta.nombre_secundario || carta.payroll_secundario) {
      return [{
        nombre: carta.nombre_secundario ?? null,
        payroll: carta.payroll_secundario ?? null
      }];
    }
    return [];
  }
  verPerfil(payroll: string | number): void {

  }
}
