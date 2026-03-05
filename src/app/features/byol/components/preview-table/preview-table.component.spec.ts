import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreviewTableComponent } from './preview-table.component';
import { ValidatedLoanRow, BYOLLoanRow } from '../../models/byol.model';

describe('PreviewTableComponent', () => {
  let component: PreviewTableComponent;
  let fixture: ComponentFixture<PreviewTableComponent>;

  const createValidatedRow = (
    isValid: boolean,
    overrides: Partial<BYOLLoanRow> = {}
  ): ValidatedLoanRow => ({
    row: {
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
    },
    errors: isValid
      ? []
      : [{ field: 'loanNumber', message: 'Loan Number is required.' }],
    isValid,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PreviewTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have correct column definitions', () => {
    expect(component.COLUMNS.length).toBe(12);
    expect(component.COLUMNS[0].key).toBe('loanNumber');
    expect(component.COLUMNS[component.COLUMNS.length - 1].key).toBe('upb');
  });

  describe('formatCell', () => {
    it('should return dash for null value', () => {
      expect(component.formatCell(null)).toBe('—');
    });

    it('should return dash for undefined value', () => {
      expect(component.formatCell(undefined)).toBe('—');
    });

    it('should return dash for empty string', () => {
      expect(component.formatCell('')).toBe('—');
    });

    it('should format numbers with locale string', () => {
      const result = component.formatCell(300000);
      expect(result).toContain('300');
    });

    it('should return string values as-is', () => {
      expect(component.formatCell('SF')).toBe('SF');
    });
  });

  describe('getValue', () => {
    it('should return the value for a given key from the row', () => {
      const row = { loanNumber: 'LN-001', upb: 300000 };
      expect(component.getValue(row, 'loanNumber')).toBe('LN-001');
      expect(component.getValue(row, 'upb')).toBe(300000);
    });
  });

  describe('getErrorMessages', () => {
    it('should return joined error messages', () => {
      const vr: ValidatedLoanRow = {
        row: {} as BYOLLoanRow,
        errors: [
          { field: 'loanNumber', message: 'Loan Number is required.' },
          { field: 'upb', message: 'UPB is required.' },
        ],
        isValid: false,
      };

      expect(component.getErrorMessages(vr)).toBe(
        'Loan Number is required.; UPB is required.'
      );
    });

    it('should return empty string for valid row', () => {
      const vr: ValidatedLoanRow = {
        row: {} as BYOLLoanRow,
        errors: [],
        isValid: true,
      };

      expect(component.getErrorMessages(vr)).toBe('');
    });
  });
});
