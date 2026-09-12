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

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.me().pipe(
    map((res) => {
      const user = res.success && res.responseObject ? res.responseObject : null;
      if (!user) {
        router.navigate(['/login']);
        return false;
      }
      if (user.role !== 'ADMIN') {
        router.navigate(['/login']);
        return false;
      }
      return true;
    }),
    catchError(() => {
      router.navigate(['/login']);
      return of(false);
    }),
  );
};