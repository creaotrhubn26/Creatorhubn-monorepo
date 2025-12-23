/**
 * PlanFeaturePreview Component
 * Shows users what features they'll get with their selected plan
 * Used in: InviteRequestForm, UniversalVendorOnboarding, InviteManagementDashboard, UniversalSettingsPanel
 *
 * Enterprise users: Shows feature access based on their role (admin/member/viewer)
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemAvatar,
  Avatar,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Lock as LockIcon,
  ShoppingCart as MarketplaceIcon,
  AdminPanelSettings as AdminIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { getAllProfessionFeatures } from '@shared/profession-feature-matrix';
import { apiRequest } from '../../lib/queryClient';
import { useEnterpriseMembership, canRoleAccess, type PermissionLevel } from '../../hooks/useEnterpriseFeatureAccess';

interface PlanFeaturePreviewProps {
  profession: string;
  selectedPlan?: 'basic' | 'pro' | 'enterprise' | null;
  showLocked?: boolean;
  compact?: boolean;
  maxFeatures?: number;
  primaryColor?: string;
  showDetails?: boolean; // Show expanded feature list
  /** For enterprise users: filter features based on their role */
  showEnterpriseRoleAccess?: boolean;
}

interface FeatureCustomization {
  name?: string;
  description?: string;
  logoUrl?: string;
  logoIcon?: string;
  logoColor?: string;
  category?: string;
  marketingText?: string;
  tooltipText?: string;
  externalLink?: string;
}

interface FeatureWithAccess {
  id: string;
  name: string;
  description: string;
  plan: 'basic' | 'pro' | 'enterprise' | 'marketplace';
  impact: 'low' | 'medium' | 'high' | 'critical';
  hasAccess: boolean;
  required: boolean;
  customization?: FeatureCustomization;
  /** Enterprise role-based access */
  enterprisePermission?: PermissionLevel;
  enterpriseAccessBlocked?: boolean;
}

// Plan hierarchy for comparison
const PLAN_RANK: Record<string, number> = {
  basic: 1,
  pro: 2,
  enterprise: 3,
  marketplace: 99, // Marketplace is separate
};

const PLAN_LABELS: Record<string, string> = {
  basic: 'Gratis',
  pro: 'Pro',
  enterprise: 'Enterprise',
  marketplace: 'Marketplace',
};

const PLAN_COLORS: Record<string, string> = {
  basic: '#4caf50',
  pro: '#2196f3',
  enterprise: '#9c27b0',
  marketplace: '#ff9800',
};

export function PlanFeaturePreview({
  profession,
  selectedPlan = 'basic',
  showLocked = true,
  compact = false,
  maxFeatures = 10,
  primaryColor = '#FF8A00',
  showDetails = false,
  showEnterpriseRoleAccess = false,
}: PlanFeaturePreviewProps) {
  // Get enterprise membership info for role-based access
  const { isEnterprise, role: enterpriseRole, organizationId } = useEnterpriseMembership();

  // Fetch feature customizations from admin settings
  const { data: customizationsData } = useQuery({
    queryKey: [ '/api/feature-customizations/public,'],
    queryFn: () => apiRequest('/api/feature-customizations/public'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch enterprise organization settings (for feature permissions)
  const { data: orgSettingsData } = useQuery({
    queryKey: ['/api/enterprise/organization-settings', organizationId],
    queryFn: () => apiRequest(`/api/enterprise/organization-settings?organizationId=${organizationId}`),
    enabled: showEnterpriseRoleAccess && isEnterprise && !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  const customizations: Record<string, FeatureCustomization> = customizationsData?.customizations || {};
  const orgSettings = orgSettingsData?.settings || { adminOnlyFeatures: [], disabledFeatures: [] };

  const featuresWithAccess = useMemo(() => {
    const allFeatures = getAllProfessionFeatures(profession);
    if (!allFeatures || !Array.isArray(allFeatures)) return [];

    const userPlanRank = PLAN_RANK[selectedPlan || 'basic'] || 1;

    // Filter out disabled features (enabled: false in profession-feature-matrix)
    // Only show features that are enabled OR required
    return allFeatures
      .filter((feature: any) => feature.enabled === true || feature.required === true)
      .map((feature: any) => {
        const featurePlanRank = PLAN_RANK[feature.plan] || 1;
        let hasAccess = feature.plan === 'marketplace'
          ? false
          : featurePlanRank <= userPlanRank;

        const featureId = feature.featureId || feature.id;
        const customization = customizations[featureId];

        // Check enterprise role-based permissions
        let enterprisePermission: PermissionLevel = 'all';
        let enterpriseAccessBlocked = false;

        if (showEnterpriseRoleAccess && isEnterprise && enterpriseRole) {
          if (orgSettings.disabledFeatures?.includes(featureId)) {
            enterprisePermission = 'disabled';
            enterpriseAccessBlocked = true;
            hasAccess = false;
          } else if (orgSettings.adminOnlyFeatures?.includes(featureId)) {
            enterprisePermission = 'admin_only';
            enterpriseAccessBlocked = !canRoleAccess(enterpriseRole, 'admin_only');
            if (enterpriseAccessBlocked) hasAccess = false;
          }
        }

        return {
          id: featureId,
          name: customization?.name || feature.name || featureId,
          description: customization?.description || feature.description,
          plan: feature.plan,
          impact: feature.impact,
          hasAccess,
          required: feature.required || false,
          customization,
          enterprisePermission,
          enterpriseAccessBlocked,
        } as FeatureWithAccess;
      });
  }, [profession, selectedPlan, customizations, showEnterpriseRoleAccess, isEnterprise, enterpriseRole, orgSettings]);

  // Group features by plan tier
  const groupedFeatures = useMemo(() => {
    const groups: Record<string, FeatureWithAccess[]> = {
      basic: [],
      pro: [],
      enterprise: [],
      marketplace: [],
    };

    featuresWithAccess.forEach((feature) => {
      if (groups[feature.plan]) {
        groups[feature.plan].push(feature);
      }
    });

    // Sort by impact within each group
    const impactOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => 
        (impactOrder[a.impact] || 4) - (impactOrder[b.impact] || 4)
      );
    });

    return groups;
  }, [featuresWithAccess]);

  const totalByPlan = useMemo(() => ({
    basic: groupedFeatures.basic.length,
    pro: groupedFeatures.pro.length,
    enterprise: groupedFeatures.enterprise.length,
    marketplace: groupedFeatures.marketplace.length,
    total: featuresWithAccess.length,
    accessible: featuresWithAccess.filter(f => f.hasAccess).length,
  }), [groupedFeatures, featuresWithAccess]);

  if (compact) {
    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          icon={<CheckIcon sx={{ fontSize: 16 }} />}
          label={`${totalByPlan.accessible} funksjoner`}
          size="small"
          sx={{ bgcolor: alpha(primaryColor, 0.1), color: primaryColor }}
        />
        {selectedPlan !== 'enterprise' && showLocked && (
          <Chip
            icon={<LockIcon sx={{ fontSize: 14 }} />}
            label={`${totalByPlan.total - totalByPlan.accessible} låst`}
            size="small"
            variant="outlined"
            sx={{ borderColor: '#ccc', color: '#666' }}
          />
        )}
      </Box>
    );
  }

  // Render feature item with customization and enterprise permissions
  const renderFeatureItem = (feature: FeatureWithAccess) => {
    const hasLogo = feature.customization?.logoUrl || feature.customization?.logoIcon;

    // Determine icon and tooltip based on enterprise permissions
    const getFeatureIcon = () => {
      if (feature.enterpriseAccessBlocked) {
        if (feature.enterprisePermission === 'disabled') {
          return <BlockIcon sx={{ fontSize: 18, color: '#d32f2f' }} />;
        }
        if (feature.enterprisePermission === 'admin_only') {
          return <AdminIcon sx={{ fontSize: 18, color: '#ff9800' }} />;
        }
      }
      return feature.hasAccess
        ? <CheckIcon sx={{ fontSize: 18, color: PLAN_COLORS[feature.plan] }} />
        : <LockIcon sx={{ fontSize: 18, color: '#999' }} />;
    };

    const getEnterpriseTooltip = () => {
      if (feature.enterprisePermission === 'disabled') {
        return 'Deaktivert av administrator';
      }
      if (feature.enterprisePermission === 'admin_only' && feature.enterpriseAccessBlocked) {
        return 'Kun tilgjengelig for administratorer';
      }
      return feature.customization?.tooltipText || feature.description;
    };

    return (
      <ListItem
        key={feature.id}
        sx={{
          py: 0.5,
          opacity: feature.hasAccess ? 1 : 0.6,
          bgcolor: feature.enterpriseAccessBlocked ? alpha('#d32f2f', 0.05) : 'transparent'}}
      >
        {hasLogo ? (
          <ListItemAvatar sx={{ minWidth: 40 }}>
            {feature.customization?.logoUrl ? (
              <Avatar
                src={feature.customization.logoUrl}
                sx={{ width: 28, height: 28 }}
              />
            ) : (
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  bgcolor: feature.customization?.logoColor || PLAN_COLORS[feature.plan],
                  fontSize: 14}}
              >
                {feature.name.charAt(0).toUpperCase()}
              </Avatar>
            )}
          </ListItemAvatar>
        ) : (
          <ListItemIcon sx={{ minWidth: 32 }}>
            {getFeatureIcon()}
          </ListItemIcon>
        )}
        <ListItemText
          primary={
            <Tooltip title={getEnterpriseTooltip()}>
              <Typography variant="body2" sx={{ fontWeight: eature.hasAccess ? 500 : 400 }}>
                {feature.name}
              </Typography>
            </Tooltip>
          }
          secondary={
            feature.customization?.marketingText && (
              <Typography variant="caption" color="text.secondary">
                {feature.customization.marketingText}
              </Typography>
            )
          }
        />
        {/* Show enterprise permission badge if blocked */}
        {feature.enterpriseAccessBlocked && (
          <Chip
            label={feature.enterprisePermission === 'disabled' ? 'Deaktivert' : 'Kun admin'}
            size="small"
            sx={{
              height: 18,
              fontSize: 9,
              mr: 0.5,
              bgcolor: feature.enterprisePermission === 'disabled'
                ? alpha('#d32f2f', 0.1)
                : alpha('#ff9800', 0.1),
              color: feature.enterprisePermission === 'disabled' ? '#d32f2f' : '#ff9800'}}
          />
        )}
        <Chip
          label={PLAN_LABELS[feature.plan]}
          size="small"
          sx={{
            height: 20,
            fontSize: 10,
            bgcolor: alpha(PLAN_COLORS[feature.plan], 0.1),
            color: PLAN_COLORS[feature.plan]}}
        />
      </ListItem>
    );
  };

  // Count enterprise-blocked features
  const enterpriseBlockedCount = featuresWithAccess.filter(f => f.enterpriseAccessBlocked).length;
  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator',
    member: 'Medlem',
    viewer: 'Leser',
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Enterprise role indicator */}
      {showEnterpriseRoleAccess && isEnterprise && enterpriseRole && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, bgcolor: alpha('#9c27b0', 0.05), borderRadius: 1 }}>
          <AdminIcon sx={{ color: '#9c27b0', fontSize: 20 }} />
          <Typography variant="body2" sx={{ color: '#9c27b0', fontWeight: 500}}>
            Din rolle: {ROLE_LABELS[enterpriseRole] || enterpriseRole}
          </Typography>
          {enterpriseBlockedCount > 0 && (
            <Chip
              label={`${enterpriseBlockedCount} begrenset`}
              size="small"
              sx={{ ml: 'auto', bgcolor: alpha('#ff9800', 0.1), color: '#ff9800', fontSize: 11 }}
            />
          )}
        </Box>
      )}

      {/* Summary chips */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {Object.entries(PLAN_LABELS).map(([planKey, label]) => {
          const count = totalByPlan[planKey as keyof typeof totalByPlan] as number;
          if (count === 0) return null;
          const isAccessible = PLAN_RANK[planKey] <= PLAN_RANK[selectedPlan || 'basic'];

          return (
            <Tooltip
              key={planKey}
              title={isAccessible ? `Du har tilgang til ${count} ${label}-funksjoner` : `Oppgrader for ${count} ${label}-funksjoner`}
            >
              <Chip
                icon={isAccessible ? <CheckIcon /> : <LockIcon />}
                label={`${label}: ${count}`}
                size="small"
                sx={{
                  bgcolor: isAccessible ? alpha(PLAN_COLORS[planKey], 0.15) : alpha('#999', 0.1),
                  color: isAccessible ? PLAN_COLORS[planKey] : '#666',
                  fontWeight: sAccessible ? 600 : 400}}
              />
            </Tooltip>
          );
        })}
      </Box>

      {/* Detailed feature list */}
      {showDetails && (
        <Box sx={{ mt: 2 }}>
          {(['basic', 'pro', 'enterprise', 'marketplace'] as const).map((planKey) => {
            const features = groupedFeatures[planKey];
            if (features.length === 0) return null;

            const isAccessible = planKey === 'marketplace'
              ? false
              : PLAN_RANK[planKey] <= PLAN_RANK[selectedPlan || 'basic'];

            return (
              <Accordion
                key={planKey}
                defaultExpanded={planKey === selectedPlan}
                sx={{
                  '&:before': { display: 'none' },
                  boxShadow: 'none',
                  border: `1px solid ${alpha(PLAN_COLORS[planKey], 0.2)}`,
                  mb: 1}}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isAccessible ? (
                      <CheckIcon sx={{ color: PLAN_COLORS[planKey], fontSize: 20 }} />
                    ) : planKey === 'marketplace' ? (
                      <MarketplaceIcon sx={{ color: PLAN_COLORS[planKey], fontSize: 20 }} />
                    ) : (
                      <LockIcon sx={{ color: '#999', fontSize: 20 }} />
                    )}
                    <Typography sx={{ fontWeight: 600, color: PLAN_COLORS[planKey] }}>
                      {PLAN_LABELS[planKey]}
                    </Typography>
                    <Chip
                      label={`${features.length} funksjoner`}
                      size="small"
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <List dense disablePadding>
                    {features.slice(0, maxFeatures).map(renderFeatureItem)}
                    {features.length > maxFeatures && (
                      <ListItem>
                        <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>
                          + {features.length - maxFeatures} flere funksjoner
                        </Typography>
                      </ListItem>
                    )}
                  </List>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export default PlanFeaturePreview;

