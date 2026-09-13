import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { moduleRoutes } from './module-routes.generated';
import { LoginPage } from './pages/login/login';
import { ProfilePage } from './pages/profile/profile';
import { UsersPage } from './pages/users/users';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginPage, canActivate: [guestGuard] },
  { path: 'users', component: UsersPage, canActivate: [adminGuard] },
  { path: 'profile', component: ProfilePage, canActivate: [authGuard] },
  ...moduleRoutes,
  { path: '**', redirectTo: 'login' },
];