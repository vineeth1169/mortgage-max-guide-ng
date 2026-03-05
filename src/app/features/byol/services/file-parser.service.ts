import { Injectable } from '@angular/core';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { BYOLLoanRow } from '../models/byol.model';

/**
 * FileParserService - Parse CSV / XLSX / XLS / TSV / TXT into BYOLLoanRow[]
 */
@Injectable({
  providedIn: 'root',
})
export class FileParserService {
  private readonly ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.tsv', '.txt'];

  /**
   * Canonical field names mapping (lowercase keys → schema keys)
   */
  private readonly FIELD_ALIASES: Record<string, keyof BYOLLoanRow> = {
    loannumber: 'loanNumber',
    loan_number: 'loanNumber',
    loanid: 'loanNumber',
    loan_id: 'loanNumber',
    poolnumber: 'poolNumber',
    pool_number: 'poolNumber',
    poolid: 'poolNumber',
    pool_id: 'poolNumber',
    interestrate: 'interestRate',
    interest_rate: 'interestRate',
    int_rate: 'interestRate',
    couponrate: 'couponRate',
    coupon_rate: 'couponRate',
    netyield: 'netYield',
    net_yield: 'netYield',
    loanagemonths: 'loanAgeMonths',
    loan_age_months: 'loanAgeMonths',
    loan_age: 'loanAgeMonths',
    age_months: 'loanAgeMonths',
    loanstatuscode: 'loanStatusCode',
    loan_status_code: 'loanStatusCode',
    loan_status: 'loanStatusCode',
    status_code: 'loanStatusCode',
    ratetypecode: 'rateTypeCode',
    rate_type_code: 'rateTypeCode',
    rate_type: 'rateTypeCode',
    currentinvestorbalance: 'currentInvestorBalance',
    current_investor_balance: 'currentInvestorBalance',
    investor_balance: 'currentInvestorBalance',
    propertytype: 'propertyType',
    property_type: 'propertyType',
    prop_type: 'propertyType',
    specialcategory: 'specialCategory',
    special_category: 'specialCategory',
    upb: 'upb',
    unpaid_balance: 'upb',
    unpaidbalance: 'upb',
  };

  constructor() {}

  /**
   * Check if a file has an accepted extension
   */
  isAcceptedFile(filename: string): boolean {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    return this.ACCEPTED_EXTENSIONS.includes(ext);
  }

  /**
   * Get comma-separated list of accepted file types for input accept attribute
   */
  getAcceptString(): string {
    return this.ACCEPTED_EXTENSIONS.join(',');
  }

  /**
   * Parse a file (CSV, XLSX, XLS, TSV, or TXT) into BYOLLoanRow array
   */
  async parseFile(file: File): Promise<BYOLLoanRow[]> {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

    if (!this.ACCEPTED_EXTENSIONS.includes(ext)) {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    if (ext === '.xlsx' || ext === '.xls') {
      return this.parseExcel(file);
    }

    return this.parseDelimited(file);
  }

  /**
   * Parse CSV / TSV / TXT using papaparse
   */
  private parseDelimited(file: File): Promise<BYOLLoanRow[]> {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          const rows = results.data.map((r, i) => this.toRow(r, i + 1));
          resolve(rows);
        },
        error: (err: Error) => {
          reject(new Error(`CSV parse error: ${err.message}`));
        },
      });
    });
  }

  /**
   * Parse Excel file using SheetJS
   */
  private parseExcel(file: File): Promise<BYOLLoanRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const sheetName = wb.SheetNames[0];
          const sheet = wb.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: '',
          });
          const rows = json.map((r, i) => this.toRow(r, i + 1));
          resolve(rows);
        } catch {
          reject(new Error('Failed to parse Excel file. Ensure it is a valid .xlsx or .xls file.'));
        }
      };

      reader.onerror = () => reject(new Error('File reading failed.'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Normalize a header string to a schema field name
   */
  private mapHeader(raw: string): string {
    const key = raw.trim().replace(/\s+/g, '').toLowerCase();
    return (this.FIELD_ALIASES[key as keyof typeof this.FIELD_ALIASES] as string) ?? raw.trim();
  }

  /**
   * Coerce a value to number or null
   */
  private toNum(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Convert a plain object (record) into a BYOLLoanRow
   */
  private toRow(record: Record<string, unknown>, index: number): BYOLLoanRow {
    const mapped: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      mapped[this.mapHeader(key)] = value;
    }

    return {
      _rowIndex: index,
      loanNumber: String(mapped['loanNumber'] ?? ''),
      poolNumber: String(mapped['poolNumber'] ?? ''),
      interestRate: this.toNum(mapped['interestRate']),
      couponRate: this.toNum(mapped['couponRate']),
      netYield: this.toNum(mapped['netYield']),
      loanAgeMonths: this.toNum(mapped['loanAgeMonths']),
      loanStatusCode: String(mapped['loanStatusCode'] ?? ''),
      rateTypeCode: String(mapped['rateTypeCode'] ?? ''),
      currentInvestorBalance: this.toNum(mapped['currentInvestorBalance']),
      propertyType: String(mapped['propertyType'] ?? ''),
      specialCategory: String(mapped['specialCategory'] ?? ''),
      upb: this.toNum(mapped['upb']),
    };
  }
}
