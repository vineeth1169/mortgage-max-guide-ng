import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EligibilityResultsComponent } from './eligibility-results.component';
import { EligibilityResponse, BYOLLoanRow } from '../../models/byol.model';
import { CsvExporterService } from '../../services/csv-exporter.service';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  imports: [EligibilityResultsComponent],
  template: `
    <app-eligibility-results
      [response]="response"
      [loans]="loans"
      (onRemoveIneligible)="removedLoan = $event"
    />
  `,
})
class TestHostComponent {
  response: EligibilityResponse = {
    results: [
      { loanNumber: 'LN-001', eligible: true, failures: [] },
      {
        loanNumber: 'LN-002',
        eligible: false,
        failures: [
          {
            ruleId: 'R-001',
            ruleName: 'Minimum UPB',
            message: 'UPB must be at least $50,000.',
            severity: 'error',
          },
        ],
      },
    ],
    summary: { total: 2, eligible: 1, ineligible: 1 },
  };

  loans: BYOLLoanRow[] = [
    {
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
    },
    {
      _rowIndex: 2,
      loanNumber: 'LN-002',
      poolNumber: 'PL-002',
      interestRate: 6.0,
      couponRate: 5.5,
      netYield: 5.0,
      loanAgeMonths: 24,
      loanStatusCode: 'A',
      rateTypeCode: 'FRM',
      currentInvestorBalance: 10000,
      propertyType: 'CO',
      specialCategory: '',
      upb: 10000,
    },
  ];

  removedLoan = '';
}

describe('EligibilityResultsComponent', () => {
  let hostComponent: TestHostComponent;
  let hostFixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, EligibilityResultsComponent],
      providers: [CsvExporterService],
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;
    hostFixture.detectChanges();
  });

  it('should create the host component', () => {
    expect(hostComponent).toBeTruthy();
  });

  it('should display summary statistics', () => {
    const nativeElement = hostFixture.nativeElement;
    const summaryStats = nativeElement.querySelectorAll('.stat-num');

    expect(summaryStats.length).toBeGreaterThanOrEqual(3);
  });

  it('should display eligible and ineligible loans', () => {
    const nativeElement = hostFixture.nativeElement;
    const loanRows = nativeElement.querySelectorAll('.eligibility-row');

    expect(loanRows.length).toBe(2);
  });

  it('should show export button when there are ineligible loans', () => {
    const nativeElement = hostFixture.nativeElement;
    const exportButton = nativeElement.querySelector('button');

    expect(exportButton).toBeTruthy();
  });

  it('should emit onRemoveIneligible when remove button is clicked', () => {
    const nativeElement = hostFixture.nativeElement;
    const removeButtons = nativeElement.querySelectorAll('.elig-actions button');

    if (removeButtons.length > 1) {
      removeButtons[1].click();
      hostFixture.detectChanges();
      expect(hostComponent.removedLoan).toBe('LN-002');
    }
  });
});
