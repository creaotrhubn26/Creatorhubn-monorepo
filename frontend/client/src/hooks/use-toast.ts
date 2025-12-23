interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

// ZERO TOAST COMPLIANCE - No toast notifications allowed
// CreatorHub Norge: Zero Toast Policy - All user feedback through Material UI components
export const toast = (options: ToastOptions) => {
  console.log('Toast disabled (Zero Toast Compliance):', options);
};

export function useToast() {
  return {
    toast,
    toasts: [], // Always empty array - no toasts allowed
  };
}
