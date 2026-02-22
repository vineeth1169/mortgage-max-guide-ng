import { Injectable, signal, computed } from '@angular/core';
import {
  NavigationItem,
  GuideSection,
  BreadcrumbItem,
  RelatedResources,
} from '../models/navigation.model';

@Injectable({ providedIn: 'root' })
export class GuideDataService {

  // ── Navigation Tree ──────────────────────────────────────────────
  readonly navigationTree = signal<NavigationItem[]>([
    {
      id: '1000',
      title: 'Series 1000: General Information and Introduction',
      children: [
        { id: '1100', title: 'Chapter 1100: Introduction to the Guide' },
        { id: '1200', title: 'Chapter 1200: MortgageMax Contacts' },
        { id: '1300', title: 'Chapter 1300: Definitions' },
      ],
    },
    {
      id: '2000',
      title: 'Series 2000: General Mortgage Eligibility',
      children: [
        { id: '2100', title: 'Chapter 2100: General Mortgage Terms' },
        { id: '2200', title: 'Chapter 2200: Mortgage Terms and Conditions' },
        { id: '2300', title: 'Chapter 2300: Occupancy Types and Eligibility' },
      ],
    },
    {
      id: '3000',
      title: 'Series 3000: Mortgage Products',
      children: [
        { id: '3100', title: 'Chapter 3100: Fixed-Rate Mortgages' },
        { id: '3200', title: 'Chapter 3200: Adjustable-Rate Mortgages (ARMs)' },
        { id: '3300', title: 'Chapter 3300: Government Mortgages' },
      ],
    },
    {
      id: '4000',
      title: 'Series 4000: Origination and Underwriting',
      children: [
        {
          id: '4100',
          title: 'Chapter 4100: Borrower Eligibility',
          children: [
            { id: '4101', title: 'Section 4101.1: General Borrower Requirements' },
            { id: '4102', title: 'Section 4101.2: Non-Occupant Borrowers' },
            { id: '4103', title: 'Section 4101.3: Multiple Financed Properties' },
          ],
        },
        { id: '4200', title: 'Chapter 4200: Property Eligibility' },
        { id: '4300', title: 'Chapter 4300: Income Assessment' },
        { id: '4400', title: 'Chapter 4400: Asset Assessment' },
        { id: '4500', title: 'Chapter 4500: Credit Assessment' },
      ],
    },
    {
      id: '5000',
      title: 'Series 5000: Property Valuation and Analysis',
      children: [
        { id: '5100', title: 'Chapter 5100: Appraisal Requirements' },
        { id: '5200', title: 'Chapter 5200: Automated Valuation Models' },
        { id: '5300', title: 'Chapter 5300: Property Inspection Waivers' },
      ],
    },
    {
      id: '6000',
      title: 'Series 6000: Quality Control, Representations, and Warranties',
      children: [
        { id: '6100', title: 'Chapter 6100: QC Program Requirements' },
        { id: '6200', title: 'Chapter 6200: Representations and Warranties' },
      ],
    },
    {
      id: '8000',
      title: 'Series 8000: Servicing',
      children: [
        { id: '8100', title: 'Chapter 8100: General Servicing Requirements' },
        { id: '8200', title: 'Chapter 8200: Escrow Administration' },
        { id: '8300', title: 'Chapter 8300: Default Management' },
      ],
    },
  ]);

  // ── Selected Section State ───────────────────────────────────────
  readonly selectedSectionId = signal<string>('4100');

  // ── Expanded Nodes ───────────────────────────────────────────────
  readonly expandedNodes = signal<Set<string>>(new Set(['4000']));

  // ── Section Content Map ──────────────────────────────────────────
  private readonly sectionContentMap: Record<string, GuideSection> = {
    '1100': {
      id: '1100',
      title: 'Chapter 1100: Introduction to the Guide',
      effectiveDate: 'January 15, 2026',
      breadcrumbs: [
        { label: 'Home', sectionId: '' },
        { label: 'Series 1000', sectionId: '1000' },
        { label: 'Chapter 1100', sectionId: '1100' },
      ],
      contentHtml: `
        <p class="mb-4">The MortgageMax Single-Family Seller/Servicer Guide (the Guide) sets forth the terms and conditions under which MortgageMax will purchase and securitize single-family Mortgages. The Guide also establishes the servicing requirements that apply to Mortgages sold to, or serviced for, MortgageMax.</p>
        <p class="mb-4">The Guide comprises several series of chapters, each of which addresses a specific aspect of the origination, sale, and servicing of Mortgages. The Guide is updated regularly through Guide Bulletins, which are issued as needed to communicate changes to the Guide.</p>
        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">1100.1 Purpose of the Guide</h2>
        <p class="mb-4">This Guide provides Seller/Servicers with the requirements for originating, selling, and servicing Mortgages in accordance with MortgageMax's standards. Compliance with the Guide is a condition of each Seller/Servicer's Purchase Documents and Servicing Agreement.</p>
        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">1100.2 How to Use the Guide</h2>
        <p class="mb-4">The Guide is organized into numbered series and chapters. Each chapter addresses specific topics, and related sections within each chapter provide detailed requirements. Use the navigation tree on the left to browse the Guide structure, or use the search functionality to find specific topics.</p>
      `,
    },
    '4100': {
      id: '4100',
      title: 'Chapter 4100: Borrower Eligibility',
      effectiveDate: 'December 11, 2025',
      breadcrumbs: [
        { label: 'Home', sectionId: '' },
        { label: 'Series 4000: Origination and Underwriting', sectionId: '4000' },
        { label: 'Chapter 4100: Borrower Eligibility', sectionId: '4100' },
      ],
      contentHtml: `
        <p class="mb-4">This chapter provides the requirements for evaluating Borrower eligibility for Mortgages sold to MortgageMax. The Seller/Servicer must determine that each Borrower meets the eligibility requirements described in this chapter and in the applicable Product chapters of the Guide.</p>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">4100.1 General Requirements</h2>
        <p class="mb-4">Each Borrower on the Mortgage must meet the following general eligibility requirements:</p>
        <ul class="list-disc pl-8 mb-4 space-y-2">
          <li>Be a natural person (an individual human being)</li>
          <li>Have a valid Social Security Number (SSN) or Individual Taxpayer Identification Number (ITIN) as permitted by the Guide</li>
          <li>Be of legal age to execute a Mortgage and Note under applicable state law</li>
          <li>Intend to occupy the Mortgaged Premises as their Primary Residence, unless the Mortgage is for a Second Home or Investment Property</li>
          <li>Demonstrate the willingness and ability to repay the Mortgage debt</li>
        </ul>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">4100.2 Citizenship and Residency</h2>
        <p class="mb-4">MortgageMax purchases Mortgages made to Borrowers who are:</p>
        <ul class="list-disc pl-8 mb-4 space-y-2">
          <li>U.S. citizens</li>
          <li>Permanent resident aliens</li>
          <li>Non-permanent resident aliens with lawful residency in the U.S.</li>
        </ul>
        <p class="mb-4">The Seller/Servicer must verify the Borrower's citizenship or immigration status and retain documentation in the Mortgage file.</p>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">4100.3 Age of Borrower</h2>
        <p class="mb-4">There is no maximum age limit for Borrowers. However, the Borrower must be of legal age to execute the Mortgage and Note under the jurisdiction in which the Mortgaged Premises is located.</p>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">4100.4 Number of Borrowers</h2>
        <p class="mb-4">There is no specific limit to the number of Borrowers who may be obligated on a Mortgage that is sold to MortgageMax. All Borrowers must meet the eligibility requirements of the Guide and must execute the Note.</p>
      `,
      tableData: {
        headers: [
          'Property Type',
          'Max LTV/TLTV',
          'Min Credit Score',
          'Max DTI Ratio',
          'Occupancy',
          'Documentation Level',
        ],
        rows: [
          ['1-Unit Primary Residence', '97%', '620', '45%', 'Owner-Occupied', 'Full Documentation'],
          ['2-Unit Primary Residence', '85%', '620', '45%', 'Owner-Occupied', 'Full Documentation'],
          ['3-4 Unit Primary Residence', '80%', '620', '45%', 'Owner-Occupied', 'Full Documentation'],
          ['1-Unit Second Home', '90%', '640', '45%', 'Second Home', 'Full Documentation'],
          ['1-Unit Investment', '85%', '660', '45%', 'Investment', 'Full Documentation'],
          ['2-4 Unit Investment', '75%', '660', '45%', 'Investment', 'Full Documentation'],
          ['Manufactured Home', '95%', '620', '45%', 'Owner-Occupied', 'Full Documentation'],
          ['Condo – Primary', '97%', '620', '45%', 'Owner-Occupied', 'Full Documentation'],
          ['Condo – Investment', '75%', '660', '45%', 'Investment', 'Full Documentation'],
          ['Co-op', '80%', '680', '43%', 'Owner-Occupied', 'Full Documentation'],
        ],
      },
    },
    '4101': {
      id: '4101',
      title: 'Section 4101.1: General Borrower Requirements',
      effectiveDate: 'December 11, 2025',
      breadcrumbs: [
        { label: 'Home', sectionId: '' },
        { label: 'Series 4000', sectionId: '4000' },
        { label: 'Chapter 4100', sectionId: '4100' },
        { label: 'Section 4101.1', sectionId: '4101' },
      ],
      contentHtml: `
        <p class="mb-4">The Seller/Servicer must confirm that each Borrower meets the requirements outlined below. These requirements apply to all Mortgage products unless specific exceptions are noted in the applicable Product chapters.</p>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">4101.1(a) Identity Verification</h2>
        <p class="mb-4">The Seller/Servicer must verify the identity of each Borrower by obtaining at least one form of government-issued photo identification. Acceptable forms of identification include:</p>
        <ul class="list-disc pl-8 mb-4 space-y-2">
          <li>Valid state-issued driver's license</li>
          <li>State-issued identification card</li>
          <li>Valid U.S. passport or passport card</li>
          <li>U.S. military identification card</li>
        </ul>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">4101.1(b) Social Security Number</h2>
        <p class="mb-4">Each Borrower must have a valid Social Security Number (SSN). The Seller/Servicer must verify the SSN through appropriate verification methods, such as the Social Security Administration's verification service or through a credit report that matches the Borrower's SSN with their identity.</p>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">4101.1(c) Legal Capacity</h2>
        <p class="mb-4">The Borrower must have the legal capacity to incur the debt obligation. This includes being of legal age and having the mental capacity to enter into a binding contract under applicable state law. Mortgages executed by a Borrower under a Power of Attorney (POA) are eligible, subject to the requirements in Guide Section 4101.4.</p>
      `,
    },
    '4102': {
      id: '4102',
      title: 'Section 4101.2: Non-Occupant Borrowers',
      effectiveDate: 'December 11, 2025',
      breadcrumbs: [
        { label: 'Home', sectionId: '' },
        { label: 'Series 4000', sectionId: '4000' },
        { label: 'Chapter 4100', sectionId: '4100' },
        { label: 'Section 4101.2', sectionId: '4102' },
      ],
      contentHtml: `
        <p class="mb-4">A Non-Occupant Borrower is a Borrower who will not occupy the Mortgaged Premises as a Primary Residence. MortgageMax permits Non-Occupant Borrowers under certain conditions as outlined in this section.</p>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">4101.2(a) When Non-Occupant Borrowers Are Permitted</h2>
        <p class="mb-4">A Non-Occupant Borrower may be included on a Mortgage when:</p>
        <ul class="list-disc pl-8 mb-4 space-y-2">
          <li>At least one Borrower will occupy the property as their Primary Residence</li>
          <li>The Non-Occupant Borrower has a demonstrated relationship with the occupant Borrower (family member, domestic partner, etc.)</li>
          <li>The transaction meets the applicable LTV/TLTV requirements for properties with Non-Occupant Borrowers</li>
        </ul>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">4101.2(b) Underwriting Considerations</h2>
        <p class="mb-4">When a Mortgage includes a Non-Occupant Borrower, the Seller/Servicer must apply the more restrictive LTV/TLTV limits. The income and assets of the Non-Occupant Borrower may be used to qualify for the Mortgage, and their liabilities must also be included in the DTI ratio calculation.</p>
      `,
    },
    '4103': {
      id: '4103',
      title: 'Section 4101.3: Multiple Financed Properties',
      effectiveDate: 'December 11, 2025',
      breadcrumbs: [
        { label: 'Home', sectionId: '' },
        { label: 'Series 4000', sectionId: '4000' },
        { label: 'Chapter 4100', sectionId: '4100' },
        { label: 'Section 4101.3', sectionId: '4103' },
      ],
      contentHtml: `
        <p class="mb-4">MortgageMax limits the number of financed properties that a Borrower may have. This section defines the requirements for Mortgages when the Borrower owns multiple financed properties.</p>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">4101.3(a) Maximum Number of Financed Properties</h2>
        <p class="mb-4">A Borrower may have a maximum of 10 financed properties (including the subject property). The requirements vary based on the number of financed properties, as shown in the table below.</p>
      `,
      tableData: {
        headers: ['Number of Properties', 'Minimum Credit Score', 'Minimum Down Payment', 'Reserve Requirements', 'Cash-Out Refinance Allowed'],
        rows: [
          ['1-4', '620', '15% (Investment)', '2 months PITIA', 'Yes'],
          ['5-6', '720', '25%', '6 months PITIA per property', 'No'],
          ['7-10', '720', '25%', '6 months PITIA per property', 'No'],
        ],
      },
    },
    '5100': {
      id: '5100',
      title: 'Chapter 5100: Appraisal Requirements',
      effectiveDate: 'November 20, 2025',
      breadcrumbs: [
        { label: 'Home', sectionId: '' },
        { label: 'Series 5000', sectionId: '5000' },
        { label: 'Chapter 5100', sectionId: '5100' },
      ],
      contentHtml: `
        <p class="mb-4">This chapter provides the appraisal requirements for Mortgages sold to MortgageMax. The Seller/Servicer must ensure that appraisals are performed in compliance with the Uniform Standards of Professional Appraisal Practice (USPAP) and meet the specific requirements of the Guide.</p>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">5100.1 General Appraisal Standards</h2>
        <p class="mb-4">All appraisals must be performed by state-licensed or state-certified appraisers in accordance with applicable federal and state regulations. The appraisal must provide a credible opinion of the market value of the Mortgaged Premises as of the effective date of the appraisal.</p>

        <h2 class="text-xl font-bold text-fm-text mt-6 mb-3">5100.2 Appraisal Independence</h2>
        <p class="mb-4">The Seller/Servicer must ensure that the appraisal process is independent and free from inappropriate influence. The appraiser must have no direct or indirect interest in the transaction, and the Seller/Servicer must not engage in any practice that impairs the independence of the appraisal.</p>
      `,
    },
  };

  // ── Related Resources Map ────────────────────────────────────────
  private readonly relatedResourcesMap: Record<string, RelatedResources> = {
    '4100': {
      bulletins: [
        { id: 'b1', title: 'Bulletin 2025-28: Borrower Eligibility Updates', date: 'Dec 11, 2025', pdfUrl: '#' },
        { id: 'b2', title: 'Bulletin 2025-22: LTV Ratio Changes', date: 'Oct 15, 2025', pdfUrl: '#' },
        { id: 'b3', title: 'Bulletin 2025-18: Credit Score Requirements', date: 'Sep 01, 2025', pdfUrl: '#' },
        { id: 'b4', title: 'Bulletin 2025-12: DTI Calculation Updates', date: 'Jul 20, 2025', pdfUrl: '#' },
      ],
      faqs: [
        { id: 'f1', question: 'What is the minimum credit score for a primary residence?', answer: 'The minimum credit score for a 1-unit primary residence is 620, as specified in Section 4100.4 of the Guide. Higher credit scores may be required for certain property types or investment properties.' },
        { id: 'f2', question: 'Can a non-U.S. citizen obtain a MortgageMax mortgage?', answer: 'Yes, permanent and non-permanent resident aliens with lawful residency in the U.S. are eligible. See Section 4100.2 for detailed citizenship and residency requirements.' },
        { id: 'f3', question: 'What is the maximum DTI ratio allowed?', answer: 'The maximum DTI ratio is generally 45% for most mortgage products. However, this may vary depending on compensating factors and the specific loan parameters. Refer to Section 4100 for detailed matrix.' },
        { id: 'f4', question: 'Are manufactured homes eligible?', answer: 'Yes, manufactured homes are eligible with a maximum LTV of 95% for owner-occupied primary residences and a minimum credit score of 620. See the eligibility matrix in Section 4100.' },
      ],
      forms: [
        { id: 'frm1', title: 'Uniform Residential Loan Application', formNumber: 'Form 65', url: '#' },
        { id: 'frm2', title: 'Borrower Verification of Employment', formNumber: 'Form 90', url: '#' },
        { id: 'frm3', title: 'Request for Transcript of Tax Return', formNumber: 'Form 4506-C', url: '#' },
      ],
    },
    default: {
      bulletins: [
        { id: 'b1', title: 'Bulletin 2025-28: General Guide Updates', date: 'Dec 11, 2025', pdfUrl: '#' },
        { id: 'b2', title: 'Bulletin 2025-25: Servicing Enhancements', date: 'Nov 08, 2025', pdfUrl: '#' },
      ],
      faqs: [
        { id: 'f1', question: 'How often is the Guide updated?', answer: 'The Guide is updated regularly through Guide Bulletins, which are issued as needed to communicate policy changes and enhancements.' },
        { id: 'f2', question: 'Where can I find the latest Bulletins?', answer: 'The latest Bulletins are available on the MortgageMax website and through the Guide\'s Bulletin section. You can also subscribe to email notifications.' },
      ],
      forms: [
        { id: 'frm1', title: 'Uniform Residential Loan Application', formNumber: 'Form 65', url: '#' },
      ],
    },
  };

  // ── Computed Values ──────────────────────────────────────────────
  readonly currentSection = computed<GuideSection>(() => {
    const id = this.selectedSectionId();
    return this.sectionContentMap[id] ?? this.getDefaultSection(id);
  });

  readonly relatedResources = computed<RelatedResources>(() => {
    const id = this.selectedSectionId();
    return this.relatedResourcesMap[id] ?? this.relatedResourcesMap['default'];
  });

  // ── Methods ──────────────────────────────────────────────────────
  selectSection(id: string): void {
    this.selectedSectionId.set(id);
    this.ensureParentsExpanded(id);
  }

  toggleNode(id: string): void {
    const current = new Set(this.expandedNodes());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.expandedNodes.set(current);
  }

  isExpanded(id: string): boolean {
    return this.expandedNodes().has(id);
  }

  // ── Private Helpers ─────────────────────────────────────────────
  private ensureParentsExpanded(targetId: string): void {
    const path = this.findPathToNode(targetId, this.navigationTree());
    if (path) {
      const current = new Set(this.expandedNodes());
      path.forEach(id => current.add(id));
      this.expandedNodes.set(current);
    }
  }

  private findPathToNode(targetId: string, items: NavigationItem[], path: string[] = []): string[] | null {
    for (const item of items) {
      if (item.id === targetId) {
        return path;
      }
      if (item.children) {
        const result = this.findPathToNode(targetId, item.children, [...path, item.id]);
        if (result) return result;
      }
    }
    return null;
  }

  private getDefaultSection(id: string): GuideSection {
    const item = this.findNavItem(id, this.navigationTree());
    const title = item?.title ?? `Section ${id}`;
    return {
      id,
      title,
      effectiveDate: 'January 01, 2026',
      breadcrumbs: [
        { label: 'Home', sectionId: '' },
        { label: title, sectionId: id },
      ],
      contentHtml: `
        <p class="mb-4">Content for <strong>${title}</strong> is currently being updated. Please check back later or refer to the latest Guide Bulletin for any interim changes.</p>
        <p class="mb-4">For questions regarding this section, please contact your MortgageMax representative or visit the <a href="#" class="text-fm-blue hover:underline">MortgageMax Learning Center</a>.</p>
      `,
    };
  }

  private findNavItem(id: string, items: NavigationItem[]): NavigationItem | null {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = this.findNavItem(id, item.children);
        if (found) return found;
      }
    }
    return null;
  }
}
