import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { EligibilityService } from './eligibility.service';
import { BYOLLoanRow, EligibilityResponse } from '../models/byol.model';

describe('EligibilityService', () => {
  let service: EligibilityService;
  let httpMock: HttpTestingController;

  const createLoan = (overrides: Partial<BYOLLoanRow> = {}): BYOLLoanRow => ({
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
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(EligibilityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('evaluateEligibility', () => {
    it('should call backend API and return response', async () => {
      const loans = [createLoan()];
      const mockResponse: EligibilityResponse = {
        results: [
          {
            loanNumber: 'LN-001',
            eligible: true,
            failures: [],
          },
        ],
        summary: { total: 1, eligible: 1, ineligible: 0 },
      };

      const resultPromise = service.evaluateEligibility(loans);

      const req = httpMock.expectOne('/api/eligibility/evaluate');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ loans });
      req.flush(mockResponse);

      const result = await resultPromise;
      expect(result.summary.total).toBe(1);
      expect(result.summary.eligible).toBe(1);
      expect(result.results[0].eligible).toBe(true);
    });

    it('should fall back to simulation when backend fails', async () => {
      const loans = [createLoan()];

      const resultPromise = service.evaluateEligibility(loans);

      const req = httpMock.expectOne('/api/eligibility/evaluate');
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result.summary.total).toBe(1);
      expect(result.results.length).toBe(1);
      // A valid loan should be eligible in simulation
      expect(result.results[0].eligible).toBe(true);
    });

    it('should mark loans with low UPB as ineligible in simulation', async () => {
      const loans = [createLoan({ upb: 10000 })];

      const resultPromise = service.evaluateEligibility(loans);

      const req = httpMock.expectOne('/api/eligibility/evaluate');
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result.summary.ineligible).toBe(1);
      expect(result.results[0].eligible).toBe(false);
      expect(result.results[0].failures.some((f) => f.ruleId === 'R-001')).toBe(true);
    });

    it('should mark loans with high interest rate as ineligible in simulation', async () => {
      const loans = [createLoan({ interestRate: 15 })];

      const resultPromise = service.evaluateEligibility(loans);

      const req = httpMock.expectOne('/api/eligibility/evaluate');
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result.results[0].eligible).toBe(false);
      expect(result.results[0].failures.some((f) => f.ruleId === 'R-002')).toBe(true);
    });

    it('should mark loans with excessive age as ineligible in simulation', async () => {
      const loans = [createLoan({ loanAgeMonths: 400 })];

      const resultPromise = service.evaluateEligibility(loans);

      const req = httpMock.expectOne('/api/eligibility/evaluate');
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result.results[0].eligible).toBe(false);
      expect(result.results[0].failures.some((f) => f.ruleId === 'R-003')).toBe(true);
    });

    it('should mark loans with zero investor balance as ineligible in simulation', async () => {
      const loans = [createLoan({ currentInvestorBalance: 0 })];

      const resultPromise = service.evaluateEligibility(loans);

      const req = httpMock.expectOne('/api/eligibility/evaluate');
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result.results[0].eligible).toBe(false);
      expect(result.results[0].failures.some((f) => f.ruleId === 'R-004')).toBe(true);
    });

    it('should mark loans with invalid status code as ineligible in simulation', async () => {
      const loans = [createLoan({ loanStatusCode: 'Z' })];

      const resultPromise = service.evaluateEligibility(loans);

      const req = httpMock.expectOne('/api/eligibility/evaluate');
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result.results[0].eligible).toBe(false);
      expect(result.results[0].failures.some((f) => f.ruleId === 'R-005')).toBe(true);
    });

    it('should mark loans with low net yield as ineligible in simulation', async () => {
      const loans = [createLoan({ netYield: 0.1 })];

      const resultPromise = service.evaluateEligibility(loans);

      const req = httpMock.expectOne('/api/eligibility/evaluate');
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result.results[0].eligible).toBe(false);
      expect(result.results[0].failures.some((f) => f.ruleId === 'R-006')).toBe(true);
    });

    it('should evaluate multiple loans in simulation', async () => {
      const loans = [
        createLoan({ loanNumber: 'LN-001' }),
        createLoan({ loanNumber: 'LN-002', upb: 10000 }),
        createLoan({ loanNumber: 'LN-003', interestRate: 15 }),
      ];

      const resultPromise = service.evaluateEligibility(loans);

      const req = httpMock.expectOne('/api/eligibility/evaluate');
      req.error(new ProgressEvent('error'));

      const result = await resultPromise;
      expect(result.summary.total).toBe(3);
      expect(result.summary.eligible).toBe(1);
      expect(result.summary.ineligible).toBe(2);
    });
  });
});
