import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-est-status-pill-estacionamento',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './est-status-pill-estacionamento.component.html',
  styleUrl: './est-status-pill-estacionamento.component.scss',
})
export class EstStatusPillEstacionamentoComponent {
  @Input({ required: true }) ativo!: boolean;
}
