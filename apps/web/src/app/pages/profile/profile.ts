import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError } from '../../core/models/api';
import { User } from '../../core/models/user';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './profile.scss',
})
export class ProfilePage implements OnInit {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  ngOnInit(): void {
    const current = this.auth.user();
    if (!current) {
      this.router.navigate(['/login']);
      return;
    }
    this.auth.fetchCsrfToken().subscribe();
    this.load(current.id);
  }

  load(id: number): void {
    this.users.get(id).subscribe({
      next: (res) => {
        if (res.success && res.responseObject) {
          this.user.set(res.responseObject);
          this.auth.setCurrentUser(res.responseObject);
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  save(name: string, email: string): void {
    const current = this.user();
    if (!current) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    this.users.update(current.id, { name: name.trim(), email: email.trim() }).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success && res.responseObject) {
          this.user.set(res.responseObject);
          this.auth.setCurrentUser(res.responseObject);
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        this.error.set(err.message);
      },
    });
  }

  logout(): void {
    this.auth.logout().subscribe({ complete: () => this.router.navigate(['/login']) });
  }
}