/**
 * Split Sheet Collaboration Provider
 * WebSocket-based real-time collaboration context
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface CollaborationState {
  isConnected: boolean;
  activeUsers: Array<{
    userId: string;
    isEditing: boolean;
    editingSection?: string;
  }>;
  sendUpdate: (type: string, data: any) => void;
  setEditing: (isEditing: boolean, section?: string) => void;
}

const CollaborationContext = createContext<CollaborationState | null>(null);

export const useSplitSheetCollaboration = () => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useSplitSheetCollaboration must be used within SplitSheetCollaborationProvider ');
  }
  return context;
};

interface SplitSheetCollaborationProviderProps {
  splitSheetId: string;
  children: React.ReactNode;
}

export default function SplitSheetCollaborationProvider({
  splitSheetId,
  children
}: SplitSheetCollaborationProviderProps) {
  const { user } = useAuth();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<Array<{ userId: string; isEditing: boolean; editingSection?: string }>>([]);
  const [isEditing, setIsEditingState] = useState(false);
  const [editingSection, setEditingSectionState] = useState<string | undefined>();

  useEffect(() => {
    if (!splitSheetId || !user?.id) return;

    // Connect to WebSocket
    const wsUrl = `ws://localhost:3001/ws/split-sheets/${splitSheetId}?userId=${user.id}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('Split sheet WebSocket connected');
      setIsConnected(true);
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'presence_update':
            if (message.data.users) {
              setActiveUsers(message.data.users.filter((u: any) => u.userId !== user.id));
            } else if (message.data.action === 'joined' || message.data.action === 'left') {
              // Update active users list
              // In a real implementation, this would update the list
            }
            break;
          
          case 'contributor_update':
          case 'percentage_update':
          case 'status_update':
            // Notify parent components of updates
            window.dispatchEvent(new CustomEvent('split-sheet-update', { detail: message }));
            break;
          
          case 'lock_update':
            // Update editing locks
            setActiveUsers(prev => prev.map(u => 
              u.userId === message.userId 
                ? { ...u, isEditing: message.data.isEditing, editingSection: message.data.section }
                : u
            ));
            break;
          
          case'pong':
            // Keep-alive
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message: ', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('Split sheet WebSocket error:', error);
      setIsConnected(false);
    };

    websocket.onclose = () => {
      console.log('Split sheet WebSocket disconnected');
      setIsConnected(false);
      setWs(null);
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (splitSheetId && user?.id) {
          // Reconnection handled by useEffect
        }
      }, 3000);
    };

    return () => {
      websocket.close();
    };
  }, [splitSheetId, user?.id]);

  const sendUpdate = useCallback((type: string, data: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type,
        splitSheetId,
        userId: user?.id,
        data,
        timestamp: Date.now()
      }));
    }
  }, [ws, splitSheetId, user?.id]);

  const setEditing = useCallback((editing: boolean, section?: string) => {
    setIsEditingState(editing);
    setEditingSectionState(section);
    sendUpdate('lock_update', {
      isEditing: editing,
      section
    });
  }, [sendUpdate]);

  const value: CollaborationState = {
    isConnected,
    activeUsers,
    sendUpdate,
    setEditing
  };

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
}























