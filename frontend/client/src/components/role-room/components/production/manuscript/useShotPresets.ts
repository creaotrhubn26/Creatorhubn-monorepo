import { useCallback, useState } from 'react';
import type { ShotPreset } from '../types';

export const useShotPresets = () => {
  const [savedPresets, setSavedPresets] = useState<Record<string, ShotPreset>>({});
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  const closeSavePresetDialog = useCallback(() => {
    setShowSavePresetDialog(false);
    setPresetName('');
  }, []);

  return {
    savedPresets,
    setSavedPresets,
    showSavePresetDialog,
    setShowSavePresetDialog,
    presetName,
    setPresetName,
    closeSavePresetDialog,
  };
};
