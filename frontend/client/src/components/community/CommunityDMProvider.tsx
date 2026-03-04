/**
 * CreatorHub Norge Community - Direct Message Provider
 * 
 * Bridges community messaging with UniversalChatWidget
 * Provides context for DM conversations throughout the community
 */

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';
import UniversalChatWidget from '../chat/UniversalChatWidget';

interface DMConversation {
  id: string;
  participant: {
    id: string;
    name: string;
    email?: string;
    profile_picture?: string;
  };
  lastMessage?: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
  };
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DMMessage {
  id: string;
  content: string;
  sender_id: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  sender: {
    id: string;
    name: string;
    profile_picture?: string;
  };
}

interface CommunityDMContextType {
  // State
  conversations: DMConversation[];
  activeConversation: DMConversation | null;
  messages: DMMessage[];
  isLoading: boolean;
  isChatOpen: boolean;
  
  // Actions
  openDM: (userId: string, userName: string, userAvatar?: string) => Promise<void>;
  closeDM: () => void;
  sendMessage: (content: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  
  // Unread count
  totalUnreadCount: number;
}

const CommunityDMContext = createContext<CommunityDMContextType | undefined>(undefined);

interface CommunityDMProviderProps {
  children: ReactNode;
  currentUserId?: string;
  currentUserEmail?: string;
  profession?: string;
}

export function CommunityDMProvider({
  children,
  currentUserId,
  currentUserEmail,
  profession = 'photographer',
}: CommunityDMProviderProps) {
  const { communication } = useEnhancedMasterIntegration();
  
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<DMConversation | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Calculate total unread count
  const totalUnreadCount = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);

  // Load all conversations
  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;

    try {
      setIsLoading(true);
      const response = await apiRequest(`/api/community/dm/conversations?userId=${currentUserId}`);
      if (response.success) {
        setConversations(response.conversations || []);
      }
    } catch (error) {
      console.error('Error loading DM conversations: ', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!currentUserId) return;

    try {
      setIsLoading(true);
      const response = await apiRequest(
        `/api/community/dm/conversations/${conversationId}/messages?userId=${currentUserId}`
      );
      if (response.success) {
        setMessages(response.messages || []);
      }
    } catch (error) {
      console.error('Error loading DM messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  // Open a DM conversation (create if doesn't exist)
  const openDM = useCallback(async (userId: string, userName: string, userAvatar?: string) => {
    if (!currentUserId) return;

    try {
      setIsLoading(true);
      
      // Create or get existing conversation
      const response = await apiRequest('/api/community/dm/conversations', {
        method: 'POST',
        body: JSON.stringify({
          currentUserId,
          participantId: userId,
        }),
      });

      if (response.success && response.conversation) {
        const conversation: DMConversation = {
          id: response.conversation.id,
          participant: response.conversation.participant || {
            id: userId,
            name: userName,
            profile_picture: userAvatar,
          },
          unreadCount: 0,
          createdAt: response.conversation.createdAt,
          updatedAt: response.conversation.updatedAt,
        };

        setActiveConversation(conversation);
        setIsChatOpen(true);

        // Load messages for this conversation
        await loadMessages(conversation.id);

        // Refresh conversations list
        await loadConversations();
      }
    } catch (error) {
      console.error('Error opening DM: ', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, loadMessages, loadConversations]);

  // Close DM
  const closeDM = useCallback(() => {
    setIsChatOpen(false);
    setActiveConversation(null);
    setMessages([]);
  }, []);

  // Send a message
  const sendMessage = useCallback(async (content: string) => {
    if (!currentUserId || !activeConversation || !content.trim()) return;

    try {
      const response = await apiRequest(
        `/api/community/dm/conversations/${activeConversation.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            senderId: currentUserId,
            content: content.trim(),
          }),
        }
      );

      if (response.success && response.message) {
        // Add message to local state
        setMessages((prev) => [...prev, response.message]);

        // Update conversation's last message
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === activeConversation.id
              ? { ...conv, lastMessage: response.message, updatedAt: new Date().toISOString() }
              : conv
          )
        );
      }
    } catch (error) {
      console.error('Error sending DM:', error);
    }
  }, [currentUserId, activeConversation]);

  // Mark conversation as read
  const markAsRead = useCallback(async (conversationId: string) => {
    // This happens automatically when loading messages
    // Update local state
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      )
    );
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!currentUserId) return;

    try {
      await apiRequest(`/api/community/dm/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      // Remove from local state
      setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));

      // Close if it's the active conversation
      if (activeConversation?.id === conversationId) {
        closeDM();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  }, [currentUserId, activeConversation, closeDM]);

  // Listen for DM open events from other components
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type ==='chat:open-dm' && message.data) {
        const { participantId, participantName, participantAvatar } = message.data;
        if (participantId && participantName) {
          openDM(participantId, participantName, participantAvatar);
        }
      }
    });

    return unsubscribe;
  }, [communication, openDM]);

  // Load conversations on mount
  useEffect(() => {
    if (currentUserId) {
      loadConversations();
    }
  }, [currentUserId, loadConversations]);

  // Poll for new messages/conversations periodically
  useEffect(() => {
    if (!currentUserId) return;

    const interval = setInterval(() => {
      loadConversations();
      if (activeConversation) {
        loadMessages(activeConversation.id);
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [currentUserId, activeConversation, loadConversations, loadMessages]);

  const contextValue: CommunityDMContextType = {
    conversations,
    activeConversation,
    messages,
    isLoading,
    isChatOpen,
    openDM,
    closeDM,
    sendMessage,
    loadConversations,
    loadMessages,
    markAsRead,
    deleteConversation,
    totalUnreadCount,
  };

  return (
    <CommunityDMContext.Provider value={contextValue}>
      {children}
      
      {/* Render UniversalChatWidget when DM is active */}
      {isChatOpen && activeConversation && (
        <UniversalChatWidget
          profession={profession}
          userEmail={currentUserEmail}
          userId={currentUserId}
          isOpen={isChatOpen}
          onClose={closeDM}
          context={{
            noteTitle: `DM with ${activeConversation.participant.name}`}}
        />
      )}
    </CommunityDMContext.Provider>
  );
}

// Custom hook to use DM context
export function useCommunityDM() {
  const context = useContext(CommunityDMContext);
  if (!context) {
    throw new Error('useCommunityDM must be used within a CommunityDMProvider');
  }
  return context;
}

export default CommunityDMProvider;

