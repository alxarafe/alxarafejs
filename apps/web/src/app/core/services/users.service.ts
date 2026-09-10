import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PaginatedList, ServiceResponse } from '../models/api';
import { User } from '../models/user';

export interface UserListOptions {
  top: number;
  skip: number;
  count: boolean;
  filter?: string;
  orderBy?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list(options: UserListOptions): Observable<ServiceResponse<PaginatedList<User> | null>> {
    let params = new HttpParams().set('$top', String(options.top)).set('$skip', String(options.skip));
    if (options.count) {
      params = params.set('$count', 'true');
    }
    if (options.filter) {
      params = params.set('$filter', options.filter);
    }
    if (options.orderBy) {
      params = params.set('$orderby', options.orderBy);
    }
    return this.http.get<ServiceResponse<PaginatedList<User> | null>>('/api/users', { params });
  }
}