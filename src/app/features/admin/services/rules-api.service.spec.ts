import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RulesApiService } from './rules-api.service';
import { Rule } from '../models/rule.model';

describe('RulesApiService', () => {
  let service: RulesApiService;
  let httpMock: HttpTestingController;

  const mockRule: Rule = {
    id: 'test-rule-1',
    name: 'Test Rule',
    ruleId: 'TEST-001',
    category: 'rate',
    description: 'A test rule',
    requirement: 'Must pass test',
    field: 'testField',
    operator: 'gt',
    value: 0,
    severity: 'error',
    guideReference: 'Section 1',
    explanation: 'This is a test',
    remediation: 'Fix the issue',
    enabled: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(RulesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('loadRules', () => {
    it('should fetch rules from API', async () => {
      const loadPromise = service.loadRules();

      const req = httpMock.expectOne('http://localhost:3001/api/rules');
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [mockRule] });

      await loadPromise;
      expect(service.rules().length).toBe(1);
      expect(service.rules()[0].name).toBe('Test Rule');
    });

    it('should set error on API failure', async () => {
      const loadPromise = service.loadRules();

      const req = httpMock.expectOne('http://localhost:3001/api/rules');
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Server Error' });

      await loadPromise;
      expect(service.error()).toBeTruthy();
    });
  });

  describe('createRule', () => {
    it('should create a new rule', async () => {
      // Pre-load rules first
      const loadPromise = service.loadRules();
      httpMock.expectOne('http://localhost:3001/api/rules').flush({ success: true, data: [] });
      await loadPromise;

      const newRule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'> = {
        name: 'New Rule',
        ruleId: 'NEW-001',
        category: 'balance',
        description: 'A new rule',
        requirement: 'Must be positive',
        field: 'upb',
        operator: 'gt',
        value: 0,
        severity: 'error',
        guideReference: 'Section 2',
        explanation: 'UPB must be positive',
        remediation: 'Set positive UPB',
        enabled: true
      };

      const createPromise = service.createRule(newRule);

      const req = httpMock.expectOne('http://localhost:3001/api/rules');
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, data: { ...newRule, id: 'new-id', createdAt: '', updatedAt: '' } });

      const result = await createPromise;
      expect(result).toBe(true);
      expect(service.rules().length).toBe(1);
    });
  });

  describe('updateRule', () => {
    it('should update an existing rule', async () => {
      // Pre-load rules
      const loadPromise = service.loadRules();
      httpMock.expectOne('http://localhost:3001/api/rules').flush({ success: true, data: [mockRule] });
      await loadPromise;

      const updates = { name: 'Updated Rule' };
      const updatePromise = service.updateRule('test-rule-1', updates);

      const req = httpMock.expectOne('http://localhost:3001/api/rules/test-rule-1');
      expect(req.request.method).toBe('PUT');
      req.flush({ success: true, data: { ...mockRule, ...updates } });

      const result = await updatePromise;
      expect(result).toBe(true);
      expect(service.rules()[0].name).toBe('Updated Rule');
    });
  });

  describe('deleteRule', () => {
    it('should delete a rule', async () => {
      // Pre-load rules
      const loadPromise = service.loadRules();
      httpMock.expectOne('http://localhost:3001/api/rules').flush({ success: true, data: [mockRule] });
      await loadPromise;

      const deletePromise = service.deleteRule('test-rule-1');

      const req = httpMock.expectOne('http://localhost:3001/api/rules/test-rule-1');
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true });

      const result = await deletePromise;
      expect(result).toBe(true);
      expect(service.rules().length).toBe(0);
    });
  });

  describe('toggleRule', () => {
    it('should toggle rule enabled status', async () => {
      // Pre-load rules
      const loadPromise = service.loadRules();
      httpMock.expectOne('http://localhost:3001/api/rules').flush({ success: true, data: [mockRule] });
      await loadPromise;

      const togglePromise = service.toggleRule('test-rule-1');

      const req = httpMock.expectOne('http://localhost:3001/api/rules/test-rule-1/toggle');
      expect(req.request.method).toBe('PATCH');
      req.flush({ success: true, data: { ...mockRule, enabled: false } });

      const result = await togglePromise;
      expect(result).toBe(true);
      expect(service.rules()[0].enabled).toBe(false);
    });
  });

  describe('computed properties', () => {
    it('should compute enabled rules count', async () => {
      const rules: Rule[] = [
        { ...mockRule, id: '1', enabled: true },
        { ...mockRule, id: '2', enabled: false },
        { ...mockRule, id: '3', enabled: true }
      ];

      const loadPromise = service.loadRules();
      httpMock.expectOne('http://localhost:3001/api/rules').flush({ success: true, data: rules });
      await loadPromise;

      expect(service.enabledCount()).toBe(2);
      expect(service.disabledCount()).toBe(1);
    });

    it('should compute rules by category', async () => {
      const rules: Rule[] = [
        { ...mockRule, id: '1', category: 'rate' },
        { ...mockRule, id: '2', category: 'rate' },
        { ...mockRule, id: '3', category: 'balance' }
      ];

      const loadPromise = service.loadRules();
      httpMock.expectOne('http://localhost:3001/api/rules').flush({ success: true, data: rules });
      await loadPromise;

      const byCategory = service.rulesByCategory();
      expect(byCategory['rate'].length).toBe(2);
      expect(byCategory['balance'].length).toBe(1);
    });
  });
});
