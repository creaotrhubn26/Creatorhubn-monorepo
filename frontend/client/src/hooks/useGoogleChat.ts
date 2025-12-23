/**
 * Google Chat Hook for CreatorHub Norge
 * Provides React hooks for Google Chat integration
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/hooks/useAuth';
import { googleChatService, GoogleChatSpace, GoogleChatMessage } from'@/services/GoogleChatService';

export const useGoogleChat = () => {
  const { isDemoMode } = useDemoMode();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Set demo mode in service
  useEffect(() => {
    googleChatService.setDemoMode(isDemoMode);
}, [isDemoMode]);

  // Set access token when user changes
  useEffect(() => {
    if ((user as any)?.googleAccessToken) {
      (googleChatService as any).setAccessToken((user as any).googleAccessToken);
  }
}, [(user as any)?.googleAccessToken]);

  // Get Google Chat spaces
  const {
    data: spaces,
    isLoading: spacesLoading,
    error: spacesError,
    refetch: refetchSpaces,
} = useQuery({
    queryKey: ['google-chat-spaces'],
    queryFn: () => (googleChatService as any).getSpaces(),
    enabled: !isDemoMode && !!(user as any)?.googleAccessToken,
    refetchInterval: 30000, // Refetch every 30 seconds
});

  // Get messages for a specific space
  const useSpaceMessages = (spaceName: string) => {
    return useQuery({
      queryKey: ['google-chat-messages', spaceName],
      queryFn: () => (googleChatService as any).getMessages(spaceName),
      enabled: !isDemoMode && !!(user as any)?.googleAccessToken && !!spaceName,
      refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  });
};

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ spaceName, text, threadName }: { 
      spaceName: string; 
      text: string; 
      threadName?: string; 
  }) => {
      return (googleChatService as any).sendMessage(spaceName, text, threadName);
  },
    onSuccess: (_, variables) => {
      // Invalidate and refetch messages for the space
      queryClient.invalidateQueries({
        queryKey: ['google-chat-messages', variables.spaceName],
    });
  },
});

  // Create space mutation
  const createSpaceMutation = useMutation({
    mutationFn: async ({ displayName, description }: { 
      displayName: string; 
      description?: string; 
  }) => {
      return (googleChatService as any).createSpace(displayName, description);
  },
    onSuccess: () => {
      // Invalidate and refetch spaces
      queryClient.invalidateQueries({
        queryKey: ['google-chat-spaces'],
    });
  },
});

  // Add reaction mutation
  const addReactionMutation = useMutation({
    mutationFn: async ({ messageName, emoji }: { 
      messageName: string; 
      emoji: string; 
  }) => {
      return (googleChatService as any).addReaction(messageName, emoji);
  },
});

  // Search messages
  const searchMessagesMutation = useMutation({
    mutationFn: async ({ query, spaces }: { 
      query: string; 
      spaces?: string[]; 
  }) => {
      return (googleChatService as any).searchMessages(query, spaces);
  },
});

  // Get space members
  const useSpaceMembers = (spaceName: string) => {
    return useQuery({
      queryKey: ['google-chat-members', spaceName],
      queryFn: () => (googleChatService as any).getSpaceMembers(spaceName),
      enabled: !isDemoMode && !!(user as any)?.googleAccessToken && !!spaceName,
  });
};

  return {
    // Data
    spaces: spaces?.spaces || [],
    spacesLoading,
    spacesError,
    
    // Actions
    refetchSpaces,
    sendMessage: sendMessageMutation.mutateAsync,
    sendMessageLoading: sendMessageMutation.isPending,
    createSpace: createSpaceMutation.mutateAsync,
    createSpaceLoading: createSpaceMutation.isPending,
    addReaction: addReactionMutation.mutateAsync,
    searchMessages: searchMessagesMutation.mutateAsync,
    
    // Hooks
    useSpaceMessages,
    useSpaceMembers,
    
    // State
    isConnected: !isDemoMode && !!(user as any)?.googleAccessToken,
    isDemoMode,
};
};

export default useGoogleChat;
