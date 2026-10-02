import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { EstacionamentoService } from '../../../features/cadastro/services/estacionamento.service';
import { BrasilMapaComponent } from '../../../shared/maps/brasil-mapa.component';
import type { PontoMapa } from '../../../shared/maps/ponto-mapa.model';

@Component({
  selector: 'app-estacionamento-mapa-atalho',
  standalone: true,
  imports: [BrasilMapaComponent],
  templateUrl: './estacionamento-mapa-atalho.component.html',
  styleUrl: './estacionamento-mapa-atalho.component.scss'
})
export class EstacionamentoMapaAtalhoComponent {
  private readonly estacionamentoService = inject(EstacionamentoService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly aberto = signal(false);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly pontos = signal<PontoMapa[]>([]);

  toggle(): void {
    const abrir = !this.aberto();
    this.aberto.set(abrir);
    if (abrir) this.carregar();
  }

  @HostListener('document:click', ['$event'])
  fecharAoClicarFora(evento: MouseEvent): void {
    if (!this.aberto()) return;
    const alvo = evento.target;
    if (alvo instanceof Node && this.host.nativeElement.contains(alvo)) return;
    this.aberto.set(false);
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);
    this.estacionamentoService.listarMapa().subscribe({
      next: (pontos) => {
        this.pontos.set(pontos);
        this.carregando.set(false);
      },
      error: () => {
        this.pontos.set([]);
        this.erro.set('Não foi possível carregar as localizações.');
        this.carregando.set(false);
      }
    });
  }
}
