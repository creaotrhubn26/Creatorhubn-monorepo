/**
 * Showcase Community Integration Hook
 * 
 * Provides integration between UniversalShowcase and Community features:
 * - Share items to community
 * - Get community feedback on items
 * - Track which items have been shared
 * - Handle community events related to showcase items
 */

import { useState, useEffect, useCallback } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';

// ============================================
// TYPES
// ============================================

export interface ShowcaseItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  fileType: 'video' | 'photo' | 'audio' | 'document' | 'design';
  tags?: string[];
}

export interface CommunityFeedback {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  isMentor: boolean;
  createdAt: string;
}

export interface ShareRecord {
  itemId: string;
  messageId: string;
  channelId: string;
  shareType: string;
  sharedAt: string;
  feedbackCount: number;
}

// ============================================
// MAIN HOOK
// ============================================

export function useShowcaseCommunityIntegration(userId: string) {
  const { communication } = useEnhancedMasterIntegration();
  
  const [shareRecords, setShareRecords] = useState<Map<string, ShareRecord>>(new Map());
  const [pendingFeedback, setPendingFeedback] = useState<Map<string, CommunityFeedback[]>>(new Map());
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState<ShowcaseItem | null>(null);
  const [itemsToShare, setItemsToShare] = useState<ShowcaseItem[]>([]);

  // ============================================
  // SHARE MANAGEMENT
  // ============================================

  /**
   * Open share dialog for a single item
   */
  const openShareDialog = useCallback((item: ShowcaseItem) => {
    setItemToShare(item);
    setItemsToShare([]);
    setIsShareDialogOpen(true);
  }, []);

  /**
   * Open share dialog for multiple items (bulk share)
   */
  const openBulkShareDialog = useCallback((items: ShowcaseItem[]) => {
    setItemToShare(null);
    setItemsToShare(items);
    setIsShareDialogOpen(true);
  }, []);

  /**
   * Close share dialog
   */
  const closeShareDialog = useCallback(() => {
    setIsShareDialogOpen(false);
    setItemToShare(null);
    setItemsToShare([]);
  }, []);

  /**
   * Handle successful share
   */
  const handleShareSuccess = useCallback((messageId: string, channelId: string) => {
    const items = itemsToShare.length > 0 ? itemsToShare : itemToShare ? [itemToShare] : [];
    
    items.forEach(item => {
      setShareRecords(prev => {
        const newMap = new Map(prev);
        newMap.set(item.id, {
          itemId: item.id,
          messageId,
          channelId,
          shareType: 'showcase',
          sharedAt: new Date().toISOString(),
          feedbackCount: 0,
        });
        return newMap;
      });
    });

    // Broadcast event for other components
    communication.sendBroadcast('showcase:items-shared', {
      itemIds: items.map(i => i.id),
      messageId,
      channelId,
      sharedBy: userId,
    });
  }, [itemToShare, itemsToShare, userId, communication]);

  // ============================================
  // FEEDBACK MANAGEMENT
  // ============================================

  /**
   * Fetch feedback for a shared item
   */
  const fetchFeedback = useCallback(async (itemId: string) => {
    const record = shareRecords.get(itemId);
    if (!record) return [];

    try {
      const response = await apiRequest(
        `/api/community/showcase/feedback/${record.messageId}`
      );

      if (response.success) {
        const feedback = response.feedback || [];
        setPendingFeedback(prev => {
          const newMap = new Map(prev);
          newMap.set(itemId, feedback);
          return newMap;
        });

        // Update feedback count
        setShareRecords(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(itemId);
          if (existing) {
            newMap.set(itemId, {
              ...existing,
              feedbackCount: feedback.length,
            });
          }
          return newMap;
        });

        return feedback;
      }
    } catch (error) {
      console.error('Error fetching feedback: ', error);
    }
    return [];
  }, [shareRecords]);

  /**
   * Check if an item has been shared
   */
  const isItemShared = useCallback((itemId: string) => {
    return shareRecords.has(itemId);
  }, [shareRecords]);

  /**
   * Get share record for an item
   */
  const getShareRecord = useCallback((itemId: string) => {
    return shareRecords.get(itemId);
  }, [shareRecords]);

  /**
   * Get feedback for an item
   */
  const getFeedback = useCallback((itemId: string) => {
    return pendingFeedback.get(itemId) || [];
  }, [pendingFeedback]);

  /**
   * Get feedback count for an item
   */
  const getFeedbackCount = useCallback((itemId: string) => {
    return shareRecords.get(itemId)?.feedbackCount || 0;
  }, [shareRecords]);

  // ============================================
  // EVENT LISTENERS
  // ============================================

  useEffect(() => {
    // Listen for new feedback on shared items
    const unsubscribe = communication.onMessage((msg: any) => {
      if (msg.type ==='community:new-reply') {
        // Check if this reply is for one of our shared items
        shareRecords.forEach((record, itemId) => {
          if (record.messageId === msg.data?.parentMessageId) {
            // Refresh feedback for this item
            fetchFeedback(itemId);
          }
        });
      }
    });

    return unsubscribe;
  }, [communication, shareRecords, fetchFeedback]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Dialog state
    isShareDialogOpen,
    itemToShare,
    itemsToShare,
    
    // Dialog actions
    openShareDialog,
    openBulkShareDialog,
    closeShareDialog,
    handleShareSuccess,
    
    // Share status
    isItemShared,
    getShareRecord,
    shareRecords,
    
    // Feedback
    fetchFeedback,
    getFeedback,
    getFeedbackCount,
    pendingFeedback,
  };
}

export default useShowcaseCommunityIntegration;

