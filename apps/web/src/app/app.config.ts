import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { apiInterceptor } from './core/interceptors/api.interceptor';
import { AuthService } from './core/services/auth.service';

// CSRF (double-submit) needs the session token before any state-changing
// request. A reload loses the in-memory value while the session cookie
// survives, so re-login/logout would 403 without this bootstrap fetch.
function bootstrapCsrfToken(): void {
  inject(AuthService).fetchCsrfToken().subscribe();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(bootstrapCsrfToken),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),
  ],
};