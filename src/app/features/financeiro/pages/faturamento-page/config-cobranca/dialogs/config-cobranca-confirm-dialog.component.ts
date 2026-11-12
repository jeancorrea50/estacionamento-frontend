import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ConfigCobrancaConfirmDialogData {
  titulo: string;
  mensagem: string;
}

@Component({
  selector: 'app-config-cobranca-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <div class="fat-dlg">
      <header class="fat-dlg__header">
        <div class="fat-dlg__header-main">
          <div class="fat-dlg__icon fat-dlg__icon--warn" aria-hidden="true">
            <span class="material-symbols-outlined">delete</span>
          </div>
          <div class="fat-dlg__titles">
            <h2 class="fat-dlg__title" mat-dialog-title>{{ data.titulo }}</h2>
            <p class="fat-dlg__subtitle">Esta ação não pode ser desfeita facilmente.</p>
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
        <button type="button" mat-flat-button color="warn" (click)="ref.close(true)">Remover</button>
      </footer>
    </div>
  `,
  styleUrl: './config-cobranca-confirm-dialog.component.scss'
})
export class ConfigCobrancaConfirmDialogComponent {
  readonly ref = inject(MatDialogRef<ConfigCobrancaConfirmDialogComponent, boolean>);
  readonly data = inject<ConfigCobrancaConfirmDialogData>(MAT_DIALOG_DATA);
}
