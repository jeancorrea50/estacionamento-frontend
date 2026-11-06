import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface FaturaConfirmDialogData {
  titulo: string;
  mensagem: string;
  confirmLabel?: string;
  /** Ícone do header; padrão warning. */
  icon?: string;
  /** Usa estilo de alerta (estorno/exclusão). */
  danger?: boolean;
}

@Component({
  selector: 'app-fatura-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <div class="fat-dlg">
      <header class="fat-dlg__header">
        <div class="fat-dlg__header-main">
          <div class="fat-dlg__icon" [class.fat-dlg__icon--warn]="data.danger !== false" aria-hidden="true">
            <span class="material-symbols-outlined">{{ data.icon || 'warning' }}</span>
          </div>
          <div class="fat-dlg__titles">
            <h2 class="fat-dlg__title" mat-dialog-title>{{ data.titulo }}</h2>
            <p class="fat-dlg__subtitle">Confirme para continuar com a operação.</p>
          </div>
        </div>
        <button type="button" class="fat-dlg__close" aria-label="Fechar" (click)="ref.close(false)">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>

      <mat-dialog-content class="fat-dlg__body">
        <section class="fat-dlg__card">
          <p class="fat-dlg__hint" style="margin:0">{{ data.mensagem }}</p>
        </section>
      </mat-dialog-content>

      <footer class="fat-dlg__footer">
        <button type="button" mat-button (click)="ref.close(false)">Cancelar</button>
        <button type="button" mat-flat-button [color]="data.danger === false ? 'primary' : 'warn'" (click)="ref.close(true)">
          {{ data.confirmLabel || 'Confirmar' }}
        </button>
      </footer>
    </div>
  `,
  styleUrl: './fatura-confirm-dialog.component.scss'
})
export class FaturaConfirmDialogComponent {
  readonly ref = inject(MatDialogRef<FaturaConfirmDialogComponent, boolean>);
  readonly data = inject<FaturaConfirmDialogData>(MAT_DIALOG_DATA);
}
