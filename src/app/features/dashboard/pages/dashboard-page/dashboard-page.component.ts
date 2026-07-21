import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalrDashboardService } from '../../../../core/services/signalr-dashboard.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.scss']
})
export class DashboardPageComponent implements OnInit {
  private readonly signalrDashboardService = inject(SignalrDashboardService);

  readonly dashboardAtualizado = this.signalrDashboardService.dashboardAtualizado;
  readonly movimentacoes = this.signalrDashboardService.movimentacoes;
  readonly alertaOperacional = this.signalrDashboardService.alertaOperacional;

  readonly ultimaMovimentacao = computed(() => {
    const lista = this.movimentacoes();
    return lista.length > 0 ? lista[lista.length - 1] : null;
  });

  ngOnInit(): void {
    void this.signalrDashboardService.connect();
  }
}
