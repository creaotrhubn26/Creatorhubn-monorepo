/**
 * White-Label Branding Context
 * Provides user, 's custom branding to all client-facing components
 * Automatically applies: custom logo, brand colors, business name, custom domain
 */

import type { ReactNode } from 'react';
import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface WhiteLabelBranding {
  // Business Identity
  businessName: string;
  tagline?: string;
  customLogo?: string;

  // Brand Colors
  brandColor: string;
  darkBrandColor?: string;
  lightBrandColor?: string;

  // Contact Info
  email?: string;
  phone?: string;
  website?: string;
  businessAddress?: string;

  // Custom Domain
  customDomain?: string;
  domainStatus?: 'active' | 'pending' | 'failed';

  // Social Media
  facebook?: string;
  instagram?: string;
  twitter?: string;

  // White-Label Settings
  hideCreatorHubBranding: boolean;
  customFooterText?: string;

  // User Info
  photographerName: string;
  profilePhoto?: string;
}

interface WhiteLabelBrandingContextType {
  branding: WhiteLabelBranding | null;
  isLoading: boolean;
  error: string | null;
  getLogoUrl: () => string;
  getBrandColor: () => string;
  getBusinessName: () => string;
  getCustomDomain: () => string | null;
  shouldHideCreatorHub: () => boolean;
}

const WhiteLabelBrandingContext = createContext<WhiteLabelBrandingContextType | undefined>(
  undefined,
);

interface WhiteLabelBrandingProviderProps {
  children: ReactNode;
  photographerId: string; // The photographer/user whose branding to load
}

export const WhiteLabelBrandingProvider: React.FC<WhiteLabelBrandingProviderProps> = ({
  children,
  photographerId,
}) => {
  // Fetch branding data for the specific photographer
  const {
    data: brandingData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/white-label/branding', photographerId],
    queryFn: () => apiRequest(`/api/white-label/branding/${photographerId}`),
    enabled: !!photographerId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Merge business branding + onboarding profile + domain settings
  const branding: WhiteLabelBranding | null = brandingData
    ? {
        businessName: brandingData.businessName || brandingData.photographerName || 'Photographer',
        tagline: brandingData.tagline,
        customLogo: brandingData.customLogo,
        brandColor: brandingData.brandingColor || brandingData.brandColor || '#ff8c00',
        darkBrandColor: brandingData.darkBrandColor,
        lightBrandColor: brandingData.lightBrandColor,
        email: brandingData.email,
        phone: brandingData.phone,
        website: brandingData.website,
        businessAddress: brandingData.businessAddress,
        customDomain: brandingData.customDomain,
        domainStatus: brandingData.domainStatus,
        facebook: brandingData.facebook,
        instagram: brandingData.instagram,
        twitter: brandingData.twitter,
        hideCreatorHubBranding: brandingData.hideCreatorHubBranding || false,
        customFooterText: brandingData.customFooterText,
        photographerName:
          brandingData.photographerName || brandingData.businessName || 'Photographer',
        profilePhoto: brandingData.profilePhoto,
      }
    : null;

  const getLogoUrl = () => {
    if (branding?.customLogo) return branding.customLogo;
    if (branding?.profilePhoto) return branding.profilePhoto;
    return '/creatorhub-logo-amber.svg'; // Fallback
  };

  const getBrandColor = () => {
    return branding?.brandColor || '#ff8c00';
  };

  const getBusinessName = () => {
    return branding?.businessName || branding?.photographerName || 'Photographer';
  };

  const getCustomDomain = () => {
    if (branding?.customDomain && branding.domainStatus === 'active') {
      return branding.customDomain;
    }
    return null;
  };

  const shouldHideCreatorHub = () => {
    return branding?.hideCreatorHubBranding || false;
  };

  const value: WhiteLabelBrandingContextType = {
    branding,
    isLoading,
    error: error ?'Failed to load branding' : null,
    getLogoUrl,
    getBrandColor,
    getBusinessName,
    getCustomDomain,
    shouldHideCreatorHub,
  };

  return (
    <WhiteLabelBrandingContext.Provider value={value}>
      {children}
    </WhiteLabelBrandingContext.Provider>
  );
};

// Hook to use white-label branding
export const useWhiteLabelBranding = () => {
  const context = useContext(WhiteLabelBrandingContext);

  if (context === undefined) {
    throw new Error('useWhiteLabelBranding must be used within WhiteLabelBrandingProvider');
  }

  return context;
};

// HOC to wrap client-facing components with branding
export const withWhiteLabelBranding = <P extends object>(
  Component: React.ComponentType<P & { whiteLabelBranding?: WhiteLabelBranding }>,
) => {
  return (props: P & { photographerId: string }) => {
    return (
      <WhiteLabelBrandingProvider photographerId={props.photographerId}>
        <WhiteLabelBrandingConsumer>
          {(branding) => (
            <Component {...props} whiteLabelBranding={branding.branding || undefined} />
          )}
        </WhiteLabelBrandingConsumer>
      </WhiteLabelBrandingProvider>
    );
  };
};

const WhiteLabelBrandingConsumer: React.FC<{
  children: (branding: WhiteLabelBrandingContextType) => ReactNode;
}> = ({ children }) => {
  const branding = useWhiteLabelBranding();
  return <>{children(branding)}</>;
};

export default WhiteLabelBrandingContext;
