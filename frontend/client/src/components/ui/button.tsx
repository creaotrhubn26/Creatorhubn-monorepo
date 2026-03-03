import * as React from 'react';
import { Button as MuiButton, type ButtonProps as MuiButtonProps } from '@mui/material';

type UIButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type UIButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends Omit<MuiButtonProps, 'variant' | 'size'> {
  variant?: UIButtonVariant;
  size?: UIButtonSize;
  asChild?: boolean;
}

function mapVariant(variant: UIButtonVariant): MuiButtonProps['variant'] {
  if (variant === 'outline') return 'outlined';
  if (variant === 'ghost' || variant === 'link') return 'text';
  return 'contained';
}

function mapColor(variant: UIButtonVariant): MuiButtonProps['color'] {
  if (variant === 'destructive') return 'error';
  if (variant === 'secondary') return 'secondary';
  return 'primary';
}

function mapSize(size: UIButtonSize): MuiButtonProps['size'] {
  if (size === 'sm') return 'small';
  if (size === 'lg') return 'large';
  return 'medium';
}

function composeClickHandlers(
  first?: React.MouseEventHandler<HTMLElement>,
  second?: React.MouseEventHandler<HTMLElement>,
): React.MouseEventHandler<HTMLElement> {
  return (event) => {
    first?.(event);
    second?.(event);
  };
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'default', asChild = false, children, sx, ...props },
  ref,
) {
  const mappedVariant = mapVariant(variant);
  const mappedSize = mapSize(size);
  const mappedColor = mapColor(variant);

  const sharedSx = {
    ...(variant === 'link'
      ? {
          textTransform: 'none',
          minWidth: 0,
          p: 0,
          '&:hover': { textDecoration: 'underline', backgroundColor: 'transparent' },
        }
      : null),
    ...(size === 'icon'
      ? {
          minWidth: 36,
          width: 36,
          height: 36,
          p: 0,
        }
      : null),
    ...sx,
  };

  if (asChild && React.isValidElement(children)) {
    const childProps = (children.props ?? {}) as {
      children?: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLElement>;
      href?: string;
      target?: string;
      rel?: string;
      className?: string;
    };

    const elementType: MuiButtonProps['component'] = childProps.href ? 'a' : 'span';
    return (
      <MuiButton
        {...props}
        ref={ref}
        component={elementType}
        variant={mappedVariant}
        size={mappedSize}
        color={mappedColor}
        onClick={composeClickHandlers(props.onClick as React.MouseEventHandler<HTMLElement>, childProps.onClick)}
        href={childProps.href}
        target={childProps.target}
        rel={childProps.rel}
        sx={sharedSx}
      >
        {childProps.children}
      </MuiButton>
    );
  }

  return (
    <MuiButton {...props} ref={ref} variant={mappedVariant} size={mappedSize} color={mappedColor} sx={sharedSx}>
      {children}
    </MuiButton>
  );
});

export default Button;
