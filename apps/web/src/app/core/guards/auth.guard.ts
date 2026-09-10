import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.me().pipe(
    map((res) => {
      const ok = res.success && !!res.responseObject;
      if (!ok) {
        router.navigate(['/login']);
      }
      return ok;
    }),
    catchError(() => {
      router.navigate(['/login']);
      return of(false);
    }),
  );
};