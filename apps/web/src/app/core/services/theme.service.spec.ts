import { TestBed } from '@angular/core/testing';

import { THEMES, ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
  });

  it('exposes the resource-controller themes', () => {
    expect(THEMES.map((theme) => theme.value)).toEqual([
      'default',
      'alternative',
      'cyberpunk',
      'high-contrast',
      'vintage',
    ]);
  });

  it('defaults to the default theme and applies it', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.current()).toBe('default');
    expect(document.documentElement.getAttribute('data-theme')).toBe('default');
  });

  it('applies and persists the selected theme', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('cyberpunk');
    expect(service.current()).toBe('cyberpunk');
    expect(document.documentElement.getAttribute('data-theme')).toBe('cyberpunk');
    expect(localStorage.getItem('alxarafe.theme')).toBe('cyberpunk');
  });

  it('falls back to default for unknown themes', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('neon' as unknown as 'default');
    expect(service.current()).toBe('default');
  });

  it('restores a persisted theme on boot', () => {
    localStorage.setItem('alxarafe.theme', 'vintage');
    const service = new ThemeService();
    expect(service.current()).toBe('vintage');
    expect(document.documentElement.getAttribute('data-theme')).toBe('vintage');
  });
});