import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import {
  clearChunkReloadFlag,
  recoverFromChunkLoadFailure,
} from './app/core/utils/chunk-load-recovery';

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (recoverFromChunkLoadFailure(event.reason)) {
      event.preventDefault();
    }
  });
  window.addEventListener('error', (event) => {
    if (recoverFromChunkLoadFailure(event.error ?? event.message)) {
      event.preventDefault();
    }
  });
}

bootstrapApplication(App, appConfig)
  .then(() => clearChunkReloadFlag())
  .catch((err) => {
    if (!recoverFromChunkLoadFailure(err)) {
      console.error(err);
    }
  });
