import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  PeriodoDataPickerComponent,
  type PeriodoDataSelecionado
} from '../../../../../../shared/ui/periodo-data-picker/periodo-data-picker.component';
import {
  cloneAcordo,
  MESES_ACORDO,
  mensagensValidacaoAcordo,
  mesesOcupados,
  novaListagemAcordo,
  sincronizarVagasDoAcordo,
  vagasFobDoMes
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
    MatSnackBarModule,
    PeriodoDataPickerComponent
  ],
  templateUrl: './config-cobranca-acordo-dialog.component.html',
  styleUrl: './config-cobranca-acordo-dialog.component.scss'
})
export class ConfigCobrancaAcordoDialogComponent {
  readonly ref = inject(MatDialogRef<ConfigCobrancaAcordoDialogComponent, ConfigCobrancaAcordo | undefined>);
  readonly data = inject<ConfigCobrancaAcordoDialogData>(MAT_DIALOG_DATA);
  private readonly snack = inject(MatSnackBar);

  readonly mesesAcordo = MESES_ACORDO;
  /** Sentinela só do UI; nunca entra nas vagas/API (meses válidos: 1–12). */
  readonly todosMesesSentinel = 0;

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

  mesesDisponiveis(listagem: ConfigCobrancaAcordoListagem): ConfigCobrancaMesAcordo[] {
    const ocupados = mesesOcupados(this.acordo, listagem.id);
    return this.mesesAcordo.map((m) => m.mes).filter((mes) => !ocupados.has(mes));
  }

  todosMesesSelecionados(listagem: ConfigCobrancaAcordoListagem): boolean {
    const disponiveis = this.mesesDisponiveis(listagem);
    return disponiveis.length > 0 && disponiveis.every((mes) => listagem.meses.includes(mes));
  }

  onMesesChange(listagem: ConfigCobrancaAcordoListagem, meses: Array<ConfigCobrancaMesAcordo | number>): void {
    const ocupados = mesesOcupados(this.acordo, listagem.id);
    const raw = meses ?? [];
    const pediuTodos = raw.some((mes) => Number(mes) === this.todosMesesSentinel);
    if (pediuTodos) {
      listagem.meses = this.todosMesesSelecionados(listagem) ? [] : [...this.mesesDisponiveis(listagem)];
      return;
    }
    listagem.meses = raw
      .map((mes) => Number(mes))
      .filter((mes): mes is ConfigCobrancaMesAcordo => mes >= 1 && mes <= 12 && !ocupados.has(mes))
      .sort((a, b) => a - b);
  }

  /** Mantém `dataInicio`/`dataFim` em ISO `yyyy-MM-dd` (contrato `dataInicioAcordo`/`dataFimAcordo`). */
  onPeriodoChange(periodo: PeriodoDataSelecionado): void {
    if (!periodo.ativo || !periodo.dataInicial || !periodo.dataFinal) {
      this.acordo.dataInicio = null;
      this.acordo.dataFim = null;
      return;
    }
    this.acordo.dataInicio = periodo.dataInicial;
    this.acordo.dataFim = periodo.dataFinal;
  }

  fobListagem(listagem: ConfigCobrancaAcordoListagem): string {
    const fob = vagasFobDoMes(listagem.quantidade, listagem.quantidadeCif);
    return fob == null ? '—' : String(fob);
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
