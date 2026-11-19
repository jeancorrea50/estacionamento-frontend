import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil } from 'rxjs/operators';
import { ToastService } from '../../../../core/api/services/toast.service';
import { PaginatedSearchItem } from '../../../../shared/models/paginated-search.models';
import { formatPlacaDisplay, normalizePlaca } from '../../../cadastro/utils/placa-br';
import { VeiculoService } from '../../../cadastro/services/veiculo.service';
import { ModalBuscaMotoristaComponent } from '../../../movimentos/entrada-saida/components/modal-busca-motorista/modal-busca-motorista.component';
import { ModalBuscaVeiculoComponent } from '../../../movimentos/entrada-saida/components/modal-busca-veiculo/modal-busca-veiculo.component';
import { AgendamentoService } from '../../services/agendamento.service';
import type { AgendamentoPlacaSelecionada } from '../agendamento-novo-modal/agendamento-placa.model';

/**
 * Modal para montar a frota do agendamento: N placas + motorista por placa.
 * Motorista vinculado no veículo fica bloqueado até limpar com X.
 */
@Component({
  selector: 'app-agendamento-veiculos-motoristas-modal',
  standalone: true,
  imports: [CommonModule, ModalBuscaVeiculoComponent, ModalBuscaMotoristaComponent],
  templateUrl: './agendamento-veiculos-motoristas-modal.component.html',
  styleUrl: './agendamento-veiculos-motoristas-modal.component.scss',
})
export class AgendamentoVeiculosMotoristasModalComponent {
  private readonly api = inject(AgendamentoService);
  private readonly veiculoApi = inject(VeiculoService);
  private readonly toast = inject(ToastService);

  readonly aberto = input(false);
  readonly transportadoraId = input<number | null>(null);
  /** Estado atual no formulário pai (espelhado ao abrir). */
  readonly placas = input<AgendamentoPlacaSelecionada[]>([]);

  readonly fechar = output<void>();
  /** Confirma a lista editada (pode estar vazia se o usuário removeu tudo). */
  readonly confirmar = output<AgendamentoPlacaSelecionada[]>();

  readonly rascunho = signal<AgendamentoPlacaSelecionada[]>([]);
  readonly buscaPlacaAberta = signal(false);
  readonly buscaMotoristaAberta = signal(false);
  readonly veiculoIdBuscaMotorista = signal<number | null>(null);
  readonly resolvendoPlacas = signal(false);

  private readonly cancelarResolucao$ = new Subject<void>();
  private geracaoResolucao = 0;

  constructor() {
    effect(() => {
      const open = this.aberto();
      const origem = this.placas();
      untracked(() => {
        if (open) {
          this.cancelarResolucao$.next();
          this.geracaoResolucao += 1;
          this.rascunho.set(origem.map((p) => ({ ...p })));
          this.buscaPlacaAberta.set(false);
          this.fecharBuscaMotorista();
          this.resolvendoPlacas.set(false);
        }
      });
    });
  }

  formatPlaca(placa: string | null | undefined): string {
    return formatPlacaDisplay(placa) || placa || '—';
  }

  labelMotorista(p: AgendamentoPlacaSelecionada): string {
    const nome = (p.motoristaNome || '').trim();
    if (nome) return nome;
    if (p.motoristaId && p.motoristaId > 0) return `Motorista #${p.motoristaId}`;
    return '';
  }

  idsJaSelecionados(): number[] {
    return this.rascunho().map((p) => p.id);
  }

  abrirBuscaPlaca(): void {
    if (!this.transportadoraId()) return;
    this.buscaPlacaAberta.set(true);
  }

  fecharBuscaPlaca(): void {
    this.buscaPlacaAberta.set(false);
  }

  onPlacasBuscadas(itens: PaginatedSearchItem[]): void {
    this.buscaPlacaAberta.set(false);
    if (!itens?.length) return;

    const tid = this.transportadoraId() ?? 0;
    const geracao = ++this.geracaoResolucao;
    let ignoradasInativas = 0;
    let duplicadas = 0;

    /** Aceitas neste lote (evita colisão entre itens do mesmo confirm). */
    const idsLote = new Set<number>();
    const placasLote = new Set<string>();
    const aceitas: AgendamentoPlacaSelecionada[] = [];

    for (const item of itens) {
      const preparado = this.prepararPlacaDaBusca(item, idsLote, placasLote);
      if (!preparado.ok) {
        if (preparado.motivo === 'inativa') ignoradasInativas += 1;
        if (preparado.motivo === 'duplicada') duplicadas += 1;
        continue;
      }
      idsLote.add(preparado.base.id);
      placasLote.add(normalizePlaca(preparado.base.placa));
      aceitas.push(preparado.base);
    }

    if (!aceitas.length) {
      if (ignoradasInativas) {
        this.toast.warning(
          ignoradasInativas === 1
            ? '1 placa inativa foi ignorada.'
            : `${ignoradasInativas} placas inativas foram ignoradas.`
        );
      } else if (duplicadas) {
        this.toast.warning('As placas selecionadas já estavam na lista.');
      }
      return;
    }

    // Inclui todas as placas imediatamente (multi-seleção N) e depois enriquece motorista.
    for (const base of aceitas) {
      this.mesclarPlaca({ ...base });
    }

    if (ignoradasInativas) {
      this.toast.warning(
        ignoradasInativas === 1
          ? '1 placa inativa foi ignorada.'
          : `${ignoradasInativas} placas inativas foram ignoradas.`
      );
    }

    let pendentes = aceitas.length;
    this.resolvendoPlacas.set(true);

    for (const base of aceitas) {
      this.resolverMotoristaDaPlaca(base, tid)
        .pipe(takeUntil(this.cancelarResolucao$))
        .subscribe({
          next: (resolved) => {
            if (!this.aberto() || geracao !== this.geracaoResolucao) return;
            if (tid !== (this.transportadoraId() ?? 0)) return;
            this.mesclarPlaca({
              ...resolved,
              motoristaBloqueado: !!(resolved.motoristaId && resolved.motoristaId > 0),
            });
            pendentes -= 1;
            if (pendentes <= 0) this.resolvendoPlacas.set(false);
          },
          error: () => {
            if (!this.aberto() || geracao !== this.geracaoResolucao) return;
            this.mesclarPlaca({ ...base, motoristaBloqueado: false });
            pendentes -= 1;
            if (pendentes <= 0) this.resolvendoPlacas.set(false);
          },
        });
    }
  }

  removerPlaca(veiculoId: number): void {
    this.rascunho.update((lista) => lista.filter((p) => p.id !== veiculoId));
  }

  limparMotorista(veiculoId: number): void {
    this.rascunho.update((lista) =>
      lista.map((p) =>
        p.id === veiculoId
          ? {
              ...p,
              motoristaId: null,
              motoristaNome: null,
              motoristaCpf: null,
              motoristaBloqueado: false,
            }
          : p
      )
    );
  }

  abrirBuscaMotorista(veiculoId: number): void {
    if (!this.transportadoraId()) return;
    const placa = this.rascunho().find((p) => p.id === veiculoId);
    if (!placa) return;
    if (placa.motoristaBloqueado && placa.motoristaId && placa.motoristaId > 0) return;
    this.veiculoIdBuscaMotorista.set(veiculoId);
    this.buscaMotoristaAberta.set(true);
  }

  fecharBuscaMotorista(): void {
    this.buscaMotoristaAberta.set(false);
    this.veiculoIdBuscaMotorista.set(null);
  }

  onMotoristaSelecionado(item: PaginatedSearchItem): void {
    const veiculoId = this.veiculoIdBuscaMotorista();
    this.fecharBuscaMotorista();
    if (veiculoId == null || !item?.id) return;
    const id = Number(item.id);
    if (!Number.isFinite(id) || id <= 0) return;
    const cpf =
      item.campo2 && item.campo2 !== '—'
        ? String(item.campo2)
        : item.meta?.['cpf'] != null
          ? String(item.meta['cpf'])
          : null;
    this.rascunho.update((lista) =>
      lista.map((p) =>
        p.id === veiculoId
          ? {
              ...p,
              motoristaId: id,
              motoristaNome: String(item.titulo || '').trim() || `Motorista #${id}`,
              motoristaCpf: cpf,
              motoristaBloqueado: false,
            }
          : p
      )
    );
  }

  pendentesMotorista(): number {
    return this.rascunho().filter((p) => !(p.motoristaId && p.motoristaId > 0)).length;
  }

  onConfirmar(): void {
    const lista = this.rascunho();
    if (!lista.length) {
      this.toast.error('Adicione ao menos uma placa.');
      return;
    }
    const semMotorista = lista.filter((p) => !(p.motoristaId && p.motoristaId > 0));
    if (semMotorista.length) {
      this.toast.error(
        semMotorista.length === 1
          ? `Defina o motorista da placa ${this.formatPlaca(semMotorista[0].placa)}.`
          : `Defina o motorista de ${semMotorista.length} placas antes de confirmar.`
      );
      return;
    }
    this.confirmar.emit(lista.map((p) => ({ ...p })));
  }

  onVoltar(): void {
    this.cancelarResolucao$.next();
    this.fechar.emit();
  }

  private mesclarPlaca(nova: AgendamentoPlacaSelecionada): void {
    this.rascunho.update((lista) => {
      const idx = lista.findIndex(
        (p) => p.id === nova.id || normalizePlaca(p.placa) === normalizePlaca(nova.placa)
      );
      if (idx >= 0) {
        const next = [...lista];
        next[idx] = { ...next[idx], ...nova };
        return next;
      }
      return [...lista, nova];
    });
  }

  private prepararPlacaDaBusca(
    item: PaginatedSearchItem,
    idsLote?: Set<number>,
    placasLote?: Set<string>
  ):
    | { ok: true; base: AgendamentoPlacaSelecionada }
    | { ok: false; motivo: 'invalida' | 'inativa' | 'duplicada' } {
    const id = Number(item.id);
    const placa = String(item.titulo || '').trim();
    if (!Number.isFinite(id) || id <= 0 || !placa) return { ok: false, motivo: 'invalida' };

    if ((item.campo5 || '').trim().toLowerCase() === 'não') {
      return { ok: false, motivo: 'inativa' };
    }

    const placaNorm = normalizePlaca(placa);
    const jaExiste =
      this.rascunho().some((p) => p.id === id || normalizePlaca(p.placa) === placaNorm) ||
      !!idsLote?.has(id) ||
      !!placasLote?.has(placaNorm);
    if (jaExiste) return { ok: false, motivo: 'duplicada' };

    const metaMotoristaId = Number(item.meta?.['motoristaId'] ?? 0);
    const metaNome =
      item.meta?.['motoristaNome'] != null ? String(item.meta['motoristaNome']) : null;
    const metaCpf =
      item.meta?.['motoristaCpf'] != null ? String(item.meta['motoristaCpf']) : null;

    return {
      ok: true,
      base: {
        id,
        placa,
        marcaModelo: item.campo2 && item.campo2 !== '—' ? item.campo2 : undefined,
        motoristaId: metaMotoristaId > 0 ? metaMotoristaId : null,
        motoristaNome: metaNome,
        motoristaCpf: metaCpf,
        motoristaBloqueado: metaMotoristaId > 0,
      },
    };
  }

  private resolverMotoristaDaPlaca(
    veiculo: AgendamentoPlacaSelecionada,
    transportadoraId: number
  ) {
    if (veiculo.motoristaId && veiculo.motoristaId > 0) {
      return of(veiculo);
    }

    const placa = normalizePlaca(veiculo.placa);
    return this.api.obterPorPlaca(placa).pipe(
      switchMap((agg) => {
        if (agg?.motoristaId && agg.motoristaId > 0) {
          return of({
            ...veiculo,
            id: agg.veiculoId > 0 ? agg.veiculoId : veiculo.id,
            motoristaId: agg.motoristaId,
            motoristaNome: agg.motoristaNome || veiculo.motoristaNome || null,
            motoristaCpf: agg.motoristaCpf || veiculo.motoristaCpf || null,
          });
        }

        if (!(transportadoraId > 0 && veiculo.id > 0)) {
          return of(veiculo);
        }

        return this.veiculoApi.obterPorId(veiculo.id, transportadoraId).pipe(
          map((detalhe) => {
            if (!detalhe) return veiculo;
            const vinculo =
              detalhe.motoristasVinculos?.find((m) => m.principal === true) ??
              detalhe.motoristasVinculos?.[0];
            const mid =
              (detalhe.motoristaId && detalhe.motoristaId > 0 ? detalhe.motoristaId : null) ??
              (vinculo && vinculo.id > 0 ? vinculo.id : null);
            if (!mid) return veiculo;
            return {
              ...veiculo,
              motoristaId: mid,
              motoristaNome: detalhe.motoristaNome || vinculo?.nome || veiculo.motoristaNome || null,
              motoristaCpf: vinculo?.cpf || veiculo.motoristaCpf || null,
            };
          }),
          catchError(() => of(veiculo))
        );
      }),
      catchError(() => of(veiculo))
    );
  }
}
