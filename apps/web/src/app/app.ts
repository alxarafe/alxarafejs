import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { AppTheme, ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App {
  readonly themeService = inject(ThemeService);

  setTheme(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.themeService.setTheme(target.value as AppTheme);
  }
}