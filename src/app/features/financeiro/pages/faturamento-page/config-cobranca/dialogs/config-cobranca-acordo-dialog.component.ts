import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  cloneAcordo,
  MESES_ACORDO,
  mensagensValidacaoAcordo,
  mesesOcupados,
  novaListagemAcordo,
  sincronizarVagasDoAcordo
} from '../config-cobranca-acordo.util';
import type {
  ConfigCobrancaAcordo,
  ConfigCobrancaAcordoListagem,
  ConfigCobrancaMesAcordo
} from '../faturamento-config-cobranca.types';

export interface ConfigCobrancaAcordoDialogData {
  acordo: ConfigCobrancaAcordo;
  /** true = edição de acordo já existente */
  editando: boolean;
}

@Component({
  selector: 'app-config-cobranca-acordo-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  templateUrl: './config-cobranca-acordo-dialog.component.html',
  styleUrl: './config-cobranca-acordo-dialog.component.scss'
})
export class ConfigCobrancaAcordoDialogComponent {
  readonly ref = inject(MatDialogRef<ConfigCobrancaAcordoDialogComponent, ConfigCobrancaAcordo | undefined>);
  readonly data = inject<ConfigCobrancaAcordoDialogData>(MAT_DIALOG_DATA);
  private readonly snack = inject(MatSnackBar);

  readonly mesesAcordo = MESES_ACORDO;

  acordo: ConfigCobrancaAcordo = (() => {
    const rascunho = cloneAcordo(this.data.acordo);
    if (!rascunho.listagens.length) rascunho.listagens = [novaListagemAcordo()];
    return rascunho;
  })();

  erros: string[] = [];

  get titulo(): string {
    return this.data.editando ? 'Editar acordo' : 'Criar acordo';
  }

  adicionarListagem(): void {
    this.acordo.listagens = [...this.acordo.listagens, novaListagemAcordo()];
  }

  removerListagem(id: string): void {
    if (this.acordo.listagens.length <= 1) return;
    this.acordo.listagens = this.acordo.listagens.filter((l) => l.id !== id);
  }

  mesOcupado(listagem: ConfigCobrancaAcordoListagem, mes: ConfigCobrancaMesAcordo): boolean {
    return mesesOcupados(this.acordo, listagem.id).has(mes);
  }

  onMesesChange(listagem: ConfigCobrancaAcordoListagem, meses: ConfigCobrancaMesAcordo[]): void {
    const ocupados = mesesOcupados(this.acordo, listagem.id);
    listagem.meses = (meses ?? []).filter((mes) => !ocupados.has(mes)).sort((a, b) => a - b);
  }

  cancelar(): void {
    this.ref.close(undefined);
  }

  concluir(): void {
    this.acordo.listagens = this.acordo.listagens.filter((l) => l.meses.length > 0);
    sincronizarVagasDoAcordo(this.acordo);
    const erros = mensagensValidacaoAcordo(this.acordo, { validarExcedente: false });
    if (erros.length) {
      this.erros = erros;
      this.snack.open(erros[0], 'Fechar', { duration: 4500 });
      if (!this.acordo.listagens.length) this.acordo.listagens = [novaListagemAcordo()];
      return;
    }
    this.ref.close(cloneAcordo(this.acordo));
  }
}
