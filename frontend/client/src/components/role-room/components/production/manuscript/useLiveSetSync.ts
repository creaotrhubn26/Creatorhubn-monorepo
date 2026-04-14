import { useEffect, useRef, useState } from 'react';
import type { SceneBreakdown } from '../../../models/casting';
import { productionWorkflowService, type LiveSetStatus } from '..';

interface UseLiveSetSyncOptions {
  projectId: string;
  isConnected: boolean;
  followLiveScene: boolean;
  scenes: SceneBreakdown[];
  selectedSceneId?: string;
  onSceneFollow: (scene: SceneBreakdown) => void;
  pollMs?: number;
}

export const useLiveSetSync = ({
  projectId,
  isConnected,
  followLiveScene,
  scenes,
  selectedSceneId,
  onSceneFollow,
  pollMs = 5000,
}: UseLiveSetSyncOptions) => {
  const [liveSetStatus, setLiveSetStatus] = useState<LiveSetStatus | null>(null);
  const scenesRef = useRef(scenes);
  const selectedSceneIdRef = useRef(selectedSceneId);
  const onSceneFollowRef = useRef(onSceneFollow);

  scenesRef.current = scenes;
  selectedSceneIdRef.current = selectedSceneId;
  onSceneFollowRef.current = onSceneFollow;

  useEffect(() => {
    if (!isConnected || !projectId) return;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled) {
        try {
          const status = await productionWorkflowService.getLiveSetStatus(projectId);
          if (cancelled) break;
          setLiveSetStatus(status);

          if (followLiveScene && status.currentScene) {
            const liveScene = scenesRef.current.find((scene) => scene.id === status.currentScene);
            if (liveScene && liveScene.id !== selectedSceneIdRef.current) {
              onSceneFollowRef.current(liveScene);
            }
          }
        } catch (error) {
          console.error('Error syncing live set status:', error);
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    };

    void loop();
    return () => {
      cancelled = true;
    };
  }, [followLiveScene, isConnected, pollMs, projectId]);

  useEffect(() => {
    if (!isConnected) {
      setLiveSetStatus(null);
    }
  }, [isConnected]);

  return liveSetStatus;
};
