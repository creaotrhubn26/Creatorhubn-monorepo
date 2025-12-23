/**
 * Contract Archive Configuration Service
 * Manages retention policies and year/month-based folder organization for contracts
 *
 * @deprecated Use document-archive-config.ts instead for unified document management
 */

export interface RetentionPolicy {
  /**
   * Name of the retention policy
   */
  name: string;

  /**
   * Description of the retention policy
   */
  description: string;

  /**
   * Number of years to keep contracts in active folder before archiving
   * @default 1
   */
  activeYears: number;

  /**
   * Number of years to keep contracts in archive before marking for deletion
   * @default 7 (legal requirement for most business documents)
   */
  archiveYears: number;

  /**
   * Whether to automatically archive old contracts
   * @default true
   */
  autoArchive: boolean;

  /**
   * Whether to create year-based subfolders (e.g., 2024/, 2025/)
   * @default true
   */
  yearBasedFolders: boolean;

  /**
   * Archive folder structure type
   * - 'simple': Just year folders (e.g., Contracts & Documents/2024/)
   * - 'archive': Separate archive folder (e.g., Contracts & Documents/Archive/2024/)
   * - 'status': Organize by status (e.g., Contracts & Documents/Active/2024/, Contracts & Documents/Archived/2024/)
   * @default 'simple'
   */
  folderStructure: 'simple' | 'archive' | 'status';

  /**
   * Whether to copy or move contracts when archiving
   * - 'copy': Keep original and create archive copy
   * - 'move': Move to archive folder
   * @default 'move'
   */
  archiveAction: 'copy' | 'move';

  /**
   * Custom folder naming pattern (supports {YEAR}, {MONTH}, {STATUS})
   * @example "Contracts_{YEAR}" -> "Contracts_2024"
   */
  customFolderPattern?: string;
}

export interface ContractArchiveConfig {
  /**
   * Base folder name for contracts
   * @default "Contracts & Documents"
   */
  baseFolderName: string;

  /**
   * Current retention policy
   */
  retentionPolicy: RetentionPolicy;

  /**
   * Whether the archive system is enabled
   * @default true
   */
  enabled: boolean;

  /**
   * Frequency to check for contracts to archive (in days)
   * @default 30
   */
  archiveCheckFrequencyDays: number;

  /**
   * Last time archive check was performed
   */
  lastArchiveCheck?: Date;
}

// Predefined retention policies
export const RETENTION_POLICIES: Record<string, RetentionPolicy> = {
  default: {
    name: 'Standard (7 år)',
    description: 'Standard oppbevaringstid på 7 år i henhold til norsk lovgivning',
    activeYears: 1,
    archiveYears: 7,
    autoArchive: true,
    yearBasedFolders: true,
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
    folderStructure: 'simple',
    archiveAction: 'move',
  },

  permanent: {
    name: 'Permanent',
    description: 'Ingen automatisk arkivering - behold alle kontrakter permanent',
    activeYears: 100, // Effectively permanent
    archiveYears: 100,
    autoArchive: false,
    yearBasedFolders: true,
    folderStructure: 'status',
    archiveAction: 'copy',
  },

  statusBased: {
    name: 'Statusbasert',
    description: 'Organiser kontrakter basert på status (Aktiv/Arkivert)',
    activeYears: 1,
    archiveYears: 7,
    autoArchive: true,
    yearBasedFolders: true,
    folderStructure: 'status',
    archiveAction: 'move',
  },
};

class ContractArchiveConfigService {
  private config: ContractArchiveConfig;
  private listeners: Set<(config: ContractArchiveConfig) => void> = new Set();

  constructor() {
    // Load config from localStorage or use default
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): ContractArchiveConfig {
    // Server-first
    // Note: best-effort synchronous read not possible; try local first then attempt async hydrate
    const stored = localStorage.getItem('contractArchiveConfig');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.lastArchiveCheck) parsed.lastArchiveCheck = new Date(parsed.lastArchiveCheck);
        // Hydrate async
        fetch('/api/user/kv/contractArchiveConfig', { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
            if (v) {
              try {
                const p = typeof v === 'string' ? JSON.parse(v) : v;
                if (p.lastArchiveCheck) p.lastArchiveCheck = new Date(p.lastArchiveCheck);
                this.config = p;
                this.notifyListeners();
              } catch {}
            }
          })
          .catch(() => {});
        return parsed;
      } catch (error) {
        console.error('Failed to load contract archive config: ', error);
      }
    } else {
      fetch('/api/user/kv/contractArchiveConfig', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
          if (v) {
            try {
              const p = typeof v === 'string' ? JSON.parse(v) : v;
              if (p.lastArchiveCheck) p.lastArchiveCheck = new Date(p.lastArchiveCheck);
              this.config = p;
              this.notifyListeners();
            } catch {}
          }
        })
        .catch(() => {});
    }

    // Return default configuration
    return {
      baseFolderName: 'Contracts & Documents',
      retentionPolicy: RETENTION_POLICIES.default,
      enabled: true,
      archiveCheckFrequencyDays: 30,
    };
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig() {
    try {
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'contractArchiveConfig', value: this.config })
      }).catch(() => {});
      localStorage.setItem('contractArchiveConfig', JSON.stringify(this.config));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save contract archive config:', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ContractArchiveConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ContractArchiveConfig>) {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  /**
   * Set retention policy
   */
  setRetentionPolicy(policyKey: keyof typeof RETENTION_POLICIES) {
    this.config.retentionPolicy = RETENTION_POLICIES[policyKey];
    this.saveConfig();
  }

  /**
   * Set custom retention policy
   */
  setCustomRetentionPolicy(policy: RetentionPolicy) {
    this.config.retentionPolicy = policy;
    this.saveConfig();
  }

  /**
   * Get folder path for a contract based on configuration
   * @param contractDate The date of the contract
   * @param status Contract status (e.g. 'draft','signed','expired')
   * @returns Folder path string
   */
  getFolderPath(contractDate: Date, status?: string): string {
    const year = contractDate.getFullYear();
    const month = String(contractDate.getMonth() + 1).padStart(2, '0');
    const policy = this.config.retentionPolicy;
    const base = this.config.baseFolderName;

    // Use custom folder pattern if provided
    if (policy.customFolderPattern) {
      const path = policy.customFolderPattern
        .replace('{YEAR}', String(year))
        .replace('{MONTH}', month)
        .replace('{STATUS}', status || 'Unknown');
      return `${base}/${path}`;
    }

    // Determine if contract should be archived
    const now = new Date();
    const contractAge = (now.getTime() - contractDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const isArchived = contractAge > policy.activeYears;

    // Build path based on folder structure type
    switch (policy.folderStructure) {
      case 'simple':
        return policy.yearBasedFolders ? `${base}/${year}` : base;

      case 'archive':
        if (isArchived) {
          return policy.yearBasedFolders ? `${base}/Archive/${year}` : `${base}/Archive`;
        }
        return policy.yearBasedFolders ? `${base}/${year}` : base;

      case 'status':
        const statusFolder = isArchived ? 'Archived' : 'Active';
        return policy.yearBasedFolders
          ? `${base}/${statusFolder}/${year}`
          : `${base}/${statusFolder}`;

      default:
        return policy.yearBasedFolders ? `${base}/${year}` : base;
    }
  }

  /**
   * Check if a contract should be archived
   * @param contractDate The date of the contract
   * @returns True if contract should be archived
   */
  shouldArchive(contractDate: Date): boolean {
    if (!this.config.enabled || !this.config.retentionPolicy.autoArchive) {
      return false;
    }

    const now = new Date();
    const contractAge = (now.getTime() - contractDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return contractAge > this.config.retentionPolicy.activeYears;
  }

  /**
   * Check if a contract should be deleted (exceeded archive period)
   * @param contractDate The date of the contract
   * @returns True if contract exceeded retention period
   */
  shouldDelete(contractDate: Date): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const now = new Date();
    const contractAge = (now.getTime() - contractDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const totalRetention =
      this.config.retentionPolicy.activeYears + this.config.retentionPolicy.archiveYears;
    return contractAge > totalRetention;
  }

  /**
   * Check if archive check is due
   * @returns True if archive check should be performed
   */
  isArchiveCheckDue(): boolean {
    if (!this.config.lastArchiveCheck) {
      return true;
    }

    const daysSinceLastCheck =
      (Date.now() - this.config.lastArchiveCheck.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastCheck >= this.config.archiveCheckFrequencyDays;
  }

  /**
   * Mark archive check as performed
   */
  markArchiveCheckPerformed() {
    this.config.lastArchiveCheck = new Date();
    this.saveConfig();
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(listener: (config: ContractArchiveConfig) => void): () => void {
    this.listeners.add(listener);
    listener(this.getConfig()); // Send initial state

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners() {
    const config = this.getConfig();
    this.listeners.forEach((listener) => listener(config));
  }

  /**
   * Reset configuration to default
   */
  resetToDefault() {
    this.config = {
      baseFolderName:'Contracts & Documents',
      retentionPolicy: RETENTION_POLICIES.default,
      enabled: true,
      archiveCheckFrequencyDays: 30,
    };
    this.saveConfig();
  }
}

// Export singleton instance
export const contractArchiveConfig = new ContractArchiveConfigService();

// Note: For new implementations, use document-archive-config.ts which provides
// unified document management with month-based folder support
