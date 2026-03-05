import { TestBed } from '@angular/core/testing';
import { FileParserService } from './file-parser.service';
import { BYOLLoanRow } from '../models/byol.model';

describe('FileParserService', () => {
  let service: FileParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FileParserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isAcceptedFile', () => {
    it('should accept .csv files', () => {
      expect(service.isAcceptedFile('loans.csv')).toBe(true);
    });

    it('should accept .xlsx files', () => {
      expect(service.isAcceptedFile('loans.xlsx')).toBe(true);
    });

    it('should accept .xls files', () => {
      expect(service.isAcceptedFile('loans.xls')).toBe(true);
    });

    it('should accept .tsv files', () => {
      expect(service.isAcceptedFile('data.tsv')).toBe(true);
    });

    it('should accept .txt files', () => {
      expect(service.isAcceptedFile('data.txt')).toBe(true);
    });

    it('should reject .pdf files', () => {
      expect(service.isAcceptedFile('report.pdf')).toBe(false);
    });

    it('should reject .doc files', () => {
      expect(service.isAcceptedFile('document.doc')).toBe(false);
    });

    it('should reject .json files', () => {
      expect(service.isAcceptedFile('data.json')).toBe(false);
    });

    it('should handle uppercase extensions', () => {
      expect(service.isAcceptedFile('loans.CSV')).toBe(true);
    });
  });

  describe('getAcceptString', () => {
    it('should return comma-separated accepted extensions', () => {
      const acceptString = service.getAcceptString();
      expect(acceptString).toContain('.csv');
      expect(acceptString).toContain('.xlsx');
      expect(acceptString).toContain('.xls');
      expect(acceptString).toContain('.tsv');
      expect(acceptString).toContain('.txt');
    });
  });

  describe('parseFile', () => {
    it('should reject unsupported file types', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      await expectAsync(service.parseFile(file)).toBeRejectedWithError(
        'Unsupported file type: .pdf'
      );
    });

    it('should parse a valid CSV file', async () => {
      const csvContent = [
        'loanNumber,poolNumber,interestRate,couponRate,netYield,loanAgeMonths,loanStatusCode,rateTypeCode,currentInvestorBalance,propertyType,specialCategory,upb',
        'LN-001,PL-001,5.5,5.0,4.5,12,A,FRM,295000,SF,,300000',
        'LN-002,PL-002,6.0,5.5,5.0,24,C,ARM,400000,CO,,410000',
      ].join('\n');

      const file = new File([csvContent], 'loans.csv', { type: 'text/csv' });
      const rows = await service.parseFile(file);

      expect(rows.length).toBe(2);
      expect(rows[0].loanNumber).toBe('LN-001');
      expect(rows[0].poolNumber).toBe('PL-001');
      expect(rows[0].interestRate).toBe(5.5);
      expect(rows[0].couponRate).toBe(5.0);
      expect(rows[0].netYield).toBe(4.5);
      expect(rows[0].loanAgeMonths).toBe(12);
      expect(rows[0].loanStatusCode).toBe('A');
      expect(rows[0].rateTypeCode).toBe('FRM');
      expect(rows[0].currentInvestorBalance).toBe(295000);
      expect(rows[0].propertyType).toBe('SF');
      expect(rows[0].upb).toBe(300000);
      expect(rows[0]._rowIndex).toBe(1);

      expect(rows[1].loanNumber).toBe('LN-002');
      expect(rows[1]._rowIndex).toBe(2);
    });

    it('should handle CSV with alternative header names', async () => {
      const csvContent = [
        'loan_number,pool_number,interest_rate,coupon_rate,net_yield,loan_age_months,loan_status_code,rate_type_code,current_investor_balance,property_type,special_category,unpaid_balance',
        'LN-100,PL-100,4.5,4.0,3.5,36,A,FRM,200000,SF,,210000',
      ].join('\n');

      const file = new File([csvContent], 'loans.csv', { type: 'text/csv' });
      const rows = await service.parseFile(file);

      expect(rows.length).toBe(1);
      expect(rows[0].loanNumber).toBe('LN-100');
      expect(rows[0].poolNumber).toBe('PL-100');
      expect(rows[0].interestRate).toBe(4.5);
      expect(rows[0].upb).toBe(210000);
    });

    it('should handle empty CSV', async () => {
      const csvContent = 'loanNumber,poolNumber,interestRate\n';
      const file = new File([csvContent], 'empty.csv', { type: 'text/csv' });
      const rows = await service.parseFile(file);

      expect(rows.length).toBe(0);
    });

    it('should handle missing values as null for numbers', async () => {
      const csvContent = [
        'loanNumber,poolNumber,interestRate,couponRate,netYield,loanAgeMonths,loanStatusCode,rateTypeCode,currentInvestorBalance,propertyType,specialCategory,upb',
        'LN-001,PL-001,,,,,A,FRM,,,,,',
      ].join('\n');

      const file = new File([csvContent], 'loans.csv', { type: 'text/csv' });
      const rows = await service.parseFile(file);

      expect(rows.length).toBe(1);
      expect(rows[0].interestRate).toBeNull();
      expect(rows[0].couponRate).toBeNull();
      expect(rows[0].netYield).toBeNull();
    });

    it('should parse TSV file', async () => {
      const tsvContent = [
        'loanNumber\tpoolNumber\tinterestRate\tupb',
        'LN-001\tPL-001\t5.5\t300000',
      ].join('\n');

      const file = new File([tsvContent], 'loans.tsv', { type: 'text/tab-separated-values' });
      const rows = await service.parseFile(file);

      expect(rows.length).toBe(1);
      expect(rows[0].loanNumber).toBe('LN-001');
    });
  });
});
