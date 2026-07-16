/**
 * Ikon per utstyrs-kategori. Vi bruker tydelige kategori-ikoner (kamera,
 * objektiv, drone, lys, lyd …) i stedet for ekte produktbilder — produktfoto
 * krever hosting/rettigheter, mens ikonene gir rask visuell gjenkjenning uten
 * avhengigheter og fungerer likt i katalog, chips og profilkort.
 */

import React from 'react';
import {
  Videocam, CameraAlt, FlightTakeoff, ControlCamera, WbIncandescent,
  Mic, Construction, Memory,
} from '@mui/icons-material';
import type { SvgIconProps } from '@mui/material';
import type { EquipmentCategory } from '../utils/equipmentCatalog';

const ICON_BY_CATEGORY: Record<EquipmentCategory, React.ComponentType<SvgIconProps>> = {
  camera: Videocam,
  lens: CameraAlt,
  drone: FlightTakeoff,
  gimbal: ControlCamera,
  light: WbIncandescent,
  audio: Mic,
  support: Construction,
  software: Memory,
};

export const EquipmentCategoryIcon: React.FC<{ category: EquipmentCategory } & SvgIconProps> = ({
  category, ...props
}) => {
  const Icon = ICON_BY_CATEGORY[category] ?? Construction;
  return <Icon {...props} />;
};

export default EquipmentCategoryIcon;
