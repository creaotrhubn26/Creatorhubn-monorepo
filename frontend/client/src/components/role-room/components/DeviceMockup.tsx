/**
 * DeviceMockup.tsx
 *
 * CSS-baserte enhets-rammer for MacBook, iPad og iPhone. Pakker
 * et produkt-skjermbilde inn i en autentisk-utseende device-frame
 * — ingen externe bilder for selve rammen.
 *
 * Brukt på landingssiden for å vise at The Role Room funker på
 * tvers av desktop, tablet og mobil.
 *
 * Variantene:
 *   - macbook: trapesform-hengsel + notch + rundede skjerm-corners
 *   - ipad:    rektangel m/ uniform tynn bezel + front-kamera-prikk
 *   - iphone:  tall pille m/ Dynamic Island + tynn metall-rim
 */

import React from 'react';
import { Box, Typography } from '@mui/material';

export type DeviceVariant = 'macbook' | 'ipad' | 'iphone';

export interface DeviceMockupProps {
  variant: DeviceVariant;
  screenshotUrl: string;
  screenshotAlt: string;
  caption?: string;
  /**
   * Skalafaktor — 1.0 = base-størrelse, 0.8 = mindre, 1.2 = større.
   * Gjør det enkelt å scale et sett av enheter til samme visuelle høyde.
   */
  scale?: number;
}

/**
 * MacBook Pro 14"-style frame.
 * Base-dim: 460×290px (16:10-aktig), pluss hengsel-bånd under.
 */
function MacBookFrame({ screenshotUrl, screenshotAlt, scale = 1 }: Omit<DeviceMockupProps, 'variant' | 'caption'>) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: 460 * scale,
        maxWidth: '100%',
        aspectRatio: '460/310',
        mx: 'auto',
        filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.55))',
      }}
    >
      {/* Screen body */}
      <Box
        sx={{
          position: 'absolute',
          inset: '0 0 24px 0',
          background: 'linear-gradient(180deg, #1a1a1c 0%, #0f0f12 100%)',
          borderRadius: '14px',
          padding: '14px 14px 16px 14px',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Notch */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 90,
            height: 14,
            background: '#0a0a0c',
            borderRadius: '0 0 8px 8px',
            zIndex: 2,
          }}
        />
        {/* Screen content */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '4px',
            overflow: 'hidden',
            background: '#0b1120',
          }}
        >
          <Box
            component="img"
            src={screenshotUrl}
            alt={screenshotAlt}
            loading="lazy"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </Box>
      </Box>

      {/* Hinge bar */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          left: '-3%',
          right: '-3%',
          height: 12,
          background: 'linear-gradient(180deg, #232325 0%, #131316 100%)',
          borderRadius: '0 0 14px 14px',
          boxShadow: '0 2px 0 rgba(0,0,0,0.5) inset',
        }}
      />
      {/* Hinge slot */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          left: '40%',
          right: '40%',
          height: 4,
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '0 0 4px 4px',
        }}
      />
    </Box>
  );
}

/**
 * iPad Pro-style frame (portrait would also work, but vi bruker landscape
 * for å vise bredere views).
 * Base-dim: 360×270px (4:3 landscape).
 */
function IpadFrame({ screenshotUrl, screenshotAlt, scale = 1 }: Omit<DeviceMockupProps, 'variant' | 'caption'>) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: 360 * scale,
        maxWidth: '100%',
        aspectRatio: '360/270',
        mx: 'auto',
        filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.5))',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #1c1c1f 0%, #111114 100%)',
          borderRadius: '18px',
          padding: '12px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Front camera dot (left side in landscape) */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: 5,
            transform: 'translateY(-50%)',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#0a0a0a',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
            zIndex: 2,
          }}
        />
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '6px',
            overflow: 'hidden',
            background: '#0b1120',
          }}
        >
          <Box
            component="img"
            src={screenshotUrl}
            alt={screenshotAlt}
            loading="lazy"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

/**
 * iPhone 15 Pro-style frame med Dynamic Island.
 * Base-dim: 200×420px (≈ 9:19 portrait).
 */
function IphoneFrame({ screenshotUrl, screenshotAlt, scale = 1 }: Omit<DeviceMockupProps, 'variant' | 'caption'>) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: 200 * scale,
        maxWidth: '100%',
        aspectRatio: '200/420',
        mx: 'auto',
        filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.55))',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #1f1f22 0%, #0d0d10 100%)',
          borderRadius: '32px',
          padding: '10px',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Dynamic Island */}
        <Box
          sx={{
            position: 'absolute',
            top: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 70,
            height: 18,
            background: '#000',
            borderRadius: '12px',
            zIndex: 2,
          }}
        />
        {/* Side button glyph */}
        <Box
          sx={{
            position: 'absolute',
            right: -2,
            top: '24%',
            width: 2,
            height: 36,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '0 1px 1px 0',
          }}
        />
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '22px',
            overflow: 'hidden',
            background: '#0b1120',
          }}
        >
          <Box
            component="img"
            src={screenshotUrl}
            alt={screenshotAlt}
            loading="lazy"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}

export default function DeviceMockup({ variant, screenshotUrl, screenshotAlt, caption, scale }: DeviceMockupProps) {
  const FrameComponent =
    variant === 'macbook' ? MacBookFrame :
    variant === 'ipad' ? IpadFrame :
    IphoneFrame;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <FrameComponent screenshotUrl={screenshotUrl} screenshotAlt={screenshotAlt} scale={scale} />
      {caption ? (
        <Typography
          sx={{
            color: 'rgba(203,213,225,0.78)',
            fontSize: '0.86rem',
            textAlign: 'center',
            fontWeight: 500,
            maxWidth: 280,
          }}
        >
          {caption}
        </Typography>
      ) : null}
    </Box>
  );
}
