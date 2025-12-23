/**
 * Node Types Index
 * Central export for all node types in the wiring system
 */

// Base node
export * from './BaseNode';
export { default as BaseNode } from './BaseNode';

// Event nodes
export * from './EventNodes';
export { default as EVENT_NODE_DEFINITIONS } from './EventNodes';

// Logic nodes
export * from './LogicNodes';
export { default as LOGIC_NODE_DEFINITIONS } from './LogicNodes';

// Database nodes
export * from './DatabaseNodes';
export { default as DATABASE_NODE_DEFINITIONS } from './DatabaseNodes';

// Data Transform nodes
export * from './DataTransformNodes';
export { default as DATA_TRANSFORM_NODE_DEFINITIONS } from './DataTransformNodes';

// API nodes
export * from './APINodes';
export { default as API_NODE_DEFINITIONS } from './APINodes';

// Environment nodes
export * from './EnvironmentNodes';
export { default as ENVIRONMENT_NODE_DEFINITIONS } from './EnvironmentNodes';

// Documentation nodes
export * from './DocumentationNodes';
export { default as DOCUMENTATION_NODE_DEFINITIONS } from './DocumentationNodes';

// Animation nodes
export * from './AnimationNodes';
export { default as ANIMATION_NODE_DEFINITIONS } from './AnimationNodes';

// Validation nodes
export * from './ValidationNodes';
export { default as VALIDATION_NODE_DEFINITIONS } from './ValidationNodes';

// State nodes
export * from './StateNodes';
export { default as STATE_NODE_DEFINITIONS } from './StateNodes';

// Utility nodes
export * from './UtilityNodes';
export { default as UTILITY_NODE_DEFINITIONS } from './UtilityNodes';

// Theme nodes
export * from './ThemeNodes';
export { default as THEME_NODE_DEFINITIONS } from './ThemeNodes';

// i18n nodes
export * from './I18nNodes';
export { default as I18N_NODE_DEFINITIONS } from './I18nNodes';

// AI nodes
export * from './AINodes';
export { default as AI_NODE_DEFINITIONS } from './AINodes';

// Import all node definitions
import EVENT_NODE_DEFINITIONS from './EventNodes';
import LOGIC_NODE_DEFINITIONS from './LogicNodes';
import DATABASE_NODE_DEFINITIONS from './DatabaseNodes';
import DATA_TRANSFORM_NODE_DEFINITIONS from './DataTransformNodes';
import API_NODE_DEFINITIONS from './APINodes';
import ENVIRONMENT_NODE_DEFINITIONS from './EnvironmentNodes';
import DOCUMENTATION_NODE_DEFINITIONS from './DocumentationNodes';
import ANIMATION_NODE_DEFINITIONS from './AnimationNodes';
import VALIDATION_NODE_DEFINITIONS from './ValidationNodes';
import STATE_NODE_DEFINITIONS from './StateNodes';
import UTILITY_NODE_DEFINITIONS from './UtilityNodes';
import THEME_NODE_DEFINITIONS from './ThemeNodes';
import I18N_NODE_DEFINITIONS from './I18nNodes';
import AI_NODE_DEFINITIONS from './AINodes';

// Combined node library
export const ALL_NODE_DEFINITIONS = [
  ...EVENT_NODE_DEFINITIONS,
  ...LOGIC_NODE_DEFINITIONS,
  ...DATABASE_NODE_DEFINITIONS,
  ...DATA_TRANSFORM_NODE_DEFINITIONS,
  ...API_NODE_DEFINITIONS,
  ...ENVIRONMENT_NODE_DEFINITIONS,
  ...DOCUMENTATION_NODE_DEFINITIONS,
  ...ANIMATION_NODE_DEFINITIONS,
  ...VALIDATION_NODE_DEFINITIONS,
  ...STATE_NODE_DEFINITIONS,
  ...UTILITY_NODE_DEFINITIONS,
  ...THEME_NODE_DEFINITIONS,
  ...I18N_NODE_DEFINITIONS,
  ...AI_NODE_DEFINITIONS,
];

// Node categories
export const NODE_CATEGORIES = {
  events: {
    name: 'Events',
    color: '#4caf50',
    description: 'DOM and component event handlers',
    nodes: EVENT_NODE_DEFINITIONS,
  },
  logic: {
    name: 'Logic',
    color: '#9c27b0',
    description: 'Conditional logic and flow control',
    nodes: LOGIC_NODE_DEFINITIONS,
  },
  database: {
    name: 'Database',
    color: '#00bcd4',
    description: 'Database operations (Neon/PostgreSQL)',
    nodes: DATABASE_NODE_DEFINITIONS,
  },
  data: {
    name: 'Data Transform',
    color: '#2196f3',
    description: 'Data transformation and manipulation',
    nodes: DATA_TRANSFORM_NODE_DEFINITIONS,
  },
  api: {
    name: 'API',
    color: '#ff9800',
    description: 'API calls and integrations',
    nodes: API_NODE_DEFINITIONS,
  },
  env: {
    name: 'Environment',
    color: '#607d8b',
    description: 'Environment variables and configuration',
    nodes: ENVIRONMENT_NODE_DEFINITIONS,
  },
  docs: {
    name: 'Documentation',
    color: '#795548',
    description: 'Auto-documentation generation',
    nodes: DOCUMENTATION_NODE_DEFINITIONS,
  },
  animation: {
    name: 'Animation',
    color: '#f44336',
    description: 'Animation triggers and timelines',
    nodes: ANIMATION_NODE_DEFINITIONS,
  },
  validation: {
    name: 'Validation',
    color: '#8bc34a',
    description: 'Form and data validation',
    nodes: VALIDATION_NODE_DEFINITIONS,
  },
  state: {
    name: 'State',
    color: '#3f51b5',
    description: 'State management and storage',
    nodes: STATE_NODE_DEFINITIONS,
  },
  utility: {
    name: 'Utility',
    color: '#9e9e9e',
    description: 'Utility and helper nodes',
    nodes: UTILITY_NODE_DEFINITIONS,
  },
  theme: {
    name: 'Theme',
    color: '#ff5722',
    description: 'Theme and style connections',
    nodes: THEME_NODE_DEFINITIONS,
  },
  i18n: {
    name: 'i18n',
    color: '#009688',
    description: 'Internationalization and translations',
    nodes: I18N_NODE_DEFINITIONS,
  },
  ai: {
    name: 'AI',
    color: '#e91e63',
    description: 'AI-powered suggestions and generation',
    nodes: AI_NODE_DEFINITIONS,
  },
  component: {
    name: 'Component',
    color: '#673ab7',
    description: 'Component references and props',
    nodes: [],
  },
};

// Get node definition by type
export function getNodeDefinition(type: string) {
  return ALL_NODE_DEFINITIONS.find(node => node.type === type);
}

// Get nodes by category
export function getNodesByCategory(category: string) {
  return ALL_NODE_DEFINITIONS.filter(node => node.category === category);
}

// Get all categories with their nodes
export function getAllCategories() {
  return Object.entries(NODE_CATEGORIES).map(([key, value]) => ({
    id: key,
    ...value,
    nodeCount: value.nodes.length,
  }));
}

// Check if a connection is valid based on data types
export function isValidConnection(
  sourceDataType: string,
  targetDataType: string
): boolean {
  // Any can connect to anything
  if (sourceDataType === 'any' || targetDataType === 'any') return true;
  
  // Same types can always connect
  if (sourceDataType === targetDataType) return true;
  
  // Event can trigger any input
  if (sourceDataType === 'event') return true;
  
  // Number can convert to string
  if (sourceDataType === 'number' && targetDataType === 'string') return true;
  
  // Array and object are compatible in some cases
  if (
    (sourceDataType === 'array' && targetDataType === 'object') ||
    (sourceDataType === 'object' && targetDataType === 'array')
  ) return true;
  
  return false;
}

export default ALL_NODE_DEFINITIONS;

