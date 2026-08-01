import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import type { ApiError } from '../../../../core/api/models';
import { ToastService } from '../../../../core/api/services/toast.service';
import type { EstacionamentoConfiguracaoPadrao } from '../../models/estacionamento-configuracao.models';
import { EstacionamentoConfiguracaoService } from '../../services/estacionamento-configuracao.service';

@Component({
  selector: 'app-horario-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './horario-page.component.html',
  styleUrls: ['./horario-page.component.scss']
})
export class HorarioPageComponent implements OnInit {
  private readonly api = inject(EstacionamentoConfiguracaoService);
  private readonly toast = inject(ToastService);

  padroes: EstacionamentoConfiguracaoPadrao[] = [];
  timeZoneId = '';
  /** Id da config atual; `null` = ainda não gravada (POST). */
  configId: number | null = null;

  loading = true;
  salvando = false;

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading = true;
    // Dropdown depende só de /padroes. A config atual (GET raiz) é opcional:
    // 404 = ainda não gravada e não pode derrubar a lista de fusos.
    this.api
      .listarPadroes()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (padroes) => {
          this.padroes = padroes;
          this.timeZoneId = padroes[0]?.timeZoneId ?? '';
          this.configId = null;
          this.carregarConfigAtual();
        },
        error: (err: ApiError) => {
          this.padroes = [];
          this.toast.error(err?.message ?? 'Não foi possível carregar os fusos horários.');
        }
      });
  }

  /** Pré-seleciona o fuso já salvo (se existir). */
  private carregarConfigAtual(): void {
    this.api.obterAtual().subscribe({
      next: (atual) => {
        if (!atual?.id || atual.id <= 0 || !atual.timeZoneId) return;
        this.configId = atual.id;
        this.timeZoneId = atual.timeZoneId;
        if (!this.padroes.some((p) => p.timeZoneId === atual.timeZoneId)) {
          this.padroes = [
            {
              timeZoneId: atual.timeZoneId,
              nome: atual.nome || atual.timeZoneId,
              utcOffset: atual.utcOffset || ''
            },
            ...this.padroes
          ];
        }
      },
      error: () => {
        // Sem toast: ausência de config é cenário esperado antes do primeiro POST.
        this.configId = null;
      }
    });
  }

  salvar(): void {
    const tz = this.timeZoneId?.trim();
    if (!tz) {
      this.toast.error('Selecione um horário.');
      return;
    }
    if (this.salvando) return;
    this.salvando = true;

    const req$ =
      this.configId != null && this.configId > 0
        ? this.api.alterar({ id: this.configId, timeZoneId: tz })
        : this.api.gravar({ timeZoneId: tz });

    req$.pipe(finalize(() => (this.salvando = false))).subscribe({
      next: (saved) => {
        const eraNovo = !(this.configId != null && this.configId > 0);
        if (saved?.id && saved.id > 0) {
          this.configId = saved.id;
          this.timeZoneId = saved.timeZoneId || tz;
        } else if (eraNovo) {
          this.carregar();
        }
        this.toast.success(eraNovo ? 'Horário gravado com sucesso.' : 'Horário atualizado com sucesso.');
      },
      error: (err: ApiError) => {
        this.toast.error(err?.message ?? 'Não foi possível salvar o horário.');
      }
    });
  }

  get podeSalvar(): boolean {
    return !!this.timeZoneId?.trim() && !this.loading && !this.salvando;
  }
}
