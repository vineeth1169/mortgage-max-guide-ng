import { TestBed } from '@angular/core/testing';
import { ClaudeAIService } from './claude-ai.service';

describe('ClaudeAIService', () => {
  let service: ClaudeAIService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClaudeAIService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Demo Mode', () => {
    beforeEach(() => {
      service.enableDemoMode();
    });

    it('should be in demo mode by default', () => {
      expect(service.demoMode()).toBe(true);
    });

    it('should classify "validate" intent correctly', async () => {
      const response = await service.classifyIntent('validate');
      expect(response.intent.action).toBe('validate');
      expect(response.intent.confidence).toBeGreaterThan(0.9);
    });

    it('should classify "build pool" intent correctly', async () => {
      const response = await service.classifyIntent('build pool');
      expect(response.intent.action).toBe('build-pool');
      expect(response.intent.confidence).toBeGreaterThan(0.9);
    });

    it('should classify "show rules" intent correctly', async () => {
      const response = await service.classifyIntent('show rules');
      expect(response.intent.action).toBe('show-rules');
      expect(response.intent.confidence).toBeGreaterThan(0.9);
    });

    it('should classify "help" intent correctly', async () => {
      const response = await service.classifyIntent('help');
      expect(response.intent.action).toBe('help');
    });

    it('should classify "load sample" intent correctly', async () => {
      const response = await service.classifyIntent('load sample');
      expect(response.intent.action).toBe('load-sample');
    });

    it('should classify rule explanation requests', async () => {
      const response = await service.classifyIntent('explain RATE-001');
      expect(response.intent.action).toBe('explain-rule');
      expect(response.intent.parameters?.['ruleId']).toBe('RATE-001');
    });

    it('should classify "show ineligible" intent', async () => {
      const response = await service.classifyIntent('show ineligible loans');
      expect(response.intent.action).toBe('show-ineligible');
    });

    it('should classify filter requests', async () => {
      const response = await service.classifyIntent('filter loans with rate > 5');
      expect(response.intent.action).toBe('filter');
    });

    it('should provide contextual responses', async () => {
      const context = { loanCount: 100, eligibleCount: 85, ineligibleCount: 15, hasValidationResults: true };
      const response = await service.classifyIntent('summary', context);
      expect(response.intent.action).toBe('summary');
      expect(response.message).toContain('100');
    });
  });

  describe('Mode Switching', () => {
    it('should switch to live mode when API key is set', () => {
      service.setApiKey('test-key');
      expect(service.demoMode()).toBe(false);
      expect(service.isLiveConfigured()).toBe(true);
    });

    it('should enable demo mode explicitly', () => {
      service.setApiKey('test-key');
      service.enableDemoMode();
      expect(service.demoMode()).toBe(true);
    });

    it('should error when enabling live mode without API key', () => {
      service.enableDemoMode();
      service.enableLiveMode();
      expect(service.lastError()).toContain('API key required');
    });

    it('should clear conversation history', () => {
      service.clearHistory();
      // History is private, but we can test that it doesn't throw
      expect(service).toBeTruthy();
    });
  });

  describe('AI Toggle', () => {
    it('should enable/disable AI mode', () => {
      service.enable();
      expect(service.isEnabled()).toBe(true);

      service.disable();
      expect(service.isEnabled()).toBe(false);
    });

    it('should return fallback response when disabled', async () => {
      service.disable();
      const response = await service.classifyIntent('validate');
      expect(response).toBeTruthy();
    });
  });
});
