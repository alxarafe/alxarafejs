import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ApiError } from '../models/api';
import { AuthService } from '../services/auth.service';

const CSRF_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function withCredentials(request: HttpRequest<unknown>): HttpRequest<unknown> {
  return request.withCredentials ? request : request.clone({ withCredentials: true });
}

function withCsrfToken(request: HttpRequest<unknown>): HttpRequest<unknown> {
  if (!CSRF_METHODS.includes(request.method)) {
    return request;
  }
  const token = inject(AuthService).csrfToken;
  return token ? request.clone({ setHeaders: { 'X-CSRF-Token': token } }) : request;
}

function toApiError(error: HttpErrorResponse): ApiError {
  const body = error.error as { message?: unknown } | null;
  const message = body && typeof body.message === 'string' ? body.message : error.message || `HTTP ${error.status}`;
  return new ApiError(message, error.status);
}

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const request = withCsrfToken(withCredentials(req));
  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        return throwError(() => toApiError(error));
      }
      return throwError(() => error);
    }),
  );
};