import { TestBed } from '@angular/core/testing';
import { LoanValidatorService } from './loan-validator.service';
import { BYOLLoanRow, ValidatedLoanRow } from '../models/byol.model';

describe('LoanValidatorService', () => {
  let service: LoanValidatorService;

  const createValidRow = (overrides: Partial<BYOLLoanRow> = {}): BYOLLoanRow => ({
    _rowIndex: 1,
    loanNumber: 'LN-001',
    poolNumber: 'PL-001',
    interestRate: 5.5,
    couponRate: 5.0,
    netYield: 4.5,
    loanAgeMonths: 12,
    loanStatusCode: 'A',
    rateTypeCode: 'FRM',
    currentInvestorBalance: 295000,
    propertyType: 'SF',
    specialCategory: '',
    upb: 300000,
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoanValidatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('validateLoanRows', () => {
    it('should validate a valid loan row with no errors', () => {
      const row = createValidRow();
      const result = service.validateLoanRows([row]);

      expect(result.length).toBe(1);
      expect(result[0].isValid).toBe(true);
      expect(result[0].errors.length).toBe(0);
    });

    it('should detect missing loan number', () => {
      const row = createValidRow({ loanNumber: '' });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'loanNumber')).toBe(true);
    });

    it('should detect missing pool number', () => {
      const row = createValidRow({ poolNumber: '' });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'poolNumber')).toBe(true);
    });

    it('should detect null interest rate', () => {
      const row = createValidRow({ interestRate: null });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'interestRate')).toBe(true);
    });

    it('should detect null UPB', () => {
      const row = createValidRow({ upb: null });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'upb')).toBe(true);
    });

    it('should detect interest rate above 100', () => {
      const row = createValidRow({ interestRate: 150 });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(
        result[0].errors.some(
          (e) => e.field === 'interestRate' && e.message.includes('between 0 and 100')
        )
      ).toBe(true);
    });

    it('should detect negative interest rate', () => {
      const row = createValidRow({ interestRate: -5 });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(
        result[0].errors.some(
          (e) => e.field === 'interestRate' && e.message.includes('between 0 and 100')
        )
      ).toBe(true);
    });

    it('should detect coupon rate above 100', () => {
      const row = createValidRow({ couponRate: 101 });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(
        result[0].errors.some(
          (e) => e.field === 'couponRate' && e.message.includes('between 0 and 100')
        )
      ).toBe(true);
    });

    it('should detect negative loan age', () => {
      const row = createValidRow({ loanAgeMonths: -5 });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'loanAgeMonths')).toBe(true);
    });

    it('should detect negative UPB', () => {
      const row = createValidRow({ upb: -100 });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'upb')).toBe(true);
    });

    it('should detect negative investor balance', () => {
      const row = createValidRow({ currentInvestorBalance: -50000 });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'currentInvestorBalance')).toBe(true);
    });

    it('should validate multiple rows', () => {
      const row1 = createValidRow({ _rowIndex: 1 });
      const row2 = createValidRow({ _rowIndex: 2, loanNumber: '' });
      const row3 = createValidRow({ _rowIndex: 3, upb: null });

      const results = service.validateLoanRows([row1, row2, row3]);

      expect(results.length).toBe(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(false);
    });

    it('should detect missing loan status code', () => {
      const row = createValidRow({ loanStatusCode: '' });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'loanStatusCode')).toBe(true);
    });

    it('should detect missing property type', () => {
      const row = createValidRow({ propertyType: '' });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'propertyType')).toBe(true);
    });

    it('should detect null net yield', () => {
      const row = createValidRow({ netYield: null });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'netYield')).toBe(true);
    });

    it('should detect null coupon rate', () => {
      const row = createValidRow({ couponRate: null });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'couponRate')).toBe(true);
    });

    it('should detect null loan age months', () => {
      const row = createValidRow({ loanAgeMonths: null });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'loanAgeMonths')).toBe(true);
    });

    it('should detect null current investor balance', () => {
      const row = createValidRow({ currentInvestorBalance: null });
      const result = service.validateLoanRows([row]);

      expect(result[0].isValid).toBe(false);
      expect(result[0].errors.some((e) => e.field === 'currentInvestorBalance')).toBe(true);
    });
  });

  describe('getErrorFields', () => {
    it('should return empty set for valid row', () => {
      const row = createValidRow();
      const [validated] = service.validateLoanRows([row]);
      const errorFields = service.getErrorFields(validated);

      expect(errorFields.size).toBe(0);
    });

    it('should return set of error field names', () => {
      const row = createValidRow({ loanNumber: '', interestRate: null });
      const [validated] = service.validateLoanRows([row]);
      const errorFields = service.getErrorFields(validated);

      expect(errorFields.has('loanNumber')).toBe(true);
      expect(errorFields.has('interestRate')).toBe(true);
    });
  });

  describe('REQUIRED_FIELD_KEYS', () => {
    it('should contain all required field names', () => {
      expect(service.REQUIRED_FIELD_KEYS).toContain('loanNumber');
      expect(service.REQUIRED_FIELD_KEYS).toContain('poolNumber');
      expect(service.REQUIRED_FIELD_KEYS).toContain('interestRate');
      expect(service.REQUIRED_FIELD_KEYS).toContain('couponRate');
      expect(service.REQUIRED_FIELD_KEYS).toContain('netYield');
      expect(service.REQUIRED_FIELD_KEYS).toContain('loanAgeMonths');
      expect(service.REQUIRED_FIELD_KEYS).toContain('loanStatusCode');
      expect(service.REQUIRED_FIELD_KEYS).toContain('currentInvestorBalance');
      expect(service.REQUIRED_FIELD_KEYS).toContain('propertyType');
      expect(service.REQUIRED_FIELD_KEYS).toContain('upb');
    });
  });
});
