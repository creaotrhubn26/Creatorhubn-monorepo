import { useClientSession as useClientSessionContext } from '../contexts/ClientSessionContext';

// Re-export the hook from context for convenience
export const useClientSession = useClientSessionContext;

// Additional client session utilities
export function useClientSessionTimeRemaining() {
  const { timeUntilExpiry, sessionData } = useClientSession();

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return'Utløpt';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}t ${minutes}m`;
  } else if (minutes > 0) {
      return `${minutes}m`;
  } else {
      return `${remainingSeconds}s`;
  }
};

  return {
    timeUntilExpiry,
    formattedTime: formatTimeRemaining(timeUntilExpiry),
    isExpiringSoon: timeUntilExpiry <= 10 * 60, // 10 minutes
    isCritical: timeUntilExpiry <= 2 * 60, // 2 minutes
    contentType: sessionData?.contentType,
    isActive: !!sessionData,
};
}

export function useClientSessionSecurity() {
  const { refreshSession, endSession, updateActivity } = useClientSession();

  return {
    refreshSession,
    endSession,
    updateActivity,
    forceExit: () => {
      console.log('🔐 Client force exit initiated');
      endSession();
  },
};
}
