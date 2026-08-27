import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
import {
  EstacionamentoSearchField,
  EstacionamentoToolbarService
} from './services/estacionamento-toolbar.service';
import {
  EstacionamentoFormStepService,
  EstacionamentoFormStep,
  Estacionamento_STEP_LABELS
} from './services/estacionamento-form-step.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-estacionamento-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, FormsModule],
  templateUrl: './estacionamento-layout.component.html',
  styleUrls: ['./estacionamento-layout.component.scss']
})
export class EstacionamentoLayoutComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  readonly stepService = inject(EstacionamentoFormStepService);
  readonly toolbar = inject(EstacionamentoToolbarService);
  readonly isAdmin = inject(AuthService).isAdmin();

  /** True quando a rota é novo ou editar (formulário com stepper). */
  showStepper = signal(false);
  readonly stepLabels = Estacionamento_STEP_LABELS;
  private sub: { unsubscribe: () => void } | null = null;

  ngOnInit(): void {
    this.updateShowStepper();
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.updateShowStepper());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private updateShowStepper(): void {
    const url = this.router.url;
    this.showStepper.set(
      url.includes('estacionamento/novo') || url.includes('estacionamento/editar')
    );
  }

  onBuscar(): void {
    this.toolbar.triggerSearch();
  }

  setSearchField(value: string): void {
    this.toolbar.setSearchField(value as EstacionamentoSearchField);
  }

  searchPlaceholder(): string {
    switch (this.toolbar.searchField()) {
      case 'cnpj':
        return 'Digite o CNPJ';
      case 'nomeRazaoSocial':
        return 'Digite o nome / razão social';
      case 'descricao':
        return 'Digite o nome fantasia';
      case 'email':
        return 'Digite o e-mail';
      case 'id':
        return 'Digite o ID';
      default:
        return 'Pesquisar por nome, razão social ou CNPJ';
    }
  }

  get currentStep(): EstacionamentoFormStep {
    return this.stepService.currentStep();
  }

  getStepLabel(step: number): string {
    return this.stepLabels[step as EstacionamentoFormStep] ?? '';
  }

  goToStep(step: number): void {
    if (step === 1 || step === 2 || step === 3) {
      this.stepService.setStep(step);
    }
  }

  /** Salvar no cabeçalho: delega ao formulário (Cadastro ou Dados Bancários). */
  onHeaderSalvar(): void {
    this.stepService.requestSaveFromHeader();
  }
}
