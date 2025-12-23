/**
 * Contract Archive Manager Service
 * Handles automatic archiving, moving, and cleanup of old contracts based on retention policies
 */

import { contractArchiveConfig } from './contract-archive-config';

export interface ContractDocument {
  id: string;
  fileName: string;
  driveFileId?: string;
  createdAt: Date;
  updatedAt?: Date;
  status: 'draft' | 'pending' | 'signed' | 'rejected' | 'expired';
  projectId?: string;
  currentFolder: string;
}

export interface ArchiveOperation {
  id: string;
  contractId: string;
  operation: 'move' | 'copy' | 'delete';
  fromFolder: string;
  toFolder: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ArchiveReport {
  totalContracts: number;
  contractsToArchive: number;
  contractsToDelete: number;
  archivedContracts: number;
  deletedContracts: number;
  failedOperations: number;
  operations: ArchiveOperation[];
  completedAt?: Date;
}

class ContractArchiveManagerService {
  private operations: Map<string, ArchiveOperation> = new Map();
  private listeners: Set<(operations: ArchiveOperation[]) => void> = new Set();
  private isRunning = false;

  /**
   * Scan contracts and determine which need archiving
   * @param contracts List of contracts to scan
   * @returns List of contracts that need archiving
   */
  async scanContracts(contracts: ContractDocument[]): Promise<{
    toArchive: ContractDocument[];
    toDelete: ContractDocument[];
  }> {
    const config = contractArchiveConfig.getConfig();

    if (!config.enabled) {
      return { toArchive: [], toDelete: [] };
    }

    const toArchive: ContractDocument[] = [];
    const toDelete: ContractDocument[] = [];

    for (const contract of contracts) {
      const contractDate = new Date(contract.createdAt);

      // Check if should be deleted
      if (contractArchiveConfig.shouldDelete(contractDate)) {
        toDelete.push(contract);
        continue;
      }

      // Check if should be archived
      if (contractArchiveConfig.shouldArchive(contractDate)) {
        const targetFolder = contractArchiveConfig.getFolderPath(contractDate, contract.status);

        // Only add to archive list if not already in target folder
        if (contract.currentFolder !== targetFolder) {
          toArchive.push(contract);
        }
      }
    }

    return { toArchive, toDelete };
  }

  /**
   * Execute archive operation for a single contract
   * @param contract Contract to archive
   * @returns Archive operation result
   */
  async archiveContract(contract: ContractDocument): Promise<ArchiveOperation> {
    const config = contractArchiveConfig.getConfig();
    const contractDate = new Date(contract.createdAt);
    const targetFolder = contractArchiveConfig.getFolderPath(contractDate, contract.status);

    const operationId = `arch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const operation: ArchiveOperation = {
      id: operationId,
      contractId: contract.id,
      operation: config.retentionPolicy.archiveAction,
      fromFolder: contract.currentFolder,
      toFolder: targetFolder,
      status: 'pending',
      createdAt: new Date(),
    };

    this.operations.set(operationId, operation);
    this.notifyListeners();

    try {
      operation.status = 'processing';
      this.notifyListeners();

      // Call API to move/copy file in Google Drive
      const response = await fetch('/api/google-drive/archive-contract', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
        },
        body: JSON.stringify({
          contractId: contract.id,
          driveFileId: contract.driveFileId,
          fromFolder: contract.currentFolder,
          toFolder: targetFolder,
          operation: operation.operation,
        }),
      });

      if (!response.ok) {
        throw new Error(`Archive operation failed with status ${response.status}`);
      }

      const result = await response.json();

      operation.status = 'completed';
      operation.completedAt = new Date();
      this.notifyListeners();

      return operation;
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Archive operation failed';
      operation.completedAt = new Date();
      this.notifyListeners();

      throw error;
    }
  }

  /**
   * Execute delete operation for a single contract
   * @param contract Contract to delete
   * @returns Archive operation result
   */
  async deleteContract(contract: ContractDocument): Promise<ArchiveOperation> {
    const operationId = `del-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const operation: ArchiveOperation = {
      id: operationId,
      contractId: contract.id,
      operation: 'delete',
      fromFolder: contract.currentFolder,
      toFolder: 'DELETED',
      status: 'pending',
      createdAt: new Date(),
    };

    this.operations.set(operationId, operation);
    this.notifyListeners();

    try {
      operation.status = 'processing';
      this.notifyListeners();

      // Call API to delete file from Google Drive
      const response = await fetch('/api/google-drive/delete-contract', {
        method: 'DELETE',
        headers: {
          'Content-Type' : 'application/json',
        },
        body: JSON.stringify({
          contractId: contract.id,
          driveFileId: contract.driveFileId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Delete operation failed with status ${response.status}`);
      }

      operation.status = 'completed';
      operation.completedAt = new Date();
      this.notifyListeners();

      return operation;
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Delete operation failed';
      operation.completedAt = new Date();
      this.notifyListeners();

      throw error;
    }
  }

  /**
   * Run automatic archive process for all contracts
   * @param contracts List of all contracts
   * @param options Archive options
   * @returns Archive report
   */
  async runArchiveProcess(
    contracts: ContractDocument[],
    options: {
      dryRun?: boolean;
      archiveOnly?: boolean;
      deleteOnly?: boolean;
    } = {},
  ): Promise<ArchiveReport> {
    if (this.isRunning) {
      throw new Error('Archive process is already running');
    }

    this.isRunning = true;

    const report: ArchiveReport = {
      totalContracts: contracts.length,
      contractsToArchive: 0,
      contractsToDelete: 0,
      archivedContracts: 0,
      deletedContracts: 0,
      failedOperations: 0,
      operations: [],
    };

    try {
      // Scan contracts
      const { toArchive, toDelete } = await this.scanContracts(contracts);

      report.contractsToArchive = toArchive.length;
      report.contractsToDelete = toDelete.length;

      if (options.dryRun) {
        console.log('🔍 Dry run - no changes will be made');
        console.log(`📦 Contracts to archive: ${toArchive.length}`);
        console.log(`🗑️ Contracts to delete: ${toDelete.length}`);
        return report;
      }

      // Archive contracts
      if (!options.deleteOnly) {
        for (const contract of toArchive) {
          try {
            const operation = await this.archiveContract(contract);
            report.operations.push(operation);

            if (operation.status === 'completed') {
              report.archivedContracts++;
            } else {
              report.failedOperations++;
            }
          } catch (error) {
            console.error(`Failed to archive contract ${contract.id}:`, error);
            report.failedOperations++;
          }
        }
      }

      // Delete expired contracts
      if (!options.archiveOnly) {
        for (const contract of toDelete) {
          try {
            const operation = await this.deleteContract(contract);
            report.operations.push(operation);

            if (operation.status === 'completed') {
              report.deletedContracts++;
            } else {
              report.failedOperations++;
            }
          } catch (error) {
            console.error(`Failed to delete contract ${contract.id}:`, error);
            report.failedOperations++;
          }
        }
      }

      // Mark archive check as performed
      contractArchiveConfig.markArchiveCheckPerformed();

      report.completedAt = new Date();
      return report;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if automatic archive is needed and run if due
   * @param contracts List of all contracts
   * @returns Archive report if run, null if not needed
   */
  async checkAndRunArchive(contracts: ContractDocument[]): Promise<ArchiveReport | null> {
    const config = contractArchiveConfig.getConfig();

    if (!config.enabled || !config.retentionPolicy.autoArchive) {
      return null;
    }

    if (!contractArchiveConfig.isArchiveCheckDue()) {
      console.log('⏭️ Archive check not due yet');
      return null;
    }

    console.log('🔄 Running automatic archive check...');
    return this.runArchiveProcess(contracts);
  }

  /**
   * Get preview of what would be archived/deleted without executing
   * @param contracts List of contracts
   * @returns Preview information
   */
  async getArchivePreview(contracts: ContractDocument[]): Promise<{
    toArchive: ContractDocument[];
    toDelete: ContractDocument[];
    affectedFolders: Set<string>;
  }> {
    const { toArchive, toDelete } = await this.scanContracts(contracts);
    const affectedFolders = new Set<string>();

    toArchive.forEach((contract) => {
      affectedFolders.add(contract.currentFolder);
      const contractDate = new Date(contract.createdAt);
      const targetFolder = contractArchiveConfig.getFolderPath(contractDate, contract.status);
      affectedFolders.add(targetFolder);
    });

    toDelete.forEach((contract) => {
      affectedFolders.add(contract.currentFolder);
    });

    return {
      toArchive,
      toDelete,
      affectedFolders,
    };
  }

  /**
   * Get all operations
   */
  getOperations(): ArchiveOperation[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get operation by ID
   */
  getOperation(operationId: string): ArchiveOperation | undefined {
    return this.operations.get(operationId);
  }

  /**
   * Clear completed operations
   */
  clearCompletedOperations() {
    const toRemove: string[] = [];
    this.operations.forEach((operation, id) => {
      if (operation.status ==='completed') {
        toRemove.push(id);
      }
    });
    toRemove.forEach((id) => this.operations.delete(id));
    this.notifyListeners();
  }

  /**
   * Subscribe to operation updates
   */
  subscribe(listener: (operations: ArchiveOperation[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getOperations()); // Send initial state

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners() {
    const operations = this.getOperations();
    this.listeners.forEach((listener) => listener(operations));
  }

  /**
   * Check if archive process is running
   */
  isArchiveRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const contractArchiveManager = new ContractArchiveManagerService();
