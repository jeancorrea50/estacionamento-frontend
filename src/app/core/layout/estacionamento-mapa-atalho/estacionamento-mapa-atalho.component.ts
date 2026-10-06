import { Component, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { EstacionamentoService } from '../../../features/cadastro/services/estacionamento.service';
import { BrasilMapaComponent } from '../../../shared/maps/brasil-mapa.component';
import { ESTADOS_BRASIL, filtrarPontosMapa, type PontoMapa } from '../../../shared/maps/ponto-mapa.model';

@Component({
  selector: 'app-estacionamento-mapa-atalho',
  standalone: true,
  imports: [BrasilMapaComponent],
  templateUrl: './estacionamento-mapa-atalho.component.html',
  styleUrl: './estacionamento-mapa-atalho.component.scss'
})
export class EstacionamentoMapaAtalhoComponent {
  private readonly estacionamentoService = inject(EstacionamentoService);
  private readonly mapa = viewChild(BrasilMapaComponent);

  readonly estados = ESTADOS_BRASIL;
  readonly aberto = signal(false);
  readonly telaCheia = signal(false);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly cidade = signal('');
  readonly estado = signal('');
  readonly pontos = signal<PontoMapa[]>([]);
  readonly pontosVisiveis = computed(() => filtrarPontosMapa(this.pontos(), this.cidade(), this.estado()));
  readonly temFiltro = computed(() => this.cidade().trim().length > 0 || this.estado().trim().length > 0);

  toggle(): void {
    const abrir = !this.aberto();
    this.aberto.set(abrir);
    if (abrir) this.carregar();
    else this.telaCheia.set(false);
  }

  fechar(): void {
    this.aberto.set(false);
    this.telaCheia.set(false);
  }

  alternarTelaCheia(): void {
    this.telaCheia.update((ativa) => !ativa);
    setTimeout(() => this.mapa()?.atualizarTamanho(), 50);
  }

  atualizarCidade(evento: Event): void {
    this.cidade.set((evento.target as HTMLInputElement).value);
  }

  atualizarEstado(evento: Event): void {
    this.estado.set((evento.target as HTMLSelectElement).value);
  }

  limparBusca(): void {
    this.cidade.set('');
    this.estado.set('');
  }

  @HostListener('document:keydown.escape')
  fecharPorEsc(): void {
    if (!this.aberto()) return;
    if (this.telaCheia()) {
      this.alternarTelaCheia();
      return;
    }
    this.fechar();
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
