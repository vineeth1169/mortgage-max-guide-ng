import { Injectable } from '@angular/core';
import { LoanValidationResult, RuleViolation, LoanRecord } from '../models/pool-logic.model';

export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf';

export interface IneligibleLoanExport {
  loanNumber: string;
  poolNumber: string;
  score: number;
  ruleId: string;
  ruleName: string;
  category: string;
  severity: string;
  actualValue: string;
  expectedValue: string;
  explanation: string;
  recommendedAction: string;
  guideReference: string;
  suggestedFix: string;
}

export interface ExportOptions {
  filename?: string;
  includeRecommendations?: boolean;
  includeSimilarLoans?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ExportService {

  /**
   * Export ineligible loans with detailed violation info and recommendations
   */
  exportIneligibleLoans(
    ineligibleResults: LoanValidationResult[],
    allLoans: LoanRecord[],
    format: ExportFormat,
    options: ExportOptions = {}
  ): void {
    const data = this.prepareIneligibleData(ineligibleResults, allLoans, options);
    const filename = options.filename || `ineligible-loans-${this.getTimestamp()}`;

    switch (format) {
      case 'csv':
        this.downloadCSV(data, filename);
        break;
      case 'excel':
        this.downloadExcel(data, filename);
        break;
      case 'json':
        this.downloadJSON(data, filename);
        break;
      case 'pdf':
        this.downloadPDF(data, filename, ineligibleResults);
        break;
    }
  }

  /**
   * Prepare ineligible loan data with recommendations
   */
  private prepareIneligibleData(
    results: LoanValidationResult[],
    allLoans: LoanRecord[],
    options: ExportOptions
  ): IneligibleLoanExport[] {
    const exports: IneligibleLoanExport[] = [];

    for (const result of results) {
      const loan = allLoans.find(l => l.loanNumber === result.loanNumber);
      
      for (const violation of result.violations) {
        const suggestedFix = this.generateSuggestedFix(violation, loan);
        
        exports.push({
          loanNumber: result.loanNumber,
          poolNumber: result.poolNumber || 'N/A',
          score: result.score,
          ruleId: violation.rule.ruleId,
          ruleName: violation.rule.ruleName,
          category: violation.rule.category,
          severity: violation.severity,
          actualValue: violation.actualValue,
          expectedValue: violation.expectedValue,
          explanation: violation.explanation,
          recommendedAction: violation.recommendedAction,
          guideReference: violation.rule.guideReference,
          suggestedFix,
        });
      }
    }

    return exports;
  }

  /**
   * Generate specific fix suggestions based on violation type
   */
  private generateSuggestedFix(violation: RuleViolation, loan?: LoanRecord): string {
    const ruleId = violation.rule.ruleId;
    const actual = violation.actualValue;
    const expected = violation.expectedValue;

    switch (ruleId) {
      case 'RATE-001':
        return `Adjust interest rate to be within 0-12% range. Current rate ${actual} is outside limits. Consider refinancing or rate modification.`;
      
      case 'RATE-002':
        return `Reduce coupon rate to be ≤ interest rate. Coupon ${actual} exceeds note rate. Adjust pool coupon assignment.`;
      
      case 'RATE-003':
        return `Correct net yield to be between 0 and coupon rate. Net yield ${actual} should satisfy: 0 ≤ netYield ≤ couponRate.`;
      
      case 'BAL-001':
        return `Loan has zero or negative UPB (${actual}). Remove from pool - this loan appears paid off or has data error.`;
      
      case 'BAL-002':
        return `Investor balance ${actual} exceeds UPB. Correct the investor balance to be ≤ ${expected}.`;
      
      case 'BAL-003':
        const limit = 766550;
        return `UPB ${actual} exceeds conforming limit of $${limit.toLocaleString()}. Consider splitting into jumbo/conforming or obtain high-balance approval.`;
      
      case 'PROP-001':
        return `Property type "${actual}" is not eligible. Only SF, CO, CP, PU, MH, 2-4 units are accepted. Reassign to eligible property type or exclude from pool.`;
      
      case 'STATUS-001':
        return `Loan status "${actual}" indicates non-performing. Only Active (A) or Current (C) loans are eligible. Wait for status update or exclude.`;
      
      case 'AGE-001':
        const currentAge = parseInt(actual) || 0;
        const monthsNeeded = 4 - currentAge;
        return `Loan is ${actual} months old, needs minimum 4 months seasoning. Wait ${monthsNeeded} more month(s) before pooling.`;
      
      case 'POOL-001':
        return `No pool number assigned. Assign this loan to a valid pool (e.g., PL-001) before delivery.`;
      
      case 'PREFIX-001':
        return `MBS prefix "${actual || 'none'}" is invalid. Assign valid prefix: MX (Fixed Rate Pool), MA (Adjustable Rate Pool), or MF (Fixed Rate Note).`;
      
      default:
        return `Review ${violation.rule.ruleName} requirements and correct ${actual} to meet ${expected} criteria.`;
    }
  }

  /**
   * Find similar eligible loans that could replace ineligible ones
   */
  findSimilarEligibleLoans(
    ineligibleLoan: LoanRecord,
    eligibleLoans: LoanRecord[],
    maxResults: number = 3
  ): LoanRecord[] {
    // Score each eligible loan by similarity
    const scored = eligibleLoans.map(el => ({
      loan: el,
      score: this.calculateSimilarity(ineligibleLoan, el)
    }));

    // Sort by similarity score (higher is more similar)
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, maxResults).map(s => s.loan);
  }

  private calculateSimilarity(a: LoanRecord, b: LoanRecord): number {
    let score = 0;
    
    // Same property type: +30 points
    if (a.propertyType === b.propertyType) score += 30;
    
    // Similar UPB (within 20%): +25 points
    const upbDiff = Math.abs(a.upb - b.upb) / Math.max(a.upb, b.upb);
    if (upbDiff < 0.2) score += 25 * (1 - upbDiff);
    
    // Similar interest rate (within 0.5%): +20 points
    const rateDiff = Math.abs(a.interestRate - b.interestRate);
    if (rateDiff < 0.5) score += 20 * (1 - rateDiff / 0.5);
    
    // Similar loan age (within 12 months): +15 points
    const ageDiff = Math.abs(a.loanAgeMonths - b.loanAgeMonths);
    if (ageDiff < 12) score += 15 * (1 - ageDiff / 12);
    
    // Same pool prefix: +10 points
    if (a.mbsPoolPrefix === b.mbsPoolPrefix) score += 10;

    return score;
  }

  // ── CSV Export ──────────────────────────────────────────────────

  private downloadCSV(data: IneligibleLoanExport[], filename: string): void {
    const headers = [
      'Loan Number',
      'Pool Number',
      'Score',
      'Rule ID',
      'Rule Name',
      'Category',
      'Severity',
      'Actual Value',
      'Expected Value',
      'Explanation',
      'Recommended Action',
      'Guide Reference',
      'Suggested Fix'
    ];

    const rows = data.map(row => [
      row.loanNumber,
      row.poolNumber,
      row.score.toString(),
      row.ruleId,
      row.ruleName,
      row.category,
      row.severity,
      `"${row.actualValue.replace(/"/g, '""')}"`,
      `"${row.expectedValue.replace(/"/g, '""')}"`,
      `"${row.explanation.replace(/"/g, '""')}"`,
      `"${row.recommendedAction.replace(/"/g, '""')}"`,
      row.guideReference,
      `"${row.suggestedFix.replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
  }

  // ── Excel Export (using CSV with BOM for Excel compatibility) ──

  private downloadExcel(data: IneligibleLoanExport[], filename: string): void {
    const headers = [
      'Loan Number',
      'Pool Number',
      'Score',
      'Rule ID',
      'Rule Name',
      'Category',
      'Severity',
      'Actual Value',
      'Expected Value',
      'Explanation',
      'Recommended Action',
      'Guide Reference',
      'Suggested Fix'
    ];

    const rows = data.map(row => [
      row.loanNumber,
      row.poolNumber,
      row.score,
      row.ruleId,
      row.ruleName,
      row.category,
      row.severity,
      row.actualValue,
      row.expectedValue,
      row.explanation,
      row.recommendedAction,
      row.guideReference,
      row.suggestedFix
    ]);

    // Create tab-separated values for better Excel compatibility
    const tsvContent = [
      headers.join('\t'),
      ...rows.map(r => r.map(cell => 
        typeof cell === 'string' ? cell.replace(/\t/g, ' ').replace(/\n/g, ' ') : cell
      ).join('\t'))
    ].join('\n');

    // Add BOM for Excel to recognize UTF-8
    const BOM = '\uFEFF';
    this.downloadFile(BOM + tsvContent, `${filename}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
  }

  // ── JSON Export ─────────────────────────────────────────────────

  private downloadJSON(data: IneligibleLoanExport[], filename: string): void {
    const jsonContent = JSON.stringify({
      exportDate: new Date().toISOString(),
      totalIneligibleLoans: [...new Set(data.map(d => d.loanNumber))].length,
      totalViolations: data.length,
      violations: data
    }, null, 2);

    this.downloadFile(jsonContent, `${filename}.json`, 'application/json;charset=utf-8;');
  }

  // ── PDF Export ──────────────────────────────────────────────────

  private downloadPDF(
    data: IneligibleLoanExport[],
    filename: string,
    results: LoanValidationResult[]
  ): void {
    // Generate HTML content for PDF
    const htmlContent = this.generatePDFHTML(data, results);
    
    // Open in new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Auto-trigger print dialog after content loads
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  }

  private generatePDFHTML(data: IneligibleLoanExport[], results: LoanValidationResult[]): string {
    const uniqueLoans = [...new Set(data.map(d => d.loanNumber))];
    const groupedByLoan = this.groupByLoan(data);

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Ineligible Loans Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #333;
      max-width: 1100px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { color: #1a365d; font-size: 24px; margin-bottom: 5px; }
    h2 { color: #2c5282; font-size: 16px; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
    h3 { color: #4a5568; font-size: 13px; margin: 10px 0 5px; }
    .header { border-bottom: 3px solid #3182ce; padding-bottom: 10px; margin-bottom: 20px; }
    .summary { background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .summary-item { text-align: center; }
    .summary-value { font-size: 24px; font-weight: bold; color: #2b6cb0; }
    .summary-label { font-size: 10px; color: #718096; text-transform: uppercase; }
    .loan-section { 
      border: 1px solid #e2e8f0; 
      border-radius: 8px; 
      margin-bottom: 15px; 
      page-break-inside: avoid;
    }
    .loan-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 10px 15px;
      border-radius: 8px 8px 0 0;
      display: flex;
      justify-content: space-between;
    }
    .loan-content { padding: 15px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { background: #edf2f7; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; color: #4a5568; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .severity-error { color: #c53030; font-weight: bold; }
    .severity-warning { color: #dd6b20; font-weight: bold; }
    .fix-box {
      background: #f0fff4;
      border-left: 4px solid #38a169;
      padding: 10px;
      margin-top: 10px;
      border-radius: 0 4px 4px 0;
    }
    .fix-title { font-weight: bold; color: #276749; margin-bottom: 5px; }
    .score-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 12px;
    }
    .score-low { background: #fed7d7; color: #c53030; }
    .score-med { background: #feebc8; color: #c05621; }
    .score-high { background: #c6f6d5; color: #276749; }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #718096;
      font-size: 10px;
    }
    @media print {
      body { padding: 0; }
      .loan-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 Ineligible Loans Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>

  <div class="summary">
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${uniqueLoans.length}</div>
        <div class="summary-label">Ineligible Loans</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${data.length}</div>
        <div class="summary-label">Total Violations</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${data.filter(d => d.severity === 'error').length}</div>
        <div class="summary-label">Errors</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${data.filter(d => d.severity === 'warning').length}</div>
        <div class="summary-label">Warnings</div>
      </div>
    </div>
  </div>

  ${Object.entries(groupedByLoan).map(([loanNumber, violations]) => {
    const result = results.find(r => r.loanNumber === loanNumber);
    const score = result?.score ?? 0;
    const scoreClass = score < 50 ? 'score-low' : score < 80 ? 'score-med' : 'score-high';
    
    return `
    <div class="loan-section">
      <div class="loan-header">
        <div>
          <strong>Loan: ${loanNumber}</strong>
          <span style="margin-left: 15px; opacity: 0.9;">Pool: ${violations[0].poolNumber}</span>
        </div>
        <span class="score-badge ${scoreClass}">Score: ${score}/100</span>
      </div>
      <div class="loan-content">
        <table>
          <thead>
            <tr>
              <th style="width: 8%">Severity</th>
              <th style="width: 15%">Rule</th>
              <th style="width: 12%">Actual</th>
              <th style="width: 12%">Expected</th>
              <th style="width: 53%">Explanation</th>
            </tr>
          </thead>
          <tbody>
            ${violations.map(v => `
              <tr>
                <td class="severity-${v.severity}">${v.severity === 'error' ? '❌ Error' : '⚠️ Warning'}</td>
                <td><strong>${v.ruleId}</strong><br/><small>${v.ruleName}</small></td>
                <td>${v.actualValue}</td>
                <td>${v.expectedValue}</td>
                <td>${v.explanation}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="fix-box">
          <div class="fix-title">💡 How to Fix:</div>
          <ul style="margin: 5px 0 0 15px; padding: 0;">
            ${violations.map(v => `<li style="margin-bottom: 5px;">${v.suggestedFix}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>
    `;
  }).join('')}

  <div class="footer">
    <p>MortgageMax Loan Pool Advisor | This report is for informational purposes only.</p>
    <p>All loans should be reviewed according to current MortgageMax Single-Family Seller/Servicer Guide requirements.</p>
  </div>
</body>
</html>
    `;
  }

  private groupByLoan(data: IneligibleLoanExport[]): Record<string, IneligibleLoanExport[]> {
    const grouped: Record<string, IneligibleLoanExport[]> = {};
    for (const item of data) {
      if (!grouped[item.loanNumber]) {
        grouped[item.loanNumber] = [];
      }
      grouped[item.loanNumber].push(item);
    }
    return grouped;
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private getTimestamp(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * Get available export formats for display
   */
  getAvailableFormats(): { format: ExportFormat; label: string; icon: string }[] {
    return [
      { format: 'csv', label: 'CSV', icon: '📄' },
      { format: 'excel', label: 'Excel', icon: '📊' },
      { format: 'json', label: 'JSON', icon: '🔧' },
      { format: 'pdf', label: 'PDF', icon: '📑' }
    ];
  }
}
