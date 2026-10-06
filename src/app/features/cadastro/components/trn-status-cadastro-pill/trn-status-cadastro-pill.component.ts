import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  STATUS_CADASTRO_TRANSPORTADORA_LABEL,
  type StatusCadastroTransportadora,
} from '../../models/convite-transportadora.models';

@Component({
  selector: 'app-trn-status-cadastro-pill',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="trn-status-pill" [ngClass]="'trn-status-pill--' + variant">
      <span class="trn-status-pill__dot" aria-hidden="true"></span>
      {{ label }}
    </span>
  `,
  styles: [
    `
      .trn-status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        border: 1px solid transparent;
        white-space: nowrap;
      }
      .trn-status-pill__dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .trn-status-pill--ativa {
        color: color-mix(in srgb, var(--est-success, #22c55e) 96%, var(--text));
        background: color-mix(in srgb, var(--est-success, #22c55e) 12%, transparent);
        border-color: color-mix(in srgb, var(--est-success, #22c55e) 35%, transparent);
      }
      .trn-status-pill--ativa .trn-status-pill__dot {
        background: var(--est-success, #22c55e);
      }
      .trn-status-pill--enviado {
        color: color-mix(in srgb, #60a5fa 96%, var(--text));
        background: color-mix(in srgb, #3b82f6 14%, transparent);
        border-color: color-mix(in srgb, #3b82f6 38%, transparent);
      }
      .trn-status-pill--enviado .trn-status-pill__dot {
        background: #3b82f6;
      }
      .trn-status-pill--andamento {
        color: color-mix(in srgb, #fbbf24 96%, var(--text));
        background: color-mix(in srgb, #f59e0b 14%, transparent);
        border-color: color-mix(in srgb, #f59e0b 38%, transparent);
      }
      .trn-status-pill--andamento .trn-status-pill__dot {
        background: #f59e0b;
      }
      .trn-status-pill--aguardando {
        color: color-mix(in srgb, #c084fc 96%, var(--text));
        background: color-mix(in srgb, #a855f7 14%, transparent);
        border-color: color-mix(in srgb, #a855f7 38%, transparent);
      }
      .trn-status-pill--aguardando .trn-status-pill__dot {
        background: #a855f7;
      }
      .trn-status-pill--expirado,
      .trn-status-pill--inativa {
        color: color-mix(in srgb, var(--danger, #f87171) 92%, var(--text));
        background: color-mix(in srgb, var(--danger, #ef4444) 10%, transparent);
        border-color: color-mix(in srgb, var(--danger, #ef4444) 32%, transparent);
      }
      .trn-status-pill--expirado .trn-status-pill__dot,
      .trn-status-pill--inativa .trn-status-pill__dot {
        background: color-mix(in srgb, var(--danger, #ef4444) 88%, var(--text));
      }
    `,
  ],
})
export class TrnStatusCadastroPillComponent {
  @Input({ required: true }) status!: StatusCadastroTransportadora;

  get label(): string {
    return STATUS_CADASTRO_TRANSPORTADORA_LABEL[this.status] ?? this.status;
  }

  get variant(): string {
    switch (this.status) {
      case 'Ativa':
        return 'ativa';
      case 'ConviteEnviado':
        return 'enviado';
      case 'CadastroEmAndamento':
        return 'andamento';
      case 'AguardandoConclusao':
        return 'aguardando';
      case 'ConviteExpirado':
        return 'expirado';
      default:
        return 'inativa';
    }
  }
}
