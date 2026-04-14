import { useRef, useState } from 'react';
import type { TTSLanguage, TTSVoice } from '../../../services/ttsService';

export const useTtsReadThrough = () => {
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsVoice, setTtsVoice] = useState<TTSVoice>('nova');
  const [ttsLanguage, setTtsLanguage] = useState<TTSLanguage | ''>('');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsCharacterVoices, setTtsCharacterVoices] = useState<Record<string, TTSVoice>>({});
  const [ttsUseCharacterVoices, setTtsUseCharacterVoices] = useState(true);
  const ttsPlayingRef = useRef(false);

  return {
    ttsEnabled,
    setTtsEnabled,
    ttsVoice,
    setTtsVoice,
    ttsLanguage,
    setTtsLanguage,
    ttsSpeed,
    setTtsSpeed,
    ttsCharacterVoices,
    setTtsCharacterVoices,
    ttsUseCharacterVoices,
    setTtsUseCharacterVoices,
    ttsPlayingRef,
  };
};
