// @ts-nocheck
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import type { CastingProject, SceneBreakdown } from '../models/casting';
import type { StoryboardDocumentAspectRatio } from '../state/storyboardDrawingDocument';
import { manuscriptService } from '../services/manuscriptService';
import { StoryboardIntegrationView } from './StoryboardIntegrationView';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import storyboardEmptyPng from './icons/Keep/roleroom_storyboard.png';
import { useToast } from './ToastStack';
import EntityAttachmentsPanel from './EntityAttachmentsPanel';

interface StoryboardTabViewProps {
  /** Aktivt produksjonsprosjekt — null hvis ingen er valgt. */
  currentProject: CastingProject | null;
  /** Prosjekt-nivå cinema-format propagert til FrameDrawingEditor. */
  projectCinemaFormat?: StoryboardDocumentAspectRatio;
  /** Kalles når brukeren klikker «Opprett første scene fra manus»-CTA. */
  onNavigateToStoryArc: () => void;
}

/**
 * Egen Storyboard-tab som åpner FrameDrawingEditor (Storyboard Pro)
 * direkte for første scene + første frame i prosjektet — uten å gå
 * via Pre-produksjon → Role Room Studio → Manuscript → Scener →
 * sceneViewMode-toggle. Bygger på StoryboardIntegrationView som
 * allerede håndterer både thumbnail-grid og full Storyboard Pro-tegne-
 * grensesnittet, så vi får alle eksisterende controls (lighting, camera,
 * brush-pack) gratis.
 */
export const StoryboardTabView: React.FC<StoryboardTabViewProps> = ({
  currentProject,
  projectCinemaFormat,
  onNavigateToStoryArc,
}) => {
  const { showError } = useToast();
  const [scenes, setScenes] = useState<SceneBreakdown[]>([]);
  const [selectedScene, setSelectedScene] = useState<SceneBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sceneliste: foretrekk allerede-loaded sceneBreakdowns på prosjektet,
  // ellers hent fra første manuskriptet via manuscriptService.
  useEffect(() => {
    let cancelled = false;
    setSelectedScene(null);
    setScenes([]);

    if (!currentProject?.id) {
      return undefined;
    }

    const preloaded = currentProject.sceneBreakdowns ?? [];
    if (preloaded.length > 0) {
      setScenes(preloaded);
      setSelectedScene(preloaded[0]);
      return undefined;
    }

    setIsLoading(true);
    (async () => {
      try {
        const manuscripts = await manuscriptService.getManuscripts(currentProject.id);
        if (cancelled) return;
        const firstManuscript = manuscripts[0];
        if (!firstManuscript) {
          setScenes([]);
          return;
        }
        const loaded = await manuscriptService.getScenes(firstManuscript.id);
        if (cancelled) return;
        setScenes(loaded);
        if (loaded.length > 0) {
          setSelectedScene(loaded[0]);
        }
      } catch (error) {
        if (!cancelled) {
          showError('Kunne ikke laste scener for storyboard');
          // eslint-disable-next-line no-console
          console.error('[StoryboardTabView] failed to load scenes', error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentProject?.id, currentProject?.sceneBreakdowns, showError]);

  const handleSceneUpdate = useCallback((updated: SceneBreakdown) => {
    setSelectedScene(updated);
    setScenes((previous) => previous.map((scene) => (scene.id === updated.id ? updated : scene)));
    // Persistens på selve scene-objektet håndteres allerede av
    // StoryboardIntegrationView via storyboard-routes; vi trenger ikke
    // å duplisere save-kall her.
    void manuscriptService.saveScene(updated).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[StoryboardTabView] saveScene failed', error);
    });
  }, []);

  const dialogueLines = useMemo(() => [], []);

  if (!currentProject) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <Alert severity="info" sx={{ maxWidth: 520 }}>
          Velg et casting-prosjekt øverst for å åpne Storyboard Pro.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <CircularProgress sx={{ color: 'rgba(244,114,182,0.85)' }} />
      </Box>
    );
  }

  if (!selectedScene || scenes.length === 0) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ width: '100%', maxWidth: 640 }}>
          <RoleRoomEmptyState
            iconSrc={storyboardEmptyPng}
            title="Ingen scener å storyboarde enda"
            subtitle="Importer eller skriv et manus i Role Room Studio, så fyller Storyboard Pro seg automatisk med scener du kan tegne på."
            color="#ec4899"
            buttonLabel="Opprett første scene fra manus"
            onAction={onNavigateToStoryArc}
            ariaLabel="Storyboard tom-tilstand"
          />
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 2, textAlign: 'center', color: 'rgba(226,232,240,0.6)' }}
          >
            Tips: når du har minst én scene kommer du tilbake hit for å tegne shots med Apple Pencil eller mus.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {selectedScene?.id && (
        <Box sx={{ mb: 1.4 }}>
          <EntityAttachmentsPanel
            entityType="scene"
            entityId={selectedScene.id}
            projectId={currentProject.id}
            sceneId={selectedScene.id}
            entityLabel="Scene"
            acceptedFileTypes="image/*,application/pdf"
          />
        </Box>
      )}
      <StoryboardIntegrationView
        scene={selectedScene}
        onUpdate={handleSceneUpdate}
        projectId={currentProject.id}
        projectCinemaFormat={projectCinemaFormat}
        allScenes={scenes}
        sceneDialogue={dialogueLines}
        storyboardOnly={false}
      />
    </Box>
  );
};

export default StoryboardTabView;
