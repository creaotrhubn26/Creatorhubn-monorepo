/**
 * OpenAI API Hook - Auto-generated
 * Generated: 2025-10-07T12:00:00.000Z
 * 
 * This hook was automatically created when the API key was added.
 * Use this in your React components to interact with OpenAI.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export const useOpenAIApi = () => {
  const queryClient = useQueryClient();

  // Chat completion mutation
  const chatMutation = useMutation({
    mutationFn: (data: { messages: any[]; model?: string }) =>
      apiRequest('/api/openai/chat', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openai'] });
  },
});

  // Embeddings mutation
  const embeddingsMutation = useMutation({
    mutationFn: (data: { input: string | string[]; model?: string }) =>
      apiRequest('/api/openai/embeddings', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
});

  return {
    chat: chatMutation.mutate,
    chatAsync: chatMutation.mutateAsync,
    isChatting: chatMutation.isPending,
    createEmbedding: embeddingsMutation.mutate,
    isCreatingEmbedding: embeddingsMutation.isPending,
};
};

// Export hook as default
export default useOpenAIApi;

