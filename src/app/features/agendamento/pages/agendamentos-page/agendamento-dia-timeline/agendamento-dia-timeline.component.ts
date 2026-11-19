import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AgendamentoTimelineSlot } from '../agendamento-dashboard.util';
import { flexBar } from '../agendamento-dashboard.util';

export type AgendamentoDiaVista = 'timeline' | 'grafico';

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

  readonly vista = signal<AgendamentoDiaVista>('timeline');
  readonly flexBar = flexBar;

  readonly maxEixo = computed(() => {
    const vals = this.slots().map((s) => Math.max(s.cadastrado, s.agendado + s.disponiveis, 1));
    const max = vals.length ? Math.max(...vals) : 1;
    return Math.max(1, Math.ceil(max));
  });

  readonly meioEixo = computed(() => Math.round(this.maxEixo() / 2));

  definirVista(v: AgendamentoDiaVista): void {
    this.vista.set(v);
  }

  alturaPct(valor: number): number {
    const max = this.maxEixo();
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, (Math.max(0, valor) / max) * 100));
  }

  rotuloCurto(s: AgendamentoTimelineSlot): string {
    const hi = (s.horaInicio || '').slice(0, 5);
    return hi || s.label;
  }
}
