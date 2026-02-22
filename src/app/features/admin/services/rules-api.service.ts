import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Rule, RulesApiResponse, CategoryInfo, RuleFormData } from '../models/rule.model';
import { environment } from '../../../../environments/environment';

/**
 * Service for managing eligibility rules via the backend API.
 */
@Injectable({ providedIn: 'root' })
export class RulesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.rulesApiUrl || 'http://localhost:3001/api';

  // ── State ─────────────────────────────────────────────────────────
  
  readonly rules = signal<Rule[]>([]);
  readonly categories = signal<CategoryInfo[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string | null>(null);

  readonly enabledRules = computed(() => this.rules().filter(r => r.enabled));
  readonly disabledRules = computed(() => this.rules().filter(r => !r.enabled));
  readonly ruleCount = computed(() => this.rules().length);

  // ── CRUD Operations ───────────────────────────────────────────────

  /**
   * Fetch all rules from the API.
   */
  async loadRules(options?: { category?: string; enabled?: boolean }): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      let url = `${this.baseUrl}/rules`;
      const params: string[] = [];
      
      if (options?.category) {
        params.push(`category=${options.category}`);
      }
      if (options?.enabled !== undefined) {
        params.push(`enabled=${options.enabled}`);
      }
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await firstValueFrom(
        this.http.get<RulesApiResponse>(url)
      );

      if (response.success && Array.isArray(response.data)) {
        this.rules.set(response.data);
        this.lastUpdated.set(response.metadata?.lastUpdated || new Date().toISOString());
      } else {
        throw new Error(response.error || 'Failed to load rules');
      }
    } catch (err: any) {
      const message = err.error?.error || err.message || 'Failed to connect to Rules API';
      this.error.set(message);
      console.error('RulesApiService.loadRules error:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Get a single rule by ID.
   */
  async getRule(id: string): Promise<Rule | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<RulesApiResponse>(`${this.baseUrl}/rules/${id}`)
      );

      if (response.success && !Array.isArray(response.data)) {
        return response.data;
      }
      return null;
    } catch (err: any) {
      console.error('RulesApiService.getRule error:', err);
      return null;
    }
  }

  /**
   * Create a new rule.
   */
  async createRule(ruleData: RuleFormData): Promise<{ success: boolean; rule?: Rule; error?: string }> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<RulesApiResponse>(`${this.baseUrl}/rules`, ruleData)
      );

      if (response.success && !Array.isArray(response.data)) {
        // Add to local state
        this.rules.update(rules => [...rules, response.data as Rule]);
        return { success: true, rule: response.data };
      } else {
        throw new Error(response.error || 'Failed to create rule');
      }
    } catch (err: any) {
      const message = err.error?.error || err.message || 'Failed to create rule';
      this.error.set(message);
      return { success: false, error: message };
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Update an existing rule.
   */
  async updateRule(id: string, ruleData: Partial<RuleFormData>): Promise<{ success: boolean; rule?: Rule; error?: string }> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.put<RulesApiResponse>(`${this.baseUrl}/rules/${id}`, ruleData)
      );

      if (response.success && !Array.isArray(response.data)) {
        // Update local state
        this.rules.update(rules => 
          rules.map(r => r.id === id ? response.data as Rule : r)
        );
        return { success: true, rule: response.data };
      } else {
        throw new Error(response.error || 'Failed to update rule');
      }
    } catch (err: any) {
      const message = err.error?.error || err.message || 'Failed to update rule';
      this.error.set(message);
      return { success: false, error: message };
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Delete a rule.
   */
  async deleteRule(id: string): Promise<{ success: boolean; error?: string }> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.delete<RulesApiResponse>(`${this.baseUrl}/rules/${id}`)
      );

      if (response.success) {
        // Remove from local state
        this.rules.update(rules => rules.filter(r => r.id !== id));
        return { success: true };
      } else {
        throw new Error(response.error || 'Failed to delete rule');
      }
    } catch (err: any) {
      const message = err.error?.error || err.message || 'Failed to delete rule';
      this.error.set(message);
      return { success: false, error: message };
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Toggle rule enabled status.
   */
  async toggleRule(id: string): Promise<{ success: boolean; rule?: Rule; error?: string }> {
    try {
      const response = await firstValueFrom(
        this.http.patch<RulesApiResponse>(`${this.baseUrl}/rules/${id}/toggle`, {})
      );

      if (response.success && !Array.isArray(response.data)) {
        // Update local state
        this.rules.update(rules => 
          rules.map(r => r.id === id ? response.data as Rule : r)
        );
        return { success: true, rule: response.data };
      } else {
        throw new Error(response.error || 'Failed to toggle rule');
      }
    } catch (err: any) {
      const message = err.error?.error || err.message || 'Failed to toggle rule';
      return { success: false, error: message };
    }
  }

  /**
   * Load categories.
   */
  async loadCategories(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ success: boolean; data: CategoryInfo[] }>(`${this.baseUrl}/categories`)
      );

      if (response.success) {
        this.categories.set(response.data);
      }
    } catch (err: any) {
      console.error('RulesApiService.loadCategories error:', err);
    }
  }

  /**
   * Export all rules as JSON.
   */
  async exportRules(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.baseUrl}/rules/export`)
      );

      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rules-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('RulesApiService.exportRules error:', err);
      this.error.set('Failed to export rules');
    }
  }

  /**
   * Import rules from JSON.
   */
  async importRules(rules: Rule[], replace: boolean = false): Promise<{ success: boolean; imported?: number; error?: string }> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; data: { imported: number; skipped: number; total: number }; error?: string }>(
          `${this.baseUrl}/rules/import`,
          { rules, replace }
        )
      );

      if (response.success) {
        await this.loadRules(); // Refresh local state
        return { success: true, imported: response.data.imported };
      } else {
        throw new Error(response.error || 'Failed to import rules');
      }
    } catch (err: any) {
      const message = err.error?.error || err.message || 'Failed to import rules';
      this.error.set(message);
      return { success: false, error: message };
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Check API health.
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ status: string }>(`${this.baseUrl}/health`)
      );
      return response.status === 'ok';
    } catch {
      return false;
    }
  }
}
