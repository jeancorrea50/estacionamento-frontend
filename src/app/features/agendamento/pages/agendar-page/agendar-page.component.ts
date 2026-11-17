import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import { AGENDAR_ROUTE, AGENDAMENTO_ROUTE } from '../../agendamento-rotas';
import { AgendamentoNovoModalComponent } from '../../components/agendamento-novo-modal/agendamento-novo-modal.component';
import {
  AgendamentoSearchItem,
  entradaSaidaStatusLabel,
  EntradaSaidaStatus,
} from '../../models/agendamento.models';
import { AgendamentoService } from '../../services/agendamento.service';
import { VagaDisponibilidadeService } from '../../services/vaga-disponibilidade.service';
import type { VagaDisponibilidadeResumo } from '../../models/vaga-disponibilidade.models';

/**
 * Visão transportadora: criar/consultar próprios agendamentos + vagas liberadas.
 * Rota: `/app/agendar`.
 *
 * Claims (mesmas do painel): `agendamentos.visualizar|gravar|alterar|excluir`
 * (alias singular `agendamento.*` também aceito).
 * Separação de tela vs Pátio → Agendamento é por **menu/rota**, não por claim distinto.
 */
@Component({
  selector: 'app-agendar-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, AgendamentoNovoModalComponent],
  templateUrl: './agendar-page.component.html',
  styleUrls: ['./agendar-page.component.scss'],
})
export class AgendarPageComponent implements OnInit {
  private readonly api = inject(AgendamentoService);
  private readonly vagasApi = inject(VagaDisponibilidadeService);
  private readonly auth = inject(AuthService);
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly permissions = inject(PermissionCacheService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly loadingVagas = signal(false);
  readonly items = signal<AgendamentoSearchItem[]>([]);
  readonly totalCount = signal(0);
  readonly vagas = signal<VagaDisponibilidadeResumo | null>(null);
  readonly erro = signal<string | null>(null);
  readonly showForm = signal(false);

  get canVisualizar(): boolean {
    return (
      this.sessionAccess.canAccessRoute(AGENDAR_ROUTE) ||
      this.sessionAccess.canAccessRoute(AGENDAMENTO_ROUTE)
    );
  }

  /** POST /Agendamento — claim `agendamento.gravar` / `agendamentos.gravar`. */
  get podeCriar(): boolean {
    return this.canVisualizar && this.permissions.allows('agendamento', 'gravar');
  }

  get isTransportadora(): boolean {
    return this.auth.isTransportadoraRole();
  }

  ngOnInit(): void {
    if (!this.canVisualizar) {
      this.erro.set(
        'Sem permissão de menu para Agendar. Libere a rota /app/agendar (ou item Agendamentos) no perfil.'
      );
      return;
    }
    if (this.auth.needsEstacionamentoSelection()) {
      this.erro.set('Selecione o estacionamento da sessão antes de continuar.');
      return;
    }
    this.carregar();
    this.carregarVagas();
  }

  abrirNovo(): void {
    if (!this.podeCriar) {
      this.toast.error('Sem permissão para criar agendamento (agendamentos.gravar).');
      return;
    }
    this.showForm.set(true);
  }

  fecharForm(): void {
    this.showForm.set(false);
  }

  onNovoSalvo(): void {
    this.showForm.set(false);
    this.carregar();
    this.carregarVagas();
  }

  carregar(): void {
    this.loading.set(true);
    this.erro.set(null);
    this.api
      .buscar({ numeroPagina: 1, tamanhoPagina: 50 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (p) => {
          this.items.set(p.items ?? []);
          this.totalCount.set(p.totalCount ?? 0);
        },
        error: () => {
          this.erro.set('Não foi possível carregar seus agendamentos.');
          this.toast.error('Falha ao carregar agendamentos.');
        },
      });
  }

  carregarVagas(): void {
    this.loadingVagas.set(true);
    this.vagasApi
      .resumoParaTransportadora()
      .pipe(finalize(() => this.loadingVagas.set(false)))
      .subscribe({
        next: (r) => this.vagas.set(r),
        error: () => this.vagas.set(null),
      });
  }

  statusLabel(item: AgendamentoSearchItem): string {
    return entradaSaidaStatusLabel(item.status as EntradaSaidaStatus) || '—';
  }
}
