// useBusinessLogo.ts - Hook for managing business logo display
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

interface BusinessLogo {
  id: string;
  userId: string;
  logoUrl: string;
  originalFilename: string;
  uploadedAt: string;
  isActive: boolean;
}

interface UseBusinessLogoOptions {
  userId?: string;
  organizationNumber?: string;
  businessName?: string;
}

export const useBusinessLogo = (options: UseBusinessLogoOptions = {}) => {
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch business logo from user's profile or onboarding data
  const { data: businessProfile } = useQuery({
    queryKey: ['/api/business-profile', options.userId],
    queryFn: () => (options.userId ? apiRequest(`/api/business-profile/${options.userId}`) : null),
    enabled: !!options.userId,
});

  // Fetch logo from onboarding profiles if user ID not available
  const { data: onboardingProfile } = useQuery({
    queryKey: ['/api/onboarding-profiles', options.organizationNumber],
    queryFn: () =>
      options.organizationNumber
        ? apiRequest(`/api/onboarding-profiles?orgNumber=${options.organizationNumber}`)
        : null,
    enabled: !!options.organizationNumber && !options.userId,
});

  // Check for uploaded logos in user's files
  const { data: userLogos } = useQuery({
    queryKey: ['/api/user-files/logos', options.userId],
    queryFn: () => (options.userId ? apiRequest(`/api/user-files/logos/${options.userId}`) : null),
    enabled: !!options.userId,
});

  useEffect(() => {
    let foundLogoUrl = '';

    // Priority 1: Business profile logo
    if (businessProfile?.logoUrl) {
      foundLogoUrl = businessProfile.logoUrl;
  }
    // Priority 2: Onboarding profile logo
    else if (onboardingProfile?.businessLogo) {
      foundLogoUrl = onboardingProfile.businessLogo;
  }
    // Priority 3: User uploaded logos
    else if (userLogos && userLogos.length > 0) {
      const activeLogo = userLogos.find((logo: BusinessLogo) => logo.isActive) || userLogos[0];
      if (activeLogo) {
        foundLogoUrl = activeLogo.logoUrl;
    }
  }
    // Priority 4: Generate placeholder based on business name
    else if (options.businessName) {
      foundLogoUrl = generateLogoPlaceholder(options.businessName);
  }

    setLogoUrl(foundLogoUrl);
    setIsLoading(false);
}, [businessProfile, onboardingProfile, userLogos, options.businessName]);

  return {
    logoUrl,
    isLoading,
    hasLogo: !!logoUrl && !logoUrl.includes('placeholder'),
    refreshLogo: () => {
      // Trigger refetch of all logo sources
      setIsLoading(true);
  },
};
};

// Generate SVG placeholder logo based on business name
const generateLogoPlaceholder = (businessName: string): string => {
  const initials = businessName
    .split('')
    .map((word) => word.charAt(0))
    .join(', ')
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    { bg: '#ff6b35', text: '#ffffff' },
    { bg: '#f7931e', text: '#ffffff' },
    { bg: '#ffd700', text: '#000000' },
    { bg: '#28a745', text: '#ffffff' },
    { bg: '#007bff', text: '#ffffff' },
    { bg: '#6f42c1', text: '#ffffff' },
  ];

  // Use business name to consistently pick a color
  const colorIndex = businessName.length % colors.length;
  const color = colors[colorIndex];

  const svgLogo = `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="12" fill="${color.bg}"/>
      <text x="32" y="40" text-anchor="middle" fill="${color.text}" 
            font-family="Arial, sans-serif" font-size="24" font-weight="bold">
        ${initials}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svgLogo)}`;
};

export default useBusinessLogo;
