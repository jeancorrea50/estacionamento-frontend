import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { GlobalSubmitGuardService } from './core/ui/global-submit-guard.service';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('GTS-FrontEnd');

  constructor() {
    // Aplica o tema ao carregar (incluindo na tela de login)
    inject(ThemeService);
    // Bloqueio global de double-click em Salvar/Gravar/Alterar
    inject(GlobalSubmitGuardService).start();
  }
}
