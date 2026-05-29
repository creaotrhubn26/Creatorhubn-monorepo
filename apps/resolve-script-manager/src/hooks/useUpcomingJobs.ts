/**
 * useUpcomingJobs — fetcher kommende feed-plan-jobs hver 60. sekund.
 * Project-type-agnostisk.
 */

import { useCallback, useEffect, useState } from "react";
import {
  upcomingJobsService,
  type UpcomingJobsResponse,
  type UpcomingJob,
} from "../services/upcomingJobsService";

export type UpcomingJobsStatus = "idle" | "loading" | "unauthenticated" | "ready" | "error";

export interface UseUpcomingJobsResult {
  status: UpcomingJobsStatus;
  jobs: UpcomingJob[];
  totalJobs: number;
  overdueCount: number;
  scannedDays: number;
  projectsScanned: number;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useUpcomingJobs(opts?: {
  days?: number;
  pollIntervalMs?: number;
  enabled?: boolean;
}): UseUpcomingJobsResult {
  const enabled = opts?.enabled ?? true;
  const pollMs = opts?.pollIntervalMs ?? 60_000;
  const days = opts?.days ?? 7;

  const [state, setState] = useState<UpcomingJobsResponse>({
    jobs: [],
    projects: 0,
    scannedDays: days,
    totalJobs: 0,
    overdueCount: 0,
  });
  const [status, setStatus] = useState<UpcomingJobsStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setStatus("loading");
    setError(null);
    try {
      const data = await upcomingJobsService.getUpcoming({ days });
      setState(data);
      setStatus("ready");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("Ikke innlogget") || msg.includes("401")) {
        setStatus("unauthenticated");
      } else {
        setStatus("error");
        setError(msg);
      }
    }
  }, [enabled, days]);

  useEffect(() => {
    void refresh();
    if (!enabled || pollMs <= 0) return;
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [refresh, enabled, pollMs]);

  return {
    status,
    jobs: state.jobs,
    totalJobs: state.totalJobs,
    overdueCount: state.overdueCount,
    scannedDays: state.scannedDays,
    projectsScanned: state.projects,
    error,
    refresh,
  };
}
