/**
 * Document Archive Configuration Service
 * Generic archive system supporting contracts, quotes, and other document types
 */

export type DocumentType = 'contract' | 'quote' | 'invoice' | 'proposal' | 'other';

export interface RetentionPolicy {
  name: string;
  description: string;
  activeYears: number;
  archiveYears: number;
  autoArchive: boolean;
  yearBasedFolders: boolean;
  monthBasedFolders: boolean; // NEW: Add month subfolders within year folders
  folderStructure: 'simple' | 'archive' | 'status';
  archiveAction: 'copy' | 'move';
  customFolderPattern?: string;
}

export interface DocumentArchiveConfig {
  documentType: DocumentType;
  baseFolderName: string;
  retentionPolicy: RetentionPolicy;
  enabled: boolean;
  archiveCheckFrequencyDays: number;
  lastArchiveCheck?: Date;
}

// Norwegian month names
const MONTH_NAMES_NO = [
  'Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember',
];

// Predefined retention policies
export const RETENTION_POLICIES: Record<string, RetentionPolicy> = {
  default: {
    name: 'Standard (7 år)',
    description: 'Standard oppbevaringstid på 7 år i henhold til norsk lovgivning',
    activeYears: 1,
    archiveYears: 7,
    autoArchive: true,
    yearBasedFolders: true,
    monthBasedFolders: true,
    folderStructure: 'simple',
    archiveAction: 'move',
  },

  extended: {
    name: 'Utvidet (10 år)',
    description: 'Utvidet oppbevaringstid på 10 år for langsiktig lagring',
    activeYears: 2,
    archiveYears: 10,
    autoArchive: true,
    yearBasedFolders: true,
    monthBasedFolders: true,
    folderStructure: 'archive',
    archiveAction: 'move',
  },

  minimal: {
    name: 'Minimal (3 år)',
    description: 'Minimal oppbevaringstid på 3 år',
    activeYears: 1,
    archiveYears: 3,
    autoArchive: true,
    yearBasedFolders: true,
    monthBasedFolders: true,
    folderStructure: 'simple',
    archiveAction: 'move',
  },

  permanent: {
    name: 'Permanent',
    description: 'Ingen automatisk arkivering - behold alle dokumenter permanent',
    activeYears: 100,
    archiveYears: 100,
    autoArchive: false,
    yearBasedFolders: true,
    monthBasedFolders: false,
    folderStructure: 'status',
    archiveAction: 'copy',
  },

  statusBased: {
    name: 'Statusbasert',
    description: 'Organiser dokumenter basert på status (Aktiv/Arkivert)',
    activeYears: 1,
    archiveYears: 7,
    autoArchive: true,
    yearBasedFolders: true,
    monthBasedFolders: true,
    folderStructure: 'status',
    archiveAction: 'move',
  },
};

// Default folder names for different document types
const DEFAULT_FOLDER_NAMES: Record<DocumentType, string> = {
  contract: 'Contracts & Documents',
  quote: 'Quotes & Proposals',
  invoice: 'Invoices',
  proposal: 'Proposals',
  other: 'Documents',
};

class DocumentArchiveConfigService {
  private configs: Map<DocumentType, DocumentArchiveConfig> = new Map();
  private listeners: Map<DocumentType, Set<(config: DocumentArchiveConfig) => void>> = new Map();

  constructor() {
    // Load all configs on initialization
    this.loadAllConfigs();
  }

  /**
   * Load all document type configurations
   */
  private loadAllConfigs() {
    const types: DocumentType[] = ['contract','quote','invoice','proposal','other'];
    types.forEach((type) => {
      this.configs.set(type, this.loadConfig(type));
    });
  }

  /**
   * Load configuration for a specific document type
   */
  private loadConfig(documentType: DocumentType): DocumentArchiveConfig {
    const key = `documentArchiveConfig_${documentType}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.lastArchiveCheck) parsed.lastArchiveCheck = new Date(parsed.lastArchiveCheck);
        // Hydrate async from server
        fetch(`/api/user/kv/${encodeURIComponent(key)}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
            if (v) {
              try {
                const p = typeof v === 'string' ? JSON.parse(v) : v;
                if (p.lastArchiveCheck) p.lastArchiveCheck = new Date(p.lastArchiveCheck);
                this.configs.set(documentType, p);
                this.notifyListeners(documentType);
              } catch {}
            }
          })
          .catch(() => {});
        return parsed;
      } catch (error) {
        console.error(`Failed to load archive config for ${documentType}:`, error);
      }
    } else {
      fetch(`/api/user/kv/${encodeURIComponent(key)}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
          if (v) {
            try {
              const p = typeof v === 'string' ? JSON.parse(v) : v;
              if (p.lastArchiveCheck) p.lastArchiveCheck = new Date(p.lastArchiveCheck);
              this.configs.set(documentType, p);
              this.notifyListeners(documentType);
            } catch {}
          }
        })
        .catch(() => {});
    }

    // Return default configuration
    return {
      documentType,
      baseFolderName: DEFAULT_FOLDER_NAMES[documentType],
      retentionPolicy: RETENTION_POLICIES.default,
      enabled: true,
      archiveCheckFrequencyDays: 30,
    };
  }

  /**
   * Save configuration
   */
  private saveConfig(documentType: DocumentType) {
    const config = this.configs.get(documentType);
    if (!config) return;

    try {
      const key = `documentArchiveConfig_${documentType}`;
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key, value: config })
      }).catch(() => {});
      localStorage.setItem(key, JSON.stringify(config));
      this.notifyListeners(documentType);
    } catch (error) {
      console.error(`Failed to save archive config for ${documentType}:`, error);
    }
  }

  /**
   * Get configuration for a document type
   */
  getConfig(documentType: DocumentType): DocumentArchiveConfig {
    const config = this.configs.get(documentType);
    if (!config) {
      const newConfig = this.loadConfig(documentType);
      this.configs.set(documentType, newConfig);
      return newConfig;
    }
    return { ...config };
  }

  /**
   * Update configuration
   */
  updateConfig(documentType: DocumentType, updates: Partial<DocumentArchiveConfig>) {
    const current = this.getConfig(documentType);
    const updated = { ...current, ...updates };
    this.configs.set(documentType, updated);
    this.saveConfig(documentType);
  }

  /**
   * Set retention policy
   */
  setRetentionPolicy(documentType: DocumentType, policyKey: keyof typeof RETENTION_POLICIES) {
    const config = this.getConfig(documentType);
    config.retentionPolicy = RETENTION_POLICIES[policyKey];
    this.configs.set(documentType, config);
    this.saveConfig(documentType);
  }

  /**
   * Set custom retention policy
   */
  setCustomRetentionPolicy(documentType: DocumentType, policy: RetentionPolicy) {
    const config = this.getConfig(documentType);
    config.retentionPolicy = policy;
    this.configs.set(documentType, config);
    this.saveConfig(documentType);
  }

  /**
   * Get folder path for a document based on configuration
   */
  getFolderPath(documentType: DocumentType, documentDate: Date, status?: string): string {
    const config = this.getConfig(documentType);
    const year = documentDate.getFullYear();
    const monthIndex = documentDate.getMonth();
    const monthNumber = String(monthIndex + 1).padStart(2, '0');
    const monthName = MONTH_NAMES_NO[monthIndex];
    const policy = config.retentionPolicy;
    const base = config.baseFolderName;

    // Use custom folder pattern if provided
    if (policy.customFolderPattern) {
      const path = policy.customFolderPattern
        .replace('{YEAR}', String(year))
        .replace('{MONTH}', monthNumber)
        .replace('{MONTH_NAME}', monthName)
        .replace('{STATUS}', status || 'Unknown');
      return `${base}/${path}`;
    }

    // Determine if document should be archived
    const now = new Date();
    const documentAge = (now.getTime() - documentDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const isArchived = documentAge > policy.activeYears;

    // Helper to build path with optional month subfolder
    const buildPath = (basePath: string): string => {
      if (!policy.yearBasedFolders) return basePath;
      if (policy.monthBasedFolders) {
        return `${basePath}/${year}/${monthName}`;
      }
      return `${basePath}/${year}`;
    };

    // Build path based on folder structure type
    switch (policy.folderStructure) {
      case 'simple':
        return buildPath(base);

      case 'archive':
        if (isArchived) {
          return buildPath(`${base}/Archive`);
        }
        return buildPath(base);

      case 'status':
        const statusFolder = isArchived ? 'Archived' : 'Active';
        return buildPath(`${base}/${statusFolder}`);

      default:
        return buildPath(base);
    }
  }

  /**
   * Check if a document should be archived
   */
  shouldArchive(documentType: DocumentType, documentDate: Date): boolean {
    const config = this.getConfig(documentType);

    if (!config.enabled || !config.retentionPolicy.autoArchive) {
      return false;
    }

    const now = new Date();
    const documentAge = (now.getTime() - documentDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return documentAge > config.retentionPolicy.activeYears;
  }

  /**
   * Check if a document should be deleted
   */
  shouldDelete(documentType: DocumentType, documentDate: Date): boolean {
    const config = this.getConfig(documentType);

    if (!config.enabled) {
      return false;
    }

    const now = new Date();
    const documentAge = (now.getTime() - documentDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const totalRetention = config.retentionPolicy.activeYears + config.retentionPolicy.archiveYears;
    return documentAge > totalRetention;
  }

  /**
   * Check if archive check is due
   */
  isArchiveCheckDue(documentType: DocumentType): boolean {
    const config = this.getConfig(documentType);

    if (!config.lastArchiveCheck) {
      return true;
    }

    const daysSinceLastCheck =
      (Date.now() - config.lastArchiveCheck.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastCheck >= config.archiveCheckFrequencyDays;
  }

  /**
   * Mark archive check as performed
   */
  markArchiveCheckPerformed(documentType: DocumentType) {
    const config = this.getConfig(documentType);
    config.lastArchiveCheck = new Date();
    this.configs.set(documentType, config);
    this.saveConfig(documentType);
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(
    documentType: DocumentType,
    listener: (config: DocumentArchiveConfig) => void,
  ): () => void {
    if (!this.listeners.has(documentType)) {
      this.listeners.set(documentType, new Set());
    }

    const typeListeners = this.listeners.get(documentType)!;
    typeListeners.add(listener);
    listener(this.getConfig(documentType)); // Send initial state

    return () => {
      typeListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(documentType: DocumentType) {
    const config = this.getConfig(documentType);
    const typeListeners = this.listeners.get(documentType);

    if (typeListeners) {
      typeListeners.forEach((listener) => listener(config));
    }
  }

  /**
   * Reset configuration to default
   */
  resetToDefault(documentType: DocumentType) {
    const config: DocumentArchiveConfig = {
      documentType,
      baseFolderName: DEFAULT_FOLDER_NAMES[documentType],
      retentionPolicy: RETENTION_POLICIES.default,
      enabled: true,
      archiveCheckFrequencyDays: 30,
    };
    this.configs.set(documentType, config);
    this.saveConfig(documentType);
  }

  /**
   * Get all configurations
   */
  getAllConfigs(): Map<DocumentType, DocumentArchiveConfig> {
    return new Map(this.configs);
  }
}

// Export singleton instance
export const documentArchiveConfig = new DocumentArchiveConfigService();

// Convenience exports for specific document types
export const contractArchiveConfig = {
  getConfig: () => documentArchiveConfig.getConfig('contract'),
  updateConfig: (updates: Partial<DocumentArchiveConfig>) =>
    documentArchiveConfig.updateConfig('contract', updates),
  setRetentionPolicy: (policyKey: keyof typeof RETENTION_POLICIES) =>
    documentArchiveConfig.setRetentionPolicy('contract', policyKey),
  getFolderPath: (documentDate: Date, status?: string) =>
    documentArchiveConfig.getFolderPath('contract', documentDate, status),
  shouldArchive: (documentDate: Date) =>
    documentArchiveConfig.shouldArchive('contract', documentDate),
  shouldDelete: (documentDate: Date) =>
    documentArchiveConfig.shouldDelete('contract', documentDate),
  isArchiveCheckDue: () => documentArchiveConfig.isArchiveCheckDue('contract'),
  markArchiveCheckPerformed: () => documentArchiveConfig.markArchiveCheckPerformed('contract'),
};

export const quoteArchiveConfig = {
  getConfig: () => documentArchiveConfig.getConfig('quote'),
  updateConfig: (updates: Partial<DocumentArchiveConfig>) =>
    documentArchiveConfig.updateConfig('quote', updates),
  setRetentionPolicy: (policyKey: keyof typeof RETENTION_POLICIES) =>
    documentArchiveConfig.setRetentionPolicy('quote', policyKey),
  getFolderPath: (documentDate: Date, status?: string) =>
    documentArchiveConfig.getFolderPath('quote', documentDate, status),
  shouldArchive: (documentDate: Date) => documentArchiveConfig.shouldArchive('quote', documentDate),
  shouldDelete: (documentDate: Date) => documentArchiveConfig.shouldDelete('quote', documentDate),
  isArchiveCheckDue: () => documentArchiveConfig.isArchiveCheckDue('quote'),
  markArchiveCheckPerformed: () => documentArchiveConfig.markArchiveCheckPerformed('quote'),
};
