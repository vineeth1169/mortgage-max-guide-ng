import { TestBed } from '@angular/core/testing';
import { provideRouter, Routes, Router } from '@angular/router';
import { Location } from '@angular/common';
import { routes } from './app.routes';

describe('App Routes', () => {
  let router: Router;
  let location: Location;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    }).compileComponents();

    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
  });

  it('should have routes defined', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should have a default redirect to guide/4100', () => {
    const defaultRoute = routes.find(r => r.path === '');
    expect(defaultRoute).toBeTruthy();
    expect(defaultRoute!.redirectTo).toBe('guide/4100');
  });

  it('should have a guide/:sectionId route', () => {
    const guideRoute = routes.find(r => r.path === 'guide/:sectionId');
    expect(guideRoute).toBeTruthy();
    expect(guideRoute!.component).toBeTruthy();
  });

  it('should have a wildcard redirect to guide/4100', () => {
    const wildcardRoute = routes.find(r => r.path === '**');
    expect(wildcardRoute).toBeTruthy();
    expect(wildcardRoute!.redirectTo).toBe('guide/4100');
  });
});
