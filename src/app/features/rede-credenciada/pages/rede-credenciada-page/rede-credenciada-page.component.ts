import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EstacionamentoService } from '../../../cadastro/services/estacionamento.service';
import { BrasilMapaComponent } from '../../../../shared/maps/brasil-mapa.component';
import {
  ESTADOS_BRASIL,
  detalhesPontoMapa,
  filtrarPontosMapaCompleto,
  linkGoogleMaps,
  type FiltroStatusMapa,
  type FiltroTipoTarifaMapa,
  type FiltroTriState,
  type PontoMapa
} from '../../../../shared/maps/ponto-mapa.model';

@Component({
  selector: 'app-rede-credenciada-page',
  standalone: true,
  imports: [CommonModule, FormsModule, BrasilMapaComponent],
  templateUrl: './rede-credenciada-page.component.html',
  styleUrl: './rede-credenciada-page.component.scss'
})
export class RedeCredenciadaPageComponent implements OnInit, AfterViewInit {
  private readonly estacionamentoService = inject(EstacionamentoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapa = viewChild(BrasilMapaComponent);

  readonly estados = ESTADOS_BRASIL;
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly pontos = signal<PontoMapa[]>([]);
  readonly selecionadoId = signal<number | null>(null);

  readonly busca = signal('');
  readonly cidade = signal('');
  readonly estado = signal('');
  readonly status = signal<FiltroStatusMapa>('todos');
  readonly seguranca = signal<FiltroTriState>('todos');
  readonly banheiro = signal<FiltroTriState>('todos');
  readonly tipoTarifa = signal<FiltroTipoTarifaMapa>('todos');

  readonly pontosVisiveis = computed(() =>
    filtrarPontosMapaCompleto(this.pontos(), {
      busca: this.busca(),
      cidade: this.cidade(),
      estado: this.estado(),
      status: this.status(),
      seguranca: this.seguranca(),
      banheiro: this.banheiro(),
      tipoTarifa: this.tipoTarifa()
    })
  );

  readonly temFiltro = computed(
    () =>
      this.busca().trim().length > 0 ||
      this.cidade().trim().length > 0 ||
      this.estado().trim().length > 0 ||
      this.status() !== 'todos' ||
      this.seguranca() !== 'todos' ||
      this.banheiro() !== 'todos' ||
      this.tipoTarifa() !== 'todos'
  );

  readonly focoMapa = computed<'brasil' | 'pontos'>(() => (this.temFiltro() ? 'pontos' : 'brasil'));

  readonly cards = computed(() =>
    this.pontosVisiveis().map((ponto) => ({
      ponto,
      local: rotuloLocal(ponto),
      detalhes: detalhesPontoMapa(ponto),
      maps: linkGoogleMaps(ponto.latitude, ponto.longitude)
    }))
  );

  constructor() {
    effect(() => {
      const id = this.selecionadoId();
      if (id == null) return;
      if (!this.pontosVisiveis().some((ponto) => ponto.id === id)) {
        this.selecionadoId.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.carregar();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.mapa()?.atualizarTamanho(), 80);
  }

  atualizarBusca(valor: string): void {
    this.busca.set(valor);
  }

  atualizarCidade(valor: string): void {
    this.cidade.set(valor);
  }

  atualizarEstado(valor: string): void {
    this.estado.set(valor);
  }

  atualizarStatus(valor: string): void {
    this.status.set(parseStatus(valor));
  }

  atualizarSeguranca(valor: string): void {
    this.seguranca.set(parseTriState(valor));
  }

  atualizarBanheiro(valor: string): void {
    this.banheiro.set(parseTriState(valor));
  }

  atualizarTipoTarifa(valor: string): void {
    this.tipoTarifa.set(parseTipoTarifa(valor));
  }

  limparFiltros(): void {
    this.busca.set('');
    this.cidade.set('');
    this.estado.set('');
    this.status.set('todos');
    this.seguranca.set('todos');
    this.banheiro.set('todos');
    this.tipoTarifa.set('todos');
    this.selecionadoId.set(null);
  }

  selecionar(ponto: PontoMapa): void {
    this.selecionadoId.set(ponto.id);
    this.mapa()?.focarPonto(ponto);
  }

  onPatioClicado(ponto: PontoMapa): void {
    this.selecionadoId.set(ponto.id);
    this.rolarAteCard(ponto.id);
  }

  recarregar(): void {
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);
    this.estacionamentoService
      .listarMapa()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pontos) => {
          this.pontos.set(pontos);
          this.carregando.set(false);
          setTimeout(() => this.mapa()?.atualizarTamanho(), 50);
        },
        error: () => {
          this.pontos.set([]);
          this.erro.set('Não foi possível carregar a rede credenciada.');
          this.carregando.set(false);
        }
      });
  }

  private rolarAteCard(id: number): void {
    setTimeout(() => {
      document.getElementById(`rede-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 0);
  }
}

function rotuloLocal(ponto: PontoMapa): string {
  const cidade = ponto.cidade?.trim();
  const estado = ponto.estado?.trim();
  if (cidade && estado) return `${cidade} — ${estado}`;
  return cidade || estado || 'Brasil';
}

function parseStatus(valor: string): FiltroStatusMapa {
  return valor === 'ativo' || valor === 'inativo' ? valor : 'todos';
}

function parseTriState(valor: string): FiltroTriState {
  return valor === 'sim' || valor === 'nao' ? valor : 'todos';
}

function parseTipoTarifa(valor: string): FiltroTipoTarifaMapa {
  return valor === 'hora' || valor === 'diaria' || valor === 'sem' ? valor : 'todos';
}
