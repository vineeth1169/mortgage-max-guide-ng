import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RulesApiService } from '../../services/rules-api.service';
import { 
  Rule, 
  RuleFormData, 
  RuleCategory, 
  RuleOperator, 
  RuleSeverity,
  CATEGORY_LABELS,
  OPERATOR_LABELS,
  SEVERITY_CONFIG,
  LOAN_FIELDS
} from '../../models/rule.model';

@Component({
  selector: 'app-rules-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <div class="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-fm-blue" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
              <div>
                <h1 class="text-xl font-bold text-gray-900">Rules Administration</h1>
                <p class="text-xs text-gray-500">Manage eligibility validation rules</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <!-- API Status -->
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                   [class]="apiConnected() 
                     ? 'bg-green-100 text-green-700' 
                     : 'bg-red-100 text-red-700'">
                <span class="w-2 h-2 rounded-full" 
                      [class]="apiConnected() ? 'bg-green-500' : 'bg-red-500'"></span>
                {{ apiConnected() ? 'API Connected' : 'API Offline' }}
              </div>

              <a href="/" 
                 class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                ← Back to App
              </a>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="text-2xl font-bold text-gray-900">{{ rulesApi.ruleCount() }}</div>
            <div class="text-sm text-gray-500">Total Rules</div>
          </div>
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="text-2xl font-bold text-green-600">{{ rulesApi.enabledRules().length }}</div>
            <div class="text-sm text-gray-500">Enabled</div>
          </div>
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="text-2xl font-bold text-gray-400">{{ rulesApi.disabledRules().length }}</div>
            <div class="text-sm text-gray-500">Disabled</div>
          </div>
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div class="text-2xl font-bold text-fm-blue">{{ rulesApi.categories().length }}</div>
            <div class="text-sm text-gray-500">Categories</div>
          </div>
        </div>

        <!-- Actions Bar -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <!-- Category Filter -->
            <select [(ngModel)]="selectedCategory"
                    (change)="filterByCategory()"
                    class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue">
              <option value="">All Categories</option>
              @for (cat of categoryOptions; track cat.value) {
                <option [value]="cat.value">{{ cat.label }}</option>
              }
            </select>

            <!-- Search -->
            <div class="relative">
              <input type="text" 
                     [(ngModel)]="searchQuery"
                     (input)="filterRules()"
                     placeholder="Search rules..."
                     class="w-64 pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue" />
              <svg xmlns="http://www.w3.org/2000/svg" class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button (click)="exportRules()"
                    class="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Export
            </button>
            <button (click)="triggerImport()"
                    class="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Import
            </button>
            <input type="file" #importInput accept=".json" (change)="importRules($event)" class="hidden" />
            <button (click)="openCreateModal()"
                    class="px-4 py-2 text-sm font-medium text-white bg-fm-blue rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Rule
            </button>
          </div>
        </div>

        <!-- Error Message -->
        @if (rulesApi.error()) {
          <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {{ rulesApi.error() }}
          </div>
        }

        <!-- Rules Table -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          @if (rulesApi.isLoading()) {
            <div class="p-8 text-center text-gray-500">
              <div class="animate-spin w-8 h-8 border-2 border-fm-blue border-t-transparent rounded-full mx-auto mb-2"></div>
              Loading rules...
            </div>
          } @else if (filteredRules().length === 0) {
            <div class="p-8 text-center text-gray-500">
              No rules found. {{ searchQuery ? 'Try a different search.' : 'Click "Add Rule" to create one.' }}
            </div>
          } @else {
            <table class="w-full">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule ID</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                @for (rule of filteredRules(); track rule.id) {
                  <tr class="hover:bg-gray-50 transition-colors" [class.opacity-50]="!rule.enabled">
                    <td class="px-4 py-3">
                      <span class="font-mono text-sm font-medium text-fm-blue">{{ rule.id }}</span>
                    </td>
                    <td class="px-4 py-3">
                      <div class="text-sm font-medium text-gray-900">{{ rule.name }}</div>
                      <div class="text-xs text-gray-500 truncate max-w-xs">{{ rule.description }}</div>
                    </td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {{ getCategoryLabel(rule.category) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600 font-mono">{{ rule.field }}</td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-1 text-xs font-medium rounded-full"
                            [class]="getSeverityConfig(rule.severity).bgColor + ' ' + getSeverityConfig(rule.severity).color">
                        {{ getSeverityConfig(rule.severity).label }}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <button (click)="toggleRule(rule)"
                              class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                              [class]="rule.enabled ? 'bg-green-500' : 'bg-gray-300'">
                        <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out"
                              [class]="rule.enabled ? 'translate-x-4' : 'translate-x-0'"></span>
                      </button>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <button (click)="openEditModal(rule)"
                                class="p-1 text-gray-400 hover:text-fm-blue transition-colors" title="Edit">
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                          </svg>
                        </button>
                        <button (click)="confirmDelete(rule)"
                                class="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </main>

      <!-- Create/Edit Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-6 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">
                {{ editingRule() ? 'Edit Rule' : 'Create New Rule' }}
              </h2>
            </div>

            <form (ngSubmit)="saveRule()" class="p-6 space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <!-- Rule ID -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Rule ID</label>
                  <input type="text" [(ngModel)]="formData.id" name="id"
                         [disabled]="!!editingRule()"
                         placeholder="e.g., CUSTOM-001"
                         class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue disabled:bg-gray-100" />
                </div>

                <!-- Name -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" [(ngModel)]="formData.name" name="name" required
                         placeholder="Rule name"
                         class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue" />
                </div>
              </div>

              <!-- Description -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" [(ngModel)]="formData.description" name="description"
                       placeholder="Brief description of the rule"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue" />
              </div>

              <div class="grid grid-cols-3 gap-4">
                <!-- Category -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select [(ngModel)]="formData.category" name="category"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue">
                    @for (cat of categoryOptions; track cat.value) {
                      <option [value]="cat.value">{{ cat.label }}</option>
                    }
                  </select>
                </div>

                <!-- Severity -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                  <select [(ngModel)]="formData.severity" name="severity"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue">
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </div>

                <!-- Enabled -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select [(ngModel)]="formData.enabled" name="enabled"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue">
                    <option [ngValue]="true">Enabled</option>
                    <option [ngValue]="false">Disabled</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <!-- Field -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Field *</label>
                  <select [(ngModel)]="formData.field" name="field" required
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue">
                    @for (field of loanFields; track field.value) {
                      <option [value]="field.value">{{ field.label }}</option>
                    }
                  </select>
                </div>

                <!-- Operator -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Operator *</label>
                  <select [(ngModel)]="formData.operator" name="operator" required
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue">
                    @for (op of operatorOptions; track op.value) {
                      <option [value]="op.value">{{ op.label }}</option>
                    }
                  </select>
                </div>
              </div>

              <!-- Value (conditional) -->
              @if (needsValue()) {
                <div class="grid grid-cols-2 gap-4">
                  @if (needsSingleValue()) {
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Value</label>
                      <input type="text" [(ngModel)]="formData.value" name="value"
                             class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue" />
                    </div>
                  }
                  @if (needsRange()) {
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Min Value</label>
                      <input type="number" [(ngModel)]="formData.minValue" name="minValue"
                             class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Max Value</label>
                      <input type="number" [(ngModel)]="formData.maxValue" name="maxValue"
                             class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue" />
                    </div>
                  }
                  @if (needsCompareField()) {
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Compare Field</label>
                      <select [(ngModel)]="formData.compareField" name="compareField"
                              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue">
                        @for (field of loanFields; track field.value) {
                          <option [value]="field.value">{{ field.label }}</option>
                        }
                      </select>
                    </div>
                  }
                  @if (needsValueList()) {
                    <div class="col-span-2">
                      <label class="block text-sm font-medium text-gray-700 mb-1">Values (comma-separated)</label>
                      <input type="text" [(ngModel)]="valuesInput" name="values"
                             placeholder="SF, CO, CP, PU"
                             class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue" />
                    </div>
                  }
                </div>
              }

              <!-- Requirement (display string) -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Requirement</label>
                <input type="text" [(ngModel)]="formData.requirement" name="requirement"
                       placeholder="e.g., UPB > 0"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue" />
              </div>

              <!-- Guide Reference -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Guide Reference</label>
                <input type="text" [(ngModel)]="formData.guideReference" name="guideReference"
                       placeholder="e.g., Section 4301.1"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue" />
              </div>

              <!-- Explanation -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
                <textarea [(ngModel)]="formData.explanation" name="explanation" rows="3"
                          placeholder="Detailed explanation for why this rule exists..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue resize-none"></textarea>
              </div>

              <!-- Remediation -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Remediation</label>
                <textarea [(ngModel)]="formData.remediation" name="remediation" rows="2"
                          placeholder="How to fix violations of this rule..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fm-blue resize-none"></textarea>
              </div>

              <!-- Actions -->
              <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" (click)="closeModal()"
                        class="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                        [disabled]="!isFormValid()"
                        class="px-4 py-2 text-sm font-medium text-white bg-fm-blue rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {{ editingRule() ? 'Update Rule' : 'Create Rule' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Delete Confirmation Modal -->
      @if (showDeleteConfirm()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-2">Delete Rule?</h2>
            <p class="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{{ deletingRule()?.id }}</strong>? This action cannot be undone.
            </p>
            <div class="flex items-center justify-end gap-3">
              <button (click)="showDeleteConfirm.set(false)"
                      class="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button (click)="deleteRule()"
                      class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class RulesManagerComponent implements OnInit {
  readonly rulesApi = inject(RulesApiService);

  // State
  readonly apiConnected = signal<boolean>(false);
  readonly showModal = signal<boolean>(false);
  readonly showDeleteConfirm = signal<boolean>(false);
  readonly editingRule = signal<Rule | null>(null);
  readonly deletingRule = signal<Rule | null>(null);

  // Filters
  selectedCategory = '';
  searchQuery = '';

  // Form
  formData: RuleFormData = this.getEmptyFormData();
  valuesInput = '';

  // Options
  readonly categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
  readonly operatorOptions = Object.entries(OPERATOR_LABELS).map(([value, label]) => ({ value, label }));
  readonly loanFields = LOAN_FIELDS;

  // Computed
  readonly filteredRules = computed(() => {
    let rules = this.rulesApi.rules();
    
    if (this.selectedCategory) {
      rules = rules.filter(r => r.category === this.selectedCategory);
    }
    
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      rules = rules.filter(r => 
        r.id.toLowerCase().includes(query) ||
        r.name.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.field.toLowerCase().includes(query)
      );
    }
    
    return rules;
  });

  async ngOnInit(): Promise<void> {
    await this.checkApiConnection();
    if (this.apiConnected()) {
      await this.rulesApi.loadRules();
      await this.rulesApi.loadCategories();
    }
  }

  async checkApiConnection(): Promise<void> {
    const connected = await this.rulesApi.checkHealth();
    this.apiConnected.set(connected);
  }

  // ── CRUD Operations ─────────────────────────────────────────────

  openCreateModal(): void {
    this.editingRule.set(null);
    this.formData = this.getEmptyFormData();
    this.valuesInput = '';
    this.showModal.set(true);
  }

  openEditModal(rule: Rule): void {
    this.editingRule.set(rule);
    this.formData = { ...rule };
    this.valuesInput = rule.values?.join(', ') || '';
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingRule.set(null);
  }

  async saveRule(): Promise<void> {
    if (!this.isFormValid()) return;

    // Convert values input to array
    if (this.valuesInput) {
      this.formData.values = this.valuesInput.split(',').map(v => v.trim()).filter(v => v);
    }

    if (this.editingRule()) {
      await this.rulesApi.updateRule(this.editingRule()!.id, this.formData);
    } else {
      await this.rulesApi.createRule(this.formData);
    }

    this.closeModal();
  }

  async toggleRule(rule: Rule): Promise<void> {
    await this.rulesApi.toggleRule(rule.id);
  }

  confirmDelete(rule: Rule): void {
    this.deletingRule.set(rule);
    this.showDeleteConfirm.set(true);
  }

  async deleteRule(): Promise<void> {
    if (this.deletingRule()) {
      await this.rulesApi.deleteRule(this.deletingRule()!.id);
      this.showDeleteConfirm.set(false);
      this.deletingRule.set(null);
    }
  }

  // ── Import/Export ───────────────────────────────────────────────

  async exportRules(): Promise<void> {
    await this.rulesApi.exportRules();
  }

  triggerImport(): void {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    input?.click();
  }

  async importRules(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const rules = data.rules || data;
      await this.rulesApi.importRules(rules, false);
    } catch (err) {
      console.error('Import error:', err);
    }

    input.value = '';
  }

  // ── Filtering ───────────────────────────────────────────────────

  filterByCategory(): void {
    // Triggers computed update
  }

  filterRules(): void {
    // Triggers computed update
  }

  // ── Helpers ─────────────────────────────────────────────────────

  getCategoryLabel(category: RuleCategory): string {
    return CATEGORY_LABELS[category] || category;
  }

  getSeverityConfig(severity: RuleSeverity) {
    return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.error;
  }

  getEmptyFormData(): RuleFormData {
    return {
      id: '',
      name: '',
      category: 'custom',
      description: '',
      requirement: '',
      field: 'interestRate',
      operator: 'gt',
      severity: 'error',
      guideReference: '',
      explanation: '',
      remediation: '',
      enabled: true
    };
  }

  isFormValid(): boolean {
    return !!this.formData.name && !!this.formData.field && !!this.formData.operator;
  }

  needsValue(): boolean {
    return ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'range', 'range_field', 'in', 'notin'].includes(this.formData.operator);
  }

  needsSingleValue(): boolean {
    return ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'].includes(this.formData.operator);
  }

  needsRange(): boolean {
    return this.formData.operator === 'range';
  }

  needsCompareField(): boolean {
    return ['lte', 'gte', 'lt', 'gt', 'range_field'].includes(this.formData.operator) && 
           (['couponRate', 'netYield', 'currentInvestorBalance'].includes(this.formData.field));
  }

  needsValueList(): boolean {
    return ['in', 'notin'].includes(this.formData.operator);
  }
}
