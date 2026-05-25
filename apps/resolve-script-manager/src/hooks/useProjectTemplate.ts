import { useCallback, useEffect, useState } from "react";
import { listProjectTemplates } from "../api";
import type { ProjectTemplateSummary } from "../types";

const STORAGE_KEY = "trrpa.activeProjectTemplate";

export interface UseProjectTemplateResult {
  templates: ProjectTemplateSummary[];
  active: ProjectTemplateSummary | null;
  activeId: string;
  setActiveId: (id: string) => void;
  loading: boolean;
  error: string | null;
}

export function useProjectTemplate(): UseProjectTemplateResult {
  const [templates, setTemplates] = useState<ProjectTemplateSummary[]>([]);
  const [activeId, setActiveIdState] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [defaultId, setDefaultId] = useState<string>("corporate_video");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjectTemplates()
      .then((index) => {
        setTemplates(index.templates);
        setDefaultId(index.default);
        if (!activeId) {
          setActiveIdState(index.default);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const effectiveId = activeId || defaultId;
  const active = templates.find((t) => t.id === effectiveId) ?? null;

  return { templates, active, activeId: effectiveId, setActiveId, loading, error };
}
