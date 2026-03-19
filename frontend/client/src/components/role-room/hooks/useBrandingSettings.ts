import { useEffect, useState } from "react";
import { fetchBrandingSettings, getBrandingSettings, subscribeBrandingSettings, type BrandingSettings } from "../config/branding";

export function useBrandingSettings(): BrandingSettings {
  const [branding, setBranding] = useState<BrandingSettings>(getBrandingSettings());

  useEffect(() => {
    let isMounted = true;
    fetchBrandingSettings()
      .then(settings => {
        if (isMounted && settings) {
          setBranding(settings);
        }
      })
      .catch(() => {
        // Ignore fetch errors - defaults remain
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return subscribeBrandingSettings(setBranding);
  }, []);

  return branding;
}

export default useBrandingSettings;
