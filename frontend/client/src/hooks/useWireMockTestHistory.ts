import { useState, useCallback } from 'react';
import { WireMockTestResult } from '../components/admin/WireMockResponseViewer';

const MAX_HISTORY_SIZE = 100;

export const useWireMockTestHistory = () => {
  const [history, setHistory] = useState<WireMockTestResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<WireMockTestResult | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const addTestResult = useCallback((result: Omit<WireMockTestResult, 'id' | 'timestamp'>) => {
    const newResult: WireMockTestResult = {
      ...result,
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    setHistory(prev => {
      const updated = [newResult, ...prev];
      // Keep only the last MAX_HISTORY_SIZE results
      return updated.slice(0, MAX_HISTORY_SIZE);
    });

    return newResult;
  }, []);

  const viewResult = useCallback((result: WireMockTestResult) => {
    setSelectedResult(result);
    setViewerOpen(true);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const getSuccessRate = useCallback(() => {
    if (history.length === 0) return 0;
    const successCount = history.filter(r => r.status === 'success').length;
    return Math.round((successCount / history.length) * 100);
  }, [history]);

  const getAverageResponseTime = useCallback(() => {
    const resultsWithTime = history.filter(r => r.responseTime !== undefined);
    if (resultsWithTime.length === 0) return 0;
    const total = resultsWithTime.reduce((sum, r) => sum + (r.responseTime || 0), 0);
    return Math.round(total / resultsWithTime.length);
  }, [history]);

  const filterByApi = useCallback((apiName: string) => {
    return history.filter(r => r.apiName === apiName);
  }, [history]);

  const filterByStatus = useCallback((status: 'success' | 'error') => {
    return history.filter(r => r.status === status);
  }, [history]);

  const exportHistory = useCallback(() => {
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wiremock-test-history-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [history]);

  return {
    history,
    selectedResult,
    viewerOpen,
    addTestResult,
    viewResult,
    closeViewer,
    clearHistory,
    getSuccessRate,
    getAverageResponseTime,
    filterByApi,
    filterByStatus,
    exportHistory
  };
};

