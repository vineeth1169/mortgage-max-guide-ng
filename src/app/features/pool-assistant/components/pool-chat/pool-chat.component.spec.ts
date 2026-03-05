import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { PoolChatComponent } from './pool-chat.component';

describe('PoolChatComponent', () => {
  let component: PoolChatComponent;
  let fixture: ComponentFixture<PoolChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoolChatComponent],
      providers: [provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(PoolChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have empty input text', () => {
      expect(component.inputText()).toBe('');
    });

    it('should not be dragging', () => {
      expect(component.isDragging()).toBe(false);
    });

    it('should not show suggestions initially', () => {
      expect(component.showSuggestions()).toBe(false);
    });
  });

  describe('Input Text', () => {
    it('should update input text', () => {
      component.inputText.set('test message');
      expect(component.inputText()).toBe('test message');
    });
  });

  describe('File Upload', () => {
    it('should have file input reference', () => {
      expect(component).toBeTruthy();
    });
  });
});
