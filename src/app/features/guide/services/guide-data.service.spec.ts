import { TestBed } from '@angular/core/testing';
import { GuideDataService } from './guide-data.service';

describe('GuideDataService', () => {
  let service: GuideDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GuideDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── Navigation Tree ──────────────────────────────────────────

  describe('navigationTree', () => {
    it('should contain 7 top-level series', () => {
      const tree = service.navigationTree();
      expect(tree.length).toBe(7);
    });

    it('should have Series 1000 as first item', () => {
      const first = service.navigationTree()[0];
      expect(first.id).toBe('1000');
      expect(first.title).toContain('Series 1000');
    });

    it('should have Series 4000 with nested children', () => {
      const series4000 = service.navigationTree().find(n => n.id === '4000');
      expect(series4000).toBeTruthy();
      const ch4100 = series4000!.children?.find(c => c.id === '4100');
      expect(ch4100).toBeTruthy();
      expect(ch4100!.children?.length).toBe(3);
    });

    it('should have section 4101 under chapter 4100', () => {
      const series4000 = service.navigationTree().find(n => n.id === '4000');
      const ch4100 = series4000!.children?.find(c => c.id === '4100');
      const sec4101 = ch4100!.children?.find(s => s.id === '4101');
      expect(sec4101).toBeTruthy();
      expect(sec4101!.title).toContain('4101.1');
    });
  });

  // ── Section Selection ────────────────────────────────────────

  describe('selectSection', () => {
    it('should default to section 4100', () => {
      expect(service.selectedSectionId()).toBe('4100');
    });

    it('should update selectedSectionId when called', () => {
      service.selectSection('1100');
      expect(service.selectedSectionId()).toBe('1100');
    });

    it('should automatically expand parent nodes', () => {
      service.selectSection('4101');
      expect(service.isExpanded('4000')).toBeTrue();
      expect(service.isExpanded('4100')).toBeTrue();
    });

    it('should expand grand-parent for deeply nested sections', () => {
      service.selectSection('4103');
      expect(service.isExpanded('4000')).toBeTrue();
      expect(service.isExpanded('4100')).toBeTrue();
    });
  });

  // ── Node Expansion ──────────────────────────────────────────

  describe('toggleNode / isExpanded', () => {
    it('should expand a collapsed node', () => {
      expect(service.isExpanded('1000')).toBeFalse();
      service.toggleNode('1000');
      expect(service.isExpanded('1000')).toBeTrue();
    });

    it('should collapse an expanded node', () => {
      service.toggleNode('1000'); // expand
      expect(service.isExpanded('1000')).toBeTrue();
      service.toggleNode('1000'); // collapse
      expect(service.isExpanded('1000')).toBeFalse();
    });

    it('should not affect other nodes when toggling', () => {
      service.toggleNode('1000');
      service.toggleNode('2000');
      expect(service.isExpanded('1000')).toBeTrue();
      expect(service.isExpanded('2000')).toBeTrue();
      service.toggleNode('1000');
      expect(service.isExpanded('1000')).toBeFalse();
      expect(service.isExpanded('2000')).toBeTrue();
    });

    it('should have 4000 expanded by default', () => {
      expect(service.isExpanded('4000')).toBeTrue();
    });
  });

  // ── Current Section (computed) ──────────────────────────────

  describe('currentSection', () => {
    it('should return section 4100 by default', () => {
      const section = service.currentSection();
      expect(section.id).toBe('4100');
      expect(section.title).toContain('Borrower Eligibility');
    });

    it('should return correct section after selectSection', () => {
      service.selectSection('1100');
      const section = service.currentSection();
      expect(section.id).toBe('1100');
      expect(section.title).toContain('Introduction to the Guide');
    });

    it('should return a default section for unknown IDs', () => {
      service.selectSection('9999');
      const section = service.currentSection();
      expect(section.id).toBe('9999');
      expect(section.contentHtml).toContain('currently being updated');
    });

    it('should have breadcrumbs for section 4100', () => {
      const section = service.currentSection();
      expect(section.breadcrumbs.length).toBeGreaterThan(0);
      expect(section.breadcrumbs[0].label).toBe('Home');
    });

    it('should have effectiveDate', () => {
      const section = service.currentSection();
      expect(section.effectiveDate).toBeTruthy();
      expect(section.effectiveDate.length).toBeGreaterThan(0);
    });

    it('should have tableData for section 4100', () => {
      const section = service.currentSection();
      expect(section.tableData).toBeTruthy();
      expect(section.tableData!.headers.length).toBe(6);
      expect(section.tableData!.rows.length).toBe(10);
    });

    it('should have tableData for section 4103', () => {
      service.selectSection('4103');
      const section = service.currentSection();
      expect(section.tableData).toBeTruthy();
      expect(section.tableData!.rows.length).toBe(3);
    });

    it('should not have tableData for section 1100', () => {
      service.selectSection('1100');
      const section = service.currentSection();
      expect(section.tableData).toBeUndefined();
    });

    it('should have HTML content', () => {
      const section = service.currentSection();
      expect(section.contentHtml).toContain('<');
      expect(section.contentHtml.length).toBeGreaterThan(100);
    });
  });

  // ── Related Resources (computed) ────────────────────────────

  describe('relatedResources', () => {
    it('should return resources for section 4100', () => {
      const resources = service.relatedResources();
      expect(resources.bulletins.length).toBe(4);
      expect(resources.faqs.length).toBe(4);
      expect(resources.forms.length).toBe(3);
    });

    it('should return default resources for unknown sections', () => {
      service.selectSection('9999');
      const resources = service.relatedResources();
      expect(resources.bulletins.length).toBeGreaterThan(0);
      expect(resources.faqs.length).toBeGreaterThan(0);
    });

    it('bulletins should have required fields', () => {
      const bulletin = service.relatedResources().bulletins[0];
      expect(bulletin.id).toBeTruthy();
      expect(bulletin.title).toBeTruthy();
      expect(bulletin.date).toBeTruthy();
      expect(bulletin.pdfUrl).toBeTruthy();
    });

    it('faqs should have question and answer', () => {
      const faq = service.relatedResources().faqs[0];
      expect(faq.id).toBeTruthy();
      expect(faq.question).toBeTruthy();
      expect(faq.answer).toBeTruthy();
      expect(faq.question.endsWith('?')).toBeTrue();
    });

    it('forms should have formNumber', () => {
      const form = service.relatedResources().forms[0];
      expect(form.id).toBeTruthy();
      expect(form.title).toBeTruthy();
      expect(form.formNumber).toBeTruthy();
    });
  });

  // ── Content for Each Mapped Section ─────────────────────────

  describe('all mapped sections', () => {
    const mappedSections = ['1100', '4100', '4101', '4102', '4103', '5100'];

    mappedSections.forEach(sectionId => {
      it(`should return valid content for section ${sectionId}`, () => {
        service.selectSection(sectionId);
        const section = service.currentSection();
        expect(section.id).toBe(sectionId);
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.effectiveDate.length).toBeGreaterThan(0);
        expect(section.breadcrumbs.length).toBeGreaterThanOrEqual(2);
        expect(section.contentHtml.length).toBeGreaterThan(0);
      });
    });
  });
});
