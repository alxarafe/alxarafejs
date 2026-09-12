import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { ContactsPage } from './pages/contacts/contacts';
import { LoginPage } from './pages/login/login';
import { UsersPage } from './pages/users/users';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginPage, canActivate: [guestGuard] },
  { path: 'contacts', component: ContactsPage, canActivate: [authGuard] },
  { path: 'users', component: UsersPage, canActivate: [adminGuard] },
  { path: '**', redirectTo: 'login' },
];