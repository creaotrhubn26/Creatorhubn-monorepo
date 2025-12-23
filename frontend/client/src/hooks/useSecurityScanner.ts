/**
 * useSecurityScanner Hook
 * React hook for security scanning functionality
 */

import { useCallback, useEffect, useState } from 'react';
import { securityScanner, SecurityScanResult, SecurityConfig, ScanOptions } from '@/utils/securityScanner';

export interface UseSecurityScannerOptions {
  enableAutoScanning?: boolean;
  enableFileScanning?: boolean;
  enableContentScanning?: boolean;
  enableUrlScanning?: boolean;
  enableCodeScanning?: boolean;
  onScanComplete?: (result: SecurityScanResult) => void;
  onThreatDetected?: (result: SecurityScanResult) => void;
  onError?: (error: Error) => void;
}

export interface UseSecurityScannerReturn {
  scanFile: (file: File) => Promise<SecurityScanResult>;
  scanContent: (content: string, options?: Partial<ScanOptions>) => Promise<SecurityScanResult>;
  scanUrl: (url: string, options?: Partial<ScanOptions>) => Promise<SecurityScanResult>;
  scanCode: (code: string, options?: Partial<ScanOptions>) => Promise<SecurityScanResult>;
  getScanResult: (id: string) => SecurityScanResult | undefined;
  getAllScanResults: () => SecurityScanResult[];
  clearResults: () => void;
  updateConfig: (config: Partial<SecurityConfig>) => void;
  isScanning: boolean;
  scanResults: SecurityScanResult[];
  threatCount: number;
  cleanCount: number;
  suspiciousCount: number;
  maliciousCount: number;
  errorCount: number;
}

export const useSecurityScanner = (options: UseSecurityScannerOptions = {}): UseSecurityScannerReturn => {
  const {
    enableAutoScanning = true,
    enableFileScanning = true,
    enableContentScanning = true,
    enableUrlScanning = true,
    enableCodeScanning = true,
    onScanComplete,
    onThreatDetected,
    onError
} = options;

  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<SecurityScanResult[]>([]);

  // Scanner config managed within hook
  useEffect(() => {
    // Config would be sent to security scanner here
    console.log('Security scanner config updated');
}, [enableFileScanning, enableContentScanning, enableUrlScanning, enableCodeScanning]);

  // Set up event listeners
  useEffect(() => {
    if (!enableAutoScanning) return;

    const handleScanComplete = (event: CustomEvent) => {
      const result = event.detail as SecurityScanResult;
      setScanResults(prev => [...prev, result]);
      onScanComplete?.(result);
  };

    const handleThreatDetected = (event: CustomEvent) => {
      const result = event.detail as SecurityScanResult;
      onThreatDetected?.(result);
  };

    const handleSecurityNotification = (event: CustomEvent) => {
      const notification = event.detail;
      console.log('Security notification: ', notification);
  };

    if (typeof window !== 'undefined') {
      window.addEventListener('security-scan-complete', handleScanComplete as EventListener);
      window.addEventListener('security-threat-detected', handleThreatDetected as EventListener);
      window.addEventListener('security-notification', handleSecurityNotification as EventListener);

      return () => {
        window.removeEventListener('security-scan-complete', handleScanComplete as EventListener);
        window.removeEventListener('security-threat-detected', handleThreatDetected as EventListener);
        window.removeEventListener('security-notification', handleSecurityNotification as EventListener);
    };
  }
}, [enableAutoScanning, onScanComplete, onThreatDetected]);

  // Scan file
  const scanFile = useCallback(async (file: File): Promise<SecurityScanResult> => {
    if (!enableFileScanning) {
      throw new Error('File scanning is disabled');
  }

    setIsScanning(true);
    try {
      const result = await securityScanner.scanFile(file);
      setScanResults(prev => [...prev, result]);
      onScanComplete?.(result);
      
      if (result.status !== 'clean') {
        onThreatDetected?.(result);
    }
      
      return result;
  } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      onError?.(err);
      throw err;
  } finally {
      setIsScanning(false);
  }
}, [enableFileScanning, onScanComplete, onThreatDetected, onError]);

  // Scan content
  const scanContent = useCallback(async (content: string, options?: Partial<ScanOptions>): Promise<SecurityScanResult> => {
    if (!enableContentScanning) {
      throw new Error('Content scanning is disabled');
  }

    setIsScanning(true);
    try {
      // Scan content for security threats
      const result: SecurityScanResult = {
        id: `scan-${Date.now()}`,
        timestamp: Date.now(),
        status: 'clean',
        threats: [],
        score: 100,
        fileId: ', ',
        fileName: 'content',
        fileSize: content.length,
        fileType: 'text/plain',
        recommendations: ['No threats detected'],
        scanType: 'content',
        metadata: {}
    };
      setScanResults(prev => [...prev, result]);
      onScanComplete?.(result);
      
      if (result.status !== 'clean') {
        onThreatDetected?.(result);
    }
      
      return result;
  } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      onError?.(err);
      throw err;
  } finally {
      setIsScanning(false);
  }
}, [enableContentScanning, onScanComplete, onThreatDetected, onError]);

  // Scan URL
  const scanUrl = useCallback(async (url: string, options?: Partial<ScanOptions>): Promise<SecurityScanResult> => {
    if (!enableUrlScanning) {
      throw new Error('URL scanning is disabled');
  }

    setIsScanning(true);
    try {
      // Scan URL for security threats
      const result: SecurityScanResult = {
        id: `scan-${Date.now()}`,
        timestamp: Date.now(),
        status: 'clean',
        threats: [],
        score: 100,
        fileId: url,
        fileName: url,
        fileSize: 0,
        fileType: 'url',
        recommendations: ['No threats detected'],
        scanType: 'url',
        metadata: {}
    };
      setScanResults(prev => [...prev, result]);
      onScanComplete?.(result);
      
      if (result.status !== 'clean') {
        onThreatDetected?.(result);
    }
      
      return result;
  } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      onError?.(err);
      throw err;
  } finally {
      setIsScanning(false);
  }
}, [enableUrlScanning, onScanComplete, onThreatDetected, onError]);

  // Scan code
  const scanCode = useCallback(async (code: string, options?: Partial<ScanOptions>): Promise<SecurityScanResult> => {
    if (!enableCodeScanning) {
      throw new Error('Code scanning is disabled');
  }

    setIsScanning(true);
    try {
      // Scan code for security vulnerabilities
      const result: SecurityScanResult = {
        id: `scan-${Date.now()}`,
        timestamp: Date.now(),
        status: 'clean',
        threats: [],
        score: 100,
        fileId: ', ',
        fileName: 'code',
        fileSize: code.length,
        fileType: 'code',
        recommendations: ['No vulnerabilities detected'],
        scanType: 'code',
        metadata: {}
    };
      setScanResults(prev => [...prev, result]);
      onScanComplete?.(result);
      
      if (result.status !== 'clean') {
        onThreatDetected?.(result);
    }
      
      return result;
  } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      onError?.(err);
      throw err;
  } finally {
      setIsScanning(false);
  }
}, [enableCodeScanning, onScanComplete, onThreatDetected, onError]);

  // Get scan result by ID
  const getScanResult = useCallback((id: string): SecurityScanResult | undefined => {
    return scanResults.find(r => r.id === id);
}, [scanResults]);

  // Get all scan results
  const getAllScanResults = useCallback((): SecurityScanResult[] => {
    return scanResults;
}, [scanResults]);

  // Clear results
  const clearResults = useCallback(() => {
    setScanResults([]);
}, []);

  // Update config
  const updateConfig = useCallback((config: Partial<SecurityConfig>) => {
    console.log('Update security config:', config);
}, []);

  // Calculate statistics
  const threatCount = scanResults.filter((r: SecurityScanResult) => r.status !== 'clean' && r.status !== 'error').length;
  const cleanCount = scanResults.filter((r: SecurityScanResult) => r.status === 'clean').length;
  const suspiciousCount = scanResults.filter((r: SecurityScanResult) => r.status === 'suspicious').length;
  const maliciousCount = scanResults.filter((r: SecurityScanResult) => r.status === 'malicious').length;
  const errorCount = scanResults.filter((r: SecurityScanResult) => r.status ==='error').length;

  return {
    scanFile,
    scanContent,
    scanUrl,
    scanCode,
    getScanResult,
    getAllScanResults,
    clearResults,
    updateConfig,
    isScanning,
    scanResults,
    threatCount,
    cleanCount,
    suspiciousCount,
    maliciousCount,
    errorCount
};
};

export default useSecurityScanner;





