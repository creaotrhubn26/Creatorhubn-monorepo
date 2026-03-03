import * as React from 'react';
import {
  FormControl,
  MenuItem,
  Select as MuiSelect,
  type SelectChangeEvent,
  type SelectProps as MuiSelectProps,
  Stack,
} from '@mui/material';

interface SelectItemData {
  value: string;
  label: React.ReactNode;
}

interface SelectContextValue {
  value: string;
  onValueChange: (nextValue: string) => void;
  items: SelectItemData[];
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(componentName: string): SelectContextValue {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error(`${componentName} must be used inside <Select>`);
  }
  return context;
}

function isSelectItemElement(node: React.ReactNode): node is React.ReactElement<SelectItemProps> {
  return React.isValidElement(node) && node.type === SelectItem;
}

function collectSelectItems(nodes: React.ReactNode): SelectItemData[] {
  const results: SelectItemData[] = [];
  React.Children.forEach(nodes, (child) => {
    if (!React.isValidElement(child)) return;
    if (isSelectItemElement(child)) {
      results.push({ value: child.props.value, label: child.props.children });
      return;
    }
    if (child.props.children) {
      results.push(...collectSelectItems(child.props.children));
    }
  });
  return results;
}

function isSelectValueElement(node: React.ReactNode): node is React.ReactElement<SelectValueProps> {
  return React.isValidElement(node) && node.type === SelectValue;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function Select({ value, defaultValue = '', onValueChange, disabled = false, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value ?? internalValue;
  const items = React.useMemo(() => collectSelectItems(children), [children]);

  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [onValueChange, value],
  );

  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleValueChange, items }}>
      <Stack direction="column" spacing={1} sx={{ minWidth: 120, opacity: disabled ? 0.7 : 1 }}>
        {children}
      </Stack>
    </SelectContext.Provider>
  );
}

export interface SelectTriggerProps extends Omit<MuiSelectProps<string>, 'value' | 'onChange' | 'children'> {
  children?: React.ReactNode;
  className?: string;
}

export const SelectTrigger = React.forwardRef<HTMLDivElement, SelectTriggerProps>(function SelectTrigger(
  { children, displayEmpty = true, className, ...props },
  ref,
) {
  const { value, onValueChange, items } = useSelectContext('SelectTrigger');
  const placeholder = React.Children.toArray(children).find(isSelectValueElement)?.props.placeholder;
  const startDecorations = React.Children.toArray(children).filter((node) => !isSelectValueElement(node));

  const handleChange = (event: SelectChangeEvent<string>) => {
    onValueChange(event.target.value);
  };

  return (
    <FormControl fullWidth className={className}>
      <MuiSelect
        {...props}
        ref={ref}
        value={value}
        displayEmpty={displayEmpty}
        onChange={handleChange}
        renderValue={(selected) => {
          if (!selected) {
            return placeholder ?? '';
          }
          const found = items.find((item) => item.value === selected);
          return found?.label ?? selected;
        }}
      >
        {startDecorations.length > 0 ? (
          <MenuItem disabled value="">
            <Stack direction="row" spacing={1} alignItems="center">
              {startDecorations.map((node, index) => (
                <React.Fragment key={`select-decoration-${index}`}>{node}</React.Fragment>
              ))}
              {placeholder ?? 'Select'}
            </Stack>
          </MenuItem>
        ) : null}
        {items.map((item) => (
          <MenuItem key={item.value} value={item.value}>
            {item.label}
          </MenuItem>
        ))}
      </MuiSelect>
    </FormControl>
  );
});

export interface SelectContentProps {
  children: React.ReactNode;
}

export function SelectContent({ children }: SelectContentProps) {
  return <>{children}</>;
}

export interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

export function SelectItem(_props: SelectItemProps) {
  return null;
}

export interface SelectValueProps {
  placeholder?: string;
}

export function SelectValue(_props: SelectValueProps) {
  return null;
}

export default Select;
