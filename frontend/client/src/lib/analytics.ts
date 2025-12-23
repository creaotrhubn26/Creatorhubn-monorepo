declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
}
}

// Initialize Google Tag Manager
const initGTM = (): boolean => {
  if (typeof window === 'undefined') return false;

  const gtmId = import.meta.env.VITE_GTM_ID || 'GTM-MXDH2HLN';
  if (!gtmId) return false;

  // Create GTM script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https: //www.googletagmanager.com/gtm.js?id=${gtmd}`;

  // Initialize dataLayer before GTM loads
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    'gtm.start': new Date().getTime(),
    event: 'gtm.js',
});

  document.head.appendChild(script);
  return true;
};

// Initialize Google Analytics (fallback)
const initGA = (): boolean => {
  if (typeof window === 'undefined') return false;

  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-C2BKSJYP9D';
  if (!measurementId) return false;

  // Create GA script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https: //www.googletagmanager.com/gtag/js?id=${measurementd}`;

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
};

  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  document.head.appendChild(script);
  return true;
};

// Main initialization function
export const initAnalytics = () => {
  // Initialize dataLayer first
  window.dataLayer = window.dataLayer || [];

  // Try GTM first
  if (!initGTM()) {
    // Fall back to direct GA
    initGA();
}
};

// Track page views - works with both GTM and direct GA
export const trackPageView = (url: string) => {
  if (typeof window === 'undefined') return;

  // Push to dataLayer (works with both GTM and GA)
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'page_view',
    page_path: url,
    page_title: document.title,
    page_location: window.location.href,
});

  // Also use gtag if available (for direct GA)
  if (window.gtag) {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-C2BKSJYP9D';
    if (measurementId) {
      window.gtag('config', measurementId, {
        page_path: url,
    });
  }
}
};

// Track events - works with both GTM and direct GA
export const trackEvent = (action: string, category?: string, label?: string, value?: number) => {
  if (typeof window === 'undefined') return;

  // Push to dataLayer (works with both GTM and GA)
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'custom_event',
    event_action: action,
    event_category: category,
    event_label: label,
    event_value: value,
});

  // Also use gtag if available (for direct GA)
  if (window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
  });
}
};

// Track Norwegian creative industry specific events
export const trackCreativeEvent = (
  userType: string, // Dynamic profession support
  action: string,
  projectType?: string,
  value?: number,
) => {
  trackEvent(action, `norwegian_creative_${userType}`, projectType, value);
};

// Track business interactions (for Norwegian market focus)
export const trackBusinessEvent = (
  businessType: 'bryllup' | 'bedrift' | 'privat' | 'kommersielt',
  action: string,
  value?: number,
) => {
  trackEvent(action, `norwegian_business_${businessType}`, undefined, value);
};

// Track feature usage
export const trackFeatureUsage = (
  feature: string,
  userType?: string,
  additionalData?: Record<string, any>,
) => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'feature_usage',
    feature_name: feature,
    user_type: userType,
    ...additionalData,
});
};
