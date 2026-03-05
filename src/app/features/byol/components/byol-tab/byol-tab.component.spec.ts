import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BYOLTabComponent } from './byol-tab.component';
import { FileParserService } from '../../services/file-parser.service';
import { LoanValidatorService } from '../../services/loan-validator.service';
import { EligibilityService } from '../../services/eligibility.service';
import { NotificationService } from '../../services/notification.service';
import { BYOLLoanRow, EligibilityResponse } from '../../models/byol.model';

describe('BYOLTabComponent', () => {
  let component: BYOLTabComponent;
  let fixture: ComponentFixture<BYOLTabComponent>;
  let fileParserService: FileParserService;
  let loanValidatorService: LoanValidatorService;
  let eligibilityService: EligibilityService;
  let notificationService: NotificationService;

  const mockLoan: BYOLLoanRow = {
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
  };

  const mockEligibilityResponse: EligibilityResponse = {
    results: [
      { loanNumber: 'LN-001', eligible: true, failures: [] },
    ],
    summary: { total: 1, eligible: 1, ineligible: 0 },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BYOLTabComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BYOLTabComponent);
    component = fixture.componentInstance;

    fileParserService = TestBed.inject(FileParserService);
    loanValidatorService = TestBed.inject(LoanValidatorService);
    eligibilityService = TestBed.inject(EligibilityService);
    notificationService = TestBed.inject(NotificationService);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start at upload step', () => {
    expect(component.currentStep()).toBe('upload');
  });

  it('should have 3 workflow steps', () => {
    expect(component.STEPS.length).toBe(3);
    expect(component.STEPS[0].key).toBe('upload');
    expect(component.STEPS[1].key).toBe('preview');
    expect(component.STEPS[2].key).toBe('results');
  });

  it('should start with empty data', () => {
    expect(component.parsedRows().length).toBe(0);
    expect(component.validatedRows().length).toBe(0);
    expect(component.eligibilityResponse()).toBeNull();
    expect(component.parsing()).toBe(false);
    expect(component.evaluating()).toBe(false);
  });

  describe('currentStepIndex', () => {
    it('should return 0 for upload step', () => {
      component.currentStep.set('upload');
      expect(component.currentStepIndex()).toBe(0);
    });

    it('should return 1 for preview step', () => {
      component.currentStep.set('preview');
      expect(component.currentStepIndex()).toBe(1);
    });

    it('should return 2 for results step', () => {
      component.currentStep.set('results');
      expect(component.currentStepIndex()).toBe(2);
    });
  });

  describe('validCount', () => {
    it('should return 0 when no rows', () => {
      expect(component.validCount()).toBe(0);
    });

    it('should count valid rows', () => {
      component.validatedRows.set([
        { row: mockLoan, errors: [], isValid: true },
        {
          row: { ...mockLoan, _rowIndex: 2 },
          errors: [{ field: 'loanNumber', message: 'Required' }],
          isValid: false,
        },
      ]);
      expect(component.validCount()).toBe(1);
    });
  });

  describe('handleFileSelected', () => {
    it('should parse file and move to preview step', async () => {
      spyOn(fileParserService, 'parseFile').and.returnValue(
        Promise.resolve([mockLoan])
      );

      const file = new File(['test'], 'loans.csv', { type: 'text/csv' });
      await component.handleFileSelected(file);

      expect(component.parsedRows().length).toBe(1);
      expect(component.validatedRows().length).toBe(1);
      expect(component.currentStep()).toBe('preview');
    });

    it('should show warning when file has no rows', async () => {
      spyOn(fileParserService, 'parseFile').and.returnValue(
        Promise.resolve([])
      );
      spyOn(notificationService, 'warning');

      const file = new File([''], 'empty.csv', { type: 'text/csv' });
      await component.handleFileSelected(file);

      expect(notificationService.warning).toHaveBeenCalledWith(
        'File contains no data rows.'
      );
      expect(component.currentStep()).toBe('upload');
    });

    it('should show error on parse failure', async () => {
      spyOn(fileParserService, 'parseFile').and.returnValue(
        Promise.reject(new Error('Invalid file'))
      );
      spyOn(notificationService, 'error');

      const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });
      await component.handleFileSelected(file);

      expect(notificationService.error).toHaveBeenCalledWith('Invalid file');
    });

    it('should set parsing flag during parse', async () => {
      let resolveParse: (value: BYOLLoanRow[]) => void;
      spyOn(fileParserService, 'parseFile').and.returnValue(
        new Promise((resolve) => {
          resolveParse = resolve;
        })
      );

      const file = new File(['test'], 'loans.csv', { type: 'text/csv' });
      const promise = component.handleFileSelected(file);

      expect(component.parsing()).toBe(true);

      resolveParse!([mockLoan]);
      await promise;

      expect(component.parsing()).toBe(false);
    });
  });

  describe('handleRemoveRow', () => {
    it('should remove a row by index', () => {
      component.parsedRows.set([mockLoan]);
      component.validatedRows.set([
        { row: mockLoan, errors: [], isValid: true },
      ]);

      component.handleRemoveRow(1);

      expect(component.parsedRows().length).toBe(0);
      expect(component.validatedRows().length).toBe(0);
    });

    it('should show info notification on removal', () => {
      spyOn(notificationService, 'info');
      component.parsedRows.set([mockLoan]);
      component.validatedRows.set([
        { row: mockLoan, errors: [], isValid: true },
      ]);

      component.handleRemoveRow(1);

      expect(notificationService.info).toHaveBeenCalledWith('Row 1 removed.');
    });
  });

  describe('handleSubmitForEvaluation', () => {
    beforeEach(() => {
      component.validatedRows.set([
        { row: mockLoan, errors: [], isValid: true },
      ]);
    });

    it('should submit valid loans and move to results step', async () => {
      spyOn(eligibilityService, 'evaluateEligibility').and.returnValue(
        Promise.resolve(mockEligibilityResponse)
      );

      await component.handleSubmitForEvaluation();

      expect(component.eligibilityResponse()).toEqual(mockEligibilityResponse);
      expect(component.currentStep()).toBe('results');
    });

    it('should warn when no valid loans', async () => {
      component.validatedRows.set([
        {
          row: mockLoan,
          errors: [{ field: 'loanNumber', message: 'Required' }],
          isValid: false,
        },
      ]);
      spyOn(notificationService, 'warning');

      await component.handleSubmitForEvaluation();

      expect(notificationService.warning).toHaveBeenCalledWith(
        'No valid loans to submit. Fix validation errors first.'
      );
    });

    it('should show error on evaluation failure', async () => {
      spyOn(eligibilityService, 'evaluateEligibility').and.returnValue(
        Promise.reject(new Error('Backend error'))
      );
      spyOn(notificationService, 'error');

      await component.handleSubmitForEvaluation();

      expect(notificationService.error).toHaveBeenCalledWith('Backend error');
    });
  });

  describe('handleRemoveIneligible', () => {
    it('should remove a loan from eligibility results', () => {
      const response: EligibilityResponse = {
        results: [
          { loanNumber: 'LN-001', eligible: true, failures: [] },
          {
            loanNumber: 'LN-002',
            eligible: false,
            failures: [
              {
                ruleId: 'R-001',
                ruleName: 'Test',
                message: 'Test failure',
                severity: 'error',
              },
            ],
          },
        ],
        summary: { total: 2, eligible: 1, ineligible: 1 },
      };

      component.eligibilityResponse.set(response);
      component.handleRemoveIneligible('LN-002');

      const updated = component.eligibilityResponse()!;
      expect(updated.results.length).toBe(1);
      expect(updated.summary.total).toBe(1);
      expect(updated.summary.ineligible).toBe(0);
    });
  });

  describe('handleReset', () => {
    it('should reset all state to initial values', () => {
      component.currentStep.set('results');
      component.parsedRows.set([mockLoan]);
      component.validatedRows.set([
        { row: mockLoan, errors: [], isValid: true },
      ]);
      component.eligibilityResponse.set(mockEligibilityResponse);

      component.handleReset();

      expect(component.currentStep()).toBe('upload');
      expect(component.parsedRows().length).toBe(0);
      expect(component.validatedRows().length).toBe(0);
      expect(component.eligibilityResponse()).toBeNull();
    });
  });
});
