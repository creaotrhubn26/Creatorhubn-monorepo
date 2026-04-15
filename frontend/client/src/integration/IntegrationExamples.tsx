// @ts-nocheck
/**
 * Integration Examples
 * Examples of how to use the EnhancedMasterIntegrationProvider with essential dependencies
 */

import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { 
  useEnhancedMasterIntegration, 
  useEssentialDependencies,
  withEssentialDependencies 
} from './EnhancedMasterIntegrationProvider';
import { useIntegratedComponent } from './IntegrationTemplate';

// Example 1: Using the hook directly
export const ExampleComponentWithHook: React.FC = () => {
  const { visualEditor, auth, analytics, performance } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  const handleClick = () => {
    // Use visual editor for toast notifications
    visualEditor.showToast('Button clicked!, ', 'success,');
    
    // Track analytics
    analytics.trackEvent('button_clicked, ', { component: 'ExampleComponentWithHook,',});
    
    // Performance timing
    const endTiming = performance.startTiming('button_click_processing');
    // ... do some work
    endTiming();
};

  return (
    <div>
      <h3>Example with Hook</h3>
      <p>Authenticated: {auth.isAuthenticated ? 'Yes' : 'N'}</p>
      <button onClick={handleClick}>Click Me</button>
    </div>
  );
};

// Example 2: Using essential dependencies hook
export const ExampleComponentWithEssentialDeps: React.FC = () => {
  const { 
    showToast, 
    getAuthHeader, 
    isAuthenticated, 
    analytics,
    getIcon,
    getProjectCategoryIcon,
    CREATOR_HUB_ICONS,
    getToastTemplate,
    getAllToastTemplates,
    createToastTemplate,
    academyToastTemplates
} = useEssentialDependencies();
  
  const handleApiCall = async () => {
    try {
      const authHeader = getAuthHeader();
      // Make API call with auth header
      showToast('API call successful!, ','success');
      analytics.trackEvent('api_call_success', { endpoint: '/api/example,',});
  } catch (error) {
      showToast('API call failed!, ','error');
      analytics.trackEvent('api_call_error', { error: error.message });
  }
};

  const handleCreateCustomToast = () => {
    // Create a custom toast template
    const customTemplate = {
      id: 'custom-example',
      name: 'Custom Example Toast',
      description: 'A custom toast template created via integration',
      config: {
        message: 'This is a custom toast, !, ',
        type: 'info',
        style: {
          backgroundColor: '#2196f',
          textColor: '#ffffff',
          borderRadius: 12
      }
    }
  };
    
    createToastTemplate(customTemplate);
    showToast('Custom template created!, ','success');
};

  const handleShowAcademyToast = () => {
    // Get an academy toast template
    const academyTemplate = academyToastTemplates[0];
    if (academyTemplate) {
      showToast(academyTemplate.config.message, academyTemplate.config.type);
  }
};

  // Get icons
  const AcademyIcon = getIcon('academy');
  const CourseIcon = getIcon('course');
  const PhotographyIcon = getProjectCategoryIcon('photography');

  // Get all available templates
  const allTemplates = getAllToastTemplates();

  return (
    <div>
      <h3>Example with Essential Dependencies</h3>
      <p>Authenticated: {isAuthenticated ? 'Yes' : 'N'}</p>
      <p>Available Templates: {allTemplates.length}</p>
      <p>Academy Templates: {academyToastTemplates.length}</p>
      
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px,',}}>
        <AcademyIcon />
        <CourseIcon />
        <PhotographyIcon />
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px,',}}>
        <button onClick={handleApiCall}>Make API Call</button>
        <button onClick={handleCreateCustomToast}>Create Custom Toast</button>
        <button onClick={handleShowAcademyToast}>Show Academy Toast</button>
      </div>
    </div>
  );
};

// Example 3: Using integrated component hook
export const ExampleComponentWithIntegratedHook: React.FC = () => {
  const {
    visualEditor,
    auth,
    analytics,
    performance,
    debugging
} = useIntegratedComponent('example-integrated-component','example');

  const handleComplexAction = () => {
    const endTiming = performance.startTiming('complex_action');
    
    try {
      // Do complex work
      visualEditor.showToast('Complex action completed!, ','success');
      analytics.trackEvent('complex_action_success', { component: 'example-integrated-component,',});
  } catch (error) {
      visualEditor.showToast('Complex action failed!, ','error');
      debugging.logIntegration('error','Complex action failed', error);
  } finally {
      endTiming();
  }
};

  return (
    <div>
      <h3>Example with Integrated Hook</h3>
      <p>Component registered with lifecycle management</p>
      <button onClick={handleComplexAction}>Complex Action</button>
    </div>
  );
};

// Example 4: Using HOC
interface ExampleHOCProps {
  title: string;
  onAction?: () => void;
}

const ExampleComponentForHOC: React.FC<ExampleHOCProps> = ({
  title,
  onAction,
  // These props are automatically injected by the HOC
  visualEditor,
  auth,
  showToast,
  getAuthHeader,
  isAuthenticated,
  analytics,
  performance,
  componentId,
  componentType
}) => {
  const handleAction = () => {
    showToast(`${title} action completed!`, 'success');
    analytics.trackEvent('hoc_action', { componentId, componentType, title });
    onAction?.();
};

  return (
    <div>
      <h3>{title}</h3>
      <p>Component ID: {componentId}</p>
      <p>Type: {componentType}</p>
      <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
      <button onClick={handleAction}>Action</button>
    </div>
  );
};

// Apply HOC with essential dependencies
export const ExampleComponentWithHOC = withEssentialDependencies(ExampleComponentForHOC, {
  componentId: 'example-hoc-component',
  componentType: 'example',
  enablePerformanceMonitoring: true,
  enableDebugLogging: true,
  enableAnalytics: true
});

// Example 5: Complete integration example
export const CompleteIntegrationExample: React.FC = () => {
  const {
    visualEditor,
    auth,
    analytics,
    performance,
    debugging,
    health,
    integration,
    communication,
    dataFlow
} = useEnhancedMasterIntegration();

  const [data, setData] = React.useState<any>(null);

  // Example of using all integration features
  const handleCompleteIntegration = async () => {
    const endTiming = performance.startTiming('complete_integration_example');
    
    try {
      // 1. Show loading toast
      const toastId = visualEditor.showToast('Processing..., ','info');
      
      // 2. Track analytics
      analytics.trackEvent('integration_started', { 
        component: 'CompleteIntegrationExample',
        timestamp: Date.now()
    ,});
      
      // 3. Use data flow
      const newData = await dataFlow.getData('example-data');
      setData(newData);
      
      // 4. Use communication
      communication.emit('data_updated', { data: newData });
      
      // 5. Use integration
      const result = await integration.executeAction('process_data', { data: newData });
      
      // 6. Hide loading toast and show success
      visualEditor.hideToast(toastId);
      visualEditor.showToast('Integration completed successfully!, ','success');
      
      // 7. Track success
      analytics.trackEvent('integration_completed', { 
        component: 'CompleteIntegrationExample',
        result: result
    ,});
      
      // 8. Debug logging
      debugging.logIntegration('info','Complete integration example finished', { result });
      
  } catch (error) {
      visualEditor.showToast('Integration failed!, ','error');
      debugging.logIntegration('error','Complete integration example failed', error);
      analytics.trackEvent('integration_failed', { 
        component: 'CompleteIntegrationExample',
        error: error.message
    ,});
  } finally {
      endTiming();
  }
};

  return (
    <div>
      <h3>Complete Integration Example</h3>
      <p>Health Status: {health.status}</p>
      <p>Authenticated: {auth.isAuthenticated ? 'Yes' : 'N'}</p>
      <p>Data: {data ? JSON.stringify(data) : 'No data'}</p>
      <button onClick={handleCompleteIntegration}>
        Run Complete Integration
      </button>
    </div>
  );
};

// Example 6: Custom hook for specific use case
export const useApiWithAuth = () => {
  const { getAuthHeader, showToast, analytics } = useEssentialDependencies();
  
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    try {
      const authHeader = getAuthHeader();
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...authHeader
      }
    });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
      
      const data = await response.json();
      showToast('Request successful!, ','success');
      analytics.trackEvent('api_request_success', { url, status: response.status });
      
      return data;
  } catch (error) {
      showToast(`Request failed: ${error.message}`, 'error');
      analytics.trackEvent('api_request_error', { url, error: error.message });
      throw error;
  }
};
  
  return { makeAuthenticatedRequest };
};

// Example component using the custom hook
export const ExampleWithCustomHook: React.FC = () => {
  const { makeAuthenticatedRequest } = useApiWithAuth();
  const [data, setData] = React.useState(null);
  
  const handleFetchData = async () => {
    try {
      const result = await makeAuthenticatedRequest('/api/data');
      setData(result);
  } catch (error) {
      console.error('Failed to fetch data: ', error);
  }
};
  
  return (
    <div>
      <h3>Example with Custom Hook</h3>
      <button onClick={handleFetchData}>Fetch Data</button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
};

// Example 7: Comprehensive icon usage
export const ExampleWithIcons: React.FC = () => {
  const { 
    getIcon, 
    getProjectCategoryIcon, 
    getProfessionIcon, 
    CREATOR_HUB_ICONS,
    showToast,
    analytics
} = useEssentialDependencies();

  const handleIconClick = (iconName: string) => {
    showToast(`${iconName} icon clicked!`, 'info');
    analytics.trackEvent('icon_clicked', { iconName });
};

  // Get various types of icons
  const AcademyIcon = getIcon('academy');
  const CourseIcon = getIcon('course');
  const VideoPlayerIcon = getIcon('videoPlayer');
  const PhotographyIcon = getProjectCategoryIcon('photography');
  const VideographyIcon = getProjectCategoryIcon('videography');
  const MusicIcon = getProjectCategoryIcon('music');
  const PhotographerIcon = getProfessionIcon('photographer');
  const VideographerIcon = getProfessionIcon('videographer');

  return (
    <div>
      <h3>Icon Usage Examples</h3>
      
      <div>
        <h4>Academy Icons</h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px,',}}>
          <AcademyIcon onClick={() => handleIconClick('academy')} style={{ cursor: 'pointer,',}} />
          <CourseIcon onClick={() => handleIconClick('course')} style={{ cursor: 'pointer,',}} />
          <VideoPlayerIcon onClick={() => handleIconClick('videoPlayer')} style={{ cursor: 'pointer,',}} />
        </div>
      </div>

      <div>
        <h4>Project Category Icons</h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px,',}}>
          <PhotographyIcon onClick={() => handleIconClick('photography')} style={{ cursor: 'pointer,',}} />
          <VideographyIcon onClick={() => handleIconClick('videography')} style={{ cursor: 'pointer,',}} />
          <MusicIcon onClick={() => handleIconClick('music')} style={{ cursor: 'pointer,',}} />
        </div>
      </div>

      <div>
        <h4>Profession Icons</h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px,',}}>
          <PhotographerIcon onClick={() => handleIconClick('photographer')} style={{ cursor: 'pointer,',}} />
          <VideographerIcon onClick={() => handleIconClick('videographer')} style={{ cursor: 'pointer,',}} />
        </div>
      </div>

      <div>
        <h4>Available Icons</h4>
        <p>Total icons available: {Object.keys(CREATOR_HUB_ICONS).length}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px,',}}>
          {Object.keys(CREATOR_HUB_ICONS).slice(0, 20).map((iconName) => {
            const IconComponent = getIcon(iconName as keyof typeof CREATOR_HUB_ICONS);
            return (
              <div 
                key={iconName} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
              ,}}
                onClick={() => handleIconClick(iconName)}
              >
                <IconComponent />
                <span style={{ fontSize: '10px', marginTop: '5px,',}}>{iconName}</span>
              </div>
            );
        })}
        </div>
      </div>
    </div>
  );
};

// Example 8: Comprehensive toast template usage
export const ExampleWithToastTemplates: React.FC = () => {
  const { 
    getToastTemplate,
    getAllToastTemplates,
    createToastTemplate,
    updateToastTemplate,
    deleteToastTemplate,
    academyToastTemplates,
    showToast,
    analytics
} = useEssentialDependencies();

  const [selectedTemplate, setSelectedTemplate] = React.useState<string>(', ');
  const [customTemplateName, setCustomTemplateName] = React.useState(', ');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = React.useState<string | null>(null);

  const allTemplates = getAllToastTemplates();

  const handleTemplateSelect = (templateId: string) => {
    const template = getToastTemplate(templateId);
    if (template) {
      setSelectedTemplate(templateId);
      showToast(template.config.message, template.config.type);
      analytics.trackEvent('toast_template_used', { templateId, templateName: template.name });
  }
};

  const handleCreateCustomTemplate = () => {
    if (!customTemplateName) return;

    const customTemplate = {
      id: `custom-${Date.now()}`,
      name: customTemplateName,
      description: 'A custom toast template created via integration',
      config: {
        message: `Hello from ${customTemplateName}!`,
        type: 'success',
        style: {
          backgroundColor: '#4caf5',
          textColor: '#ffffff',
          borderRadius:  12,
          boxShadow: '0 8px 24px rgba(6,175,80,0.3)'
      },
        actions: {
          enabled: true,
          buttons: [
            {
              id: 'action-',
              label: 'View Details',
              action: 'view-details',
              style: 'primary',
              color: '#ffffff'
          }
          ]
      }
    }
  };

    createToastTemplate(customTemplate);
    setCustomTemplateName(', ');
    showToast('Custom template created!, ','success');
    analytics.trackEvent('custom_toast_template_created', { templateName: customTemplateName });
};

  const handleUpdateTemplate = (templateId: string) => {
    const template = getToastTemplate(templateId);
    if (template) {
      const updatedTemplate = {
        ...template,
        config: {
          ...template.config,
          message: `${template.config.message} (Updated)`,
          style: {
            ...template.config.style,
            backgroundColor: '#ff9800'
        }
      }
    };
      
      updateToastTemplate(templateId, updatedTemplate);
      showToast('Template updated!, ','info');
      analytics.trackEvent('toast_template_updated', { templateId });
  }
};

  const handleDeleteTemplate = (templateId: string) => {
    setDeleteTemplateId(templateId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTemplate = () => {
    if (deleteTemplateId) {
      deleteToastTemplate(deleteTemplateId);
      if (selectedTemplate === deleteTemplateId) {
        setSelectedTemplate(', ');
      }
      showToast('Template deleted!, ','warning');
      analytics.trackEvent('toast_template_deleted', { templateId: deleteTemplateId });
    }
    setDeleteDialogOpen(false);
    setDeleteTemplateId(null);
  };

  return (
    <div>
      <h3>Toast Template Management Examples</h3>
      
      <div style={{ marginBottom: '20px,',}}>
        <h4>Template Statistics</h4>
        <p>Total Templates: {allTemplates.length}</p>
        <p>Academy Templates: {academyToastTemplates.length}</p>
        <p>Custom Templates: {allTemplates.length - academyToastTemplates.length}</p>
      </div>

      <div style={{ marginBottom: '20px,',}}>
        <h4>Create Custom Template</h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center,',}}>
          <input
            type="text"
            placeholder="Template name"
            value={customTemplateName}
            onChange={(e) => setCustomTemplateName(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc',}}
          />
          <button onClick={handleCreateCustomTemplate} disabled={!customTemplateName}>
            Create Template
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px,',}}>
        <h4>Academy Templates</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px,',}}>
          {academyToastTemplates.slice(0, 6).map((template) => (
            <div
              key={template.id}
              style={{
                padding: '10px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: selectedTemplate === template.id ? '#e3f2fd' : 'white'
            ,}}
              onClick={() => handleTemplateSelect(template.id)}
            >
              <h5>{template.name}</h5>
              <p style={{ fontSize: '12px', color: '#666,',}}>{template.description}</p>
              <div style={{ display: 'flex', gap: '5px', marginTop: '10px,',}}>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    backgroundColor: template.config.type === 'success' ? '#4caf50' :
                                   template.config.type === 'error' ? '#f44336' :
                                   template.config.type === 'warning' ? '#ff9800' : '#2196f',
                    color: 'white'
                ,}}
                >
                  {template.config.type}
                </span>
                {template.config.actions?.enabled && (
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      backgroundColor: '#9c27b0',
                      color: 'white'
                    }}
                  >
                    {template.config.actions.buttons?.length || 0} actions
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4>All Templates</h4>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {allTemplates.map((template) => (
            <div
              key={template.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px',
                border: '1px solid #eee',
                borderRadius: '4px',
                marginBottom: '5px',
                backgroundColor: selectedTemplate === template.id ? '#e3f2fd' : 'white'
              }}
            >
              <div style={{ flex: 1 }}>
                <h5 style={{ margin:  0 }}>{template.name}</h5>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{template.description}</p>
                <div style={{ display: 'flex', gap: '5px', marginTop: '5px',}}>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      backgroundColor: template.config.type === 'success' ? '#4caf50' :
                                     template.config.type === 'error' ? '#f44336' :
                                     template.config.type === 'warning' ? '#ff9800' : '#2196f3',
                      color: 'white'
                    }}
                  >
                    {template.config.type}
                  </span>
                  {template.id.startsWith('academy-') && (
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        backgroundColor: '#2196f3',
                        color: 'white'
                      }}
                    >
                      Academy
                    </span>
                  )}
                  {template.id.startsWith('custom-') && (
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        backgroundColor: '#ff9800',
                        color: 'white'
                      }}
                    >
                      Custom
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '5px',}}>
                <button
                  onClick={() => handleTemplateSelect(template.id)}
                  style={{ padding: '5px 10px', fontSize: '12px',}}
                >
                  Use
                </button>
                {template.id.startsWith('custom-') && (
                  <>
                    <button
                      onClick={() => handleUpdateTemplate(template.id)}
                      style={{ padding: '5px 10px', fontSize: '12px',}}
                    >
                      Update
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#f44336', color: 'white', border: 'none' }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default {
  ExampleComponentWithHook,
  ExampleComponentWithEssentialDeps,
  ExampleComponentWithIntegratedHook,
  ExampleComponentWithHOC,
  CompleteIntegrationExample,
  ExampleWithCustomHook
};
