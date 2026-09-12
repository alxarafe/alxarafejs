import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the shell layout', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main.shell')).toBeTruthy();
  });

  it('should offer a theme selector with the resource-controller themes', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector('.theme-toggle select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const labels = Array.from(select.options).map((option) => option.textContent?.trim());
    expect(labels).toEqual(['Default (System)', 'Alternative', 'Cyberpunk', 'High Contrast', 'Vintage']);
  });
});