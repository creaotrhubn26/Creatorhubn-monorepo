/**
 * Universal Notification Provider
 * Provides notification context and integration across all components
 */

import { useTheming } from '../../utils/theming-helper';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUniversalNotifications } from '../../hooks/useUniversalNotifications';
import NotificationSystem from '../notifications/NotificationSystem';
import CornerButtons from './misc/corner-buttons';
import { Box } from '@mui/material'; // Snackbar & Alert removed - Zero Toast Compliance
import { apiRequest } from '@/lib/queryClient';

interface UniversalNotificationContextType {
  isConnected: boolean;
  notify: (notification: any) => Promise<any>;
  notifyGoogleUpload: (data: any) => Promise<any>;
  notifyGoogleProject: (data: any) => Promise<any>;
  notifyGoogleSync: (data: any) => Promise<any>;
  notifyPhotoUpload: (data: any) => Promise<any>;
  notifyVideoUpload: (data: any) => Promise<any>;
  notifyProjectUpdate: (data: any) => Promise<any>;
  notifyWeddingTimeline: (data: any) => Promise<any>;
  notifyClientDelivery: (data: any) => Promise<any>;
  subscribe: (type: string, callback: (data: any) => void) => () => void
}

const UniversalNotificationContext = createContext<UniversalNotificationContextType | null>(null);

export function useUniversalNotificationContext() {
  const context = useContext(UniversalNotificationContext);
  if (!context) {
    throw new Error('useUniversalNotificationContext must be used within UniversalNotificationProvider ');
}
  return context;
}

interface UniversalNotificationProviderProps {
  children: React.ReactNode;
  userId?: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor'
}

export default function UniversalNotificationProvider({
  children,
  userId = 'default-user',
  profession = 'photographer'
}: UniversalNotificationProviderProps) {
  // Zero Toast Compliance - removed Snackbar state variables

  const notificationSystem = useUniversalNotifications({
    userId,
    profession,
    enableRealtime: true,
    enableGoogleIntegration: true
});

  // Subscribe to system-wide notifications
  useEffect(() => {
    const unsubscribe = notificationSystem.subscribe('all', (notification) => {
      console.log('Universal notification received: ', notification);
      
      // Zero Toast Compliance - using console logging instead of Snackbar
      if (notification.type.includes('error') || notification.type.includes('completed')) {
        console.log('Zero Toast Compliance: System notification, :', notification.title, notification.message);
    }
  });

    return unsubscribe;
}, [notificationSystem]);

  // Enhanced notification methods with automatic Google integration
  const enhancedNotify = useCallback(
  
  // Theming system
  const theming = useTheming('photographer');async (notification: any) => {
    // Add automatic Google integration metadata
    const enhancedNotification = {
      ...notification,
      metadata: {
        ...notification.metadata,
        timestamp: new Date().toISOString(),
        userId,
        profession,
        universalSystem: true
  }
  };

    return notificationSystem.notify(enhancedNotification);
}, [notificationSystem, userId, profession]);

  const enhancedNotifyGoogleUpload = useCallback(async (data: any) => {
    // Automatically trigger related component updates
    const result = await notificationSystem.notifyGoogleUpload(data);
    
    // Notify other components about the upload
    if (data.status === 'completed' && data.projectId) {
      await enhancedNotify({
        type: 'project_file_update',
        title: 'Prosjektfiler oppdatert',
        message: 'Nye filer er tilgjengelig i prosjektet',
        metadata: {
          projectId: data.projectId,
          component: 'file_management',
          googleIntegration: true
    }
    });
  }

    return result;
}, [notificationSystem, enhancedNotify]);

  const enhancedNotifyGoogleProject = useCallback(async (data: any) => {
    const result = await notificationSystem.notifyGoogleProject(data);
    
    // Trigger cross-component updates
    if (data.action === 'created' || data.action === 'updated') {
      // Notify timeline component
      await enhancedNotify({
        type: 'timeline_sync_required',
        title: 'Tidslinje synkronisering',
        message: 'Prosjektoppdatering krever tidslinje synkronisering',
        metadata: {
          projectId: data.projectId,
          component: 'wedding_timeline',
          action: 'sync_required'
    }
    });

      // Notify delivery component
      await enhancedNotify({
        type: 'delivery_update_available',
        title: 'Leveringsoppdatering',
        message: 'Nye elementer tilgjengelig for levering',
        metadata: {
          projectId: data.projectId,
          component: 'client_delivery',
          action:'update_available'
    }
    });
  }

    return result;
}, [notificationSystem, enhancedNotify]);

  const contextValue: UniversalNotificationContextType = {
    isConnected: notificationSystem.isConnected,
    notify: enhancedNotify,
    notifyGoogleUpload: enhancedNotifyGoogleUpload,
    notifyGoogleProject: enhancedNotifyGoogleProject,
    notifyGoogleSync: notificationSystem.notifyGoogleSync,
    notifyPhotoUpload: notificationSystem.notifyPhotoUpload,
    notifyVideoUpload: notificationSystem.notifyVideoUpload,
    notifyProjectUpdate: notificationSystem.notifyProjectUpdate,
    notifyWeddingTimeline: notificationSystem.notifyWeddingTimeline,
    notifyClientDelivery: notificationSystem.notifyClientDelivery,
    subscribe: notificationSystem.subscribe
};

  return (
    <UniversalNotificationContext.Provider value={contextValue}>
      {children}
      
      {/* Universal Notification System UI */}
      <NotificationSystem
        userId={userId}
        onNotificationClick={(notification) => {
          console.log('Notification clicked:', notification);
          // Handle notification click - could navigate to specific component
      }}
      />

      {/* Discrete Corner Buttons with integrated notification system */}
      <CornerButtons
        profession={profession}
        userId={userId}
      />

      {/* Zero Toast Compliance - System notifications handled through NotificationSystem component only */}
    </UniversalNotificationContext.Provider>
  );
}