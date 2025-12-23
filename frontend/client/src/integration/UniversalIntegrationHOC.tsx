/**
 * Universal Integration HOC
 * Automatically adds integration capabilities to ANY component
 * Works with all 700+ components in the platform
 */

import React, { useEffect, useRef } from 'react';
import { useEnhancedMasterIntegration } from './EnhancedMasterIntegrationProvider';
import { useTheming } from '../utils/theming-helper';
import { useComponentRegistry } from './UniversalComponentRegistry';

// Enhanced props that any component can receive
export interface UniversalIntegrationProps {
  // Component identification
  componentId?: string;
  componentName?: string;
  componentType?: string;
  componentCategory?: string;
  profession?: string;
  
  // Integration capabilities
  integrationEnabled?: boolean;
  autoRegister?: boolean;
  autoConnect?: boolean;
  
  // Communication
  onIntegrationEvent?: (event: string, data: any) => void;
  onComponentUpdate?: (componentId: string, data: any) => void;
  
  // Data sharing
  sharedData?: Record<string, any>;
  onSharedDataUpdate?: (key: string, value: any) => void;
  
  // Actions
  onActionExecute?: (action: string, data: any) => void;
  onActionRegister?: (action: string, handler: Function) => void
}

// HOC that adds universal integration to any component
export const withUniversalIntegration = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    componentId?: string;
    componentName?: string;
    componentType?: string;
    componentCategory?: string;
    profession?: string;
    capabilities?: string[];
    autoRegister?: boolean;
	    autoConnect?: boolean;
	    // Optional: feature IDs this component implements.
	    // These should correspond to IDs in PROFFESSION_FEATURE_MATRIX / CREATORHUB_FEATURES.
	    featureIds?: string[];
} = {}
) => {
  const EnhancedComponent = React.forwardRef<any, P & UniversalIntegrationProps>((props, ref) => {
    const { integration, communication, dataFlow } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
    const { registerComponent, updateComponent } = useComponentRegistry();
    
	    const {
	      componentId = options.componentId || WrappedComponent.displayName || WrappedComponent.name || 'unknown',
	      componentName = options.componentName || WrappedComponent.displayName || WrappedComponent.name || 'Unknown Component',
	      componentType = options.componentType || 'widget',
	      componentCategory = options.componentCategory || 'general',
	      profession = options.profession,
	      integrationEnabled = true,
	      autoRegister = options.autoRegister !== false,
	      autoConnect = options.autoConnect !== false,
	      onIntegrationEvent,
	      onComponentUpdate,
	      sharedData,
	      onSharedDataUpdate,
	      onActionExecute,
	      onActionRegister,
	      // Optional per-instance override / extension of feature IDs
	      featureIds = options.featureIds,
	      ...restProps
	  } = props;

    const isRegistered = useRef(false);
    const actionHandlers = useRef<Map<string, Function>>(new Map());

	    // Auto-register component
	    useEffect(() => {
	      if (autoRegister && integrationEnabled && !isRegistered.current) {
	        registerComponent({
	          id: componentId,
	          name: componentName,
	          type: componentType as any,
	          category: componentCategory,
	          profession,
	          capabilities: options.capabilities || ['data:read','event:listen'],
	          dependencies: [],
	          props: Object.keys(restProps),
	          events: [],
	          dataKeys: Object.keys(sharedData || {}),
	          version: '1.0.0',
	          description: `${componentName} component with universal integration`,
	          features: featureIds || [],
	        });
	        isRegistered.current = true;
	      }

      return () => {
        if (isRegistered.current) {
          // Component will be unregistered by the registry
        }
      };
    }, [componentId, componentName, componentType, componentCategory, profession, autoRegister, integrationEnabled, registerComponent, restProps, sharedData]);

    // Set up data flow connections
    useEffect(() => {
      if (autoConnect && integrationEnabled) {
        // Create data flow node for this component
        dataFlow.registerNode({
          type: 'source',
          componentId,
          dataKey: `${componentId}:data`,
          transform: (data) => ({ ...data, componentId, timestamp: Date.now() })
        });

        // Create data flow node for receiving data
        dataFlow.registerNode({
          type: 'destination',
          componentId,
          dataKey: `${componentId}:input`,
          transform: (data) => data
        });
      }
    }, [autoConnect, integrationEnabled, componentId, dataFlow]);

    // Listen to integration events
    useEffect(() => {
      if (!integrationEnabled) return;

      const handleIntegrationEvent = (event: string, data: any) => {
        onIntegrationEvent?.(event, data);
      };

      const handleComponentUpdate = (message: any) => {
        if (message.to === componentId || message.to === 'broadcast') {
          onComponentUpdate?.(message.from, message.data);
        }
      };

      const handleDataUpdate = (data: any) => {
        if (data.componentId === componentId) {
          onSharedDataUpdate?.(data.key, data.value);
        }
      };

      // Listen to integration events
      integration.on('integration: event', handleIntegrationEvent);
      // onMessage returns an unsubscribe function
      const unsubscribeMessage = communication.onMessage(handleComponentUpdate);
      integration.on('data: update', handleDataUpdate);

      return () => {
        integration.off('integration: event', handleIntegrationEvent);
        // Call the unsubscribe function instead of communication.off
        unsubscribeMessage();
        integration.off('data: update', handleDataUpdate);
      };
    }, [integrationEnabled, componentId, integration, communication, onIntegrationEvent, onComponentUpdate, onSharedDataUpdate]);

    // Handle action execution
    useEffect(() => {
      if (!integrationEnabled) return;

      const handleActionExecute = (action: string, data: any) => {
        const handler = actionHandlers.current.get(action);
        if (handler) {
          handler(data);
    }
        onActionExecute?.(action, data);
    };

      integration.on('action: execute', handleActionExecute);

      return () => {
        integration.off('action: execute', handleActionExecute);
    };
  }, [integrationEnabled, integration, onActionExecute]);

    // Enhanced props for the wrapped component
    const enhancedProps = {
      ...restProps,
      // Integration capabilities
      integration,
      communication,
      dataFlow,
      
      // Component identification
      componentId,
      componentName,
      componentType,
      componentCategory,
      profession,
      
      // Integration functions
      emitEvent: (event: string, data: any) => {
        if (integrationEnabled) {
          integration.emit(event, data);
          communication.sendBroadcast(event, data);
      }
    },
      
      sendMessage: (to: string, type: string, data: any, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
        if (integrationEnabled) {
          communication.sendMessage({
	            from: componentId,
            to,
            type,
            data,
            priority
        });
      }
    },
      
      broadcastMessage: (type: string, data: any, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
        if (integrationEnabled) {
          communication.sendBroadcast(type, data, priority);
      }
    },
      
      syncData: (key: string, data: any) => {
        if (integrationEnabled) {
          dataFlow.syncData(key, data);
          integration.setData(key, data);
      }
    },
      
      getData: (key: string) => {
        if (integrationEnabled) {
          return integration.getData(key);
    }
        return null;
    },
      
      executeAction: (action: string, data: any) => {
        if (integrationEnabled) {
          integration.executeAction(action, data);
      }
    },
      
      registerAction: (action: string, handler: Function) => {
        if (integrationEnabled) {
          actionHandlers.current.set(action, handler);
          integration.registerAction(action, handler);
          onActionRegister?.(action, handler);
      }
    },
      
      updateComponent: (updates: any) => {
        if (integrationEnabled) {
          updateComponent(componentId, updates);
        }
      },

      // Shared data
      sharedData: sharedData || {},
      onSharedDataUpdate: onSharedDataUpdate || (() => {}),

      // Integration status
      integrationEnabled,
      isRegistered: isRegistered.current
    };

    return <WrappedComponent {...enhancedProps} ref={ref} />;
  });

  EnhancedComponent.displayName = `withUniversalIntegration(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return EnhancedComponent;
};

// Pre-defined integration configurations for different component types
export const INTEGRATION_CONFIGS = {
  // Page components
  PAGE: {
    componentType: 'page',
    capabilities: ['data:read','data:write','event:emit','event:listen','ui:update','navigation:handle'],
    autoRegister: true,
    autoConnect: true
  },

  // Dashboard components
  DASHBOARD: {
    componentType: 'dashboard',
    capabilities: ['data:read','data:write','event:emit','event:listen','ui:update','widget:manage','analytics:track'],
    autoRegister: true,
    autoConnect: true
  },
  
  // Widget components
  WIDGET: {
    componentType: 'widget',
    capabilities: ['data:read','event:emit','event:listen','ui:update'],
    autoRegister: true,
    autoConnect: true
  },

  // Modal components
  MODAL: {
    componentType: 'modal',
    capabilities: ['data:read','event:emit','event:listen','ui:update','modal:control'],
    autoRegister: true,
    autoConnect: false
  },

  // Form components
  FORM: {
    componentType: 'form',
    capabilities: ['data:read','data:write','event:emit','event:listen','validation:handle','submit:handle'],
    autoRegister: true,
    autoConnect: true
  },

  // Chart components
  CHART: {
    componentType: 'chart',
    capabilities: ['data:read','event:listen','ui:update','chart:render','interaction:handle'],
    autoRegister: true,
    autoConnect: true
  },

  // Editor components
  EDITOR: {
    componentType: 'editor',
    capabilities: ['data:read','data:write','event:emit','event:listen','ui:update','content:edit','export:handle'],
    autoRegister: true,
    autoConnect: true
  },

  // Showcase components
  SHOWCASE: {
    componentType: 'showcase',
    capabilities: ['data:read','event:listen','ui:update','media:display','interaction:handle'],
    autoRegister: true,
    autoConnect: true
  },

  // Admin components
  ADMIN: {
    componentType: 'admin',
    capabilities: ['data:read','data:write','event:emit','event:listen','ui:update','system:control','user:manage'],
    autoRegister: true,
    autoConnect: true
  },

  // Universal components
  UNIVERSAL: {
    componentType: 'universal',
      capabilities: ['data:read', 'data:write', 'event:emit', 'event:listen', 'ui:update', 'cross:platform'],
    autoRegister: true,
    autoConnect: true
  }
};

// Utility function to create integration config for any component
export const createIntegrationConfig = (
  componentType: string,
  customCapabilities: string[] = [],
  options: Partial<typeof INTEGRATION_CONFIGS.PAGE> = {}
) => {
  const baseConfig = INTEGRATION_CONFIGS[componentType.toUpperCase() as keyof typeof INTEGRATION_CONFIGS] || INTEGRATION_CONFIGS.WIDGET;

  return {
    ...baseConfig,
    ...options,
    capabilities: [...baseConfig.capabilities, ...customCapabilities]
  };
};

export default withUniversalIntegration;




