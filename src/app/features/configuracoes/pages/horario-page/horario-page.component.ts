import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import type { ApiError } from '../../../../core/api/models';
import { ToastService } from '../../../../core/api/services/toast.service';
import type {
  EstacionamentoConfiguracao,
  EstacionamentoConfiguracaoPadrao
} from '../../models/estacionamento-configuracao.models';
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

  readonly padroes = signal<EstacionamentoConfiguracaoPadrao[]>([]);
  readonly timeZoneId = signal('');
  /** Id da config atual; `null` = ainda não gravada (POST). */
  readonly configId = signal<number | null>(null);
  /** Snapshot completo — preserva tarifa/tolerância ao salvar só o fuso. */
  private configAtual: EstacionamentoConfiguracao | null = null;

  readonly loading = signal(true);
  readonly salvando = signal(false);

  readonly podeSalvar = computed(
    () => !!this.timeZoneId().trim() && !this.loading() && !this.salvando()
  );

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.padroes.set([]);
    this.timeZoneId.set('');
    this.configId.set(null);
    this.configAtual = null;

    let padroesOk = false;
    let atualOk = false;

    const liberarSePossivel = (): void => {
      if (this.padroes().length > 0 || !!this.timeZoneId() || (padroesOk && atualOk)) {
        this.loading.set(false);
      }
    };

    // Chamadas em paralelo — signals atualizam a UI no app zoneless.
    this.api.listarPadroes().subscribe({
      next: (padroes) => {
        this.aplicarPadroes(padroes);
        padroesOk = true;
        liberarSePossivel();
      },
      error: (err: ApiError) => {
        padroesOk = true;
        if (!this.padroes().length) {
          this.toast.error(err?.message ?? 'Não foi possível carregar os fusos horários.');
        }
        liberarSePossivel();
      }
    });

    this.api.obterAtual().subscribe({
      next: (atual) => {
        this.aplicarAtual(atual);
        atualOk = true;
        liberarSePossivel();
      },
      error: () => {
        // Sem toast: ausência de config é cenário esperado antes do primeiro POST.
        this.configId.set(null);
        atualOk = true;
        liberarSePossivel();
      }
    });
  }

  onTimeZoneChange(value: string): void {
    this.timeZoneId.set(value);
  }

  private aplicarPadroes(padroes: EstacionamentoConfiguracaoPadrao[]): void {
    const selecionado = this.timeZoneId();
    this.padroes.set(padroes);

    if (selecionado) {
      this.garantirPadraoNaLista(selecionado, selecionado, '');
      this.timeZoneId.set(selecionado);
      return;
    }

    this.timeZoneId.set(padroes[0]?.timeZoneId ?? '');
  }

  private aplicarAtual(atual: EstacionamentoConfiguracao | null): void {
    if (!atual?.id || atual.id <= 0 || !atual.timeZoneId) return;

    this.configAtual = atual;
    this.configId.set(atual.id);
    this.timeZoneId.set(atual.timeZoneId);
    this.garantirPadraoNaLista(atual.timeZoneId, atual.nome || atual.timeZoneId, atual.utcOffset || '');
  }

  private garantirPadraoNaLista(timeZoneId: string, nome: string, utcOffset: string): void {
    if (this.padroes().some((p) => p.timeZoneId === timeZoneId)) return;
    this.padroes.set([{ timeZoneId, nome, utcOffset }, ...this.padroes()]);
  }

  salvar(): void {
    const tz = this.timeZoneId().trim();
    if (!tz) {
      this.toast.error('Selecione um horário.');
      return;
    }
    if (this.salvando()) return;
    this.salvando.set(true);

    const id = this.configId();
    const preservado = this.configAtual;
    const payloadBase = {
      timeZoneId: tz,
      tipoTarifaAvulsa: preservado?.tipoTarifaAvulsa ?? null,
      valorAvulso: preservado?.valorAvulso ?? null,
      minutosToleranciaPermanencia: preservado?.minutosToleranciaPermanencia ?? null
    };
    const req$ =
      id != null && id > 0
        ? this.api.alterar({ id, ...payloadBase })
        : this.api.gravar(payloadBase);

    req$.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: (saved) => {
        const eraNovo = !(id != null && id > 0);
        if (saved?.id && saved.id > 0) {
          this.configAtual = saved;
          this.configId.set(saved.id);
          this.timeZoneId.set(saved.timeZoneId || tz);
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
}

