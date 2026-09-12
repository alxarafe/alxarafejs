import { TestBed } from '@angular/core/testing';

import { CrudFormComponent } from './crud-form.component';
import { ResourceConfig } from './resource.types';
import { ThemeService } from '../services/theme.service';

const booleanConfig: ResourceConfig = {
  path: '',
  title: 'Prueba',
  listFields: [],
  formFields: [{ name: 'active', label: 'Activo', type: 'boolean' }],
};

describe('CrudFormComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({ imports: [CrudFormComponent] });
  });

  function render(theme: 'default' | 'alternative', themeService: ThemeService) {
    themeService.setTheme(theme);
    const fixture = TestBed.createComponent(CrudFormComponent);
    fixture.componentRef.setInput('config', booleanConfig);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders a Sí/No select for boolean fields under the alternative theme', () => {
    const themeService = TestBed.inject(ThemeService);
    const element = render('alternative', themeService);

    const select = element.querySelector('select');
    expect(select).not.toBeNull();
    expect(select?.options.length).toBe(2);
    expect(select?.options[0]?.textContent?.trim()).toBe('Sí');
    expect(select?.options[1]?.textContent?.trim()).toBe('No');
    expect(element.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('renders a checkbox for boolean fields under the default theme', () => {
    const themeService = TestBed.inject(ThemeService);
    const element = render('default', themeService);

    expect(element.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(element.querySelector('select')).toBeNull();
  });
});