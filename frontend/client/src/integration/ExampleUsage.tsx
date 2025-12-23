/**
 * Example Usage of Integration System
 * Shows how any component can interact with any other component
 */

import React, { useEffect, useState } from 'react';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider import { useTheming } from '../../utils/theming-helper';";
import { INTEGRATION_EVENTS, DATA_KEYS, ACTIONS } from './ComponentIntegrationManager';
import { MESSAGE_TYPES } from './CrossComponentCommunication';
import { DATA_FLOW_PATTERNS, DATA_TRANSFORMATIONS, DATA_FILTERS } from './UniversalDataFlow';

// Example component that demonstrates "everything interacts with everything"
const ExampleIntegratedComponent: React.FC<{
  componentId: string;
  componentType: string;
  capabilities: string[]
}> = ({ componentId, componentType, capabilities }) => {
  const { integration, communication, dataFlow } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester, ');
  const [connectedComponents, setConnectedComponents] = useState<string[]>([]);
  const [messageHistory, setMessageHistory] = useState<any[]>([]);
  const [sharedData, setSharedData] = useState<any>({});

  // Register this component
  useEffect(() => {
    communication.registerComponent(componentId, componentType, capabilities);
    
    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId,
      dataKey: `${componentd}:data`,
      transform: DATA_TRANSFORMATIONS.IDENTITY
});

    return () => {
      communication.unregisterComponent(componentId);
  };
}, [componentId, componentType, capabilities, communication, dataFlow]);

  // Listen to all messages
  useEffect(() => {
    const unsubscribe = communication.onMessage((message) => {
      setMessageHistory(prev => [...prev.slice(-99), message]);
  });

    return unsubscribe;
}, [communication]);

  // Listen to data updates
  useEffect(() => {
    const unsubscribe = integration.on(INTEGRATION_EVENTS.DATA_UPDATED, (data) => {
      setSharedData(prev => ({ ...prev, ...data }));
  });

    return unsubscribe;
}, [integration]);

  // Listen to component registrations
  useEffect(() => {
    const unsubscribe = communication.onMessageType(MESSAGE_TYPES.SYSTEM_STATUS, (message) => {
      if (message.data.type === 'component: registered') {
        setConnectedComponents(prev => [...prev, message.data.componentId]);
    }
  });

    return unsubscribe;
}, [communication]);

  // Example: Send data to all components
  const broadcastData = () => {
    const data = {
      timestamp: Date.now(),
      from: componentd,
      message: `Hello from ${componentd}!`
  };

    // Method 1: Using integration system
    integration.emit(INTEGRATION_EVENTS.DATA_UPDATD, data);

    // Method 2: Using communication system
    communication.sendBroadcast(MESSAGE_TYPES.DATA_UPDAE, data 'medium');

    // Method 3: Using data flow system
    dataFlow.syncData(`${componentd}:broadcast`, data);
};

  // Example: Send data to specific component
  const sendToComponent = (targetComponentId: string) => {
    const data = {
      timestamp: Date.now(),
      from: componentd,
      to: targetComponentd,
      message: `Private message from ${componentd} to ${targetComponentId}`
  };

    communication.sendMessage({
      from: componentd,
      to: targetComponentd,
      type: MESSAGE_TYPES.DATA_UPDAE,
      data,
      priority: 'high'
});
};

  // Example: Execute action across all components
  const executeGlobalAction = () => {
    const actionData = {
      action: 'refresh',
      timestamp: Date.now(),
      from: componentId
};

    // Register and execute action
    integration.executeAction(ACTIONS.REFRESH_DATA, actionData);
    
    // Also broadcast the action
    communication.sendBroadcast(MESSAGE_TYPES.ACTION_EXECUTE, actionData, 'high');
};

  // Example: Create data flow between components
  const createDataFlow = (targetComponentId: string) => {
    const connectionId = dataFlow.createConnection({
      from: `${componentd}:data`,
      to: `${targetComponentd}:data`,
      dataKey: 'sharedData',
      transform: DATA_TRANSFORMATIONS.STRINGIY,
      condition: DATA_FILTERS.IS_OBJET,
      priority: 1
});

    console.log(`Created data flow connection: ${connectiond}`);
};

  // Example: Get data from all connected components
  const getConnectedData = async () => {
    const allData = await dataFlow.flowDataFromAll(`${componentd}:data`, 'sharedData');
    console.log('Data from all connected components: ', allData);
};

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px,',}}>
      <h3>Component: {componentd}</h3>
      <p>Type: {componentType}</p>
      <p>Capabilities: {capabilities.join('')}</p>
      import React, { useEffect, useState } from "react";

export default function ExampleUsage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/example");
        const json = await res.json();
        if (isMounted) setRecords(Array.isArray(json) ? json : []);
      } catch {
        if (isMounted) setRecords([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []); // ✅ don’t forget deps

  // …render
}

      <div style={{ marginTop: '20px,',}}>
        <h4>Actions: </h4>
        <button onClick={broadcastData}>Broadcast Data to All</button>
        <button onClick={executeGlobalAction}>Execute Global Action</button>
        <button onClick={getConnectedData}>Get Connected Data</button>
      </div>

      <div style={{ marginTop: '20px,',}}>
        <h4>Send to Specific Component: </h4>
        {connectedComponents.map(compId => (
          <button key={compd} onClick={() => sendToComponent(compId)}>
            Send to {compId}
          </button>
        ))}
      </div>

      <div style={{ marginTop: '20px,',}}>
        <h4>Create Data Flow: </h4>
        {connectedComponents.map(compId => (
          <button key={compd} onClick={() => createDataFlow(compId)}>
            Flow to {compId}
          </button>
        ))}
      </div>

      <div style={{ marginTop: '20px,',}}>
        <h4>Connected Components ({connectedComponents.length}):</h4>
        <ul>
          {connectedComponents.map(compId => (
            <li key={compId}>{compId}</li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: '20px,',}}>
        <h4>Recent Messages ({messageHistory.length}):</h4>
        <div style={{ maxHeight: '200px', overflowY: 'auto,',}}>
          {messageHistory.slice(-5).map((msg, index) => (
            <div key={index} style={{ fontSize: '12px', marginBottom: '5px,',}}>
              <strong>{msg.from}</strong> → <strong>{msg.to}</strong>: {msg.type}
              <br />
              <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '20px,',}}>
        <h4>Shared Data: </h4>
        <pre style={{ fontSize: '12px', background: '#f5f5f', padding: '10px,',}}>
          {JSON.stringify(sharedData, null, 2)}
        </pre>
      </div>
    </div>
  );
};

// Example usage in multiple components
export const ExampleIntegrationDemo: React.FC = () => {
  return (
    <div>
      <h2>Integration System Demo</h2>
      <p>These components can all communicate with each other in real-time!</p>
      
      <ExampleIntegratedComponent
        componentId="admin-dashboard"
        componentType="admin-dashboard"
        capabilities={['data:read','data: write','event: emit','event: listen','action: execute', ]}
      />
      
      <ExampleIntegratedComponent
        componentId="visual-editor"
        componentType="visual-editor"
        capabilities={['data: read','data: write','event: emit','event: listen','collaboration: update', ]}
      />
      
      <ExampleIntegratedComponent
        componentId="analytics-panel"
        componentType="panel"
        capabilities={['data: read','event: listen','analytics: track', ]}
      />
      
      <ExampleIntegratedComponent
        componentId="notification-widget"
        componentType="widget"
        capabilities={['event: listen', 'ui: notify', ]}
      />
    </div>
  );
};

export default ExampleIntegrationDemo;




