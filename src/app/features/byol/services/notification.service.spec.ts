import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty notifications', () => {
    expect(service.notifications().length).toBe(0);
  });

  describe('success', () => {
    it('should add a success notification', () => {
      service.success('Test success');
      const notifications = service.notifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('success');
      expect(notifications[0].message).toBe('Test success');
    });
  });

  describe('error', () => {
    it('should add an error notification', () => {
      service.error('Test error');
      const notifications = service.notifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('error');
      expect(notifications[0].message).toBe('Test error');
    });
  });

  describe('info', () => {
    it('should add an info notification', () => {
      service.info('Test info');
      const notifications = service.notifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('info');
      expect(notifications[0].message).toBe('Test info');
    });
  });

  describe('warning', () => {
    it('should add a warning notification', () => {
      service.warning('Test warning');
      const notifications = service.notifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('warning');
      expect(notifications[0].message).toBe('Test warning');
    });
  });

  describe('remove', () => {
    it('should remove a notification by id', () => {
      service.success('Notification 1');
      service.error('Notification 2');

      const notifications = service.notifications();
      expect(notifications.length).toBe(2);

      service.remove(notifications[0].id);
      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].message).toBe('Notification 2');
    });

    it('should not fail when removing non-existent id', () => {
      service.success('Test');
      service.remove('non-existent-id');
      expect(service.notifications().length).toBe(1);
    });
  });

  describe('auto-removal', () => {
    beforeEach(() => {
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should auto-remove notification after duration', () => {
      service.success('Auto-remove', 1000);
      expect(service.notifications().length).toBe(1);

      jasmine.clock().tick(1001);
      expect(service.notifications().length).toBe(0);
    });

    it('should auto-remove error notification after 5 seconds', () => {
      service.error('Error msg');
      expect(service.notifications().length).toBe(1);

      jasmine.clock().tick(5001);
      expect(service.notifications().length).toBe(0);
    });
  });

  describe('multiple notifications', () => {
    it('should handle multiple notifications', () => {
      service.success('Success');
      service.error('Error');
      service.info('Info');
      service.warning('Warning');

      expect(service.notifications().length).toBe(4);
    });

    it('should assign unique ids', () => {
      service.success('Notification 1');
      service.success('Notification 2');
      service.success('Notification 3');

      const ids = service.notifications().map((n) => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });
});
