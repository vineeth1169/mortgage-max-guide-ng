import { Component, inject, signal } from '@angular/core';
import { GuideDataService } from '../../services/guide-data.service';

@Component({
  selector: 'app-related-sidebar',
  standalone: true,
  imports: [],
  template: `
    <aside class="bg-fm-bg-light border-l border-fm-border h-full overflow-y-auto font-arial">

      <!-- ===== Related Bulletins ===== -->
      <div class="border-b border-fm-border">
        <button
          class="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-fm-text
                 hover:bg-white transition-colors"
          (click)="toggleSection('bulletins')"
        >
          <span class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-fm-blue" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Related Bulletins
          </span>
          <svg xmlns="http://www.w3.org/2000/svg"
               class="w-4 h-4 transition-transform duration-200"
               [class.rotate-180]="isSectionOpen('bulletins')"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        @if (isSectionOpen('bulletins')) {
          <div class="px-4 pb-3">
            @for (bulletin of guideData.relatedResources().bulletins; track bulletin.id) {
              <a
                [href]="bulletin.pdfUrl"
                class="flex items-start gap-2 py-2 group border-b border-fm-border/50
                       last:border-b-0 hover:bg-white rounded px-2 -mx-2 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg"
                     class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <div class="min-w-0">
                  <span class="text-xs text-fm-blue group-hover:underline leading-snug block">
                    {{ bulletin.title }}
                  </span>
                  <span class="text-[10px] text-gray-400 mt-0.5 block">{{ bulletin.date }}</span>
                </div>
              </a>
            }
          </div>
        }
      </div>

      <!-- ===== Related FAQs ===== -->
      <div class="border-b border-fm-border">
        <button
          class="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-fm-text
                 hover:bg-white transition-colors"
          (click)="toggleSection('faqs')"
        >
          <span class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-fm-green" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Related FAQs
          </span>
          <svg xmlns="http://www.w3.org/2000/svg"
               class="w-4 h-4 transition-transform duration-200"
               [class.rotate-180]="isSectionOpen('faqs')"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        @if (isSectionOpen('faqs')) {
          <div class="px-4 pb-3">
            @for (faq of guideData.relatedResources().faqs; track faq.id) {
              <div class="border-b border-fm-border/50 last:border-b-0">
                <button
                  class="w-full text-left py-2.5 flex items-start gap-2 group"
                  (click)="toggleFaq(faq.id)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg"
                       class="w-3.5 h-3.5 text-fm-text flex-shrink-0 mt-0.5
                              transition-transform duration-200"
                       [class.rotate-90]="isFaqOpen(faq.id)"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <span class="text-xs text-fm-text group-hover:text-fm-blue leading-snug transition-colors">
                    {{ faq.question }}
                  </span>
                </button>
                @if (isFaqOpen(faq.id)) {
                  <div class="pl-6 pb-3 text-xs text-gray-500 leading-relaxed animate-fadeIn">
                    {{ faq.answer }}
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- ===== Forms ===== -->
      <div class="border-b border-fm-border">
        <button
          class="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-fm-text
                 hover:bg-white transition-colors"
          (click)="toggleSection('forms')"
        >
          <span class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-fm-orange" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Forms
          </span>
          <svg xmlns="http://www.w3.org/2000/svg"
               class="w-4 h-4 transition-transform duration-200"
               [class.rotate-180]="isSectionOpen('forms')"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        @if (isSectionOpen('forms')) {
          <div class="px-4 pb-3">
            @for (form of guideData.relatedResources().forms; track form.id) {
              <a
                [href]="form.url"
                class="flex items-center gap-3 py-2.5 border-b border-fm-border/50
                       last:border-b-0 hover:bg-white rounded px-2 -mx-2
                       transition-colors group"
              >
                <div class="w-8 h-8 rounded bg-fm-orange/10 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-fm-orange"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </div>
                <div class="min-w-0">
                  <span class="text-xs text-fm-blue group-hover:underline block leading-snug">
                    {{ form.title }}
                  </span>
                  <span class="text-[10px] text-gray-400 block">{{ form.formNumber }}</span>
                </div>
              </a>
            }
          </div>
        }
      </div>

      <!-- ===== Help Box ===== -->
      <div class="p-4">
        <div class="bg-white border border-fm-border rounded-lg p-4">
          <h3 class="text-xs font-bold text-fm-text mb-2 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-fm-blue" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Need Help?
          </h3>
          <p class="text-[11px] text-gray-400 leading-relaxed mb-3">
            Contact your MortgageMax representative for questions about Guide requirements.
          </p>
          <a href="#" class="inline-flex items-center gap-1 text-xs text-fm-blue hover:underline font-semibold">
            Contact Support
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.15s ease-out;
    }
  `],
})
export class RelatedSidebarComponent {
  readonly guideData = inject(GuideDataService);

  private readonly openSections = signal<Set<string>>(new Set(['bulletins', 'faqs', 'forms']));
  private readonly openFaqs = signal<Set<string>>(new Set());

  toggleSection(section: string): void {
    const current = new Set(this.openSections());
    if (current.has(section)) {
      current.delete(section);
    } else {
      current.add(section);
    }
    this.openSections.set(current);
  }

  isSectionOpen(section: string): boolean {
    return this.openSections().has(section);
  }

  toggleFaq(faqId: string): void {
    const current = new Set(this.openFaqs());
    if (current.has(faqId)) {
      current.delete(faqId);
    } else {
      current.add(faqId);
    }
    this.openFaqs.set(current);
  }

  isFaqOpen(faqId: string): boolean {
    return this.openFaqs().has(faqId);
  }
}
