import { Directive, HostListener, Input, inject } from '@angular/core';
import { ToastService } from '../api/services/toast.service';

/**
 * Diretiva explícita para botões críticos.
 * Uso: <button type="submit" appSubmitGuard [submitGuardMs]="1500">Salvar</button>
 *
 * O GlobalSubmitGuardService já cobre a maioria dos botões; esta diretiva
 * reforça o bloqueio no host e permite cooldown customizado.
 */
@Directive({
  selector: 'button[appSubmitGuard], input[appSubmitGuard], [appSubmitGuard]',
  standalone: true
})
export class SubmitGuardDirective {
  private readonly toast = inject(ToastService);
  private lockedUntil = 0;
  private lastToastAt = 0;

  /** Cooldown em ms após o primeiro clique válido. */
  @Input() submitGuardMs = 1500;

  /** Se true, exibe toast ao bloquear clique duplicado. */
  @Input() submitGuardToast = false;

  @HostListener('click', ['$event'])
  onClick(ev: Event): void {
    const now = Date.now();
    if (now < this.lockedUntil) {
      ev.preventDefault();
      ev.stopPropagation();
      if (this.submitGuardToast && now - this.lastToastAt > 1200) {
        this.lastToastAt = now;
        this.toast.warning('Aguarde um momento antes de repetir a ação.');
      }
      return;
    }
    this.lockedUntil = now + (this.submitGuardMs || 1500);
  }
}
