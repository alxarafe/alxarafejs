import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiError } from '../../core/models/api';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './login.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success) {
          this.router.navigate(['/users']);
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.error.set(err.message);
      },
    });
  }
}