import { Profiler, useEffect, useRef, type ReactNode } from 'react';
import {
  isRoleRoomDiagnosticsEnabled,
  logRoleRoomDiagnostic,
} from '../../utils/roleRoomDiagnostics';

interface RoleRoomDiagnosticsProbeProps {
  name: string;
  projectId?: string | null;
  detail?: Record<string, unknown>;
  children: ReactNode;
}

export default function RoleRoomDiagnosticsProbe({
  name,
  projectId,
  detail,
  children,
}: RoleRoomDiagnosticsProbeProps) {
  const mountedAtRef = useRef(0);
  const detailRef = useRef<Record<string, unknown> | undefined>(detail);
  detailRef.current = detail;

  useEffect(() => {
    if (!isRoleRoomDiagnosticsEnabled()) {
      return undefined;
    }

    mountedAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    logRoleRoomDiagnostic('panel:mount', {
      name,
      projectId: projectId ?? null,
      ...(detailRef.current ?? {}),
    });

    const rafId = window.requestAnimationFrame(() => {
      logRoleRoomDiagnostic('panel:first-paint', {
        name,
        projectId: projectId ?? null,
        elapsedMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - mountedAtRef.current),
        ...(detailRef.current ?? {}),
      });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      logRoleRoomDiagnostic('panel:unmount', {
        name,
        projectId: projectId ?? null,
        lifetimeMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - mountedAtRef.current),
        ...(detailRef.current ?? {}),
      });
    };
  }, [name, projectId]);

  if (!isRoleRoomDiagnosticsEnabled()) {
    return <>{children}</>;
  }

  return (
    <Profiler
      id={`${name}:${projectId ?? 'none'}`}
      onRender={(id, phase, actualDuration, baseDuration, startTime, commitTime) => {
        logRoleRoomDiagnostic('panel:render', {
          id,
          name,
          projectId: projectId ?? null,
          phase,
          actualDurationMs: Number(actualDuration.toFixed(2)),
          baseDurationMs: Number(baseDuration.toFixed(2)),
          startTimeMs: Number(startTime.toFixed(2)),
          commitTimeMs: Number(commitTime.toFixed(2)),
          ...(detail ?? {}),
        });
      }}
    >
      {children}
    </Profiler>
  );
}
