import { TestBed } from '@angular/core/testing';
import { ClaudeAIService } from './claude-ai.service';

describe('ClaudeAIService', () => {
  let service: ClaudeAIService;

  beforeEach(() => {
    // Clear localStorage to avoid polluting tests
    try { localStorage.removeItem('mortgagemax_ai_provider'); } catch {}
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClaudeAIService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Provider Management', () => {
    it('should default to groq provider', () => {
      expect(service.provider()).toBe('groq');
    });

    it('should switch to claude provider', () => {
      service.setProvider('claude');
      expect(service.provider()).toBe('claude');
    });

    it('should set and store Groq API key', () => {
      service.setGroqApiKey('test-groq-key');
      expect(service.isConfigured()).toBe(true);
    });

    it('should set and store Claude API key', () => {
      service.setProvider('claude');
      service.setClaudeApiKey('test-claude-key');
      expect(service.isConfigured()).toBe(true);
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
  });

  describe('Provider Info', () => {
    it('should return correct info for groq', () => {
      service.setProvider('groq');
      const info = service.providerInfo();
      expect(info.name).toBe('Groq');
      expect(info.icon).toBe('⚡');
    });

    it('should return correct info for claude', () => {
      service.setProvider('claude');
      const info = service.providerInfo();
      expect(info.name).toBe('Claude');
      expect(info.icon).toBe('🧠');
    });
  });
});
