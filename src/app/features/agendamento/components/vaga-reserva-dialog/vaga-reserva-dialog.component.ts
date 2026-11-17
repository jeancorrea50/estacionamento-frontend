import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { VagaReservaPanelComponent } from '../vaga-reserva-panel/vaga-reserva-panel.component';

export interface VagaReservaDialogData {
  podeGerenciar: boolean;
}

/** Use `panelClass: 'vaga-reserva-dialog-panel'` ao abrir (tema light/dark). */
@Component({
  selector: 'app-vaga-reserva-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, VagaReservaPanelComponent],
  templateUrl: './vaga-reserva-dialog.component.html',
  styleUrls: ['./vaga-reserva-dialog.component.scss'],
})
export class VagaReservaDialogComponent {
  readonly data = inject<VagaReservaDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<VagaReservaDialogComponent>);
}
