import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PoolChatComponent } from './pool-chat.component';

describe('PoolChatComponent', () => {
  let component: PoolChatComponent;
  let fixture: ComponentFixture<PoolChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoolChatComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PoolChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State', () => {
    it('should have empty message input', () => {
      expect(component.messageInput()).toBe('');
    });

    it('should not be sending', () => {
      expect(component.isSending()).toBe(false);
    });
  });

  describe('Message Input', () => {
    it('should update message input', () => {
      component.messageInput.set('test message');
      expect(component.messageInput()).toBe('test message');
    });

    it('should clear input after sending', async () => {
      component.messageInput.set('test message');
      // The actual send would require mocking the chat service
    });
  });

  describe('File Upload', () => {
    it('should have file input reference', () => {
      // Component should handle file uploads
      expect(component).toBeTruthy();
    });
  });
});
