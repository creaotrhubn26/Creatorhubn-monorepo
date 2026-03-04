import { useCallback, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import type { ProjectToEditorData } from '../../../utils/story-arc-project-integration';
import { isRecord, toErrorMessage } from '../storyArcStudioNormalizers';

export interface RecentStoryArcProject {
  id: string;
  storyArcName: string;
  status: string;
  templateType: string;
  createdAt: string;
}

interface WorkerInitStatus {
  inProgress: boolean;
  completed: boolean;
  error: string | null;
  progress: number;
  workers: Record<string, { ready: boolean; message: string; friendlyName?: string; description?: string }>;
}

interface WorkerStatusEntry {
  ready: boolean;
  status?: string;
  message: string;
  friendlyName?: string;
  description?: string;
}

interface WorkersStatusResponse {
  status?: string;
  workers?: {
    onDemand?: Record<string, WorkerStatusEntry>;
    continuous?: Record<string, WorkerStatusEntry>;
  };
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

interface UseStoryArcOnboardingFlowParams {
  projectContext: ProjectToEditorData | null;
  setProjectContext: Dispatch<SetStateAction<ProjectToEditorData | null>>;
  setOnboardingStep: Dispatch<SetStateAction<number>>;
  setEnsuringMapping: Dispatch<SetStateAction<boolean>>;
  setWorkerInitStatus: Dispatch<SetStateAction<WorkerInitStatus>>;
  setSnackbar: Dispatch<SetStateAction<SnackbarState>>;
  fetchRecentProjects: () => Promise<void>;
  scheduleWorkerInitTimeout: (fn: () => void, delayMs: number) => number;
  handleOnboardingComplete: () => Promise<void>;
}

export function useStoryArcOnboardingFlow({
  projectContext,
  setProjectContext,
  setOnboardingStep,
  setEnsuringMapping,
  setWorkerInitStatus,
  setSnackbar,
  fetchRecentProjects,
  scheduleWorkerInitTimeout,
  handleOnboardingComplete,
}: UseStoryArcOnboardingFlowParams) {
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const connectRecentProject = useCallback(async (project: RecentStoryArcProject) => {
    try {
      setEnsuringMapping(true);
      setProjectContext({
        projectId: project.id,
        projectName: project.storyArcName,
        clientName: 'Unknown Client',
        projectType: project.templateType || 'wedding',
      });
      setSnackbar({
        open: true,
        message: 'Project connected successfully!',
        severity: 'success',
      });
      setOnboardingStep((step) => step + 1);
    } catch (error: unknown) {
      setSnackbar({
        open: true,
        message: toErrorMessage(error, 'Failed to connect project'),
        severity: 'error',
      });
    } finally {
      setEnsuringMapping(false);
    }
  }, [setEnsuringMapping, setProjectContext, setSnackbar, setOnboardingStep]);

  const connectCurrentProject = useCallback(async () => {
    try {
      setEnsuringMapping(true);
      const projectId = projectContext?.projectId;
      if (!projectId) {
        setSnackbar({
          open: true,
          message: 'No project in context. Select a project above or create a new one.',
          severity: 'warning',
        });
        return;
      }

      const response = await fetch(
        `/api/story-arc/by-project/${encodeURIComponent(String(projectId))}/ensure?name=${encodeURIComponent(projectContext?.projectName || 'Untitled Project')}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      if (!response.ok) {
        throw new Error('Failed to ensure mapping');
      }

      setSnackbar({
        open: true,
        message: 'Project connected and Drive prepared.',
        severity: 'success',
      });
      setOnboardingStep((step) => step + 1);
    } catch (error: unknown) {
      setSnackbar({
        open: true,
        message: toErrorMessage(error, 'Failed to connect project'),
        severity: 'error',
      });
    } finally {
      setEnsuringMapping(false);
    }
  }, [projectContext?.projectId, projectContext?.projectName, setEnsuringMapping, setOnboardingStep, setSnackbar]);

  const openCreateProjectDialog = useCallback(() => {
    setNewProjectName((projectContext?.projectName || '').trim());
    setCreateProjectDialogOpen(true);
  }, [projectContext?.projectName]);

  const closeCreateProjectDialog = useCallback(() => {
    if (isCreatingProject) {
      return;
    }
    setCreateProjectDialogOpen(false);
  }, [isCreatingProject]);

  const updateNewProjectName = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setNewProjectName(event.target.value);
  }, []);

  const createProjectFromDialog = useCallback(async () => {
    const projectName = newProjectName.trim();
    if (!projectName) {
      setSnackbar({
        open: true,
        message: 'Please enter a project name.',
        severity: 'warning',
      });
      return;
    }

    try {
      setEnsuringMapping(true);
      setIsCreatingProject(true);
      const response = await fetch('/api/story-arc/projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyArcName: projectName,
          templateType: 'wedding',
          emotionalCurve: 'rising',
          targetDuration: 480,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          isRecord(errorData) && typeof errorData.error === 'string'
            ? errorData.error
            : 'Failed to create project';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setSnackbar({
        open: true,
        message: 'Project created successfully!',
        severity: 'success',
      });

      if (data.storyArcId) {
        setProjectContext({
          projectId: data.storyArcId,
          projectName,
          clientName: 'Unknown Client',
          projectType: 'wedding',
        });
      }

      await fetchRecentProjects();
      setCreateProjectDialogOpen(false);
      setNewProjectName('');
      setOnboardingStep((step) => step + 1);
    } catch (error: unknown) {
      setSnackbar({
        open: true,
        message: toErrorMessage(error, 'Failed to create project'),
        severity: 'error',
      });
    } finally {
      setEnsuringMapping(false);
      setIsCreatingProject(false);
    }
  }, [newProjectName, setSnackbar, setEnsuringMapping, setProjectContext, fetchRecentProjects, setOnboardingStep]);

  const submitCreateProjectFromDialog = useCallback(() => {
    void createProjectFromDialog();
  }, [createProjectFromDialog]);

  const prepareWorkerFeatures = useCallback(async () => {
    setWorkerInitStatus({
      inProgress: true,
      completed: false,
      error: null,
      progress: 0,
      workers: {},
    });

    try {
      await fetch('/api/workers/initialize', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const checkStatus = async (): Promise<void> => {
        try {
          const response = await fetch('/api/workers/status', { credentials: 'include' });
          const data = (await response.json()) as WorkersStatusResponse;
          const allWorkers: Record<string, WorkerStatusEntry> = {
            ...(data.workers?.onDemand || {}),
            ...(data.workers?.continuous || {}),
          };

          const totalWorkers = Object.keys(allWorkers).length;
          const readyWorkers = Object.values(allWorkers).filter(
            (worker) => worker.ready || worker.status === 'running'
          ).length;
          const progress = totalWorkers > 0 ? Math.round((readyWorkers / totalWorkers) * 100) : 0;

          setWorkerInitStatus((previous) => ({
            ...previous,
            progress,
            workers: allWorkers,
          }));

          if (data.status === 'ready' || progress >= 80) {
            setWorkerInitStatus((previous) => ({
              ...previous,
              inProgress: false,
              completed: true,
              progress: 100,
            }));
            scheduleWorkerInitTimeout(() => {
              void handleOnboardingComplete();
            }, 1000);
            return;
          }

          if (progress < 100) {
            scheduleWorkerInitTimeout(checkStatus, 1000);
          }
        } catch (error) {
          console.warn('Error checking worker status:', error);
          setWorkerInitStatus((previous) => ({
            ...previous,
            inProgress: false,
            completed: true,
            progress: 100,
          }));
          scheduleWorkerInitTimeout(() => {
            void handleOnboardingComplete();
          }, 500);
        }
      };

      await checkStatus();
    } catch (error) {
      console.warn('Error initializing workers:', error);
      setWorkerInitStatus((previous) => ({
        ...previous,
        inProgress: false,
        completed: true,
        error: null,
        progress: 100,
      }));
      scheduleWorkerInitTimeout(() => {
        void handleOnboardingComplete();
      }, 500);
    }
  }, [setWorkerInitStatus, scheduleWorkerInitTimeout, handleOnboardingComplete]);

  return {
    createProjectDialogOpen,
    newProjectName,
    isCreatingProject,
    connectRecentProject,
    connectCurrentProject,
    openCreateProjectDialog,
    closeCreateProjectDialog,
    updateNewProjectName,
    createProjectFromDialog,
    submitCreateProjectFromDialog,
    prepareWorkerFeatures,
  };
}
