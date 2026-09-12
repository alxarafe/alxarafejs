import { Injectable, signal } from '@angular/core';

export type AppTheme = 'default' | 'alternative' | 'cyberpunk' | 'high-contrast' | 'vintage';

export interface ThemeOption {
  value: AppTheme;
  label: string;
}

const STORAGE_KEY = 'alxarafe.theme';
const DEFAULT_THEME: AppTheme = 'default';

export const THEMES: ThemeOption[] = [
  { value: 'default', label: 'Default (System)' },
  { value: 'alternative', label: 'Alternative' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'high-contrast', label: 'High Contrast' },
  { value: 'vintage', label: 'Vintage' },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly Themes = THEMES;
  readonly current = signal<AppTheme>(restoreTheme());

  constructor() {
    this.apply(this.current());
  }

  setTheme(theme: AppTheme): void {
    const resolved = THEMES.some((option) => option.value === theme) ? theme : DEFAULT_THEME;
    this.current.set(resolved);
    localStorage.setItem(STORAGE_KEY, resolved);
    this.apply(resolved);
  }

  private apply(theme: AppTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function restoreTheme(): AppTheme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return THEMES.some((option) => option.value === stored) ? (stored as AppTheme) : DEFAULT_THEME;
}