import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DynamicValidationEngine, DynamicRule } from './dynamic-validation-engine.service';
import { LoanRecord } from '../models/pool-logic.model';

describe('DynamicValidationEngine', () => {
  let service: DynamicValidationEngine;
  let httpMock: HttpTestingController;

  const mockRule: DynamicRule = {
    id: 'rate-001',
    name: 'Interest Rate Range',
    category: 'rate',
    description: 'Interest rate must be within valid range',
    requirement: '0% < rate ≤ 12%',
    field: 'interestRate',
    operator: 'range',
    minValue: 0,
    maxValue: 12,
    minInclusive: false,
    maxInclusive: true,
    severity: 'error',
    guideReference: 'Section 4.6',
    explanation: 'Rate outside acceptable range',
    remediation: 'Verify rate is correct',
    enabled: true
  };

  const createLoan = (overrides: Partial<LoanRecord> = {}): LoanRecord => ({
    loanNumber: 'TEST-001',
    poolNumber: 'FG001234',
    mbsPoolPrefix: 'FG',
    interestRate: 5.5,
    couponRate: 5.0,
    netYield: 4.5,
    loanAgeMonths: 12,
    loanStatusCode: 'A',
    propertyType: 'SF',
    upb: 300000,
    currentInvestorBalance: 295000,
    ...overrides
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(DynamicValidationEngine);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('loadRules', () => {
    it('should load rules from API', async () => {
      const loadPromise = service.loadRules();

      const req = httpMock.expectOne(r => r.url.includes('/rules'));
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [mockRule] });

      const result = await loadPromise;
      expect(result).toBe(true);
      expect(service.rules().length).toBe(1);
      expect(service.isLoaded()).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      const loadPromise = service.loadRules();

      const req = httpMock.expectOne(r => r.url.includes('/rules'));
      req.error(new ProgressEvent('error'));

      const result = await loadPromise;
      expect(result).toBe(false);
      expect(service.error()).toBeTruthy();
    });

    it('should not load when useApiRules is false', async () => {
      service.useApiRules.set(false);
      const result = await service.loadRules();
      expect(result).toBe(false);
    });
  });

  describe('checkApiHealth', () => {
    it('should return true when API is healthy', async () => {
      const healthPromise = service.checkApiHealth();

      const req = httpMock.expectOne(r => r.url.includes('/health'));
      req.flush({ status: 'ok' });

      const result = await healthPromise;
      expect(result).toBe(true);
    });

    it('should return false when API is down', async () => {
      const healthPromise = service.checkApiHealth();

      const req = httpMock.expectOne(r => r.url.includes('/health'));
      req.error(new ProgressEvent('error'));

      const result = await healthPromise;
      expect(result).toBe(false);
    });
  });

  describe('validateLoan', () => {
    beforeEach(async () => {
      // Load rules first
      const loadPromise = service.loadRules();
      httpMock.expectOne(r => r.url.includes('/rules')).flush({ 
        success: true, 
        data: [
          { ...mockRule, id: 'rate-001', field: 'interestRate', operator: 'range', minValue: 0, maxValue: 12 },
          { ...mockRule, id: 'bal-001', field: 'upb', operator: 'gt', value: 0 }
        ] 
      });
      await loadPromise;
    });

    it('should validate loan against loaded rules', () => {
      const loan = createLoan();
      const violations = service.validateLoan(loan);
      expect(violations.length).toBe(0);
    });

    it('should return violations for invalid loan', () => {
      const loan = createLoan({ interestRate: 15 }); // > 12% max
      const violations = service.validateLoan(loan);
      expect(violations.some(v => v.rule.ruleId === 'rate-001')).toBe(true);
    });
  });

  describe('validateLoans', () => {
    beforeEach(async () => {
      const loadPromise = service.loadRules();
      httpMock.expectOne(r => r.url.includes('/rules')).flush({ 
        success: true, 
        data: [mockRule] 
      });
      await loadPromise;
    });

    it('should validate multiple loans', () => {
      const loans = [
        createLoan({ loanNumber: 'L001' }),
        createLoan({ loanNumber: 'L002', interestRate: 15 })
      ];
      const results = service.validateLoans(loans);
      expect(results.length).toBe(2);
      expect(results[0].eligible).toBe(true);
      expect(results[1].eligible).toBe(false);
    });
  });

  describe('computed properties', () => {
    it('should compute enabled rules', async () => {
      const rules: DynamicRule[] = [
        { ...mockRule, id: '1', enabled: true },
        { ...mockRule, id: '2', enabled: false },
        { ...mockRule, id: '3', enabled: true }
      ];

      const loadPromise = service.loadRules();
      httpMock.expectOne(r => r.url.includes('/rules')).flush({ success: true, data: rules });
      await loadPromise;

      expect(service.enabledRules().length).toBe(2);
      expect(service.ruleCount()).toBe(2);
    });
  });
});
