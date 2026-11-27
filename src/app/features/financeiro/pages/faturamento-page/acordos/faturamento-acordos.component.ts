import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ToastService } from '../../../../../core/api/services/toast.service';
import { PermissionCacheService } from '../../../../../core/services/permission-cache.service';
import { SessionAccessService } from '../../../../../core/services/session-access.service';
import { TransportadoraLookupFieldComponent } from '../../../../movimentos/entrada-saida/components/transportadora-lookup-field/transportadora-lookup-field.component';
import { mapListaItemToPostInput } from '../../../mappers/configuracao-cobranca.mapper';
import {
  ModalidadeCobranca,
  StatusConfiguracaoCobranca,
} from '../../../models/configuracao-cobranca.models';
import { ConfiguracaoCobrancaService } from '../../../services/configuracao-cobranca.service';
import { FATURAMENTO_ACORDOS_ROUTE, FATURAMENTO_CONFIG_ROUTE } from '../../../faturamento-rotas';
import {
  formatarPeriodoAcordo,
  resumoListagemAcordo,
  resumoVagasAcordo,
} from '../config-cobranca/config-cobranca-acordo.util';
import type { ConfigCobrancaListaItem } from '../config-cobranca/faturamento-config-cobranca.types';
import {
  ConfigCobrancaAcordoDialogComponent,
  type ConfigCobrancaAcordoDialogData,
} from '../config-cobranca/dialogs/config-cobranca-acordo-dialog.component';

@Component({
  selector: 'app-faturamento-acordos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, RouterLink, TransportadoraLookupFieldComponent],
  templateUrl: './faturamento-acordos.component.html',
  styleUrls: ['./faturamento-acordos.component.scss'],
})
export class FaturamentoAcordosComponent implements OnInit {
  private readonly api = inject(ConfiguracaoCobrancaService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly permissions = inject(PermissionCacheService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly salvando = signal(false);
  readonly items = signal<ConfigCobrancaListaItem[]>([]);
  readonly transportadoraId = signal<number | null>(null);
  readonly transportadoraNome = signal('');
  readonly selecionadoId = signal<number | null>(null);

  readonly podeVisualizar = computed(() => this.permissions.allows('acordos', 'visualizar'));
  readonly podeAlterar = computed(
    () => this.permissions.allows('acordos', 'alterar') || this.permissions.allows('acordos', 'gravar')
  );

  readonly selecionado = computed(() => {
    const id = this.selecionadoId();
    return this.items().find((i) => i.id === id) ?? null;
  });

  readonly cobrancaRoute = FATURAMENTO_CONFIG_ROUTE;

  ngOnInit(): void {
    if (!this.sessionAccess.canAccessRoute(FATURAMENTO_ACORDOS_ROUTE)) {
      void this.router.navigateByUrl('/app');
      return;
    }
    if (!this.podeVisualizar()) return;
    this.carregar();
  }

  onTransportadoraId(id: number | null): void {
    this.transportadoraId.set(id);
    this.carregar();
  }

  onTransportadoraNome(nome: string): void {
    this.transportadoraNome.set(nome || '');
  }

  carregar(): void {
    this.loading.set(true);
    const tid = this.transportadoraId();
    this.api
      .listar({
        numeroPagina: 1,
        tamanhoPagina: 100,
        status: StatusConfiguracaoCobranca.Ativa,
        ...(tid && tid > 0 ? { transportadoraId: tid } : {}),
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          const acordos = (page.items ?? []).filter(
            (i) => i.modalidadeCobranca === ModalidadeCobranca.Acordo || i.modalidade === 'Acordo'
          );
          this.items.set(acordos);
          const sel = this.selecionadoId();
          if (sel && !acordos.some((i) => i.id === sel)) {
            this.selecionadoId.set(acordos[0]?.id ?? null);
          } else if (!sel && acordos.length) {
            this.selecionadoId.set(acordos[0].id);
          }
        },
        error: (err: { message?: string }) => {
          this.items.set([]);
          this.toast.error(err?.message || 'Não foi possível carregar os acordos.');
        },
      });
  }

  selecionar(item: ConfigCobrancaListaItem): void {
    this.selecionadoId.set(item.id);
  }

  periodoLabel(item: ConfigCobrancaListaItem): string {
    return formatarPeriodoAcordo(item.acordo?.dataInicio, item.acordo?.dataFim);
  }

  vagasLabel(item: ConfigCobrancaListaItem): string {
    const listagens = item.acordo?.listagens ?? [];
    if (listagens.length) {
      return listagens.map((l) => resumoListagemAcordo(l)).join(' · ');
    }
    return resumoVagasAcordo(item.acordo?.vagas);
  }

  limpezaLabel(item: ConfigCobrancaListaItem): string {
    const limpeza = item.servicos?.limpeza;
    if (!limpeza?.habilitado) return 'Não cobra limpeza';
    const valor = limpeza.valor == null ? '—' : `R$ ${Number(limpeza.valor).toFixed(2)}`;
    return `Cobra limpeza · ${valor}`;
  }

  editarAcordo(): void {
    const item = this.selecionado();
    if (!item) {
      this.toast.warning('Selecione um acordo na lista.');
      return;
    }
    if (!this.podeAlterar()) {
      this.toast.error('Sem permissão para alterar acordos (acordos.alterar).');
      return;
    }

    this.salvando.set(true);
    this.api
      .obterListaItemPorId(item.id)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: (full) => {
          if (!full) {
            this.toast.error('Acordo não encontrado.');
            return;
          }
          const ref = this.dialog.open(ConfigCobrancaAcordoDialogComponent, {
            width: 'min(720px, 96vw)',
            maxWidth: '96vw',
            autoFocus: false,
            data: {
              acordo: full.acordo,
              editando: true,
            } satisfies ConfigCobrancaAcordoDialogData,
          });
          ref.afterClosed().subscribe((acordo) => {
            if (!acordo) return;
            const atualizado: ConfigCobrancaListaItem = { ...full, acordo };
            this.persistir(atualizado);
          });
        },
        error: (err: { message?: string }) => {
          this.toast.error(err?.message || 'Não foi possível abrir o acordo.');
        },
      });
  }

  private persistir(item: ConfigCobrancaListaItem): void {
    this.salvando.set(true);
    const base = mapListaItemToPostInput(item);
    const payload = { ...base, id: item.id };
    this.api
      .alterar(payload)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('Acordo atualizado (período, vagas e split CIF/FOB).');
          this.carregar();
        },
        error: (err: { message?: string }) => {
          this.toast.error(err?.message || 'Falha ao salvar o acordo.');
        },
      });
  }
}
