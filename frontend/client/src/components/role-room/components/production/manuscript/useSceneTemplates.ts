import { useCallback, useState } from 'react';
import type { SceneBreakdown } from '../../../models/casting';

export const useSceneTemplates = () => {
  const [sceneTemplates, setSceneTemplates] = useState<Record<string, SceneBreakdown>>({});
  const [showSceneTemplate, setShowSceneTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const closeSceneTemplate = useCallback(() => {
    setShowSceneTemplate(false);
    setTemplateName('');
  }, []);

  return {
    sceneTemplates,
    setSceneTemplates,
    showSceneTemplate,
    setShowSceneTemplate,
    templateName,
    setTemplateName,
    closeSceneTemplate,
  };
};
