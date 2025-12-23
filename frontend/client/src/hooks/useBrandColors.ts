/**
 * Brand Colors Hook
 * Connects BrandingWorkflowPanel to PropertyPanel
 */

import { useCreatorHubBranding } from '@/hooks/useCreatorHubBranding';

export function useBrandColors(
  profession:
    | 'photographer'
    | 'videographer'
    | 'music_producer'
    | 'vendor'
    | 'admin' = 'photographer',
) {
  const branding = useCreatorHubBranding({
    profession,
    persist: true,
  });

  return {
    primary: branding.color,
    accent: branding.accentColor || branding.color,
    background: branding.backgroundColor || '#ffffff',
    text: branding.textColor ||'#333333',
    gradients: branding.gradients || [],

    // Full branding object if needed
    fullBranding: branding,
  };
}
