import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-est-summary-metric',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './est-summary-metric.component.html',
  styleUrl: './est-summary-metric.component.scss',
})
export class EstSummaryMetricComponent {
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number;
  /** Cor do destaque visual (ícone + borda esquerda). */
  @Input() variant: 'neutral' | 'success' | 'danger' = 'neutral';
  /** Texto auxiliar opcional (ex.: “Nesta página” quando há paginação). */
  @Input() hint: string | null = null;
}
