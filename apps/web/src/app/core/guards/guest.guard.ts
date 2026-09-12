import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.me().pipe(
    map((res) => {
      const user = res.success && res.responseObject ? res.responseObject : null;
      if (user?.role === 'ADMIN') {
        router.navigate(['/users']);
        return false;
      }
      return true;
    }),
    catchError(() => of(true)),
  );
};