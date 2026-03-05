import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { RulesManagerComponent } from './rules-manager.component';

describe('RulesManagerComponent', () => {
  let component: RulesManagerComponent;
  let fixture: ComponentFixture<RulesManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RulesManagerComponent],
      providers: [provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(RulesManagerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial state', () => {
    expect(component.showModal()).toBe(false);
    expect(component.editingRule()).toBeNull();
    expect(component.searchQuery).toBe('');
    expect(component.selectedCategory).toBe('');
  });

  describe('UI Interactions', () => {
    it('should open create modal', () => {
      component.openCreateModal();
      expect(component.showModal()).toBe(true);
      expect(component.editingRule()).toBeNull();
    });

    it('should close modal', () => {
      component.openCreateModal();
      component.closeModal();
      expect(component.showModal()).toBe(false);
    });

    it('should set search query', () => {
      component.searchQuery = 'test';
      expect(component.searchQuery).toBe('test');
    });

    it('should set category filter', () => {
      component.selectedCategory = 'rate';
      expect(component.selectedCategory).toBe('rate');
    });
  });

  describe('Computed Properties', () => {
    it('should compute filtered rules with search query', () => {
      // Initial state - no rules loaded
      expect(component.filteredRules().length).toBe(0);
    });
  });
});
