/**
 * Universal Component Registry
 * Automatically discovers and registers ALL components in the platform
 * Enables "everything interacts with everything" across 700+ components
 */

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useIntegration } from './ComponentIntegrationManager';
import { useCommunication } from './CrossComponentCommunication';
import { useDataFlow } from './UniversalDataFlow';

// ---- Component & event typing helpers ----
type ComponentType = 'dashboard' | 'widget' | 'page' | 'editor' | 'showcase' | (string & {});

type Category =
  | 'music'
  | 'showcase'
  | 'communication'
  | 'analytics'
  | 'equipment'
  | 'projects'
  | 'client'
  | 'legal'
  | 'templates'
  | 'export'
  | 'crm'
  | 'sales'
  | 'settings'
  | 'integrations'
  | 'security'
  | (string & {});

type Profession = 'music_producer' | 'photographer' | 'videographer' | 'vendor' | (string & {});

// Event map for your registry (extend as needed)
interface EventMap {
  'component:mounted': { id: string };
  'component:updated': { id: string; changes: Record<string, unknown> };
  'component:removed': { id: string };
  // fallback for custom events
  [key: string]: Record<string, unknown>;
}

// Component metadata interface
export interface ComponentMetadata {
  id: string;
  name: string;
  type:
    | 'page'
    | 'dashboard'
    | 'widget'
    | 'modal'
    | 'form'
    | 'chart'
    | 'editor'
    | 'showcase'
    | 'admin'
    | 'universal'
    | 'other';
  category: string;
  profession?: string;
  path?: string;
  capabilities: string[];
  dependencies: string[];
  props: string[];
  events: string[];
  dataKeys: string[];
	  // Optional: feature IDs this component implements (from profession-feature-matrix)
	  features?: string[];
  lastSeen: number;
  status: 'active' | 'inactive' | 'error' | 'loading';
  version?: string;
  description?: string;
  // allow flexible extension
  [k: string]: unknown;
}

type RegisterableComponentMetadata = {
  id: string;
  name: string;
  type?: ComponentMetadata['type'];
  category?: ComponentMetadata['category'];
  profession?: ComponentMetadata['profession'];
  path?: ComponentMetadata['path'];
  capabilities?: string[];
  dependencies?: string[];
  props?: string[];
  events?: string[];
  dataKeys?: string[];
  features?: string[];
  version?: string;
  description?: string;
} & Record<string, unknown>;

// Context shape exposed by the registry
interface ComponentRegistryContextType {
  registerComponent: (metadata: RegisterableComponentMetadata) => void;
  unregisterComponent: (componentId: string) => void;
  updateComponent: (componentId: string, updates: Partial<ComponentMetadata>) => void;
  getComponent: (componentId: string) => ComponentMetadata | undefined;
  getAllComponents: () => ComponentMetadata[];
  getComponentsByType: (type: string) => ComponentMetadata[];
  getComponentsByCategory: (category: string) => ComponentMetadata[];
  getComponentsByProfession: (profession: string) => ComponentMetadata[];
  searchComponents: (query: string) => ComponentMetadata[];
  getComponentDependencies: (componentId: string) => ComponentMetadata[];
  getComponentsThatDependOn: (componentId: string) => ComponentMetadata[];
  getRelatedComponents: (componentId: string) => ComponentMetadata[];
  // Components where we never observed any props (helps detect gaps)
  getComponentsMissingProps: () => ComponentMetadata[];
  broadcastToAll: (event: string, data: any) => void;
  broadcastToType: (type: string, event: string, data: any) => void;
  broadcastToCategory: (category: string, event: string, data: any) => void;
  broadcastToProfession: (profession: string, event: string, data: any) => void;
  getComponentHealth: () => { total: number; active: number; inactive: number; error: number };
  getInactiveComponents: () => ComponentMetadata[];
  getErrorComponents: () => ComponentMetadata[];
}

const ComponentRegistryContext = createContext<ComponentRegistryContextType | null>(null);

// Component Registry Provider
export const ComponentRegistryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const integration = useIntegration();
  const communication = useCommunication();
  const dataFlow = useDataFlow();
	  const components = useRef<Map<string, ComponentMetadata>>(new Map());
	  const componentListeners = useRef<Set<(components: ComponentMetadata[]) => void>>(new Set());

  // Auto-discover components on mount
  useEffect(() => {
    // Discover all components automatically
    discoverAllComponents();

    // Set up periodic health checks
    const healthCheckInterval = setInterval(() => {
      updateComponentHealth();
    }, 30000); // Every 30 seconds

    return () => clearInterval(healthCheckInterval);
  }, []);

  // Auto-discover all components in the platform
  const discoverAllComponents = useCallback(() => {
    // This would be implemented to automatically discover all components
    // For now, we'll register the major component categories

    const majorComponents: Array<
      Pick<
        RegisterableComponentMetadata,
        'id' | 'name' | 'type' | 'category' | 'profession' | 'capabilities'
      >
    > = [
      // Admin Components
      {
        id: 'admin-dashboard',
        name: 'Admin Dashboard',
        type: 'admin',
        category: 'administration',
        capabilities: ['data:read','data:write','user:manage','system:control'],
      },
      {
        id: 'user-management',
        name: 'User Management',
        type: 'admin',
        category: 'administration',
        capabilities: ['user:create','user:update','user:delete'],
      },
      {
        id: 'system-health',
        name: 'System Health',
        type: 'admin',
        category: 'monitoring',
        capabilities: ['system:monitor','health: check'],
      },

      // Universal Components
      {
        id: 'universal-dashboard',
        name: 'Universal Dashboard',
        type: 'dashboard',
        category: 'main',
        capabilities: ['data:read','data: write','ui: update'],
      },
      {
        id: 'file-manager',
        name: 'File Manager',
        type: 'widget',
        category: 'files',
        capabilities: ['file:upload','file: download','file: manage'],
      },
      {
        id: 'project-timeline',
        name: 'Project Timeline',
        type: 'widget',
        category: 'projects',
        capabilities: ['project:track','timeline: update'],
      },

      // Profession-Specific Components
      {
        id: 'photographer-dashboard',
        name: 'Photographer Dashboard',
        type: 'dashboard',
        category: 'photography',
        profession: 'photographer',
        capabilities: ['photo:manage','client: communicate'],
      },
      {
        id: 'videographer-dashboard',
        name: 'Videographer Dashboard',
        type: 'dashboard',
        category: 'videography',
        profession: 'videographer',
        capabilities: ['video:manage','editing: tools'],
      },
      {
        id: 'music-producer-dashboard',
        name: 'Music Producer Dashboard',
        type: 'dashboard',
        category: 'music',
        profession: 'music_producer',
        capabilities: ['audio:manage','mixing: tools'],
      },

      // Showcase Components
      {
        id: 'photo-showcase',
        name: 'Photo Showcase',
        type: 'showcase',
        category: 'showcase',
        capabilities: ['gallery:display','client: view'],
      },
      {
        id: 'video-showcase',
        name: 'Video Showcase',
        type: 'showcase',
        category: 'showcase',
        capabilities: ['video:display','player: controls'],
      },
      {
        id: 'music-showcase',
        name: 'Music Showcase',
        type: 'showcase',
        category: 'showcase',
        capabilities: ['audio:play','playlist: manage'],
      },

      // Communication Components
      {
        id: 'chat-widget',
        name: 'Chat Widget',
        type: 'widget',
        category: 'communication',
        capabilities: ['message:send','message: receive'],
      },
      {
        id: 'email-center',
        name: 'Email Center',
        type: 'widget',
        category: 'communication',
        capabilities: ['email:send','email: manage'],
      },
      {
        id: 'meeting-manager',
        name: 'Meeting Manager',
        type: 'widget',
        category: 'communication',
        capabilities: ['meeting:schedule','meeting: join'],
      },

      // Analytics Components
      {
        id: 'analytics-dashboard',
        name: 'Analytics Dashboard',
        type: 'dashboard',
        category: 'analytics',
        capabilities: ['data:analyze','metrics: track'],
      },
      {
        id: 'business-intelligence',
        name: 'Business Intelligence',
        type: 'dashboard',
        category: 'analytics',
        capabilities: ['insights:generate','reports: create'],
      },
      {
        id: 'performance-metrics',
        name: 'Performance Metrics',
        type: 'widget',
        category: 'analytics',
        capabilities: ['performance:track','optimization: suggest'],
      },

      // Equipment Components
      {
        id: 'equipment-dashboard',
        name: 'Equipment Dashboard',
        type: 'dashboard',
        category: 'equipment',
        capabilities: ['equipment:track','maintenance: schedule'],
      },
      {
        id: 'camera-manager',
        name: 'Camera Manager',
        type: 'widget',
        category: 'equipment',
        capabilities: ['camera:manage','settings: configure'],
      },
      {
        id: 'lighting-simulator',
        name: 'Lighting Simulator',
        type: 'widget',
        category: 'equipment',
        capabilities: ['lighting:simulate','setup: optimize'],
      },

      // Project Management Components
      {
        id: 'project-manager',
        name: 'Project Manager',
        type: 'dashboard',
        category: 'projects',
        capabilities: ['project:create','project: track','project: manage'],
      },
      {
        id: 'client-portal',
        name: 'Client Portal',
        type: 'page',
        category: 'client',
        capabilities: ['client:view','project:access','communication:send'],
      },
      {
        id: 'contract-manager',
        name: 'Contract Manager',
        type: 'widget',
        category: 'legal',
        capabilities: ['contract:create','contract: sign','contract: track'],
      },

      // Visual Editor Components
      {
        id: 'visual-editor',
        name: 'Visual Editor',
        type: 'editor',
        category: 'editing',
        capabilities: ['design:create','element: edit','export: generate'],
      },
      {
        id: 'template-manager',
        name: 'Template Manager',
        type: 'widget',
        category: 'templates',
        capabilities: ['template:create','template: apply','template: manage'],
      },
      {
        id: 'export-presets',
        name: 'Export Presets',
        type: 'widget',
        category: 'export',
        capabilities: ['preset:create','preset: apply','export: optimize'],
      },

      // CRM Components
      {
        id: 'crm-dashboard',
        name: 'CRM Dashboard',
        type: 'dashboard',
        category: 'crm',
        capabilities: ['client:manage','lead: track','sales: analyze'],
      },
      {
        id: 'client-management',
        name: 'Client Management',
        type: 'widget',
        category: 'crm',
        capabilities: ['client:create','client: update','client: communicate'],
      },
      {
        id: 'sales-hub',
        name: 'Sales Hub',
        type: 'dashboard',
        category: 'sales',
        capabilities: ['sales:track','pipeline: manage','revenue: analyze'],
      },

      // Settings Components
      {
        id: 'settings-dashboard',
        name: 'Settings Dashboard',
        type: 'dashboard',
        category: 'settings',
        capabilities: ['settings:manage','preferences: update'],
      },
      {
        id: 'integration-manager',
        name: 'Integration Manager',
        type: 'widget',
        category: 'integrations',
        capabilities: ['integration:configure','api: manage'],
      },
      {
        id: 'security-panel',
        name: 'Security Panel',
        type: 'widget',
        category: 'security',
        capabilities: ['security:monitor', 'access: control'],
      },
    ];

    // Register all major components
    majorComponents.forEach((component) => {
      registerComponent({
        ...component,
        dependencies: [],
        props: [],
        events: [],
        dataKeys: [],
        version: '1.0.0',
        description: `${component.name} component`,
      });
    });

    // Set up data flow connections between related components
    setupComponentConnections();
  }, []);

  // Set up automatic connections between related components
  const setupComponentConnections = useCallback(() => {
    // Project-related connections
    dataFlow.createConnection({
      from: 'project-manager:project',
      to: 'client-portal:project',
      dataKey: 'projectData',
      priority: 1,
    });

    dataFlow.createConnection({
      from: 'project-manager:project',
      to: 'analytics-dashboard:project',
      dataKey: 'projectMetrics',
      priority: 1,
    });

    // Client-related connections
    dataFlow.createConnection({
      from: 'client-management:client',
      to: 'crm-dashboard:client',
      dataKey: 'clientData',
      priority: 1,
    });

    dataFlow.createConnection({
      from: 'client-management:client',
      to: 'email-center:client',
      dataKey: 'clientInfo',
      priority: 1,
    });

    // Visual editor connections
    dataFlow.createConnection({
      from: 'visual-editor:project',
      to: 'template-manager:project',
      dataKey: 'designData',
      priority: 1,
    });

    dataFlow.createConnection({
      from: 'visual-editor:export',
      to: 'export-presets:export',
      dataKey: 'exportData',
      priority: 1,
    });

    // Analytics connections
    dataFlow.createConnection({
      from: 'analytics-dashboard:metrics',
      to: 'business-intelligence:metrics',
      dataKey: 'analyticsData',
      priority: 1,
    });

    // Equipment connections
    dataFlow.createConnection({
      from: 'equipment-dashboard:equipment',
      to: 'camera-manager:equipment',
      dataKey: 'equipmentData',
      priority: 1,
    });
  }, [dataFlow]);

  // Register component
  const registerComponent = useCallback(
    (metadata: RegisterableComponentMetadata) => {
      const fullMetadata: ComponentMetadata = {
        ...metadata,
        type: metadata.type ?? 'widget',
        category: metadata.category ?? 'general',
        capabilities: metadata.capabilities ?? [],
        dependencies: metadata.dependencies ?? [],
        props: metadata.props ?? [],
        events: metadata.events ?? [],
        dataKeys: metadata.dataKeys ?? [],
        lastSeen: Date.now(),
        status: 'active',
      };

      components.current.set(metadata.id, fullMetadata);

      // Notify listeners
      componentListeners.current.forEach((listener) =>
        listener(Array.from(components.current.values())),
      );

      // Emit registration event
      integration.emit('component:registered', fullMetadata);
      communication.sendBroadcast('component:registered', fullMetadata);
    },
    [integration, communication],
  );

  // Unregister component
  const unregisterComponent = useCallback(
    (componentId: string) => {
      const component = components.current.get(componentId);
      if (component) {
        components.current.delete(componentId);

        // Notify listeners
        componentListeners.current.forEach((listener) =>
          listener(Array.from(components.current.values())),
        );

        // Emit unregistration event
        integration.emit('component:unregistered', { componentId });
        communication.sendBroadcast('component:unregistered', { componentId });
      }
    },
    [integration, communication],
  );

  // Update component
  const updateComponent = useCallback(
    (componentId: string, updates: Partial<ComponentMetadata>) => {
      const component = components.current.get(componentId);
      if (component) {
        const updatedComponent = { ...component, ...updates, lastSeen: Date.now() };
        components.current.set(componentId, updatedComponent);

        // Notify listeners
        componentListeners.current.forEach((listener) =>
          listener(Array.from(components.current.values())),
        );

        // Emit update event
        integration.emit('component:updated', updatedComponent);
      }
    },
    [integration],
  );

  // Get component
  const getComponent = useCallback((componentId: string) => {
    return components.current.get(componentId);
  }, []);

  // Get all components
  const getAllComponents = useCallback(() => {
    return Array.from(components.current.values());
  }, []);

  // Get components by type
  const getComponentsByType = useCallback((type: string) => {
    return Array.from(components.current.values()).filter((c) => c.type === type);
  }, []);

  // Get components by category
  const getComponentsByCategory = useCallback((category: string) => {
    return Array.from(components.current.values()).filter((c) => c.category === category);
  }, []);

  // Get components by profession
  const getComponentsByProfession = useCallback((profession: string) => {
    return Array.from(components.current.values()).filter((c) => c.profession === profession);
  }, []);

  // Search components
  const searchComponents = useCallback((query: string) => {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(components.current.values()).filter(
      (c) =>
        c.name.toLowerCase().includes(lowercaseQuery) ||
        c.description?.toLowerCase().includes(lowercaseQuery) ||
        c.category.toLowerCase().includes(lowercaseQuery),
    );
  }, []);

  // Get component dependencies
  const getComponentDependencies = useCallback((componentId: string) => {
    const component = components.current.get(componentId);
    if (!component) return [];

    return component.dependencies
      .map((depId) => components.current.get(depId))
      .filter(Boolean) as ComponentMetadata[];
  }, []);

  // Get components that depend on this component
  const getComponentsThatDependOn = useCallback((componentId: string) => {
    return Array.from(components.current.values()).filter((c) =>
      c.dependencies.includes(componentId),
    );
  }, []);

  // Get related components
  const getRelatedComponents = useCallback(
    (componentId: string) => {
      const component = components.current.get(componentId);
      if (!component) return [];

      const related = new Set<ComponentMetadata>();

      // Add components of same type
      getComponentsByType(component.type).forEach((c) => {
        if (c.id !== componentId) related.add(c);
      });

      // Add components of same category
      getComponentsByCategory(component.category).forEach((c) => {
        if (c.id !== componentId) related.add(c);
      });

      // Add components with shared capabilities
      Array.from(components.current.values()).forEach((c) => {
        if (
          c.id !== componentId &&
          c.capabilities.some((cap) => component.capabilities.includes(cap))
        ) {
          related.add(c);
        }
      });

      return Array.from(related);
    },
    [getComponentsByType, getComponentsByCategory],
  );

	  // Components that never reported any props (helps detect missing integration/prop wiring)
	  const getComponentsMissingProps = useCallback(() => {
	    return Array.from(components.current.values()).filter(
	      (c) => !c.props || c.props.length === 0,
	    );
	  }, []);

  // Broadcast to all components
  const broadcastToAll = useCallback(
	    (event: string, data: any) => {
	      integration.emit(`broadcast:${event}`, data);
	      communication.sendBroadcast(event, data);
    },
    [integration, communication],
  );

  // Broadcast to components by type
  const broadcastToType = useCallback(
	    (type: string, event: string, data: any) => {
	      const componentsOfType = getComponentsByType(type);
      componentsOfType.forEach((component) => {
        communication.sendMessage({
          from: 'component-registry',
          to: component.id,
          type: event,
          data,
          priority: 'medium',
        });
      });
    },
    [communication, getComponentsByType],
  );

  // Broadcast to components by category
  const broadcastToCategory = useCallback(
	    (category: string, event: string, data: any) => {
	      const componentsInCategory = getComponentsByCategory(category);
      componentsInCategory.forEach((component) => {
        communication.sendMessage({
          from: 'component-registry',
          to: component.id,
          type: event,
          data,
          priority: 'medium',
        });
      });
    },
    [communication, getComponentsByCategory],
  );

  // Broadcast to components by profession
  const broadcastToProfession = useCallback(
	    (profession: string, event: string, data: any) => {
	      const componentsForProfession = getComponentsByProfession(profession);
      componentsForProfession.forEach((component) => {
        communication.sendMessage({
          from: 'component-registry',
          to: component.id,
          type: event,
          data,
          priority: 'medium',
        });
      });
    },
    [communication, getComponentsByProfession],
  );

  // Get component health
  const getComponentHealth = useCallback(() => {
    const allComponents = Array.from(components.current.values());
    return {
      total: allComponents.length,
      active: allComponents.filter((c) => c.status === 'active').length,
      inactive: allComponents.filter((c) => c.status === 'inactive').length,
      error: allComponents.filter((c) => c.status === 'error').length,
    };
  }, []);

  // Get inactive components
  const getInactiveComponents = useCallback(() => {
    return Array.from(components.current.values()).filter((c) => c.status === 'inactive');
  }, []);

  // Get error components
  const getErrorComponents = useCallback(() => {
    return Array.from(components.current.values()).filter((c) => c.status === 'error');
  }, []);

  // Update component health
  const updateComponentHealth = useCallback(() => {
    const now = Date.now();
    const inactiveThreshold = 60000; // 1 minute

    components.current.forEach((component, id) => {
      if (now - component.lastSeen > inactiveThreshold) {
        updateComponent(id, { status: 'inactive' });
      }
    });
  }, [updateComponent]);

  const contextValue: ComponentRegistryContextType = {
    registerComponent,
    unregisterComponent,
    updateComponent,
    getComponent,
    getAllComponents,
    getComponentsByType,
    getComponentsByCategory,
    getComponentsByProfession,
    searchComponents,
    getComponentDependencies,
    getComponentsThatDependOn,
    getRelatedComponents,
	    getComponentsMissingProps,
    broadcastToAll,
    broadcastToType,
    broadcastToCategory,
    broadcastToProfession,
    getComponentHealth,
    getInactiveComponents,
    getErrorComponents,
  };

  return (
    <ComponentRegistryContext.Provider value={contextValue}>
      {children}
    </ComponentRegistryContext.Provider>
  );
};

// Hook to use component registry
export const useComponentRegistry = () => {
  const context = useContext(ComponentRegistryContext);
  if (!context) {
    throw new Error('useComponentRegistry must be used within ComponentRegistryProvider');
  }
  return context;
};

export default ComponentRegistryProvider;
