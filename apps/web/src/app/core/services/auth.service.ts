import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ServiceResponse } from '../models/api';
import { AuthSession, User } from '../models/user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _user = signal<User | null>(null);
  private csrfTokenValue: string | null = null;

  readonly user = this._user.asReadonly();

  get csrfToken(): string | null {
    return this.csrfTokenValue;
  }

  login(email: string, password: string): Observable<ServiceResponse<AuthSession>> {
    return this.http.post<ServiceResponse<AuthSession>>('/api/auth/login', { email, password }).pipe(
      tap((res) => {
        if (res.success && res.responseObject) {
          this.captureSession(res.responseObject);
        }
      }),
    );
  }

  me(): Observable<ServiceResponse<User | null>> {
    return this.http.get<ServiceResponse<User | null>>('/api/auth/me').pipe(
      tap((res) => {
        if (res.success && res.responseObject) {
          this._user.set(res.responseObject);
        } else {
          this.clear();
        }
      }),
    );
  }

  fetchCsrfToken(): Observable<ServiceResponse<{ csrfToken: string } | null>> {
    return this.http.get<ServiceResponse<{ csrfToken: string } | null>>('/api/auth/csrf').pipe(
      tap((res) => {
        if (res.success && res.responseObject) {
          this.csrfTokenValue = res.responseObject.csrfToken;
        }
      }),
    );
  }

  logout(): Observable<ServiceResponse<null>> {
    return this.http.post<ServiceResponse<null>>('/api/auth/logout', {}).pipe(tap(() => this.clear()));
  }

  private captureSession(session: AuthSession): void {
    this._user.set(session.user);
    this.csrfTokenValue = session.csrfToken;
  }

  private clear(): void {
    this._user.set(null);
    this.csrfTokenValue = null;
  }
}