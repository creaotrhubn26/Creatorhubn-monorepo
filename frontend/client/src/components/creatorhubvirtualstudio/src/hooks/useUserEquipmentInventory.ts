/**
 * useUserEquipmentInventory - Hook to fetch user, 's owned equipment
 * 
 * Connects Virtual Studio to the user, 's equipment inventory from the dashboard.
 * Enables filtering in EquipmentBrowser to show only owned equipment.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '../core/services/logger';
import { useAuth } from '@/hooks/useAuth';

const log = logger.module('EquipmentInventory, ');

export interface UserEquipmentItem {
  id: string;
  userId: string;
  name: string;
  brand?: string;
  model?: string;
  category?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
  status?: 'available' | 'in-use' | 'maintenance' | 'rented-out';
  location?: string;
  notes?: string;
  specifications?: Record<string, unknown>;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Wikimedia Commons equipment images
 * Free-to-use images from https://commons.wikimedia.org/
 */
export const EQUIPMENT_IMAGES: Record<string, string> = {
  // ============================================================================
  // CAMERAS - Wikimedia Commons
  // ============================================================================
  
  // Canon Cameras
  'canon-eos-r5':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Canon_EOS_R5_body.jpg/320px-Canon_EOS_R5_body.jpg','canon-eos-r6':'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Canon_EOS_R6_body.jpg/320px-Canon_EOS_R6_body.jpg','canon-eos-r3':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Canon_EOS_R3_01.jpg/320px-Canon_EOS_R3_01.jpg','canon-eos-r':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Canon_EOS_R_with_Canon_RF_24-105mm_F4_L_IS_USM.jpg/320px-Canon_EOS_R_with_Canon_RF_24-105mm_F4_L_IS_USM.jpg','canon-5d-mark-iv':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Canon_EOS_5D_Mark_IV_with_EF_50_1.4.jpg/320px-Canon_EOS_5D_Mark_IV_with_EF_50_1.4.jpg','canon-5d-mark-iii':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Canon_EOS_5D_Mark_III.jpg/320px-Canon_EOS_5D_Mark_III.jpg','canon-6d-mark-ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Canon_EOS_6D_Mark_II_with_EF_24-105mm_F4L_IS_II_USM.jpg/320px-Canon_EOS_6D_Mark_II_with_EF_24-105mm_F4L_IS_II_USM.jpg','canon-90d':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Canon_EOS_90D_01.jpg/320px-Canon_EOS_90D_01.jpg','canon-7d-mark-ii' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Canon_EOS_7D_Mark_II_with_Canon_EF_100-400mm_F4.5-5.6L_IS_II_USM.jpg/320px-Canon_EOS_7D_Mark_II_with_Canon_EF_100-400mm_F4.5-5.6L_IS_II_USM.jpg',
  
  // Sony Cameras
  'sony-a7':'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Sony_A7R_III_with_FE_24-70mm_F4_ZA_OSS.jpg/320px-Sony_A7R_III_with_FE_24-70mm_F4_ZA_OSS.jpg','sony-a7iv':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Sony_Alpha_7_IV_%28ILCE-7M4%29_01.jpg/320px-Sony_Alpha_7_IV_%28ILCE-7M4%29_01.jpg','sony-a7iii':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Sony_a7_III_with_FE_28-70mm_F3.5-5.6_OSS.jpg/320px-Sony_a7_III_with_FE_28-70mm_F3.5-5.6_OSS.jpg','sony-a7riv':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Sony_A7R_IV_01.jpg/320px-Sony_A7R_IV_01.jpg','sony-a7rv':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Sony_Alpha_7R_V_01.jpg/320px-Sony_Alpha_7R_V_01.jpg','sony-a7siii':'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Sony_Alpha_7S_III_01.jpg/320px-Sony_Alpha_7S_III_01.jpg','sony-a1':'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Sony_Alpha_1_02.jpg/320px-Sony_Alpha_1_02.jpg','sony-a9ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Sony_Alpha_9_II_01.jpg/320px-Sony_Alpha_9_II_01.jpg','sony-a6600':'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Sony_Alpha_6600_01.jpg/320px-Sony_Alpha_6600_01.jpg','sony-a6400':'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Sony_A6400_01.jpg/320px-Sony_A6400_01.jpg','sony-zv-e10':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Sony_ZV-E10_01.jpg/320px-Sony_ZV-E10_01.jpg','sony-fx3':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Sony_FX3_01.jpg/320px-Sony_FX3_01.jpg','sony-fx6' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Sony_FX6_01.jpg/320px-Sony_FX6_01.jpg',
  
  // Nikon Cameras
  'nikon-z9':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Nikon_Z_9_01.jpg/320px-Nikon_Z_9_01.jpg','nikon-z8':'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Nikon_Z_8_02.jpg/320px-Nikon_Z_8_02.jpg','nikon-z7ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Nikon_Z7_II_01.jpg/320px-Nikon_Z7_II_01.jpg','nikon-z6ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Nikon_Z6_II_01.jpg/320px-Nikon_Z6_II_01.jpg','nikon-z6':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Nikon_Z6_mit_Nikkor_Z_24-70mm_4_S.jpg/320px-Nikon_Z6_mit_Nikkor_Z_24-70mm_4_S.jpg','nikon-z5':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Nikon_Z_5_01.jpg/320px-Nikon_Z_5_01.jpg','nikon-zf':'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Nikon_Zf_01.jpg/320px-Nikon_Zf_01.jpg','nikon-z50':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Nikon_Z50_01.jpg/320px-Nikon_Z50_01.jpg','nikon-d850':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Nikon_D850_01.jpg/320px-Nikon_D850_01.jpg','nikon-d780':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Nikon_D780_01.jpg/320px-Nikon_D780_01.jpg','nikon-d750':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Nikon_D750_01.jpg/320px-Nikon_D750_01.jpg','nikon-d500' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Nikon_D500_01.jpg/320px-Nikon_D500_01.jpg',
  
  // Fujifilm Cameras
  'fujifilm-xt5':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Fujifilm_X-T5_01.jpg/320px-Fujifilm_X-T5_01.jpg','fujifilm-xt4':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Fujifilm_X-T4_01.jpg/320px-Fujifilm_X-T4_01.jpg','fujifilm-xh2':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Fujifilm_X-H2_01.jpg/320px-Fujifilm_X-H2_01.jpg','fujifilm-xh2s':'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Fujifilm_X-H2S_01.jpg/320px-Fujifilm_X-H2S_01.jpg','fujifilm-xs20':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Fujifilm_X-S20_01.jpg/320px-Fujifilm_X-S20_01.jpg','fujifilm-gfx100s':'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Fujifilm_GFX_100S_01.jpg/320px-Fujifilm_GFX_100S_01.jpg','fujifilm-gfx100ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Fujifilm_GFX100_II_01.jpg/320px-Fujifilm_GFX100_II_01.jpg','fujifilm-gfx50sii' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Fujifilm_GFX_50S_II_01.jpg/320px-Fujifilm_GFX_50S_II_01.jpg',
  
  // Panasonic Cameras
  'panasonic-s5':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Panasonic_Lumix_DC-S5.jpg/320px-Panasonic_Lumix_DC-S5.jpg','panasonic-s5ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Panasonic_Lumix_S5II_01.jpg/320px-Panasonic_Lumix_S5II_01.jpg','panasonic-s1':'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Panasonic_Lumix_DC-S1.jpg/320px-Panasonic_Lumix_DC-S1.jpg','panasonic-s1r':'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Panasonic_Lumix_DC-S1R.jpg/320px-Panasonic_Lumix_DC-S1R.jpg','panasonic-s1h':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Panasonic_Lumix_DC-S1H.jpg/320px-Panasonic_Lumix_DC-S1H.jpg','panasonic-gh6':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Panasonic_Lumix_DC-GH6_01.jpg/320px-Panasonic_Lumix_DC-GH6_01.jpg','panasonic-gh5ii' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Panasonic_Lumix_DC-GH5M2_01.jpg/320px-Panasonic_Lumix_DC-GH5M2_01.jpg',
  
  // Leica Cameras
  'leica-sl2':'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Leica_SL2_01.jpg/320px-Leica_SL2_01.jpg','leica-sl2s':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Leica_SL2-S_01.jpg/320px-Leica_SL2-S_01.jpg','leica-q3':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Leica_Q3_01.jpg/320px-Leica_Q3_01.jpg','leica-m11' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Leica_M11_01.jpg/320px-Leica_M11_01.jpg',
  
  // ============================================================================
  // LENSES - Wikimedia Commons
  // ============================================================================
  
  // Canon RF Lenses
  'canon-rf-50mm-f1.2':'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Canon_RF_50mm_F1.2_L_USM.jpg/320px-Canon_RF_50mm_F1.2_L_USM.jpg','canon-rf-85mm-f1.2':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Canon_RF_85mm_F1.2_L_USM.jpg/320px-Canon_RF_85mm_F1.2_L_USM.jpg','canon-rf-28-70mm-f2':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_RF_28-70mm_F2_L_USM.jpg/320px-Canon_RF_28-70mm_F2_L_USM.jpg','canon-rf-24-70mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Canon_RF_24-70mm_F2.8_L_IS_USM.jpg/320px-Canon_RF_24-70mm_F2.8_L_IS_USM.jpg','canon-rf-70-200mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Canon_RF_70-200mm_F2.8_L_IS_USM.jpg/320px-Canon_RF_70-200mm_F2.8_L_IS_USM.jpg','canon-rf-100-500mm':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Canon_RF_100-500mm_F4.5-7.1_L_IS_USM.jpg/320px-Canon_RF_100-500mm_F4.5-7.1_L_IS_USM.jpg','canon-rf-15-35mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Canon_RF_15-35mm_F2.8_L_IS_USM.jpg/320px-Canon_RF_15-35mm_F2.8_L_IS_USM.jpg','canon-rf-35mm-f1.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Canon_RF_35mm_F1.8_Macro_IS_STM.jpg/320px-Canon_RF_35mm_F1.8_Macro_IS_STM.jpg','canon-rf-100mm-f2.8-macro' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Canon_RF_100mm_F2.8_L_Macro_IS_USM.jpg/320px-Canon_RF_100mm_F2.8_L_Macro_IS_USM.jpg',
  
  // Canon EF Lenses
  'canon-ef-24-70mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Canon_EF_24-70mm_F2.8L_II_USM.jpg/320px-Canon_EF_24-70mm_F2.8L_II_USM.jpg','canon-ef-70-200mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Canon_EF_70-200mm_F2.8L_IS_III_USM.jpg/320px-Canon_EF_70-200mm_F2.8L_IS_III_USM.jpg','canon-ef-50mm-f1.2':'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Canon_EF_50mm_F1.2L_USM.jpg/320px-Canon_EF_50mm_F1.2L_USM.jpg','canon-ef-50mm-f1.4':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Canon_EF_50mm_F1.4_USM.jpg/320px-Canon_EF_50mm_F1.4_USM.jpg','canon-ef-50mm-f1.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Canon_EF_50mm_f1.8_II.jpg/320px-Canon_EF_50mm_f1.8_II.jpg','canon-ef-85mm-f1.4':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Canon_EF_85mm_F1.4L_IS_USM.jpg/320px-Canon_EF_85mm_F1.4L_IS_USM.jpg','canon-ef-100mm-f2.8-macro':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Canon_EF_100mm_F2.8L_Macro_IS_USM.jpg/320px-Canon_EF_100mm_F2.8L_Macro_IS_USM.jpg','canon-ef-16-35mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Canon_EF_16-35mm_F2.8L_III_USM.jpg/320px-Canon_EF_16-35mm_F2.8L_III_USM.jpg','canon-ef-100-400mm' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Canon_EF_100-400mm_F4.5-5.6L_IS_II_USM.jpg/320px-Canon_EF_100-400mm_F4.5-5.6L_IS_II_USM.jpg',
  
  // Sony FE/GM Lenses
  'sony-fe-24-70mm-f2.8-gm':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Sony_FE_24-70mm_F2.8_GM.jpg/320px-Sony_FE_24-70mm_F2.8_GM.jpg','sony-fe-70-200mm-f2.8-gm':'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Sony_FE_70-200mm_F2.8_GM_OSS.jpg/320px-Sony_FE_70-200mm_F2.8_GM_OSS.jpg','sony-fe-24-70mm-f2.8-gmii':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Sony_FE_24-70mm_F2.8_GM_II_01.jpg/320px-Sony_FE_24-70mm_F2.8_GM_II_01.jpg','sony-fe-70-200mm-f2.8-gmii':'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Sony_FE_70-200mm_F2.8_GM_OSS_II_01.jpg/320px-Sony_FE_70-200mm_F2.8_GM_OSS_II_01.jpg','sony-fe-50mm-f1.2-gm':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Sony_FE_50mm_F1.2_GM_01.jpg/320px-Sony_FE_50mm_F1.2_GM_01.jpg','sony-fe-85mm-f1.4-gm':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Sony_FE_85mm_F1.4_GM.jpg/320px-Sony_FE_85mm_F1.4_GM.jpg','sony-fe-35mm-f1.4-gm':'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Sony_FE_35mm_F1.4_GM_01.jpg/320px-Sony_FE_35mm_F1.4_GM_01.jpg','sony-fe-14mm-f1.8-gm':'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Sony_FE_14mm_F1.8_GM_01.jpg/320px-Sony_FE_14mm_F1.8_GM_01.jpg','sony-fe-12-24mm-f2.8-gm':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Sony_FE_12-24mm_F2.8_GM.jpg/320px-Sony_FE_12-24mm_F2.8_GM.jpg','sony-fe-100-400mm-gm':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Sony_FE_100-400mm_F4.5-5.6_GM_OSS.jpg/320px-Sony_FE_100-400mm_F4.5-5.6_GM_OSS.jpg','sony-fe-200-600mm-g':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Sony_FE_200-600mm_F5.6-6.3_G_OSS.jpg/320px-Sony_FE_200-600mm_F5.6-6.3_G_OSS.jpg','sony-fe-90mm-f2.8-macro':'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Sony_FE_90mm_F2.8_Macro_G_OSS.jpg/320px-Sony_FE_90mm_F2.8_Macro_G_OSS.jpg','sony-fe-55mm-f1.8' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Sony_Sonnar_T%2A_FE_55mm_F1.8_ZA.jpg/320px-Sony_Sonnar_T%2A_FE_55mm_F1.8_ZA.jpg',
  
  // Nikon Z Lenses
  'nikon-z-24-70mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Nikkor_Z_24-70mm_F2.8_S.jpg/320px-Nikkor_Z_24-70mm_F2.8_S.jpg','nikon-z-70-200mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Nikkor_Z_70-200mm_F2.8_VR_S.jpg/320px-Nikkor_Z_70-200mm_F2.8_VR_S.jpg','nikon-z-50mm-f1.2':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Nikkor_Z_50mm_F1.2_S.jpg/320px-Nikkor_Z_50mm_F1.2_S.jpg','nikon-z-50mm-f1.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Nikkor_Z_50mm_F1.8_S.jpg/320px-Nikkor_Z_50mm_F1.8_S.jpg','nikon-z-85mm-f1.2':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Nikkor_Z_85mm_F1.2_S.jpg/320px-Nikkor_Z_85mm_F1.2_S.jpg','nikon-z-85mm-f1.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Nikkor_Z_85mm_F1.8_S.jpg/320px-Nikkor_Z_85mm_F1.8_S.jpg','nikon-z-14-24mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Nikkor_Z_14-24mm_F2.8_S.jpg/320px-Nikkor_Z_14-24mm_F2.8_S.jpg','nikon-z-100-400mm':'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Nikkor_Z_100-400mm_F4.5-5.6_VR_S.jpg/320px-Nikkor_Z_100-400mm_F4.5-5.6_VR_S.jpg','nikon-z-105mm-f2.8-macro':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Nikkor_Z_MC_105mm_F2.8_VR_S.jpg/320px-Nikkor_Z_MC_105mm_F2.8_VR_S.jpg','nikon-z-35mm-f1.8' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Nikkor_Z_35mm_F1.8_S.jpg/320px-Nikkor_Z_35mm_F1.8_S.jpg',
  
  // Sigma Art Lenses
  'sigma-art-35mm-f1.4':'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Sigma_35mm_F1.4_DG_HSM_Art.jpg/320px-Sigma_35mm_F1.4_DG_HSM_Art.jpg','sigma-art-50mm-f1.4':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Sigma_50mm_F1.4_DG_HSM_Art.jpg/320px-Sigma_50mm_F1.4_DG_HSM_Art.jpg','sigma-art-85mm-f1.4':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Sigma_85mm_F1.4_DG_HSM_Art.jpg/320px-Sigma_85mm_F1.4_DG_HSM_Art.jpg','sigma-art-24-70mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Sigma_24-70mm_F2.8_DG_DN_Art.jpg/320px-Sigma_24-70mm_F2.8_DG_DN_Art.jpg','sigma-art-14-24mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Sigma_14-24mm_F2.8_DG_HSM_Art.jpg/320px-Sigma_14-24mm_F2.8_DG_HSM_Art.jpg','sigma-art-24mm-f1.4':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Sigma_24mm_F1.4_DG_HSM_Art.jpg/320px-Sigma_24mm_F1.4_DG_HSM_Art.jpg','sigma-art-105mm-f1.4':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Sigma_105mm_F1.4_DG_HSM_Art.jpg/320px-Sigma_105mm_F1.4_DG_HSM_Art.jpg','sigma-art-135mm-f1.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Sigma_135mm_F1.8_DG_HSM_Art.jpg/320px-Sigma_135mm_F1.8_DG_HSM_Art.jpg','sigma-art-40mm-f1.4':'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Sigma_40mm_F1.4_DG_HSM_Art.jpg/320px-Sigma_40mm_F1.4_DG_HSM_Art.jpg','sigma-art-20mm-f1.4' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Sigma_20mm_F1.4_DG_HSM_Art.jpg/320px-Sigma_20mm_F1.4_DG_HSM_Art.jpg',
  
  // Tamron Lenses
  'tamron-28-75mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Tamron_28-75mm_F2.8_Di_III_RXD.jpg/320px-Tamron_28-75mm_F2.8_Di_III_RXD.jpg','tamron-70-180mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Tamron_70-180mm_F2.8_Di_III_VXD.jpg/320px-Tamron_70-180mm_F2.8_Di_III_VXD.jpg','tamron-17-28mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Tamron_17-28mm_F2.8_Di_III_RXD.jpg/320px-Tamron_17-28mm_F2.8_Di_III_RXD.jpg','tamron-35mm-f1.4':'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Tamron_SP_35mm_F1.4_Di_USD.jpg/320px-Tamron_SP_35mm_F1.4_Di_USD.jpg','tamron-150-500mm' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Tamron_150-500mm_F5-6.7_Di_III_VC_VXD.jpg/320px-Tamron_150-500mm_F5-6.7_Di_III_VC_VXD.jpg',
  
  // Zeiss Lenses
  'zeiss-batis-85mm':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Zeiss_Batis_85mm_F1.8.jpg/320px-Zeiss_Batis_85mm_F1.8.jpg','zeiss-batis-25mm':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Zeiss_Batis_25mm_F2.jpg/320px-Zeiss_Batis_25mm_F2.jpg','zeiss-milvus-50mm':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Zeiss_Milvus_50mm_F1.4.jpg/320px-Zeiss_Milvus_50mm_F1.4.jpg','zeiss-otus-55mm' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Zeiss_Otus_55mm_F1.4.jpg/320px-Zeiss_Otus_55mm_F1.4.jpg',
  
  // Fujifilm XF Lenses
  'fujifilm-xf-56mm-f1.2':'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Fujifilm_XF_56mm_F1.2_R.jpg/320px-Fujifilm_XF_56mm_F1.2_R.jpg','fujifilm-xf-23mm-f1.4':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Fujifilm_XF_23mm_F1.4_R.jpg/320px-Fujifilm_XF_23mm_F1.4_R.jpg','fujifilm-xf-16-55mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Fujifilm_XF_16-55mm_F2.8_R_LM_WR.jpg/320px-Fujifilm_XF_16-55mm_F2.8_R_LM_WR.jpg','fujifilm-xf-50-140mm-f2.8':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Fujifilm_XF_50-140mm_F2.8_R_LM_OIS_WR.jpg/320px-Fujifilm_XF_50-140mm_F2.8_R_LM_OIS_WR.jpg','fujifilm-xf-35mm-f1.4' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Fujifilm_XF_35mm_F1.4_R.jpg/320px-Fujifilm_XF_35mm_F1.4_R.jpg',
  
  // ============================================================================
  // FLASHES / SPEEDLITES - Wikimedia Commons
  // ============================================================================
  
  // Canon Speedlites
  'canon-speedlite-600ex':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','canon-speedlite-600ex-ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','canon-speedlite-580ex':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','canon-speedlite-580ex-ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','canon-speedlite-430ex':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','canon-speedlite-430ex-iii':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','canon-speedlite-el-1':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','canon-el-1':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','canon-flash' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg',
  
  // Nikon Speedlights
  'nikon-sb-5000':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nikon_SB-800.jpg/320px-Nikon_SB-800.jpg','nikon-sb-910':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nikon_SB-800.jpg/320px-Nikon_SB-800.jpg','nikon-sb-900':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nikon_SB-800.jpg/320px-Nikon_SB-800.jpg','nikon-sb-800':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nikon_SB-800.jpg/320px-Nikon_SB-800.jpg','nikon-sb-700':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nikon_SB-800.jpg/320px-Nikon_SB-800.jpg','nikon-sb-600':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nikon_SB-800.jpg/320px-Nikon_SB-800.jpg','nikon-sb-500':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nikon_SB-800.jpg/320px-Nikon_SB-800.jpg','nikon-speedlight':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nikon_SB-800.jpg/320px-Nikon_SB-800.jpg','nikon-flash' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nikon_SB-800.jpg/320px-Nikon_SB-800.jpg',
  
  // Sony Flashes
  'sony-hvl-f60rm':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Sony_HVL-F58AM.jpg/320px-Sony_HVL-F58AM.jpg','sony-hvl-f60rm2':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Sony_HVL-F58AM.jpg/320px-Sony_HVL-F58AM.jpg','sony-hvl-f46rm':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Sony_HVL-F58AM.jpg/320px-Sony_HVL-F58AM.jpg','sony-hvl-f58am':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Sony_HVL-F58AM.jpg/320px-Sony_HVL-F58AM.jpg','sony-hvl-f43am':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Sony_HVL-F58AM.jpg/320px-Sony_HVL-F58AM.jpg','sony-hvl-f32m':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Sony_HVL-F58AM.jpg/320px-Sony_HVL-F58AM.jpg','sony-flash' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Sony_HVL-F58AM.jpg/320px-Sony_HVL-F58AM.jpg',
  
  // Godox Speedlites/Flashes
  'godox-v1':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Godox_V860II-C.jpg/320px-Godox_V860II-C.jpg','godox-v860':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Godox_V860II-C.jpg/320px-Godox_V860II-C.jpg','godox-v860ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Godox_V860II-C.jpg/320px-Godox_V860II-C.jpg','godox-v860iii':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Godox_V860II-C.jpg/320px-Godox_V860II-C.jpg','godox-tt685':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Godox_V860II-C.jpg/320px-Godox_V860II-C.jpg','godox-tt685ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Godox_V860II-C.jpg/320px-Godox_V860II-C.jpg','godox-tt600':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Godox_V860II-C.jpg/320px-Godox_V860II-C.jpg','godox-speedlite':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Godox_V860II-C.jpg/320px-Godox_V860II-C.jpg','godox-flash' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Godox_V860II-C.jpg/320px-Godox_V860II-C.jpg',
  
  // Godox Portable Strobes (AD series)
  'godox-ad200':'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Godox_AD200Pro.jpg/320px-Godox_AD200Pro.jpg','godox-ad200-pro':'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Godox_AD200Pro.jpg/320px-Godox_AD200Pro.jpg','godox-ad300-pro':'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Godox_AD200Pro.jpg/320px-Godox_AD200Pro.jpg','godox-ad400-pro':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','godox-ad600':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','godox-ad600-pro' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg',
  
  // Fujifilm Flashes
  'fujifilm-ef-x500':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','fujifilm-ef-60':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','fujifilm-ef-42':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','fujifilm-ef-20':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','fujifilm-flash' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg',
  
  // Yongnuo Flashes (Budget alternative)
  'yongnuo-yn600ex':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','yongnuo-yn685':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','yongnuo-yn560':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','yongnuo-yn565ex':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','yongnuo-flash' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg',
  
  // Nissin Flashes
  'nissin-di700a':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','nissin-i60a':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','nissin-mg80-pro':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','nissin-flash' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg',
  
  // Metz Flashes
  'metz-52-af-1':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','metz-64-af-1':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','metz-flash' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg',
  
  // Profoto Flashes
  'profoto-a1':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Profoto_A1_flash.jpg/320px-Profoto_A1_flash.jpg','profoto-a1x':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Profoto_A1_flash.jpg/320px-Profoto_A1_flash.jpg','profoto-a10':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Profoto_A1_flash.jpg/320px-Profoto_A1_flash.jpg','profoto-flash' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Profoto_A1_flash.jpg/320px-Profoto_A1_flash.jpg',
  
  // Generic Flash
  'speedlite':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','speedlight':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nikon_SB-800.jpg/320px-Nikon_SB-800.jpg','flash-generic' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg',
  
  // ============================================================================
  // STUDIO LIGHTING - Wikimedia Commons
  // ============================================================================
  
  // Profoto Studio Strobes
  'profoto-b10':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','profoto-b10-plus':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','profoto-b1':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','profoto-b1x':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','profoto-b2':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','profoto-d2':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','profoto-d1':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','profoto-pro':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','profoto-strobe' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg',
  
  // Elinchrom Studio Strobes
  'elinchrom-elc':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','elinchrom-elc-125':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','elinchrom-elc-500':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','elinchrom-dlite':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','elinchrom-one':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','elinchrom-five':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','elinchrom-strobe' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg',
  
  // Broncolor Studio Strobes
  'broncolor-siros':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','broncolor-siros-400':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','broncolor-siros-800':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','broncolor-move':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','broncolor-strobe' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg',
  
  // Godox Studio Strobes
  'godox-sk400':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','godox-sk300':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','godox-ms300':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','godox-dp600':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','godox-strobe' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg',
  
  // ============================================================================
  // CONTINUOUS / LED LIGHTS - Wikimedia Commons
  // ============================================================================
  
  // Aputure LEDs
  'aputure-600d':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','aputure-600d-pro':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','aputure-600c-pro':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','aputure-300d':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','aputure-300d-ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','aputure-300x':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','aputure-120d':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','aputure-120d-ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','aputure-amaran':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','aputure-mc':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','aputure-led' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg',
  
  // Nanlite LEDs
  'nanlite-forza':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','nanlite-forza-60':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','nanlite-forza-300':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','nanlite-forza-500':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','nanlite-pavotube':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','nanlite-litolite':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','nanlite-led' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg',
  
  // Godox LEDs
  'godox-sl-60w':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','godox-sl-150w':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','godox-sl-200w':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','godox-vl150':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','godox-vl300':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','godox-led' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg',
  
  // Light Modifiers
  'softbox':'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Softbox_studio_lighting.jpg/320px-Softbox_studio_lighting.jpg','ring-light':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Ring_light_photography.jpg/320px-Ring_light_photography.jpg','led-panel':'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/LED_photography_light_panel.jpg/320px-LED_photography_light_panel.jpg','beauty-dish':'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Softbox_studio_lighting.jpg/320px-Softbox_studio_lighting.jpg','umbrella':'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Softbox_studio_lighting.jpg/320px-Softbox_studio_lighting.jpg','octabox' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Softbox_studio_lighting.jpg/320px-Softbox_studio_lighting.jpg',
  
  // ============================================================================
  // AUDIO EQUIPMENT - Wikimedia Commons
  // ============================================================================
  'rode-ntg3':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Rode_NTG-2_shotgun_microphone.jpg/320px-Rode_NTG-2_shotgun_microphone.jpg','rode-ntg2':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Rode_NTG-2_shotgun_microphone.jpg/320px-Rode_NTG-2_shotgun_microphone.jpg','rode-videomic':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Rode_NTG-2_shotgun_microphone.jpg/320px-Rode_NTG-2_shotgun_microphone.jpg','sennheiser-mke600':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Rode_NTG-2_shotgun_microphone.jpg/320px-Rode_NTG-2_shotgun_microphone.jpg','zoom-h6' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Zoom_H6_Handy_Recorder.jpg/320px-Zoom_H6_Handy_Recorder.jpg',
  
  // ============================================================================
  // SUPPORT EQUIPMENT - Wikimedia Commons
  // ============================================================================
  'tripod':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Gitzo_GT3542LS_tripod.jpg/320px-Gitzo_GT3542LS_tripod.jpg','manfrotto-tripod':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Gitzo_GT3542LS_tripod.jpg/320px-Gitzo_GT3542LS_tripod.jpg','gitzo-tripod':'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Gitzo_GT3542LS_tripod.jpg/320px-Gitzo_GT3542LS_tripod.jpg','gimbal':'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/DJI_RS_3_Pro_01.jpg/320px-DJI_RS_3_Pro_01.jpg','dji-rs3' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/DJI_RS_3_Pro_01.jpg/320px-DJI_RS_3_Pro_01.jpg',
  
  // ============================================================================
  // GENERIC FALLBACKS - Wikimedia Commons
  // ============================================================================
  'camera':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Canon_EOS_5D_Mark_III.jpg/320px-Canon_EOS_5D_Mark_III.jpg','lens':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Canon_EF_50mm_f1.8_II.jpg/320px-Canon_EF_50mm_f1.8_II.jpg','lighting':'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/320px-Studio_strobe_light.jpg','flash':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/320px-Canon_Speedlite_580EX_II.jpg','microphone':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Rode_NTG-2_shotgun_microphone.jpg/320px-Rode_NTG-2_shotgun_microphone.jpg','audio' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Rode_NTG-2_shotgun_microphone.jpg/320px-Rode_NTG-2_shotgun_microphone.jpg',
};

/**
 * Get equipment image URL from Wikimedia Commons or fallback
 */
export function getEquipmentImageUrl(item: UserEquipmentItem): string {
  // If item has a custom image, use it
  if (item.imageUrl) return item.imageUrl;
  
  // Try to match by brand-model key
  const brandModel = `${(item.brand || ', ').toLowerCase()}-${(item.model || ', ').toLowerCase()}`.replace(/\s+/g,'-');
  if (EQUIPMENT_IMAGES[brandModel]) {
    return EQUIPMENT_IMAGES[brandModel];
  }
  
  // Try partial matches
  const searchKey = `${item.brand || ', '} ${item.model || ', '} ${item.name || ', '}`.toLowerCase();
  
  // ========== LENS MATCHING ==========
  
  // Canon RF Lenses
  if (searchKey.includes('canon') && searchKey.includes('rf')) {
    if (searchKey.includes('50mm') && searchKey.includes('1.2')) return EQUIPMENT_IMAGES['canon-rf-50mm-f1.2'];
    if (searchKey.includes('85mm') && searchKey.includes('1.2')) return EQUIPMENT_IMAGES['canon-rf-85mm-f1.2'];
    if (searchKey.includes('28-70') && searchKey.includes('f2')) return EQUIPMENT_IMAGES['canon-rf-28-70mm-f2'];
    if (searchKey.includes('24-70') && searchKey.includes('2.8')) return EQUIPMENT_IMAGES['canon-rf-24-70mm-f2.8'];
    if (searchKey.includes('70-200') && searchKey.includes('2.8')) return EQUIPMENT_IMAGES['canon-rf-70-200mm-f2.8'];
    if (searchKey.includes('15-35')) return EQUIPMENT_IMAGES['canon-rf-15-35mm-f2.8'];
    if (searchKey.includes('100-500')) return EQUIPMENT_IMAGES['canon-rf-100-500mm'];
    if (searchKey.includes('35mm')) return EQUIPMENT_IMAGES['canon-rf-35mm-f1.8'];
    if (searchKey.includes('100mm') && searchKey.includes('macro')) return EQUIPMENT_IMAGES['canon-rf-100mm-f2.8-macro'];
    return EQUIPMENT_IMAGES['lens'];
  }
  
  // Canon EF Lenses
  if (searchKey.includes('canon') && (searchKey.includes('ef') || searchKey.includes('lens'))) {
    if (searchKey.includes('24-70') && searchKey.includes('2.8')) return EQUIPMENT_IMAGES['canon-ef-24-70mm-f2.8'];
    if (searchKey.includes('70-200') && searchKey.includes('2.8')) return EQUIPMENT_IMAGES['canon-ef-70-200mm-f2.8'];
    if (searchKey.includes('50mm') && searchKey.includes('1.2')) return EQUIPMENT_IMAGES['canon-ef-50mm-f1.2'];
    if (searchKey.includes('50mm') && searchKey.includes('1.4')) return EQUIPMENT_IMAGES['canon-ef-50mm-f1.4'];
    if (searchKey.includes('50mm') && searchKey.includes('1.8')) return EQUIPMENT_IMAGES['canon-ef-50mm-f1.8'];
    if (searchKey.includes('85mm')) return EQUIPMENT_IMAGES['canon-ef-85mm-f1.4'];
    if (searchKey.includes('100mm') && searchKey.includes('macro')) return EQUIPMENT_IMAGES['canon-ef-100mm-f2.8-macro'];
    if (searchKey.includes('16-35')) return EQUIPMENT_IMAGES['canon-ef-16-35mm-f2.8'];
    if (searchKey.includes('100-400')) return EQUIPMENT_IMAGES['canon-ef-100-400mm'];
    return EQUIPMENT_IMAGES['lens'];
  }
  
  // Sony FE/GM Lenses
  if (searchKey.includes('sony') && (searchKey.includes('fe') || searchKey.includes('gm') || searchKey.includes('lens'))) {
    if (searchKey.includes('24-70') && searchKey.includes('gm') && searchKey.includes('ii')) return EQUIPMENT_IMAGES['sony-fe-24-70mm-f2.8-gmii'];
    if (searchKey.includes('24-70') && searchKey.includes('2.8')) return EQUIPMENT_IMAGES['sony-fe-24-70mm-f2.8-gm'];
    if (searchKey.includes('70-200') && searchKey.includes('gm') && searchKey.includes('ii')) return EQUIPMENT_IMAGES['sony-fe-70-200mm-f2.8-gmii'];
    if (searchKey.includes('70-200') && searchKey.includes('2.8')) return EQUIPMENT_IMAGES['sony-fe-70-200mm-f2.8-gm'];
    if (searchKey.includes('50mm') && searchKey.includes('1.2')) return EQUIPMENT_IMAGES['sony-fe-50mm-f1.2-gm'];
    if (searchKey.includes('85mm') && searchKey.includes('1.4')) return EQUIPMENT_IMAGES['sony-fe-85mm-f1.4-gm'];
    if (searchKey.includes('35mm') && searchKey.includes('1.4')) return EQUIPMENT_IMAGES['sony-fe-35mm-f1.4-gm'];
    if (searchKey.includes('14mm')) return EQUIPMENT_IMAGES['sony-fe-14mm-f1.8-gm'];
    if (searchKey.includes('12-24')) return EQUIPMENT_IMAGES['sony-fe-12-24mm-f2.8-gm'];
    if (searchKey.includes('100-400')) return EQUIPMENT_IMAGES['sony-fe-100-400mm-gm'];
    if (searchKey.includes('200-600')) return EQUIPMENT_IMAGES['sony-fe-200-600mm-g'];
    if (searchKey.includes('90mm') && searchKey.includes('macro')) return EQUIPMENT_IMAGES['sony-fe-90mm-f2.8-macro'];
    if (searchKey.includes('55mm')) return EQUIPMENT_IMAGES['sony-fe-55mm-f1.8'];
    return EQUIPMENT_IMAGES['lens'];
  }
  
  // Nikon Z Lenses
  if (searchKey.includes('nikon') && (searchKey.includes('nikkor') || searchKey.includes('z') || searchKey.includes('lens'))) {
    if (searchKey.includes('24-70') && searchKey.includes('2.8')) return EQUIPMENT_IMAGES['nikon-z-24-70mm-f2.8'];
    if (searchKey.includes('70-200') && searchKey.includes('2.8')) return EQUIPMENT_IMAGES['nikon-z-70-200mm-f2.8'];
    if (searchKey.includes('50mm') && searchKey.includes('1.2')) return EQUIPMENT_IMAGES['nikon-z-50mm-f1.2'];
    if (searchKey.includes('50mm') && searchKey.includes('1.8')) return EQUIPMENT_IMAGES['nikon-z-50mm-f1.8'];
    if (searchKey.includes('85mm') && searchKey.includes('1.2')) return EQUIPMENT_IMAGES['nikon-z-85mm-f1.2'];
    if (searchKey.includes('85mm') && searchKey.includes('1.8')) return EQUIPMENT_IMAGES['nikon-z-85mm-f1.8'];
    if (searchKey.includes('14-24')) return EQUIPMENT_IMAGES['nikon-z-14-24mm-f2.8'];
    if (searchKey.includes('100-400')) return EQUIPMENT_IMAGES['nikon-z-100-400mm'];
    if (searchKey.includes('105mm') && searchKey.includes('macro')) return EQUIPMENT_IMAGES['nikon-z-105mm-f2.8-macro'];
    if (searchKey.includes('35mm')) return EQUIPMENT_IMAGES['nikon-z-35mm-f1.8'];
    return EQUIPMENT_IMAGES['lens'];
  }
  
  // Sigma Art Lenses
  if (searchKey.includes('sigma') && searchKey.includes('art')) {
    if (searchKey.includes('35mm') && searchKey.includes('1.4')) return EQUIPMENT_IMAGES['sigma-art-35mm-f1.4'];
    if (searchKey.includes('50mm') && searchKey.includes('1.4')) return EQUIPMENT_IMAGES['sigma-art-50mm-f1.4'];
    if (searchKey.includes('85mm') && searchKey.includes('1.4')) return EQUIPMENT_IMAGES['sigma-art-85mm-f1.4'];
    if (searchKey.includes('24-70')) return EQUIPMENT_IMAGES['sigma-art-24-70mm-f2.8'];
    if (searchKey.includes('14-24')) return EQUIPMENT_IMAGES['sigma-art-14-24mm-f2.8'];
    if (searchKey.includes('24mm')) return EQUIPMENT_IMAGES['sigma-art-24mm-f1.4'];
    if (searchKey.includes('105mm')) return EQUIPMENT_IMAGES['sigma-art-105mm-f1.4'];
    if (searchKey.includes('135mm')) return EQUIPMENT_IMAGES['sigma-art-135mm-f1.8'];
    if (searchKey.includes('40mm')) return EQUIPMENT_IMAGES['sigma-art-40mm-f1.4'];
    if (searchKey.includes('20mm')) return EQUIPMENT_IMAGES['sigma-art-20mm-f1.4'];
    return EQUIPMENT_IMAGES['lens'];
  }
  
  // Tamron Lenses
  if (searchKey.includes('tamron')) {
    if (searchKey.includes('28-75')) return EQUIPMENT_IMAGES['tamron-28-75mm-f2.8'];
    if (searchKey.includes('70-180')) return EQUIPMENT_IMAGES['tamron-70-180mm-f2.8'];
    if (searchKey.includes('17-28')) return EQUIPMENT_IMAGES['tamron-17-28mm-f2.8'];
    if (searchKey.includes('35mm')) return EQUIPMENT_IMAGES['tamron-35mm-f1.4'];
    if (searchKey.includes('150-500')) return EQUIPMENT_IMAGES['tamron-150-500mm'];
    return EQUIPMENT_IMAGES['lens'];
  }
  
  // Zeiss Lenses
  if (searchKey.includes('zeiss')) {
    if (searchKey.includes('batis') && searchKey.includes('85')) return EQUIPMENT_IMAGES['zeiss-batis-85mm'];
    if (searchKey.includes('batis') && searchKey.includes('25')) return EQUIPMENT_IMAGES['zeiss-batis-25mm'];
    if (searchKey.includes('milvus') && searchKey.includes('50')) return EQUIPMENT_IMAGES['zeiss-milvus-50mm'];
    if (searchKey.includes('otus')) return EQUIPMENT_IMAGES['zeiss-otus-55mm'];
    return EQUIPMENT_IMAGES['lens'];
  }
  
  // Fujifilm XF Lenses
  if (searchKey.includes('fuji') && (searchKey.includes('xf') || searchKey.includes('fujinon'))) {
    if (searchKey.includes('56mm')) return EQUIPMENT_IMAGES['fujifilm-xf-56mm-f1.2'];
    if (searchKey.includes('23mm')) return EQUIPMENT_IMAGES['fujifilm-xf-23mm-f1.4'];
    if (searchKey.includes('16-55')) return EQUIPMENT_IMAGES['fujifilm-xf-16-55mm-f2.8'];
    if (searchKey.includes('50-140')) return EQUIPMENT_IMAGES['fujifilm-xf-50-140mm-f2.8'];
    if (searchKey.includes('35mm')) return EQUIPMENT_IMAGES['fujifilm-xf-35mm-f1.4'];
    return EQUIPMENT_IMAGES['lens'];
  }
  
  // ========== CAMERA MATCHING ==========
  
  // Canon Cameras
  if (searchKey.includes('canon') && (searchKey.includes('eos') || searchKey.includes('camera'))) {
    if (searchKey.includes('r5')) return EQUIPMENT_IMAGES['canon-eos-r5'];
    if (searchKey.includes('r6')) return EQUIPMENT_IMAGES['canon-eos-r6'];
    if (searchKey.includes('r3')) return EQUIPMENT_IMAGES['canon-eos-r3'];
    if (searchKey.includes('5d') && searchKey.includes('iv')) return EQUIPMENT_IMAGES['canon-5d-mark-iv'];
    if (searchKey.includes('5d') && searchKey.includes('iii')) return EQUIPMENT_IMAGES['canon-5d-mark-iii'];
    if (searchKey.includes('5d')) return EQUIPMENT_IMAGES['canon-5d-mark-iv'];
    if (searchKey.includes('6d')) return EQUIPMENT_IMAGES['canon-6d-mark-ii'];
    if (searchKey.includes('90d')) return EQUIPMENT_IMAGES['canon-90d'];
    if (searchKey.includes('7d')) return EQUIPMENT_IMAGES['canon-7d-mark-ii'];
    return EQUIPMENT_IMAGES['canon-eos-r'];
  }
  
  // Sony Cameras
  if (searchKey.includes('sony') && (searchKey.includes('alpha') || searchKey.includes('a7') || searchKey.includes('a9') || searchKey.includes('a1') || searchKey.includes('a6') || searchKey.includes('fx'))) {
    if (searchKey.includes('a7iv') || searchKey.includes('a7 iv') || searchKey.includes('a7m4')) return EQUIPMENT_IMAGES['sony-a7iv'];
    if (searchKey.includes('a7iii') || searchKey.includes('a7 iii') || searchKey.includes('a7m3')) return EQUIPMENT_IMAGES['sony-a7iii'];
    if (searchKey.includes('a7riv') || searchKey.includes('a7r iv')) return EQUIPMENT_IMAGES['sony-a7riv'];
    if (searchKey.includes('a7rv') || searchKey.includes('a7r v')) return EQUIPMENT_IMAGES['sony-a7rv'];
    if (searchKey.includes('a7siii') || searchKey.includes('a7s iii')) return EQUIPMENT_IMAGES['sony-a7siii'];
    if (searchKey.includes('a1')) return EQUIPMENT_IMAGES['sony-a1'];
    if (searchKey.includes('a9')) return EQUIPMENT_IMAGES['sony-a9ii'];
    if (searchKey.includes('a6600')) return EQUIPMENT_IMAGES['sony-a6600'];
    if (searchKey.includes('a6400')) return EQUIPMENT_IMAGES['sony-a6400'];
    if (searchKey.includes('zv-e10') || searchKey.includes('zve10')) return EQUIPMENT_IMAGES['sony-zv-e10'];
    if (searchKey.includes('fx3')) return EQUIPMENT_IMAGES['sony-fx3'];
    if (searchKey.includes('fx6')) return EQUIPMENT_IMAGES['sony-fx6'];
    return EQUIPMENT_IMAGES['sony-a7'];
  }
  
  // Nikon Cameras
  if (searchKey.includes('nikon') && (searchKey.includes('z') || searchKey.includes('d8') || searchKey.includes('d7') || searchKey.includes('d5'))) {
    if (searchKey.includes('z9')) return EQUIPMENT_IMAGES['nikon-z9'];
    if (searchKey.includes('z8')) return EQUIPMENT_IMAGES['nikon-z8'];
    if (searchKey.includes('z7') && searchKey.includes('ii')) return EQUIPMENT_IMAGES['nikon-z7ii'];
    if (searchKey.includes('z6') && searchKey.includes('ii')) return EQUIPMENT_IMAGES['nikon-z6ii'];
    if (searchKey.includes('z6')) return EQUIPMENT_IMAGES['nikon-z6'];
    if (searchKey.includes('z5')) return EQUIPMENT_IMAGES['nikon-z5'];
    if (searchKey.includes('zf')) return EQUIPMENT_IMAGES['nikon-zf'];
    if (searchKey.includes('z50')) return EQUIPMENT_IMAGES['nikon-z50'];
    if (searchKey.includes('d850')) return EQUIPMENT_IMAGES['nikon-d850'];
    if (searchKey.includes('d780')) return EQUIPMENT_IMAGES['nikon-d780'];
    if (searchKey.includes('d750')) return EQUIPMENT_IMAGES['nikon-d750'];
    if (searchKey.includes('d500')) return EQUIPMENT_IMAGES['nikon-d500'];
    return EQUIPMENT_IMAGES['nikon-z6'];
  }
  
  // Fujifilm Cameras
  if (searchKey.includes('fuji')) {
    if (searchKey.includes('gfx100') && searchKey.includes('ii')) return EQUIPMENT_IMAGES['fujifilm-gfx100ii'];
    if (searchKey.includes('gfx100s')) return EQUIPMENT_IMAGES['fujifilm-gfx100s'];
    if (searchKey.includes('gfx50s')) return EQUIPMENT_IMAGES['fujifilm-gfx50sii'];
    if (searchKey.includes('gfx')) return EQUIPMENT_IMAGES['fujifilm-gfx100s'];
    if (searchKey.includes('x-t5') || searchKey.includes('xt5')) return EQUIPMENT_IMAGES['fujifilm-xt5'];
    if (searchKey.includes('x-t4') || searchKey.includes('xt4')) return EQUIPMENT_IMAGES['fujifilm-xt4'];
    if (searchKey.includes('x-h2s') || searchKey.includes('xh2s')) return EQUIPMENT_IMAGES['fujifilm-xh2s'];
    if (searchKey.includes('x-h2') || searchKey.includes('xh2')) return EQUIPMENT_IMAGES['fujifilm-xh2'];
    if (searchKey.includes('x-s20') || searchKey.includes('xs20')) return EQUIPMENT_IMAGES['fujifilm-xs20'];
    return EQUIPMENT_IMAGES['fujifilm-xt5'];
  }
  
  // Panasonic Cameras
  if (searchKey.includes('panasonic') || searchKey.includes('lumix')) {
    if (searchKey.includes('s5') && searchKey.includes('ii')) return EQUIPMENT_IMAGES['panasonic-s5ii'];
    if (searchKey.includes('s5')) return EQUIPMENT_IMAGES['panasonic-s5'];
    if (searchKey.includes('s1r')) return EQUIPMENT_IMAGES['panasonic-s1r'];
    if (searchKey.includes('s1h')) return EQUIPMENT_IMAGES['panasonic-s1h'];
    if (searchKey.includes('s1')) return EQUIPMENT_IMAGES['panasonic-s1'];
    if (searchKey.includes('gh6')) return EQUIPMENT_IMAGES['panasonic-gh6'];
    if (searchKey.includes('gh5')) return EQUIPMENT_IMAGES['panasonic-gh5ii'];
    return EQUIPMENT_IMAGES['panasonic-s5'];
  }
  
  // Leica Cameras
  if (searchKey.includes('leica')) {
    if (searchKey.includes('sl2-s') || searchKey.includes('sl2s')) return EQUIPMENT_IMAGES['leica-sl2s'];
    if (searchKey.includes('sl2')) return EQUIPMENT_IMAGES['leica-sl2'];
    if (searchKey.includes('q3')) return EQUIPMENT_IMAGES['leica-q3'];
    if (searchKey.includes('m11')) return EQUIPMENT_IMAGES['leica-m11'];
    return EQUIPMENT_IMAGES['leica-sl2'];
  }
  
  // ========== FLASH / SPEEDLITE MATCHING ==========
  
  // Canon Speedlites
  if (searchKey.includes('canon') && (searchKey.includes('speedlite') || searchKey.includes('flash') || searchKey.includes('el-1'))) {
    if (searchKey.includes('600ex')) return EQUIPMENT_IMAGES['canon-speedlite-600ex'];
    if (searchKey.includes('580ex')) return EQUIPMENT_IMAGES['canon-speedlite-580ex'];
    if (searchKey.includes('430ex')) return EQUIPMENT_IMAGES['canon-speedlite-430ex'];
    if (searchKey.includes('el-1') || searchKey.includes('el1')) return EQUIPMENT_IMAGES['canon-speedlite-el-1'];
    return EQUIPMENT_IMAGES['canon-flash'];
  }
  
  // Nikon Speedlights
  if (searchKey.includes('nikon') && (searchKey.includes('speedlight') || searchKey.includes('sb-') || searchKey.includes('flash'))) {
    if (searchKey.includes('sb-5000') || searchKey.includes('sb5000')) return EQUIPMENT_IMAGES['nikon-sb-5000'];
    if (searchKey.includes('sb-910') || searchKey.includes('sb910')) return EQUIPMENT_IMAGES['nikon-sb-910'];
    if (searchKey.includes('sb-900') || searchKey.includes('sb900')) return EQUIPMENT_IMAGES['nikon-sb-900'];
    if (searchKey.includes('sb-800') || searchKey.includes('sb800')) return EQUIPMENT_IMAGES['nikon-sb-800'];
    if (searchKey.includes('sb-700') || searchKey.includes('sb700')) return EQUIPMENT_IMAGES['nikon-sb-700'];
    if (searchKey.includes('sb-600') || searchKey.includes('sb600')) return EQUIPMENT_IMAGES['nikon-sb-600'];
    if (searchKey.includes('sb-500') || searchKey.includes('sb500')) return EQUIPMENT_IMAGES['nikon-sb-500'];
    return EQUIPMENT_IMAGES['nikon-speedlight'];
  }
  
  // Sony Flashes
  if (searchKey.includes('sony') && (searchKey.includes('hvl') || searchKey.includes('flash'))) {
    if (searchKey.includes('f60rm')) return EQUIPMENT_IMAGES['sony-hvl-f60rm'];
    if (searchKey.includes('f46rm')) return EQUIPMENT_IMAGES['sony-hvl-f46rm'];
    if (searchKey.includes('f58am')) return EQUIPMENT_IMAGES['sony-hvl-f58am'];
    if (searchKey.includes('f43am')) return EQUIPMENT_IMAGES['sony-hvl-f43am'];
    if (searchKey.includes('f32m')) return EQUIPMENT_IMAGES['sony-hvl-f32m'];
    return EQUIPMENT_IMAGES['sony-flash'];
  }
  
  // Godox Flashes/Speedlites
  if (searchKey.includes('godox') && (searchKey.includes('v1') || searchKey.includes('v860') || searchKey.includes('tt') || searchKey.includes('flash') || searchKey.includes('speedlite'))) {
    if (searchKey.includes('v1')) return EQUIPMENT_IMAGES['godox-v1'];
    if (searchKey.includes('v860')) return EQUIPMENT_IMAGES['godox-v860'];
    if (searchKey.includes('tt685')) return EQUIPMENT_IMAGES['godox-tt685'];
    if (searchKey.includes('tt600')) return EQUIPMENT_IMAGES['godox-tt600'];
    return EQUIPMENT_IMAGES['godox-flash'];
  }
  
  // Godox AD Series (Portable Strobes)
  if (searchKey.includes('godox') && searchKey.includes('ad')) {
    if (searchKey.includes('ad200')) return EQUIPMENT_IMAGES['godox-ad200'];
    if (searchKey.includes('ad300')) return EQUIPMENT_IMAGES['godox-ad300-pro'];
    if (searchKey.includes('ad400')) return EQUIPMENT_IMAGES['godox-ad400-pro'];
    if (searchKey.includes('ad600')) return EQUIPMENT_IMAGES['godox-ad600'];
    return EQUIPMENT_IMAGES['godox-ad200'];
  }
  
  // Profoto Flashes
  if (searchKey.includes('profoto') && (searchKey.includes('a1') || searchKey.includes('a10') || searchKey.includes('flash'))) {
    if (searchKey.includes('a10')) return EQUIPMENT_IMAGES['profoto-a10'];
    if (searchKey.includes('a1x')) return EQUIPMENT_IMAGES['profoto-a1x'];
    if (searchKey.includes('a1')) return EQUIPMENT_IMAGES['profoto-a1'];
    return EQUIPMENT_IMAGES['profoto-flash'];
  }
  
  // Yongnuo Flashes
  if (searchKey.includes('yongnuo') || searchKey.includes('yn')) {
    if (searchKey.includes('yn600ex') || searchKey.includes('600ex')) return EQUIPMENT_IMAGES['yongnuo-yn600ex'];
    if (searchKey.includes('yn685') || searchKey.includes('685')) return EQUIPMENT_IMAGES['yongnuo-yn685'];
    if (searchKey.includes('yn560') || searchKey.includes('560')) return EQUIPMENT_IMAGES['yongnuo-yn560'];
    if (searchKey.includes('yn565ex') || searchKey.includes('565ex')) return EQUIPMENT_IMAGES['yongnuo-yn565ex'];
    return EQUIPMENT_IMAGES['yongnuo-flash'];
  }
  
  // Nissin Flashes
  if (searchKey.includes('nissin')) {
    if (searchKey.includes('di700')) return EQUIPMENT_IMAGES['nissin-di700a'];
    if (searchKey.includes('i60')) return EQUIPMENT_IMAGES['nissin-i60a'];
    if (searchKey.includes('mg80')) return EQUIPMENT_IMAGES['nissin-mg80-pro'];
    return EQUIPMENT_IMAGES['nissin-flash'];
  }
  
  // Metz Flashes
  if (searchKey.includes('metz')) {
    if (searchKey.includes('52')) return EQUIPMENT_IMAGES['metz-52-af-1'];
    if (searchKey.includes('64')) return EQUIPMENT_IMAGES['metz-64-af-1'];
    return EQUIPMENT_IMAGES['metz-flash'];
  }
  
  // Fujifilm Flashes
  if (searchKey.includes('fuji') && (searchKey.includes('ef-') || searchKey.includes('flash'))) {
    if (searchKey.includes('ef-x500') || searchKey.includes('efx500')) return EQUIPMENT_IMAGES['fujifilm-ef-x500'];
    if (searchKey.includes('ef-60') || searchKey.includes('ef60')) return EQUIPMENT_IMAGES['fujifilm-ef-60'];
    if (searchKey.includes('ef-42') || searchKey.includes('ef42')) return EQUIPMENT_IMAGES['fujifilm-ef-42'];
    if (searchKey.includes('ef-20') || searchKey.includes('ef20')) return EQUIPMENT_IMAGES['fujifilm-ef-20'];
    return EQUIPMENT_IMAGES['fujifilm-flash'];
  }
  
  // Generic Flash/Speedlite detection
  if (searchKey.includes('speedlite') || searchKey.includes('speedlight') || searchKey.includes('flash')) {
    return EQUIPMENT_IMAGES['flash-generic'];
  }
  
  // ========== STUDIO LIGHTING MATCHING ==========
  
  // Profoto Studio Strobes
  if (searchKey.includes('profoto')) {
    if (searchKey.includes('b10') && searchKey.includes('plus')) return EQUIPMENT_IMAGES['profoto-b10-plus'];
    if (searchKey.includes('b10')) return EQUIPMENT_IMAGES['profoto-b10'];
    if (searchKey.includes('b1x')) return EQUIPMENT_IMAGES['profoto-b1x'];
    if (searchKey.includes('b1')) return EQUIPMENT_IMAGES['profoto-b1'];
    if (searchKey.includes('b2')) return EQUIPMENT_IMAGES['profoto-b2'];
    if (searchKey.includes('d2')) return EQUIPMENT_IMAGES['profoto-d2'];
    if (searchKey.includes('d1')) return EQUIPMENT_IMAGES['profoto-d1'];
    return EQUIPMENT_IMAGES['profoto-strobe'];
  }
  
  // Godox Studio Strobes/LEDs
  if (searchKey.includes('godox')) {
    if (searchKey.includes('sl-60') || searchKey.includes('sl60')) return EQUIPMENT_IMAGES['godox-sl-60w'];
    if (searchKey.includes('sl-150') || searchKey.includes('sl150')) return EQUIPMENT_IMAGES['godox-sl-150w'];
    if (searchKey.includes('sl-200') || searchKey.includes('sl200')) return EQUIPMENT_IMAGES['godox-sl-200w'];
    if (searchKey.includes('vl150')) return EQUIPMENT_IMAGES['godox-vl150'];
    if (searchKey.includes('vl300')) return EQUIPMENT_IMAGES['godox-vl300'];
    if (searchKey.includes('sk400')) return EQUIPMENT_IMAGES['godox-sk400'];
    if (searchKey.includes('sk300')) return EQUIPMENT_IMAGES['godox-sk300'];
    if (searchKey.includes('ms300')) return EQUIPMENT_IMAGES['godox-ms300'];
    if (searchKey.includes('dp600')) return EQUIPMENT_IMAGES['godox-dp600'];
    return EQUIPMENT_IMAGES['godox-strobe'];
  }
  
  // Elinchrom
  if (searchKey.includes('elinchrom')) {
    if (searchKey.includes('elc') && searchKey.includes('125')) return EQUIPMENT_IMAGES['elinchrom-elc-125'];
    if (searchKey.includes('elc') && searchKey.includes('500')) return EQUIPMENT_IMAGES['elinchrom-elc-500'];
    if (searchKey.includes('elc')) return EQUIPMENT_IMAGES['elinchrom-elc'];
    if (searchKey.includes('dlite')) return EQUIPMENT_IMAGES['elinchrom-dlite'];
    if (searchKey.includes('one')) return EQUIPMENT_IMAGES['elinchrom-one'];
    if (searchKey.includes('five')) return EQUIPMENT_IMAGES['elinchrom-five'];
    return EQUIPMENT_IMAGES['elinchrom-strobe'];
  }
  
  // Broncolor
  if (searchKey.includes('broncolor')) {
    if (searchKey.includes('siros') && searchKey.includes('400')) return EQUIPMENT_IMAGES['broncolor-siros-400'];
    if (searchKey.includes('siros') && searchKey.includes('800')) return EQUIPMENT_IMAGES['broncolor-siros-800'];
    if (searchKey.includes('siros')) return EQUIPMENT_IMAGES['broncolor-siros'];
    if (searchKey.includes('move')) return EQUIPMENT_IMAGES['broncolor-move'];
    return EQUIPMENT_IMAGES['broncolor-strobe'];
  }
  
  // Aputure LEDs
  if (searchKey.includes('aputure')) {
    if (searchKey.includes('600d')) return EQUIPMENT_IMAGES['aputure-600d'];
    if (searchKey.includes('600c')) return EQUIPMENT_IMAGES['aputure-600c-pro'];
    if (searchKey.includes('300d')) return EQUIPMENT_IMAGES['aputure-300d'];
    if (searchKey.includes('300x')) return EQUIPMENT_IMAGES['aputure-300x'];
    if (searchKey.includes('120d')) return EQUIPMENT_IMAGES['aputure-120d'];
    if (searchKey.includes('amaran')) return EQUIPMENT_IMAGES['aputure-amaran'];
    if (searchKey.includes('mc')) return EQUIPMENT_IMAGES['aputure-mc'];
    return EQUIPMENT_IMAGES['aputure-led'];
  }
  
  // Nanlite LEDs
  if (searchKey.includes('nanlite')) {
    if (searchKey.includes('forza') && searchKey.includes('60')) return EQUIPMENT_IMAGES['nanlite-forza-60'];
    if (searchKey.includes('forza') && searchKey.includes('300')) return EQUIPMENT_IMAGES['nanlite-forza-300'];
    if (searchKey.includes('forza') && searchKey.includes('500')) return EQUIPMENT_IMAGES['nanlite-forza-500'];
    if (searchKey.includes('forza')) return EQUIPMENT_IMAGES['nanlite-forza'];
    if (searchKey.includes('pavotube')) return EQUIPMENT_IMAGES['nanlite-pavotube'];
    if (searchKey.includes('litolite')) return EQUIPMENT_IMAGES['nanlite-litolite'];
    return EQUIPMENT_IMAGES['nanlite-led'];
  }
  
  // Light modifiers
  if (searchKey.includes('softbox')) return EQUIPMENT_IMAGES['softbox'];
  if (searchKey.includes('ring') && searchKey.includes('light')) return EQUIPMENT_IMAGES['ring-light'];
  if (searchKey.includes('beauty') && searchKey.includes('dish')) return EQUIPMENT_IMAGES['beauty-dish'];
  if (searchKey.includes('umbrella')) return EQUIPMENT_IMAGES['umbrella'];
  if (searchKey.includes('octabox')) return EQUIPMENT_IMAGES['octabox'];
  
  // ========== AUDIO MATCHING ==========
  if (searchKey.includes('rode')) return EQUIPMENT_IMAGES['rode-ntg3'];
  if (searchKey.includes('sennheiser')) return EQUIPMENT_IMAGES['sennheiser-mke600'];
  if (searchKey.includes('zoom') && searchKey.includes('h')) return EQUIPMENT_IMAGES['zoom-h6'];
  
  // ========== SUPPORT MATCHING ==========
  if (searchKey.includes('manfrotto')) return EQUIPMENT_IMAGES['manfrotto-tripod'];
  if (searchKey.includes('gitzo')) return EQUIPMENT_IMAGES['gitzo-tripod'];
  if (searchKey.includes('dji') && searchKey.includes('rs')) return EQUIPMENT_IMAGES['dji-rs3'];
  if (searchKey.includes('gimbal')) return EQUIPMENT_IMAGES['gimbal'];
  
  // ========== CATEGORY-BASED FALLBACKS ==========
  const category = (item.category || ', ').toLowerCase();
  if (category.includes('camera') || category.includes('body')) return EQUIPMENT_IMAGES['camera'];
  if (category.includes('lens')) return EQUIPMENT_IMAGES['lens'];
  if (category.includes('flash') || category.includes('speedlite') || category.includes('speedlight')) return EQUIPMENT_IMAGES['flash'];
  if (category.includes('strobe')) return EQUIPMENT_IMAGES['lighting'];
  if (category.includes('light') || category.includes('led') || category.includes('continuous')) return EQUIPMENT_IMAGES['led-panel'];
  if (category.includes('audio') || category.includes('mic')) return EQUIPMENT_IMAGES['microphone'];
  if (category.includes('tripod') || category.includes('support') || category.includes('gimbal')) return EQUIPMENT_IMAGES['tripod'];
  if (category.includes('modifier') || category.includes('softbox') || category.includes('umbrella')) return EQUIPMENT_IMAGES['softbox'];
  
  // Default fallback
  return EQUIPMENT_IMAGES['camera'];
}

interface UseUserEquipmentInventoryResult {
  /** User's owned equipment items */
  inventory: UserEquipmentItem[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh inventory from server */
  refresh: () => Promise<void>;
  /** Check if a specific equipment (by brand+model) is owned */
  isOwned: (brand: string, model: string) => boolean;
  /** Get owned equipment IDs for filtering */
  ownedEquipmentIds: Set<string>;
  /** Get a normalized key for matching (brand-model lowercase) */
  getMatchKey: (brand: string, model: string) => string;
}

/**
 * Hook to access user's equipment inventory for Virtual Studio
 */
export function useUserEquipmentInventory(): UseUserEquipmentInventoryResult {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<UserEquipmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id;

  // Fetch inventory from backend
  const fetchInventory = useCallback(async () => {
    if (!userId || userId === 'guest') {
      setInventory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/equipment/inventory?userId=${userId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch inventory: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setInventory(data.data);
        log.debug(`Loaded ${data.data.length} equipment items from inventory`);
      } else {
        setInventory([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load inventory';
      setError(message);
      log.error('Error loading equipment inventory: ', err);
      setInventory([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Create normalized match key (lowercase brand-model)
  const getMatchKey = useCallback((brand: string, model: string): string => {
    return `${(brand || ', ').toLowerCase().trim()}-${(model ||',').toLowerCase().trim()}`;
  }, []);

  // Build a set of owned equipment keys for fast lookup
  const ownedEquipmentKeys = useMemo(() => {
    const keys = new Set<string>();
    inventory.forEach((item) => {
      if (item.brand && item.model) {
        keys.add(getMatchKey(item.brand, item.model));
      }
      // Also add by name for fallback matching
      if (item.name) {
        keys.add(item.name.toLowerCase().trim());
      }
    });
    return keys;
  }, [inventory, getMatchKey]);

  // Build set of owned equipment IDs
  const ownedEquipmentIds = useMemo(() => {
    return new Set(inventory.map((item) => item.id));
  }, [inventory]);

  // Check if equipment is owned
  const isOwned = useCallback(
    (brand: string, model: string): boolean => {
      const key = getMatchKey(brand, model);
      return ownedEquipmentKeys.has(key);
    },
    [ownedEquipmentKeys, getMatchKey]
  );

  return {
    inventory,
    isLoading,
    error,
    refresh: fetchInventory,
    isOwned,
    ownedEquipmentIds,
    getMatchKey,
  };
}

export default useUserEquipmentInventory;

