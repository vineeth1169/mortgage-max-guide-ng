import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LoanValidationService } from './loan-validation.service';
import { LoanRecord } from '../models/pool-logic.model';
import { DynamicRule } from './dynamic-validation-engine.service';

describe('LoanValidationService', () => {
  let service: LoanValidationService;
  let httpMock: HttpTestingController;

  /** Realistic mock rules matching the backend's default ruleset */
  const mockRules: DynamicRule[] = [
    { id: 'RATE-001', name: 'Positive Interest Rate', category: 'rate', description: 'Rate in range', requirement: '0 < rate <= 12', field: 'interestRate', operator: 'range', minValue: 0, maxValue: 12, minInclusive: false, maxInclusive: true, severity: 'error', guideReference: 'Sec 4.6', explanation: '', remediation: '', enabled: true },
    { id: 'RATE-002', name: 'Coupon ≤ Interest', category: 'rate', description: 'Coupon rate check', requirement: 'couponRate <= interestRate', field: 'couponRate', operator: 'lte', compareField: 'interestRate', severity: 'error', guideReference: 'Sec 4.6', explanation: '', remediation: '', enabled: true },
    { id: 'BAL-001', name: 'Positive UPB', category: 'balance', description: 'UPB check', requirement: 'UPB > 0', field: 'upb', operator: 'gt', value: 0, severity: 'error', guideReference: '', explanation: '', remediation: '', enabled: true },
    { id: 'BAL-003', name: 'Conforming Loan Limit', category: 'balance', description: 'UPB limit', requirement: 'UPB <= 766550', field: 'upb', operator: 'lte', value: 766550, severity: 'error', guideReference: '', explanation: '', remediation: '', enabled: true },
    { id: 'PROP-001', name: 'Eligible Property Types', category: 'property', description: 'Property type', requirement: 'propertyType in [SF,CO,CP,PU,MH]', field: 'propertyType', operator: 'in', values: ['SF','CO','CP','PU','MH'], severity: 'error', guideReference: '', explanation: '', remediation: '', enabled: true },
    { id: 'STATUS-001', name: 'Active Loan Status', category: 'status', description: 'Loan status', requirement: 'loanStatusCode in [A,C]', field: 'loanStatusCode', operator: 'in', values: ['A','C'], severity: 'error', guideReference: '', explanation: '', remediation: '', enabled: true },
    { id: 'AGE-001', name: 'Minimum Seasoning', category: 'age', description: 'Loan age', requirement: 'loanAgeMonths >= 4', field: 'loanAgeMonths', operator: 'gte', value: 4, severity: 'error', guideReference: '', explanation: '', remediation: '', enabled: true },
    { id: 'POOL-001', name: 'Pool Number Assigned', category: 'pool', description: 'Pool number', requirement: 'poolNumber required', field: 'poolNumber', operator: 'required', severity: 'error', guideReference: '', explanation: '', remediation: '', enabled: true },
    { id: 'PREFIX-001', name: 'Valid MBS Prefix', category: 'pool', description: 'Prefix', requirement: 'mbsPoolPrefix in [MX,MA,MF]', field: 'mbsPoolPrefix', operator: 'in', values: ['MX','MA','MF'], severity: 'error', guideReference: '', explanation: '', remediation: '', enabled: true },
  ];

  /** Helper to load mock rules via Http mock */
  async function loadMockRules(): Promise<void> {
    const loadPromise = service.loadRules();
    httpMock.expectOne(req => req.url.includes('/rules')).flush({ success: true, data: mockRules });
    await loadPromise;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(LoanValidationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getRules', () => {
    it('should return all eligibility rules after loading', async () => {
      await loadMockRules();
      const rules = service.getRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.ruleId === 'RATE-001')).toBe(true);
    });
  });

  describe('CSV Parsing', () => {
    it('should parse valid CSV data', () => {
      const csv = `loanNumber,interestRate,currentInvestorBalance,propertyType,upb
L001,5.5,250000,SF,260000
L002,4.75,180000,CO,185000`;
      
      const result = service.parseCSV(csv);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.loans.length).toBe(2);
        expect(result.loans[0].loanNumber).toBe('L001');
        expect(result.loans[0].interestRate).toBe(5.5);
      }
    });

    it('should fail for missing required fields', () => {
      const csv = `loanNumber,someOtherField
L001,value`;
      
      const result = service.parseCSV(csv);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.missingFields.length).toBeGreaterThan(0);
      }
    });
  });

  describe('JSON Parsing', () => {
    it('should parse valid JSON array', () => {
      const json = JSON.stringify([
        { loanNumber: 'L001', interestRate: 5.5, currentInvestorBalance: 250000, propertyType: 'SF', upb: 260000 },
        { loanNumber: 'L002', interestRate: 4.75, currentInvestorBalance: 180000, propertyType: 'CO', upb: 185000 }
      ]);
      
      const result = service.parseJSON(json);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.loans.length).toBe(2);
      }
    });

    it('should fail for invalid JSON', () => {
      const result = service.parseJSON('not valid json');
      expect(result.ok).toBe(false);
    });
  });

  describe('Loan Validation', () => {
    const createValidLoan = (overrides: Partial<LoanRecord> = {}): LoanRecord => ({
      loanNumber: 'TEST-001',
      poolNumber: 'MX001234',
      mbsPoolPrefix: 'MX',
      interestRate: 5.5,
      couponRate: 5.0,
      netYield: 4.5,
      loanAgeMonths: 12,
      loanStatusCode: 'A',
      rateTypeCode: 'FRM',
      propertyType: 'SF',
      specialCategory: '',
      upb: 300000,
      currentInvestorBalance: 295000,
      ...overrides
    });

    beforeEach(async () => {
      await loadMockRules();
    });

    it('should validate a fully compliant loan as eligible', () => {
      const loans = [createValidLoan()];
      const results = service.validateLoans(loans);
      
      expect(results.length).toBe(1);
      expect(results[0].eligible).toBe(true);
      expect(results[0].violations.filter(v => v.severity === 'error').length).toBe(0);
    });

    it('should flag invalid interest rate', () => {
      const loans = [createValidLoan({ interestRate: 15 })]; // > 12% limit
      const results = service.validateLoans(loans);
      
      expect(results[0].eligible).toBe(false);
      expect(results[0].violations.some(v => v.rule.ruleId === 'RATE-001')).toBe(true);
    });

    it('should flag coupon rate exceeding interest rate', () => {
      const loans = [createValidLoan({ couponRate: 6, interestRate: 5 })];
      const results = service.validateLoans(loans);
      
      expect(results[0].eligible).toBe(false);
      expect(results[0].violations.some(v => v.rule.ruleId === 'RATE-002')).toBe(true);
    });

    it('should flag negative UPB', () => {
      const loans = [createValidLoan({ upb: -1000 })];
      const results = service.validateLoans(loans);
      
      expect(results[0].eligible).toBe(false);
      expect(results[0].violations.some(v => v.rule.ruleId === 'BAL-001')).toBe(true);
    });

    it('should flag UPB exceeding conforming limit', () => {
      const loans = [createValidLoan({ upb: 800000 })]; // > $766,550
      const results = service.validateLoans(loans);
      
      expect(results[0].eligible).toBe(false);
      expect(results[0].violations.some(v => v.rule.ruleId === 'BAL-003')).toBe(true);
    });

    it('should flag invalid property type', () => {
      const loans = [createValidLoan({ propertyType: 'INVALID' })];
      const results = service.validateLoans(loans);
      
      expect(results[0].eligible).toBe(false);
      expect(results[0].violations.some(v => v.rule.ruleId === 'PROP-001')).toBe(true);
    });

    it('should flag inactive loan status', () => {
      const loans = [createValidLoan({ loanStatusCode: 'D' })]; // Delinquent
      const results = service.validateLoans(loans);
      
      expect(results[0].eligible).toBe(false);
      expect(results[0].violations.some(v => v.rule.ruleId === 'STATUS-001')).toBe(true);
    });

    it('should flag loans younger than 4 months', () => {
      const loans = [createValidLoan({ loanAgeMonths: 2 })];
      const results = service.validateLoans(loans);
      
      expect(results[0].eligible).toBe(false);
      expect(results[0].violations.some(v => v.rule.ruleId === 'AGE-001')).toBe(true);
    });

    it('should flag missing pool number', () => {
      const loans = [createValidLoan({ poolNumber: '' })];
      const results = service.validateLoans(loans);
      
      expect(results[0].eligible).toBe(false);
      expect(results[0].violations.some(v => v.rule.ruleId === 'POOL-001')).toBe(true);
    });

    it('should flag invalid MBS prefix', () => {
      const loans = [createValidLoan({ mbsPoolPrefix: 'XX' })];
      const results = service.validateLoans(loans);
      
      expect(results[0].eligible).toBe(false);
      expect(results[0].violations.some(v => v.rule.ruleId === 'PREFIX-001')).toBe(true);
    });
  });

  describe('Pool Summary', () => {
    beforeEach(async () => {
      await loadMockRules();
    });

    it('should build pool summary from validation results', () => {
      const loan: LoanRecord = {
        loanNumber: 'TEST-001',
        poolNumber: 'MX001234',
        mbsPoolPrefix: 'MX',
        interestRate: 5.5,
        couponRate: 5.0,
        netYield: 4.5,
        loanAgeMonths: 12,
        loanStatusCode: 'A',
        rateTypeCode: 'FRM',
        propertyType: 'SF',
        specialCategory: '',
        upb: 300000,
        currentInvestorBalance: 295000
      };
      
      const results = service.validateLoans([loan]);
      const summary = service.buildPoolSummary(results, [loan]);
      
      expect(summary.totalLoans).toBe(1);
      expect(summary.totalUPB).toBe(300000);
      expect(summary.eligibleLoans).toBe(1);
    });
  });

  describe('Sample Loans', () => {
    it('should generate sample loans', () => {
      const samples = service.getSampleLoans();
      expect(samples.length).toBeGreaterThan(0);
      expect(samples.every((s: LoanRecord) => s.loanNumber)).toBe(true);
    });
  });
});
