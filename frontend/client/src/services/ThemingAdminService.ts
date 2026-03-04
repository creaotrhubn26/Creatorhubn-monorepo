/**
 * Theming Admin Service
 * Provides centralized administration of profession branding
 * Connects Visual Editor UI to the theming helper system
 */

import type { ProfessionBranding } from '../utils/theming-helper';
import { PROFESSION_BRANDING as DEFAULT_BRANDING } from '../utils/theming-helper';

export class ThemingAdminService {
  private customBranding: Record<string, Partial<ProfessionBranding>> = {};
  private storageKey = 'creatorhub_custom_branding';
  private updateListeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Get profession branding (merged with customizations)
   */
  getProfessionBranding(profession: string): ProfessionBranding {
    const base = DEFAULT_BRANDING[profession] || DEFAULT_BRANDING.other;
    const custom = this.customBranding[profession] || {};
    return { ...base, ...custom };
  }

  /**
   * Get all profession branding as a record
   */
  getAllProfessionBranding(): Record<string, ProfessionBranding> {
    const result: Record<string, ProfessionBranding> = {};
    Object.keys(DEFAULT_BRANDING).forEach(key => {
      result[key] = this.getProfessionBranding(key);
    });
    return result;
  }

  /**
   * Update profession branding
   */
  updateProfessionBranding(profession: string, updates: Partial<ProfessionBranding>): void {
    // Validate profession exists
    if (!DEFAULT_BRANDING[profession]) {
      console.warn(`Invalid profession: ${profession}`);
      return;
    }

    // Validate color format if provided
    if (updates.color && !/^#[0-9A-F]{6}$/i.test(updates.color)) {
      console.warn(`Invalid color format: ${updates.color}`);
      return;
    }

    // Merge updates
    this.customBranding[profession] = {
      ...this.customBranding[profession],
      ...updates
    };

    // Persist to storage
    this.saveToStorage();

    // Notify listeners
    this.notifyListeners();

    // Broadcast via custom event
    this.broadcastChanges(profession);

    console.log(`✅ Profession branding updated: ${profession}`, updates);
  }

  /**
   * Reset profession to default branding
   */
  resetProfession(profession: string): void {
    if (this.customBranding[profession]) {
      delete this.customBranding[profession];
      this.saveToStorage();
      this.notifyListeners();
      this.broadcastChanges(profession);
      console.log(`🔄 Profession branding reset to default: ${profession}`);
    }
  }

  /**
   * Reset all professions to default
   */
  resetAll(): void {
    this.customBranding = {};
    this.saveToStorage();
    this.notifyListeners();
    this.broadcastChanges('all');
    console.log('🔄 All profession branding reset to defaults');
  }

  /**
   * Check if profession has customizations
   */
  hasCustomizations(profession: string): boolean {
    return !!this.customBranding[profession];
  }

  /**
   * Get customizations for a profession
   */
  getCustomizations(profession: string): Partial<ProfessionBranding> | undefined {
    return this.customBranding[profession];
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      // Mirror to server KV
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'branding_customizations', value: this.customBranding })
      }).catch(() => {});
      localStorage.setItem(this.storageKey, JSON.stringify(this.customBranding));
    } catch (error) {
      console.error('Failed to save branding to storage: ', error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    // Try server first
    fetch('/api/user/kv/branding_customizations', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data && typeof j.data === 'object') {
          this.customBranding = j.data;
          return;
        }
        // Fallback to local
        try {
          const saved = localStorage.getItem(this.storageKey);
          if (saved) {
            this.customBranding = JSON.parse(saved);
          }
        } catch (error) {
          console.error('Failed to load branding from storage:', error);
          this.customBranding = {};
        }
      })
      .catch(() => {
        try {
          const saved = localStorage.getItem(this.storageKey);
          if (saved) {
            this.customBranding = JSON.parse(saved);
          }
        } catch {
          this.customBranding = {};
        }
      });
  }

  /**
   * Export configuration as JSON string
   */
  exportConfig(): string {
    return JSON.stringify(this.customBranding, null, 2);
  }

  /**
   * Export configuration as downloadable file
   */
  downloadConfig(filename: string = 'creatorhub-branding.json'): void {
    const config = this.exportConfig();
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import configuration from JSON string
   */
  importConfig(config: string): boolean {
    try {
      const parsed = JSON.parse(config);
      
      // Validate structure
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid config structure');
      }

      // Apply configuration
      this.customBranding = parsed;
      this.saveToStorage();
      this.notifyListeners();
      this.broadcastChanges('all');
      
      console.log('✅ Branding configuration imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import branding configuration:', error);
      return false;
    }
  }

  /**
   * Import from uploaded file
   */
  async importFromFile(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      return this.importConfig(text);
    } catch (error) {
      console.error('Failed to read file:', error);
      return false;
    }
  }

  /**
   * Register a listener for branding updates
   */
  addUpdateListener(listener: () => void): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  /**
   * Notify all registered listeners
   */
  private notifyListeners(): void {
    this.updateListeners.forEach(listener => listener());
  }

  /**
   * Broadcast changes via custom event (for components not using the hook)
   */
  private broadcastChanges(profession: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('theming:update', {
        detail: { 
          profession, 
          branding: this.customBranding,
          timestamp: Date.now()
        }
      }));
    }
  }

  /**
   * Get statistics about customizations
   */
  getStats(): {
    totalProfessions: number;
    customizedProfessions: number;
    defaultProfessions: number;
    customizationRate: number;
  } {
    const totalProfessions = Object.keys(DEFAULT_BRANDING).length;
    const customizedProfessions = Object.keys(this.customBranding).length;
    const defaultProfessions = totalProfessions - customizedProfessions;
    const customizationRate = customizedProfessions / totalProfessions;

    return {
      totalProfessions,
      customizedProfessions,
      defaultProfessions,
      customizationRate
    };
  }
}

// Create singleton instance
export const themingAdminService = new ThemingAdminService();

// Make it globally accessible for debugging
if (typeof window !=='undefined') {
  (window as any).themingAdminService = themingAdminService;
}

export default themingAdminService;

