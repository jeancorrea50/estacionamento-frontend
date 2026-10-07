import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection
} from '@angular/core';
import { NavigationError, provideRouter, withNavigationErrorHandler } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { routes } from './app.routes';
import { authInterceptor } from './core/api/interceptors/auth.interceptor';
import { errorInterceptor } from './core/api/interceptors/error.interceptor';
import { mutationThrottleInterceptor } from './core/api/interceptors/mutation-throttle.interceptor';
import { recoverFromChunkLoadFailure } from './core/utils/chunk-load-recovery';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withNavigationErrorHandler((error: NavigationError) => {
        recoverFromChunkLoadFailure(error.error ?? error);
      })
    ),
    provideHttpClient(
      withInterceptors([authInterceptor, mutationThrottleInterceptor, errorInterceptor])
    ),
    /** Angular Material + PrimeNG (ripple, overlays, etc.) */
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: 'html.theme-dark, .theme-dark'
        }
      }
    }),
    /** ng2-charts (Chart.js): registra controllers/elements padrão uma vez na aplicação */
    provideCharts(withDefaultRegisterables())
  ]
};
