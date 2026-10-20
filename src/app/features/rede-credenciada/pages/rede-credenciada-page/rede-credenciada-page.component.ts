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
import { GeolocationService } from '../../../../shared/maps/geolocation.service';
import { OsrmRotaService, type EstimativaRotaCarro } from '../../../../shared/maps/osrm-rota.service';
import {
  ESTADOS_BRASIL,
  detalhesPontoMapa,
  filtrarPontosMapaCompleto,
  filtrarPontosPorProximidade,
  formatarDistanciaKm,
  linkGoogleMaps,
  linkGoogleMapsRota,
  type CoordenadaMapa,
  type FiltroStatusMapa,
  type FiltroTipoTarifaMapa,
  type FiltroTriState,
  type PontoMapa
} from '../../../../shared/maps/ponto-mapa.model';

/** null = sem corte de raio (todos), ordenado por distância se houver GPS. */
export type RaioProximidadeKm = 10 | 25 | 50 | 100 | null;

interface RotaCard {
  carregando: boolean;
  estimativa: EstimativaRotaCarro | null;
  falhou: boolean;
}

@Component({
  selector: 'app-rede-credenciada-page',
  standalone: true,
  imports: [CommonModule, FormsModule, BrasilMapaComponent],
  templateUrl: './rede-credenciada-page.component.html',
  styleUrl: './rede-credenciada-page.component.scss'
})
export class RedeCredenciadaPageComponent implements OnInit, AfterViewInit {
  private readonly estacionamentoService = inject(EstacionamentoService);
  private readonly geolocation = inject(GeolocationService);
  private readonly osrm = inject(OsrmRotaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapa = viewChild(BrasilMapaComponent);

  readonly estados = ESTADOS_BRASIL;
  readonly raiosDisponiveis: Array<{ valor: RaioProximidadeKm; label: string }> = [
    { valor: 10, label: '10 km' },
    { valor: 25, label: '25 km' },
    { valor: 50, label: '50 km' },
    { valor: 100, label: '100 km' },
    { valor: null, label: 'Todos' }
  ];

  readonly carregando = signal(false);
  readonly obtendoLocalizacao = signal(false);
  readonly erro = signal<string | null>(null);
  readonly avisoGeo = signal<string | null>(null);
  readonly pontos = signal<PontoMapa[]>([]);
  readonly selecionadoId = signal<number | null>(null);
  readonly posicaoUsuario = signal<CoordenadaMapa | null>(null);
  readonly raioKm = signal<RaioProximidadeKm>(50);
  readonly rotasPorId = signal<Record<number, RotaCard>>({});

  readonly busca = signal('');
  readonly cidade = signal('');
  readonly estado = signal('');
  readonly status = signal<FiltroStatusMapa>('todos');
  readonly seguranca = signal<FiltroTriState>('todos');
  readonly banheiro = signal<FiltroTriState>('todos');
  readonly tipoTarifa = signal<FiltroTipoTarifaMapa>('todos');

  readonly pontosVisiveis = computed(() => {
    const filtrados = filtrarPontosMapaCompleto(this.pontos(), {
      busca: this.busca(),
      cidade: this.cidade(),
      estado: this.estado(),
      status: this.status(),
      seguranca: this.seguranca(),
      banheiro: this.banheiro(),
      tipoTarifa: this.tipoTarifa()
    });
    return filtrarPontosPorProximidade(filtrados, this.posicaoUsuario(), this.raioKm());
  });

  readonly temFiltroTexto = computed(
    () =>
      this.busca().trim().length > 0 ||
      this.cidade().trim().length > 0 ||
      this.estado().trim().length > 0 ||
      this.status() !== 'todos' ||
      this.seguranca() !== 'todos' ||
      this.banheiro() !== 'todos' ||
      this.tipoTarifa() !== 'todos'
  );

  readonly temFiltro = computed(
    () => this.temFiltroTexto() || (this.posicaoUsuario() != null && this.raioKm() != null)
  );

  readonly focoMapa = computed<'brasil' | 'pontos'>(() => (this.temFiltro() ? 'pontos' : 'brasil'));

  readonly cards = computed(() => {
    const origem = this.posicaoUsuario();
    const rotas = this.rotasPorId();
    return this.pontosVisiveis().map((ponto) => {
      const rota = rotas[ponto.id];
      const distanciaLinha =
        Number.isFinite(ponto.distanciaKm) && ponto.distanciaKm < Number.POSITIVE_INFINITY
          ? formatarDistanciaKm(ponto.distanciaKm)
          : null;
      let rotaTexto: string | null = null;
      if (rota?.estimativa) {
        rotaTexto = `~${rota.estimativa.duracaoMinutos} min · ${formatarDistanciaKm(rota.estimativa.distanciaKm)} (rota)`;
      } else if (rota?.falhou && distanciaLinha) {
        rotaTexto = `${distanciaLinha} em linha reta`;
      }
      return {
        ponto,
        local: rotuloLocal(ponto),
        detalhes: detalhesPontoMapa(ponto),
        distanciaLinha,
        rotaTexto,
        rotaCarregando: rota?.carregando === true,
        maps: origem
          ? linkGoogleMapsRota(origem, ponto)
          : linkGoogleMaps(ponto.latitude, ponto.longitude)
      };
    });
  });

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
    this.solicitarLocalizacao(false);
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

  atualizarRaio(valor: string): void {
    this.raioKm.set(parseRaio(valor));
    setTimeout(() => this.mapa()?.reenquadrar(), 0);
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
    if (this.posicaoUsuario()) {
      this.raioKm.set(50);
    }
    setTimeout(() => this.mapa()?.reenquadrar(), 0);
  }

  usarMinhaLocalizacao(): void {
    this.solicitarLocalizacao(true);
  }

  selecionar(ponto: PontoMapa): void {
    this.selecionadoId.set(ponto.id);
    this.mapa()?.focarPonto(ponto);
    this.estimarRotaSeNecessario(ponto);
  }

  onPatioClicado(ponto: PontoMapa): void {
    this.selecionadoId.set(ponto.id);
    this.rolarAteCard(ponto.id);
    this.estimarRotaSeNecessario(ponto);
  }

  recarregar(): void {
    this.carregar();
  }

  private solicitarLocalizacao(forcarAviso: boolean): void {
    this.obtendoLocalizacao.set(true);
    if (forcarAviso) this.avisoGeo.set(null);
    this.geolocation
      .obterPosicaoAtual()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.obtendoLocalizacao.set(false);
        if (resultado.ok) {
          this.posicaoUsuario.set(resultado.posicao);
          this.avisoGeo.set(null);
          if (this.raioKm() == null) this.raioKm.set(50);
          setTimeout(() => {
            this.mapa()?.atualizarTamanho();
            this.mapa()?.reenquadrar();
          }, 50);
          return;
        }
        this.posicaoUsuario.set(null);
        if (forcarAviso || resultado.codigo === 'denied') {
          this.avisoGeo.set(resultado.mensagem);
        }
        setTimeout(() => this.mapa()?.reenquadrar(), 50);
      });
  }

  private estimarRotaSeNecessario(ponto: PontoMapa): void {
    const origem = this.posicaoUsuario();
    if (!origem) return;
    const atual = this.rotasPorId()[ponto.id];
    if (atual?.estimativa || atual?.carregando) return;

    this.patchRota(ponto.id, { carregando: true, estimativa: null, falhou: false });
    this.osrm
      .estimarRotaCarro(origem, ponto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((estimativa) => {
        if (estimativa) {
          this.patchRota(ponto.id, { carregando: false, estimativa, falhou: false });
        } else {
          this.patchRota(ponto.id, { carregando: false, estimativa: null, falhou: true });
        }
      });
  }

  private patchRota(id: number, card: RotaCard): void {
    this.rotasPorId.update((mapa) => ({ ...mapa, [id]: card }));
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
          setTimeout(() => {
            this.mapa()?.atualizarTamanho();
            this.mapa()?.reenquadrar();
          }, 50);
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

function parseRaio(valor: string): RaioProximidadeKm {
  if (valor === '' || valor === 'todos' || valor === 'null') return null;
  const n = Number(valor);
  if (n === 10 || n === 25 || n === 50 || n === 100) return n;
  return 50;
}
