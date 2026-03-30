import React, { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Collapse,
  Divider,
  LinearProgress,
  Rating,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Business as BusinessIcon,
  CheckCircle as VerifiedIcon,
  Email as EmailIcon,
  ExpandMore as ExpandIcon,
  Flag as FlagIcon,
  Language as WebsiteIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  Phone as PhoneIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useTheming } from '../utils/theming-helper';
import { useBusinessLogo } from '../hooks/useBusinessLogo';

interface CompanyProfile {
  id: string;
  name: string;
  organizationNumber: string;
  industry: string;
  status: 'active' | 'inactive' | 'verified';
  logo?: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  employees?: number;
  revenue?: {
    amount: number;
    year: number;
    currency: string;
  };
  rating?: number;
  verification: {
    brreg: boolean;
    proff: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
  description?: string;
  founded?: number;
  services?: string[];
  socialProof?: {
    projects: number;
    clients: number;
    reviews: number;
  };
}

interface CompanyProfileQuickViewProps {
  profile: CompanyProfile;
  variant?: 'compact' | 'expanded' | 'minimal';
  animation?: 'slide' | 'fade' | 'zoom' | 'flip';
  showRiskIndicators?: boolean;
  onViewDetails?: (profile: CompanyProfile) => void;
  onContact?: (profile: CompanyProfile) => void;
}

const getMotionProps = (animation: CompanyProfileQuickViewProps['animation']) => {
  switch (animation) {
    case 'fade':
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.35 } };
    case 'zoom':
      return {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        transition: { duration: 0.3 },
      };
    case 'flip':
      return {
        initial: { opacity: 0, rotateY: 10 },
        animate: { opacity: 1, rotateY: 0 },
        transition: { duration: 0.35 },
      };
    case 'slide':
    default:
      return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } };
  }
};

const getStatusColor = (status: CompanyProfile['status']) => {
  switch (status) {
    case 'verified':
      return 'success';
    case 'inactive':
      return 'error';
    case 'active':
    default:
      return 'primary';
  }
};

const getRiskColor = (riskLevel: CompanyProfile['verification']['riskLevel']) => {
  switch (riskLevel) {
    case 'low':
      return 'success';
    case 'high':
      return 'error';
    case 'medium':
    default:
      return 'warning';
  }
};

export default function CompanyProfileQuickView({
  profile,
  variant = 'expanded',
  animation = 'slide',
  showRiskIndicators = false,
  onViewDetails,
  onContact,
}: CompanyProfileQuickViewProps) {
  const theming = useTheming('photographer');
  const [expanded, setExpanded] = useState(variant === 'expanded');
  const { logoUrl, hasLogo } = useBusinessLogo({
    organizationNumber: profile.organizationNumber,
    businessName: profile.name,
  });

  const revenueProgress = Math.min(100, Math.max(8, (profile.revenue?.amount ?? 0) / 100000));

  return (
    <motion.div {...getMotionProps(animation)}>
      <Card
        sx={{
          height: '100%',
          minHeight: variant === 'minimal' ? 150 : 250,
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          ...theming.getThemedCardSx(),
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            bgcolor:
              profile.status === 'verified'
                ? 'success.main'
                : profile.status === 'inactive'
                  ? 'error.main'
                  : 'primary.main',
          }}
        />

        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Avatar
              src={logoUrl || profile.logo}
              sx={{
                width: variant === 'minimal' ? 48 : 56,
                height: variant === 'minimal' ? 48 : 56,
                bgcolor: hasLogo ? 'transparent' : 'primary.main',
              }}
            >
              {!hasLogo && <BusinessIcon />}
            </Avatar>

            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant={variant === 'minimal' ? 'h6' : 'h5'} fontWeight="bold">
                  {profile.name}
                </Typography>
                {profile.verification.brreg && (
                  <Tooltip title="Bekreftet i Brønnøysundregistrene">
                    <VerifiedIcon color="success" fontSize="small" />
                  </Tooltip>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {profile.industry} • Org.nr: {profile.organizationNumber}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Chip label={profile.status} size="small" color={getStatusColor(profile.status)} />
                {showRiskIndicators && (
                  <Chip
                    icon={<FlagIcon />}
                    label={`Risiko ${profile.verification.riskLevel}`}
                    size="small"
                    color={getRiskColor(profile.verification.riskLevel)}
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LocationIcon fontSize="small" color="action" />
            <Typography variant="body2">{profile.address}</Typography>
          </Box>

          {typeof profile.rating === 'number' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Rating value={profile.rating} precision={0.1} size="small" readOnly />
              <Typography variant="body2" color="text.secondary">
                {profile.rating.toFixed(1)}
              </Typography>
            </Box>
          )}

          {profile.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {profile.description}
            </Typography>
          )}

          {profile.revenue && variant !== 'minimal' && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Omsetning {profile.revenue.year}
                </Typography>
                <Typography variant="caption" fontWeight={600}>
                  {new Intl.NumberFormat('no-NO', {
                    style: 'currency',
                    currency: profile.revenue.currency,
                    maximumFractionDigits: 0,
                  }).format(profile.revenue.amount)}
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={revenueProgress} />
            </Box>
          )}

          {variant !== 'minimal' && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                {profile.socialProof?.projects !== undefined && (
                  <Chip icon={<TrendingIcon />} label={`${profile.socialProof.projects} prosjekter`} size="small" variant="outlined" />
                )}
                {profile.socialProof?.clients !== undefined && (
                  <Chip icon={<PeopleIcon />} label={`${profile.socialProof.clients} kunder`} size="small" variant="outlined" />
                )}
              </Box>
            </>
          )}

          <Collapse in={expanded && variant !== 'minimal'}>
            <Box sx={{ display: 'grid', gap: 1.25 }}>
              {profile.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="body2">{profile.phone}</Typography>
                </Box>
              )}
              {profile.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmailIcon fontSize="small" color="action" />
                  <Typography variant="body2">{profile.email}</Typography>
                </Box>
              )}
              {profile.website && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WebsiteIcon fontSize="small" color="action" />
                  <Typography variant="body2">{profile.website}</Typography>
                </Box>
              )}
              {profile.services && profile.services.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {profile.services.map((service) => (
                    <Chip key={service} label={service} size="small" />
                  ))}
                </Box>
              )}
            </Box>
          </Collapse>
        </CardContent>

        <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
          {variant !== 'minimal' && (
            <Button
              size="small"
              startIcon={<ExpandIcon />}
              onClick={() => setExpanded((previous) => !previous)}
            >
              {expanded ? 'Mindre' : 'Mer'}
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => onViewDetails?.(profile)}>
            Detaljer
          </Button>
          <Button size="small" variant="contained" onClick={() => onContact?.(profile)}>
            Kontakt
          </Button>
        </CardActions>
      </Card>
    </motion.div>
  );
}
