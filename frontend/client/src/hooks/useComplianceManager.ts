/**
 * useComplianceManager Hook
 * React hook for compliance management functionality
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { 
  complianceManager, 
  ComplianceViolation, 
  ComplianceCheck, 
  ConsentRecord, 
  DataSubjectRequest, 
  ComplianceReport,
  ComplianceConfig 
} from '@/utils/complianceManager';

export interface UseComplianceManagerOptions {
  enableGDPR?: boolean;
  enableAccessibility?: boolean;
  enableSecurity?: boolean;
  enableDataProtection?: boolean;
  enablePrivacyControls?: boolean;
  enableConsentManagement?: boolean;
  enableDataRetention?: boolean;
  enableDataPortability?: boolean;
  enableRightToBeForgotten?: boolean;
  enableAuditLogging?: boolean;
  enableComplianceReporting?: boolean;
  enableAutomatedChecks?: boolean;
  enableRemediation?: boolean;
  onViolationDetected?: (violation: ComplianceViolation) => void;
  onCheckCompleted?: (check: ComplianceCheck) => void;
  onConsentUpdated?: (record: ConsentRecord) => void;
  onRequestSubmitted?: (request: DataSubjectRequest) => void;
  onReportGenerated?: (report: ComplianceReport) => void;
}

export interface UseComplianceManagerReturn {
  // Core functionality
  addConsentRecord: (record: Omit<ConsentRecord , 'id, '>) => void;
  addDataSubjectRequest: (request: Omit<DataSubjectRequest, 'id'>) => void;
  generateComplianceReport: (type: 'gdpr' | 'accessibility' | 'security' | 'comprehensive') => ComplianceReport;
  
  // Data access
  getViolations: () => ComplianceViolation[];
  getChecks: () => ComplianceCheck[];
  getConsentRecords: () => ConsentRecord[];
  getDataSubjectRequests: () => DataSubjectRequest[];
  getComplianceScore: () => number;
  
  // Configuration
  updateConfig: (config: Partial<ComplianceConfig>) => void;
  
  // State
  violations: ComplianceViolation[];
  checks: ComplianceCheck[];
  consentRecords: ConsentRecord[];
  dataSubjectRequests: DataSubjectRequest[];
  complianceScore: number;
  
  // Status indicators
  totalViolations: number;
  openViolations: number;
  resolvedViolations: number;
  criticalViolations: number;
  highViolations: number;
  mediumViolations: number;
  lowViolations: number;
  
  // Compliance metrics
  gdprViolations: number;
  accessibilityViolations: number;
  securityViolations: number;
  privacyViolations: number;
  dataProtectionViolations: number;
  
  // Check status
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  checkSuccessRate: number;
  
  // Consent management
  totalConsentRecords: number;
  activeConsentRecords: number;
  expiredConsentRecords: number;
  revokedConsentRecords: number;
  
  // Data subject requests
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  rejectedRequests: number;
  overdueRequests: number;
  
  // Utility functions
  resolveViolation: (violationId: string) => void;
  acknowledgeViolation: (violationId: string) => void;
  updateViolationStatus: (violationId: string, status: ComplianceViolation['status']) => void;
  getViolationsByType: (type: ComplianceViolation['type']) => ComplianceViolation[];
  getViolationsBySeverity: (severity: ComplianceViolation['severity']) => ComplianceViolation[];
  getViolationsByStatus: (status: ComplianceViolation['status']) => ComplianceViolation[];
  getChecksByCategory: (category: ComplianceCheck['category']) => ComplianceCheck[];
  getChecksByStatus: (status: ComplianceCheck['status']) => ComplianceCheck[];
  getConsentRecordsByType: (type: ConsentRecord['consentType']) => ConsentRecord[];
  getDataSubjectRequestsByType: (type: DataSubjectRequest['requestType']) => DataSubjectRequest[];
  getDataSubjectRequestsByStatus: (status: DataSubjectRequest['status']) => DataSubjectRequest[];
  exportComplianceData: (format?: 'json' | 'csv') => string;
  importComplianceData: (data: string) => void;
}

export const useComplianceManager = (options: UseComplianceManagerOptions = {}): UseComplianceManagerReturn => {
  const {
    enableGDPR = true,
    enableAccessibility = true,
    enableSecurity = true,
    enableDataProtection = true,
    enablePrivacyControls = true,
    enableConsentManagement = true,
    enableDataRetention = true,
    enableDataPortability = true,
    enableRightToBeForgotten = true,
    enableAuditLogging = true,
    enableComplianceReporting = true,
    enableAutomatedChecks = true,
    enableRemediation = true,
    onViolationDetected,
    onCheckCompleted,
    onConsentUpdated,
    onRequestSubmitted,
    onReportGenerated
} = options;

  const [violations, setViolations] = useState<ComplianceViolation[]>([]);
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);
  const [dataSubjectRequests, setDataSubjectRequests] = useState<DataSubjectRequest[]>([]);
  const [complianceScore, setComplianceScore] = useState(100);

  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update compliance config
  useEffect(() => {
    (complianceManager as any).updateConfig({
      enableGDPR,
      enableAccessibility,
      enableSecurity,
      enableDataProtection,
      enablePrivacyControls,
      enableConsentManagement,
      enableDataRetention,
      enableDataPortability,
      enableRightToBeForgotten,
      enableAuditLogging,
      enableComplianceReporting,
      enableAutomatedChecks,
      enableRemediation
  });
}, [
    enableGDPR,
    enableAccessibility,
    enableSecurity,
    enableDataProtection,
    enablePrivacyControls,
    enableConsentManagement,
    enableDataRetention,
    enableDataPortability,
    enableRightToBeForgotten,
    enableAuditLogging,
    enableComplianceReporting,
    enableAutomatedChecks,
    enableRemediation
  ]);

  // Update data periodically
  useEffect(() => {
    const updateData = () => {
      try {
        const currentViolations = (complianceManager as any).getViolations();
        const currentChecks = (complianceManager as any).getChecks();
        const currentConsentRecords = (complianceManager as any).getConsentRecords();
        const currentDataSubjectRequests = (complianceManager as any).getDataSubjectRequests();
        const currentComplianceScore = (complianceManager as any).getComplianceScore();

        setViolations(currentViolations);
        setChecks(currentChecks);
        setConsentRecords(currentConsentRecords);
        setDataSubjectRequests(currentDataSubjectRequests);
        setComplianceScore(currentComplianceScore);

        // Check for new violations
        if (currentViolations.length > violations.length) {
          const newViolations = currentViolations.slice(violations.length);
          newViolations.forEach((violation: ComplianceViolation) => {
            onViolationDetected?.(violation);
        });
      }

        // Check for updated checks
        currentChecks.forEach((check: ComplianceCheck) => {
          const existingCheck = checks.find(c => c.id === check.id);
          if (existingCheck && existingCheck.status !== check.status) {
            onCheckCompleted?.(check);
        }
      });

        // Check for new consent records
        if (currentConsentRecords.length > consentRecords.length) {
          const newConsentRecords = currentConsentRecords.slice(consentRecords.length);
          newConsentRecords.forEach((record: ConsentRecord) => {
            onConsentUpdated?.(record);
        });
      }

        // Check for new data subject requests
        if (currentDataSubjectRequests.length > dataSubjectRequests.length) {
          const newRequests = currentDataSubjectRequests.slice(dataSubjectRequests.length);
          newRequests.forEach((request: DataSubjectRequest) => {
            onRequestSubmitted?.(request);
        });
      }

    } catch (error) {
        console.error('Failed to update compliance data: ', error);
    }
  };

    updateData();
    updateIntervalRef.current = setInterval(updateData, 5000); // Update every 5 seconds

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
    }
  };
}, [violations.length, checks, consentRecords.length, dataSubjectRequests.length, onViolationDetected, onCheckCompleted, onConsentUpdated, onRequestSubmitted]);

  // Add consent record
  const addConsentRecord = useCallback((record: Omit<ConsentRecord, 'id'>) => {
    (complianceManager as any).addConsentRecord(record);
}, []);

  // Add data subject request
  const addDataSubjectRequest = useCallback((request: Omit<DataSubjectRequest, 'id'>) => {
    (complianceManager as any).addDataSubjectRequest(request);
}, []);

  // Generate compliance report
  const generateComplianceReport = useCallback((type: 'gdpr' | 'accessibility' | 'security' | 'comprehensive'): ComplianceReport => {
    const report = (complianceManager as any).generateComplianceReport(type);
    onReportGenerated?.(report);
    return report;
}, [onReportGenerated]);

  // Get violations
  const getViolations = useCallback((): ComplianceViolation[] => {
    return (complianceManager as any).getViolations();
}, []);

  // Get checks
  const getChecks = useCallback((): ComplianceCheck[] => {
    return (complianceManager as any).getChecks();
}, []);

  // Get consent records
  const getConsentRecords = useCallback((): ConsentRecord[] => {
    return (complianceManager as any).getConsentRecords();
}, []);

  // Get data subject requests
  const getDataSubjectRequests = useCallback((): DataSubjectRequest[] => {
    return (complianceManager as any).getDataSubjectRequests();
}, []);

  // Get compliance score
  const getComplianceScore = useCallback((): number => {
    return (complianceManager as any).getComplianceScore();
}, []);

  // Update configuration
  const updateConfig = useCallback((config: Partial<ComplianceConfig>) => {
    (complianceManager as any).updateConfig(config);
}, []);

  // Resolve violation
  const resolveViolation = useCallback((violationId: string) => {
    const violation = violations.find(v => v.id === violationId);
    if (violation) {
      violation.status = 'resolved';
      violation.resolvedAt = Date.now();
      setViolations([...violations]);
  }
}, [violations]);

  // Acknowledge violation
  const acknowledgeViolation = useCallback((violationId: string) => {
    const violation = violations.find(v => v.id === violationId);
    if (violation) {
      violation.status = 'in_progress';
      setViolations([...violations]);
  }
}, [violations]);

  // Update violation status
  const updateViolationStatus = useCallback((violationId: string, status: ComplianceViolation['status']) => {
    const violation = violations.find(v => v.id === violationId);
    if (violation) {
      violation.status = status;
      if (status === 'resolved') {
        violation.resolvedAt = Date.now();
    }
      setViolations([...violations]);
  }
}, [violations]);

  // Get violations by type
  const getViolationsByType = useCallback((type: ComplianceViolation['type']): ComplianceViolation[] => {
    return violations.filter(v => v.type === type);
}, [violations]);

  // Get violations by severity
  const getViolationsBySeverity = useCallback((severity: ComplianceViolation['severity']): ComplianceViolation[] => {
    return violations.filter(v => v.severity === severity);
}, [violations]);

  // Get violations by status
  const getViolationsByStatus = useCallback((status: ComplianceViolation['status']): ComplianceViolation[] => {
    return violations.filter(v => v.status === status);
}, [violations]);

  // Get checks by category
  const getChecksByCategory = useCallback((category: ComplianceCheck['category']): ComplianceCheck[] => {
    return checks.filter(c => c.category === category);
}, [checks]);

  // Get checks by status
  const getChecksByStatus = useCallback((status: ComplianceCheck['status']): ComplianceCheck[] => {
    return checks.filter(c => c.status === status);
}, [checks]);

  // Get consent records by type
  const getConsentRecordsByType = useCallback((type: ConsentRecord['consentType']): ConsentRecord[] => {
    return consentRecords.filter(c => c.consentType === type);
}, [consentRecords]);

  // Get data subject requests by type
  const getDataSubjectRequestsByType = useCallback((type: DataSubjectRequest['requestType']): DataSubjectRequest[] => {
    return dataSubjectRequests.filter(r => r.requestType === type);
}, [dataSubjectRequests]);

  // Get data subject requests by status
  const getDataSubjectRequestsByStatus = useCallback((status: DataSubjectRequest['status']): DataSubjectRequest[] => {
    return dataSubjectRequests.filter(r => r.status === status);
}, [dataSubjectRequests]);

  // Export to CSV helper
  const exportToCSV = (data: any): string => {
    const headers = ['id','type','severity','description','status', 'detectedAt'];
    const rows = data.violations.map((v: ComplianceViolation) => [
      v.id, v.type, v.severity, v.description, v.status, v.detectedAt
    ]);
    
    return [headers, ...rows].map(row => row.join(', ')).join('\n');
};

  // Export compliance data
  const exportComplianceData = useCallback((format: 'json' | 'csv' = 'json'): string => {
    const data = {
      violations,
      checks,
      consentRecords,
      dataSubjectRequests,
      complianceScore,
      timestamp: Date.now()
  };

    if (format === 'csv') {
      return exportToCSV(data);
  }

    return JSON.stringify(data, null, 2);
}, [violations, checks, consentRecords, dataSubjectRequests, complianceScore]);

  // Import compliance data
  const importComplianceData = useCallback((data: string) => {
    try {
      const importedData = JSON.parse(data);
      // Implementation would go here
      console.log('Compliance data imported:', importedData);
  } catch (error) {
      console.error('Failed to import compliance data:', error);
  }
}, []);

  // Computed values
  const totalViolations = violations.length;
  const openViolations = violations.filter(v => v.status === 'open').length;
  const resolvedViolations = violations.filter(v => v.status === 'resolved').length;
  const criticalViolations = violations.filter(v => v.severity === 'critical').length;
  const highViolations = violations.filter(v => v.severity === 'high').length;
  const mediumViolations = violations.filter(v => v.severity === 'medium').length;
  const lowViolations = violations.filter(v => v.severity === 'low').length;

  const gdprViolations = violations.filter(v => v.type === 'gdpr').length;
  const accessibilityViolations = violations.filter(v => v.type === 'accessibility').length;
  const securityViolations = violations.filter(v => v.type === 'security').length;
  const privacyViolations = violations.filter(v => v.type === 'privacy').length;
  const dataProtectionViolations = violations.filter(v => v.type === 'data_protection').length;

  const totalChecks = checks.length;
  const passedChecks = checks.filter(c => c.status === 'pass').length;
  const failedChecks = checks.filter(c => c.status === 'fail').length;
  const warningChecks = checks.filter(c => c.status === 'warning').length;
  const checkSuccessRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

  const totalConsentRecords = consentRecords.length;
  const activeConsentRecords = consentRecords.filter(c => c.granted && (!c.expiresAt || c.expiresAt > Date.now())).length;
  const expiredConsentRecords = consentRecords.filter(c => c.expiresAt && c.expiresAt <= Date.now()).length;
  const revokedConsentRecords = consentRecords.filter(c => c.revokedAt).length;

  const totalRequests = dataSubjectRequests.length;
  const pendingRequests = dataSubjectRequests.filter(r => r.status === 'pending').length;
  const completedRequests = dataSubjectRequests.filter(r => r.status === 'completed').length;
  const rejectedRequests = dataSubjectRequests.filter(r => r.status === 'rejected').length;
  const overdueRequests = dataSubjectRequests.filter(r => r.status !=='completed' && r.deadlineAt < Date.now()).length;

  return {
    // Core functionality
    addConsentRecord,
    addDataSubjectRequest,
    generateComplianceReport,
    
    // Data access
    getViolations,
    getChecks,
    getConsentRecords,
    getDataSubjectRequests,
    getComplianceScore,
    
    // Configuration
    updateConfig,
    
    // State
    violations,
    checks,
    consentRecords,
    dataSubjectRequests,
    complianceScore,
    
    // Status indicators
    totalViolations,
    openViolations,
    resolvedViolations,
    criticalViolations,
    highViolations,
    mediumViolations,
    lowViolations,
    
    // Compliance metrics
    gdprViolations,
    accessibilityViolations,
    securityViolations,
    privacyViolations,
    dataProtectionViolations,
    
    // Check status
    totalChecks,
    passedChecks,
    failedChecks,
    warningChecks,
    checkSuccessRate,
    
    // Consent management
    totalConsentRecords,
    activeConsentRecords,
    expiredConsentRecords,
    revokedConsentRecords,
    
    // Data subject requests
    totalRequests,
    pendingRequests,
    completedRequests,
    rejectedRequests,
    overdueRequests,
    
    // Utility functions
    resolveViolation,
    acknowledgeViolation,
    updateViolationStatus,
    getViolationsByType,
    getViolationsBySeverity,
    getViolationsByStatus,
    getChecksByCategory,
    getChecksByStatus,
    getConsentRecordsByType,
    getDataSubjectRequestsByType,
    getDataSubjectRequestsByStatus,
    exportComplianceData,
    importComplianceData
};
};

export default useComplianceManager;





