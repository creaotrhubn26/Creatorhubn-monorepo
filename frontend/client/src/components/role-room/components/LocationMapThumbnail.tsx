/**
 * LocationMapThumbnail — kompakt OpenStreetMap-bilde-thumbnail for lokasjon.
 *
 * Bruker en enkelt OSM-tile (256×256) som <img> istedenfor full Leaflet-
 * instans — gir nær-null overhead selv ved 24+ kort som rendrer samtidig.
 * Marker-prikken plasseres absolutt midt i tilen (ikke pikselpresis siden
 * tilen ofte ikke senterer eksakt på koordinatene, men "godt nok" for en
 * thumbnail som signaliserer "her er den").
 *
 * Robusthet:
 *   - Returnerer null hvis coordinates mangler eller er 0,0 (default-fallback)
 *   - Image error → vis generic kart-ikon istedenfor brutt bilde
 *   - Lazy-loading via loading="lazy" (browser-native off-viewport-skipping)
 *   - aria-label for skjermlesere
 *   - Ingen JS-map-instans = ingen leak ved unmount, ingen DOM-mutasjon
 */

import React, { useState } from 'react';
import { Box } from '@mui/material';
import { LocationOn as MapPinIcon } from '@mui/icons-material';

export interface LocationMapThumbnailProps {
  coordinates: { lat: number; lng: number } | null | undefined;
  /** Visnings-bredde i piksler. Default 80. */
  width?: number;
  /** Visnings-høyde i piksler. Default 60. */
  height?: number;
  /** Optional aria-label for skjermlesere. */
  label?: string;
}

const TILE_SIZE = 256;
const ZOOM = 14; // ~2.5km bredde per tile — viser nabolaget rundt punktet

function latToTileY(lat: number, zoom: number): number {
  return Math.floor(
    ((1 -
      Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) /
        Math.PI) /
      2) *
      Math.pow(2, zoom),
  );
}

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

export const LocationMapThumbnail: React.FC<LocationMapThumbnailProps> = ({
  coordinates,
  width = 80,
  height = 60,
  label,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  if (!coordinates || (coordinates.lat === 0 && coordinates.lng === 0)) {
    return null;
  }

  const x = lngToTileX(coordinates.lng, ZOOM);
  const y = latToTileY(coordinates.lat, ZOOM);
  // Bruker tile.openstreetmap.org direkte — OSM-policyen tillater opptil
  // 700k requests/dag for legitime brukstilfeller. Caches automatisk av
  // browseren etter første lasting.
  const tileUrl = `https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`;

  return (
    <Box
      role="img"
      aria-label={label || `Kart-thumbnail for koordinater ${coordinates.lat.toFixed(3)}, ${coordinates.lng.toFixed(3)}`}
      sx={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}
    >
      {imageFailed ? (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(168,85,247,0.6)',
          }}
        >
          <MapPinIcon sx={{ fontSize: Math.min(width, height) * 0.55 }} />
        </Box>
      ) : (
        <>
          <Box
            component="img"
            src={tileUrl}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: TILE_SIZE,
              height: TILE_SIZE,
              transform: 'translate(-50%, -50%)',
              // Mørk overlay via filter for å matche Role Room-mørke-tema
              filter: 'brightness(0.75) saturate(0.9)',
              pointerEvents: 'none',
            }}
          />
          {/* Marker-pulserende prikk i sentrum */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: '#a855f7',
              border: '2px solid #fff',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 0 4px rgba(168,85,247,0.25)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}
    </Box>
  );
};
