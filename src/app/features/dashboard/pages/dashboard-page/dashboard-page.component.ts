import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  DashboardAtualizadoPayload,
  MovimentacaoAtualizadaItem,
  MovimentacaoAtualizadaPayload
} from '../../../../core/models/dashboard.models';
import { SignalrDashboardService } from '../../../../core/services/signalr-dashboard.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.scss']
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  dashboardAtualizado: DashboardAtualizadoPayload | null = null;
  movimentacoes: MovimentacaoAtualizadaPayload = [];
  alertaOperacional = '';

  private readonly subscription = new Subscription();

  constructor(private readonly signalrDashboardService: SignalrDashboardService) {}

  ngOnInit(): void {
    void this.signalrDashboardService.connect();
    this.subscription.add(this.signalrDashboardService.validarMovimentacoesAtualizadas().subscribe());
    this.observeDashboardStreams();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get ultimaMovimentacao(): MovimentacaoAtualizadaItem | null {
    return this.movimentacoes.length > 0 ? this.movimentacoes[this.movimentacoes.length - 1] : null;
  }

  private observeDashboardStreams(): void {
    this.subscription.add(
      this.signalrDashboardService.dashboardAtualizado$.subscribe((payload) => {
        this.dashboardAtualizado = payload;
      })
    );

    this.subscription.add(
      this.signalrDashboardService.movimentacaoAtualizada$.subscribe((payload) => {
        this.movimentacoes = payload;
      })
    );

    this.subscription.add(
      this.signalrDashboardService.alertaOperacional$.subscribe((payload) => {
        this.alertaOperacional = payload;
      })
    );
  }
}
