/**
 * Universal Data Flow System
 * Enables seamless data sharing between all components
 */

import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useIntegration } from './ComponentIntegrationManager';
import { useCommunication } from './CrossComponentCommunication';

// Data flow types
export interface DataFlowNode {
  id: string;
  type: 'source' | 'processor' | 'destination';
  componentId: string;
  dataKey: string;
  transform?: (data: any) => any;
  filter?: (data: any) => boolean;
  dependencies?: string[];
}

export interface DataFlowConnection {
  id: string;
  from: string;
  to: string;
  dataKey: string;
  transform?: (data: any) => any;
  condition?: (data: any) => boolean;
  priority: number;
}

export interface DataFlowEvent {
  id: string;
  type: 'data:flow' | 'data:transform' | 'data:filter' | 'data:sync';
  source: string;
  destination: string;
  data: any;
  timestamp: number;
  success: boolean;
  error?: string;
}

// Data flow context
interface DataFlowContextType {
  // Node management
  registerNode: (node: Omit<DataFlowNode, 'id'>) => string;
  unregisterNode: (nodeId: string) => void;
  updateNode: (nodeId: string, updates: Partial<DataFlowNode>) => void;
  getNode: (nodeId: string) => DataFlowNode | undefined;
  getNodesByComponent: (componentId: string) => DataFlowNode[];
  
  // Connection management
  createConnection: (connection: Omit<DataFlowConnection, 'id'>) => string;
  removeConnection: (connectionId: string) => void;
  getConnections: (from?: string, to?: string) => DataFlowConnection[];
  
  // Data flow execution
  flowData: (from: string, to: string, data: any) => Promise<boolean>;
  flowDataToAll: (from: string, data: any) => Promise<boolean[]>;
  flowDataFromAll: (to: string, dataKey: string) => Promise<any[]>;
  
  // Data transformation
  transformData: (data: any, transform: (data: any) => any) => any;
  filterData: (data: any, filter: (data: any) => boolean) => any;
  
  // Data synchronization
  syncData: (dataKey: string, data: any) => Promise<void>;
  getSyncedData: (dataKey: string) => any;
  
  // Event handling
  onDataFlow: (callback: (event: DataFlowEvent) => void) => () => void;
  getDataFlowHistory: () => DataFlowEvent[]
}

const DataFlowContext = createContext<DataFlowContextType | null>(null);

// Data Flow Provider
export const DataFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const integration = useIntegration();
  const communication = useCommunication();
  
  const nodes = useRef<Map<string, DataFlowNode>>(new Map());
  const connections = useRef<Map<string, DataFlowConnection>>(new Map());
  const dataFlowHistory = useRef<DataFlowEvent[]>([]);
  const dataFlowListeners = useRef<Set<(event: DataFlowEvent) => void>>(new Set());
  const syncedData = useRef<Map<string, any>>(new Map());

  // Generate unique ID
  const generateId = useCallback(() => {
    return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}, []);

  // Register data flow node
  const registerNode = useCallback((node: Omit<DataFlowNode, 'id'>) => {
    const nodeId = generateId();
    const fullNode: DataFlowNode = {
      ...node,
      id: nodeId
};
    
    nodes.current.set(nodeId, fullNode);
    
    // Emit integration event
    integration.emit('dataflow: node:registered', fullNode);
    
    return nodeId;
}, [integration, generateId]);

  // Unregister data flow node
  const unregisterNode = useCallback((nodeId: string) => {
    const node = nodes.current.get(nodeId);
    if (node) {
      nodes.current.delete(nodeId);

      // Remove related connections
      Array.from(connections.current.entries()).forEach(([connectionId, connection]) => {
        if (connection.from === nodeId || connection.to === nodeId) {
          connections.current.delete(connectionId);
        }
      });

      // Emit integration event
      integration.emit('dataflow: node:unregistered', { nodeId });
    }
  }, [integration]);

  // Update data flow node
  const updateNode = useCallback((nodeId: string, updates: Partial<DataFlowNode>) => {
    const node = nodes.current.get(nodeId);
    if (node) {
      const updatedNode = { ...node, ...updates };
      nodes.current.set(nodeId, updatedNode);
      
      // Emit integration event
      integration.emit('dataflow: node:updated', updatedNode);
  }
}, [integration]);

  // Get data flow node
  const getNode = useCallback((nodeId: string) => {
    return nodes.current.get(nodeId);
}, []);

  // Get nodes by component
  const getNodesByComponent = useCallback((componentId: string) => {
    return Array.from(nodes.current.values()).filter(node => node.componentId === componentId);
}, []);

  // Create connection
  const createConnection = useCallback((connection: Omit<DataFlowConnection, 'id'>) => {
    const connectionId = generateId();
    const fullConnection: DataFlowConnection = {
      ...connection,
      id: connectionId
};
    
    connections.current.set(connectionId, fullConnection);
    
    // Emit integration event
    integration.emit('dataflow: connection:created', fullConnection);
    
    return connectionId;
}, [integration, generateId]);

  // Remove connection
  const removeConnection = useCallback((connectionId: string) => {
    const connection = connections.current.get(connectionId);
    if (connection) {
      connections.current.delete(connectionId);
      
      // Emit integration event
      integration.emit('dataflow:connection:removed', { connectionId });
  }
}, [integration]);

  // Get connections
  const getConnections = useCallback((from?: string, to?: string) => {
    return Array.from(connections.current.values()).filter(connection => {
      if (from && connection.from !== from) return false;
      if (to && connection.to !== to) return false;
      return true;
  });
}, []);

  // Flow data between nodes
  const flowData = useCallback(async (from: string, to: string, data: any): Promise<boolean> => {
    try {
      const fromNode = nodes.current.get(from);
      const toNode = nodes.current.get(to);
      
      if (!fromNode || !toNode) {
        throw new Error(`Node not found: ${from} or ${to}`);
    }

      // Find connection
      const connection = Array.from(connections.current.values()).find(
        conn => conn.from === from && conn.to === to
      );

      if (!connection) {
        throw new Error(`No connection found between ${from} and ${to}`);
    }

      // Apply transformations
      let transformedData = data;
      
      if (fromNode.transform) {
        transformedData = fromNode.transform(transformedData);
    }
      
      if (connection.transform) {
        transformedData = connection.transform(transformedData);
    }
      
      if (toNode.transform) {
        transformedData = toNode.transform(transformedData);
    }

      // Apply filters
      if (fromNode.filter && !fromNode.filter(transformedData)) {
        throw new Error(`Data filtered out by source node ${from}`);
    }
      
      if (connection.condition && !connection.condition(transformedData)) {
        throw new Error(`Data filtered out by connection condition`);
    }
      
      if (toNode.filter && !toNode.filter(transformedData)) {
        throw new Error(`Data filtered out by destination node ${to}`);
    }

      // Send data to destination
      integration.setData(toNode.dataKey, transformedData);
      
      // Send communication message
      communication.sendMessage({
        from: fromNode.componentId,
        to: toNode.componentId,
        type: 'data:flow',
        data: transformedData,
        priority: 'medium',
      });

      // Record event
      const event: DataFlowEvent = {
        id: generateId(),
        type: 'data:flow',
        source: from,
        destination: to,
        data: transformedData,
        timestamp: Date.now(),
        success: true,
      };
      
      dataFlowHistory.current.push(event);
      dataFlowListeners.current.forEach(listener => listener(event));

      return true;
  } catch (error) {
      // Record error event
      const event: DataFlowEvent = {
        id: generateId(),
        type: 'data:flow',
        source: from,
        destination: to,
        data,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      dataFlowHistory.current.push(event);
      dataFlowListeners.current.forEach(listener => listener(event));

      return false;
  }
}, [integration, communication, generateId]);

  // Flow data to all connected nodes
  const flowDataToAll = useCallback(async (from: string, data: any): Promise<boolean[]> => {
    const outgoingConnections = getConnections(from);
    const results = await Promise.all(
      outgoingConnections.map(connection => 
        flowData(from, connection.to, data)
      )
    );
    return results;
}, [getConnections, flowData]);

  // Flow data from all connected nodes
  const flowDataFromAll = useCallback(async (to: string, dataKey: string): Promise<any[]> => {
    const incomingConnections = getConnections(undefined, to);
    const results = await Promise.all(
      incomingConnections.map(async connection => {
        const fromNode = nodes.current.get(connection.from);
        if (fromNode) {
          return integration.getData(fromNode.dataKey);
      }
        return null;
    })
    );
    return results.filter(data => data !== null);
}, [getConnections, integration]);

  // Transform data
  const transformData = useCallback((data: any, transform: (data: any) => any) => {
    try {
      return transform(data);
} catch (error) {
      console.error('Data transformation error: ', error);
      return data;
  }
}, []);

  // Filter data
  const filterData = useCallback((data: any, filter: (data: any) => boolean) => {
    try {
      return filter(data) ? data : null;
} catch (error) {
      console.error('Data filtering error:', error);
      return null;
  }
}, []);

  // Sync data
  const syncData = useCallback(async (dataKey: string, data: any) => {
    syncedData.current.set(dataKey, data);
    integration.setData(dataKey, data);

    // Broadcast sync event
    communication.sendBroadcast('data:sync', { dataKey, data });
  }, [integration, communication]);

  // Get synced data
  const getSyncedData = useCallback((dataKey: string) => {
    return syncedData.current.get(dataKey);
}, []);

  // On data flow event
  const onDataFlow = useCallback((callback: (event: DataFlowEvent) => void) => {
    dataFlowListeners.current.add(callback);
    return () => dataFlowListeners.current.delete(callback);
}, []);

  // Get data flow history
  const getDataFlowHistory = useCallback(() => {
    return [...dataFlowHistory.current];
}, []);

  const contextValue: DataFlowContextType = {
    registerNode,
    unregisterNode,
    updateNode,
    getNode,
    getNodesByComponent,
    createConnection,
    removeConnection,
    getConnections,
    flowData,
    flowDataToAll,
    flowDataFromAll,
    transformData,
    filterData,
    syncData,
    getSyncedData,
    onDataFlow,
    getDataFlowHistory
};

  return (
    <DataFlowContext.Provider value={contextValue}>
      {children}
    </DataFlowContext.Provider>
  );
};

// Hook to use data flow system
export const useDataFlow = () => {
  const context = useContext(DataFlowContext);
  if (!context) {
    throw new Error('useDataFlow must be used within DataFlowProvider');
}
  return context;
};

// Pre-defined data flow patterns
export const DATA_FLOW_PATTERNS = {
  // One-to-one
  DIRECT: 'direct',
  // One-to-many
  BROADCAST: 'broadcast',
  // Many-to-one
  AGGREGATE: 'aggregate',
  // Many-to-many
  MESH: 'mesh',
  // Chain
  PIPELINE: 'pipeline',
  // Tree
  HIERARCHY: ', '
};

// Pre-defined data transformations
export const DATA_TRANSFORMATIONS = {
  // Simple transformations
  IDENTITY: (data: any) => data,
  STRINGIFY: (data: any) => JSON.stringify(data),
  PARSE: (data: any) => JSON.parse(data),
  
  // Data type transformations
  TO_STRING: (data: any) => String(data),
  TO_NUMBER: (data: any) => Number(data),
  TO_BOOLEAN: (data: any) => Boolean(data),
  
  // Array transformations
  ARRAY_FILTER: (predicate: (item: any) => boolean) => (data: any[]) => data.filter(predicate),
  ARRAY_MAP: (mapper: (item: any) => any) => (data: any[]) => data.map(mapper),
  ARRAY_REDUCE: (reducer: (acc: any, item: any) => any, initial: any) => (data: any[]) => data.reduce(reducer, initial),
  
  // Object transformations
  OBJECT_PICK: (keys: string[]) => (data: any) => {
    const result: any = {};
    keys.forEach(key => {
      if (key in data) result[key] = data[key];
  });
    return result;
},
  OBJECT_OMIT: (keys: string[]) => (data: any) => {
    const result = { ...data };
    keys.forEach(key => delete result[key]);
    return result;
}
};

// Pre-defined data filters
export const DATA_FILTERS = {
  // Type filters
  IS_STRING: (data: any) => typeof data === 'string',
  IS_NUMBER: (data: any) => typeof data === 'number',
  IS_BOOLEAN: (data: any) => typeof data === 'boolean',
  IS_OBJECT: (data: any) => typeof data ==='object' && data !== null,
  IS_ARRAY: (data: any) => Array.isArray(data),
  
  // Value filters
  IS_TRUTHY: (data: any) => Boolean(data),
  IS_FALSY: (data: any) => !Boolean(data),
  IS_EMPTY: (data: any) => data === null || data === undefined || data ==='',
  
  // Custom filters
  CUSTOM: (predicate: (data: any) => boolean) => predicate
};

export default DataFlowProvider;




