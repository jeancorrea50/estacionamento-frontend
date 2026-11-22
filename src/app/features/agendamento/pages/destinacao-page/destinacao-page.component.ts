import { Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { AGENDAMENTO_PAINEL_ROUTE, DESTINACAO_ROUTE } from '../../agendamento-rotas';
import { VagaReservaPanelComponent } from '../../components/vaga-reserva-panel/vaga-reserva-panel.component';

/**
 * Destinação por acordo — tela dedicada (substitui o modal legado do Painel).
 * Reutiliza o painel operacional (transportadora, horário, CIF/FOB, vigência).
 */
@Component({
  selector: 'app-destinacao-page',
  standalone: true,
  imports: [RouterLink, VagaReservaPanelComponent],
  templateUrl: './destinacao-page.component.html',
  styleUrls: ['./destinacao-page.component.scss'],
})
export class DestinacaoPageComponent implements OnInit {
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly permissions = inject(PermissionCacheService);
  private readonly router = inject(Router);

  readonly painelRoute = AGENDAMENTO_PAINEL_ROUTE;

  readonly podeVisualizar = computed(
    () =>
      this.permissions.allows('destinacao', 'visualizar') ||
      this.permissions.allows('agendamentos', 'visualizar')
  );

  readonly podeGerenciar = computed(
    () =>
      this.permissions.allows('destinacao', 'gravar') ||
      this.permissions.allows('destinacao', 'alterar') ||
      this.permissions.allows('agendamentos', 'gravar') ||
      this.permissions.allows('agendamentos', 'alterar')
  );

  ngOnInit(): void {
    if (!this.sessionAccess.canAccessRoute(DESTINACAO_ROUTE)) {
      void this.router.navigateByUrl('/app');
    }
  }
}
