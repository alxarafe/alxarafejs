import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PaginatedList, ServiceResponse } from '../models/api';
import { ListParams, ResourceConfig } from './resource.types';

@Injectable({ providedIn: 'root' })
export class ResourceService {
  private readonly http = inject(HttpClient);

  list<T>(config: ResourceConfig, params: ListParams): Observable<ServiceResponse<PaginatedList<T> | null>> {
    let query = new HttpParams().set('$top', String(params.top)).set('$skip', String(params.skip));
    if (params.count) {
      query = query.set('$count', 'true');
    }
    return this.http.get<ServiceResponse<PaginatedList<T> | null>>(config.path, { params: query });
  }

  findById<T>(config: ResourceConfig, id: string | number): Observable<ServiceResponse<T | null>> {
    return this.http.get<ServiceResponse<T | null>>(`${config.path}/${id}`);
  }

  create<T>(config: ResourceConfig, body: unknown): Observable<ServiceResponse<T | null>> {
    return this.http.post<ServiceResponse<T | null>>(config.path, body);
  }

  update<T>(config: ResourceConfig, id: string | number, body: unknown): Observable<ServiceResponse<T | null>> {
    return this.http.put<ServiceResponse<T | null>>(`${config.path}/${id}`, body);
  }

  remove(config: ResourceConfig, id: string | number): Observable<ServiceResponse<null>> {
    return this.http.delete<ServiceResponse<null>>(`${config.path}/${id}`);
  }
}