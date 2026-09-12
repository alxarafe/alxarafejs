import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError, PaginationMeta } from '../../core/models/api';
import { User } from '../../core/models/user';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './users.scss',
})
export class UsersPage implements OnInit {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly rows = signal<User[]>([]);
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.auth.fetchCsrfToken().subscribe();
    this.loadPage(0);
  }

  loadPage(offset: number): void {
    const limit = this.pagination()?.limit ?? 10;
    this.loading.set(true);
    this.error.set(null);

    this.users.list({ top: limit, skip: offset, count: true }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.responseObject) {
          this.rows.set(res.responseObject.data);
          this.pagination.set(res.responseObject.pagination);
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.error.set(err.message);
      },
    });
  }

  nextPage(): void {
    const pagination = this.pagination();
    if (pagination?.nextLink) {
      this.loadPage(pagination.offset + pagination.limit);
    }
  }

  previousPage(): void {
    const pagination = this.pagination();
    if (pagination?.previousLink) {
      this.loadPage(Math.max(pagination.offset - pagination.limit, 0));
    }
  }

  logout(): void {
    this.auth.logout().subscribe({ complete: () => this.router.navigate(['/login']) });
  }
}