import * as React from 'react';
import { TextField, type TextFieldProps } from '@mui/material';

export interface InputProps extends Omit<TextFieldProps, 'variant' | 'onChange'> {
  variant?: 'outlined' | 'filled' | 'standard';
  multiple?: boolean;
  accept?: string;
  capture?: boolean | 'user' | 'environment';
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'small', variant = 'outlined', multiple, accept, capture, ...props },
  ref,
) {
  return (
    <TextField
      {...props}
      size={size}
      variant={variant}
      inputRef={ref}
      inputProps={{
        ...(props.inputProps ?? {}),
        multiple,
        accept,
        capture,
      }}
    />
  );
});

export default Input;
