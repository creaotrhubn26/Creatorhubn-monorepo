// @ts-nocheck
/**
 * Sentry Integration Example
 * 
 * This file shows how to integrate Sentry throughout your application.
 * Copy the relevant parts to your actual components.
 */

import React, { useEffect } from 'react';
import { 
  initSentry, 
  setSentryUser, 
  addSentryBreadcrumb,
  captureErrorToSentry,
  setSentryTags,
  setSentryContext,
} from './utils/sentry';

/**
 * Example 1: Initialize Sentry in main.tsx or App.tsx
 */
export const initializeApp = () => {
  // Initialize Sentry first thing
  initSentry();
  
  console.log('App initialized with Sentry');
};

/**
 * Example 2: Set user context when user logs in
 */
export const handleUserLogin = (user: any) => {
  // Set user context in Sentry
  setSentryUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
  
  // Set custom tags
  setSentryTags({
    userType: user.role || 'user',
    subscription: user.subscriptionTier || 'free',
  });
  
  // Add breadcrumb
  addSentryBreadcrumb({
    category: 'auth',
    message: 'User logged in successfully',
    level: 'info',
    data: { userId: user.id },
  });
};

/**
 * Example 3: Clear user context when user logs out
 */
export const handleUserLogout = () => {
  addSentryBreadcrumb({
    category: 'auth',
    message: 'User logged out',
    level: 'info',
  });
  
  // Clear user context
  setSentryUser(null);
};

/**
 * Example 4: Track user actions with breadcrumbs
 */
export const ExampleComponent: React.FC = () => {
  const handleButtonClick = () => {
    addSentryBreadcrumb({
      category: 'user-action',
      message: 'User clicked submit button',
      level: 'info',
      data: { buttonId: 'submit-course' },
    });
    
    // ... your logic
  };
  
  const handleNavigation = (page: string) => {
    addSentryBreadcrumb({
      category: 'navigation',
      message: `User navigated to ${page}`,
      level: 'info',
      data: { page },
    });
  };
  
  return (
    <div>
      <button onClick={handleButtonClick}>Submit</button>
    </div>
  );
};

/**
 * Example 5: Capture errors manually
 */
export const handleApiCall = async () => {
  try {
    const response = await fetch('/api/courses');
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    // Capture error to Sentry with context
    captureErrorToSentry(error as Error, {
      endpoint: '/api/courses',
      method: 'GET',
      timestamp: new Date().toISOString(),
    });
    
    throw error; // Re-throw to handle in UI
  }
};

/**
 * Example 6: Set context for specific features
 */
export const CourseCreatorWithContext: React.FC<{ courseId: string }> = ({ courseId }) => {
  useEffect(() => {
    // Set context when component mounts
    setSentryContext('course', {
      courseId,
      feature: 'course-creator',
      timestamp: new Date().toISOString(),
    });
    
    addSentryBreadcrumb({
      category: 'navigation',
      message: 'Opened course creator',
      level: 'info',
      data: { courseId },
    });
    
    // Clear context when component unmounts
    return () => {
      setSentryContext('course', null);
    };
  }, [courseId]);
  
  return <div>Course Creator</div>;
};

/**
 * Example 7: Wrap your app with ErrorBoundary
 */
import ErrorBoundary from './components/common/ErrorBoundary';

export const App: React.FC = () => {
  useEffect(() => {
    // Initialize Sentry on app mount
    initSentry();
  }, []);
  
  return (
    <ErrorBoundary 
      showDetails={import.meta.env.MODE === 'development'}
      componentName="App"
    >
      {/* Your app content */}
    </ErrorBoundary>
  );
};

/**
 * Example 8: Nested ErrorBoundaries for specific features
 */
export const AcademySection: React.FC = () => {
  return (
    <ErrorBoundary
      showDetails={true}
      componentName="AcademySection"
      context={{
        feature: 'academy',
        version: '2.0',
      }}
    >
      {/* Academy components */}
    </ErrorBoundary>
  );
};

