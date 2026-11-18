import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AgendamentoTimelineSlot } from '../agendamento-dashboard.util';
import { flexBar } from '../agendamento-dashboard.util';

@Component({
  selector: 'app-agendamento-dia-timeline',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './agendamento-dia-timeline.component.html',
  styleUrl: './agendamento-dia-timeline.component.scss',
})
export class AgendamentoDiaTimelineComponent {
  readonly dataLabel = input.required<string>();
  readonly slots = input.required<AgendamentoTimelineSlot[]>();
  readonly loading = input(false);
  readonly erro = input<string | null>(null);
  readonly janelasRoute = input<string | null>(null);
  readonly podeVerJanelas = input(false);

  readonly flexBar = flexBar;
}
