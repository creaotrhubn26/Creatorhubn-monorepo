import React from 'react';
import { FacebookRounded, Instagram, NorthEast } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { PublicSocialProfile } from '@/lib/publicBrandLinks';

type PublicSocialTone = 'creatorhub' | 'roleRoom' | 'legal';
type PublicSocialAlign = 'left' | 'center';

interface PublicSocialLinksProps {
  label: string;
  body?: string;
  links: PublicSocialProfile[];
  tone: PublicSocialTone;
  align?: PublicSocialAlign;
  showTopDivider?: boolean;
  maxWidth?: number | string;
  sx?: SxProps<Theme>;
}

const toneStyles: Record<
  PublicSocialTone,
  {
    labelColor: string;
    bodyColor: string;
    buttonColor: string;
    buttonBorder: string;
    buttonBackground: string;
    buttonHoverBackground: string;
    buttonHoverBorder: string;
    dividerColor: string;
    showExternalArrow: boolean;
  }
> = {
  creatorhub: {
    labelColor: 'rgba(255,186,108,0.78)',
    bodyColor: 'rgba(246,242,234,0.52)',
    buttonColor: '#fff5e8',
    buttonBorder: '1px solid rgba(255,186,108,0.24)',
    buttonBackground: 'rgba(255,186,108,0.08)',
    buttonHoverBackground: 'rgba(255,186,108,0.14)',
    buttonHoverBorder: 'rgba(255,186,108,0.42)',
    dividerColor: 'rgba(255,186,108,0.16)',
    showExternalArrow: true,
  },
  roleRoom: {
    labelColor: 'rgba(200,185,255,0.62)',
    bodyColor: 'rgba(255,255,255,0.5)',
    buttonColor: '#f7f4ff',
    buttonBorder: '1px solid rgba(139,92,246,0.3)',
    buttonBackground: 'rgba(139,92,246,0.12)',
    buttonHoverBackground: 'rgba(139,92,246,0.18)',
    buttonHoverBorder: 'rgba(139,92,246,0.44)',
    dividerColor: 'rgba(255,255,255,0.12)',
    showExternalArrow: false,
  },
  legal: {
    labelColor: '#374151',
    bodyColor: '#6b7280',
    buttonColor: '#374151',
    buttonBorder: '1px solid rgba(255,140,0,0.28)',
    buttonBackground: 'rgba(255,255,255,0.82)',
    buttonHoverBackground: 'rgba(255,248,230,1)',
    buttonHoverBorder: 'rgba(255,140,0,0.42)',
    dividerColor: 'rgba(255,140,0,0.16)',
    showExternalArrow: false,
  },
};

function getPlatformIcon(platform: PublicSocialProfile['platform']) {
  switch (platform) {
    case 'instagram':
      return <Instagram sx={{ fontSize: 18 }} />;
    case 'facebook':
      return <FacebookRounded sx={{ fontSize: 18 }} />;
    default:
      return undefined;
  }
}

export default function PublicSocialLinks({
  label,
  body,
  links,
  tone,
  align = 'left',
  showTopDivider = false,
  maxWidth,
  sx,
}: PublicSocialLinksProps) {
  const styles = toneStyles[tone];
  const centered = align === 'center';

  return (
    <Box
      sx={[
        {
          ...(showTopDivider
            ? {
                pt: 2,
                borderTop: `1px solid ${styles.dividerColor}`,
              }
            : {}),
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Stack
        spacing={0.9}
        alignItems={centered ? 'center' : 'flex-start'}
        sx={{
          textAlign: centered ? 'center' : 'left',
          maxWidth,
          mx: centered ? 'auto' : 0,
        }}
      >
        <Typography
          sx={{
            fontFamily: '"Space Grotesk", "Manrope", sans-serif',
            fontSize: tone === 'legal' ? '0.8rem' : '0.76rem',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: styles.labelColor,
          }}
        >
          {label}
        </Typography>

        {body ? (
          <Typography sx={{ color: styles.bodyColor, lineHeight: 1.75 }}>
            {body}
          </Typography>
        ) : null}

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          justifyContent={centered ? 'center' : 'flex-start'}
        >
          {links.map((link) => (
            <Button
              key={link.platform}
              component="a"
              href={link.href}
              target="_blank"
              rel="noreferrer"
              startIcon={getPlatformIcon(link.platform)}
              endIcon={styles.showExternalArrow ? <NorthEast sx={{ fontSize: 18 }} /> : undefined}
              sx={{
                alignSelf: 'flex-start',
                borderRadius: '999px',
                px: 2.1,
                py: 0.95,
                textTransform: 'none',
                fontWeight: 700,
                color: styles.buttonColor,
                border: styles.buttonBorder,
                background: styles.buttonBackground,
                '&:hover': {
                  background: styles.buttonHoverBackground,
                  borderColor: styles.buttonHoverBorder,
                },
              }}
            >
              {link.label}
            </Button>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
