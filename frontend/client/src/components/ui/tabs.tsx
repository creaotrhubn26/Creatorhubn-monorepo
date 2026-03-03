import * as React from 'react';
import { Box, Tab, Tabs as MuiTabs, type TabsProps as MuiTabsProps } from '@mui/material';

interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(componentName: string): TabsContextValue {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error(`${componentName} must be used within <Tabs>`);
  }
  return context;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({ value, defaultValue = '', onValueChange, className, children }: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value ?? internalValue;

  const handleChange = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [onValueChange, value],
  );

  return (
    <TabsContext.Provider value={{ value: currentValue, onChange: handleChange }}>
      <Box className={className}>{children}</Box>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends Omit<MuiTabsProps, 'value' | 'onChange'> {
  children: React.ReactNode;
  className?: string;
}

export function TabsList({ children, className, ...props }: TabsListProps) {
  const { value, onChange } = useTabsContext('TabsList');
  return (
    <MuiTabs
      {...props}
      value={value}
      className={className}
      onChange={(_event, nextValue: string) => onChange(nextValue)}
      variant={props.variant ?? 'scrollable'}
      scrollButtons={props.scrollButtons ?? 'auto'}
    >
      {children}
    </MuiTabs>
  );
}

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  return <Tab value={value} label={children} className={className} />;
}

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const context = useTabsContext('TabsContent');
  const isActive = context.value === value;

  return (
    <Box role="tabpanel" hidden={!isActive} className={className} sx={{ pt: 2 }}>
      {isActive ? children : null}
    </Box>
  );
}

export default Tabs;
