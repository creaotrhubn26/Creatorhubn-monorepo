/**
 * LeadgridProjectSelect — felles «Kundeprosjekt»-velger for Leadgrid-sider.
 *
 * Samler mønsteret som i dag er kopiert i deals/workflows/import/markedsføring
 * (henter /api/admin-room/lead-map/projects, husker valget i
 * localStorage `rr_lead_map_active_project`, velger første prosjekt når
 * husket id ikke finnes). Brukes foreløpig kun av markedsføringssiden —
 * de andre sidene røres ikke i denne omgang.
 */
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { apiRequest } from "@/lib/queryClient";

export const ACTIVE_PROJECT_STORAGE_KEY = "rr_lead_map_active_project";

export interface LeadgridProjectOption {
  id: string;
  name: string;
}

export function readStoredProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeProjectId(projectId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (projectId) localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId);
    else localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
  } catch {
    // privat modus o.l. — valget huskes bare i minnet
  }
}

export function useLeadgridProjects() {
  const query = useQuery<{ projects: LeadgridProjectOption[] }>({
    queryKey: ["leadgrid-projects"],
    queryFn: () => apiRequest("/api/admin-room/lead-map/projects"),
  });
  const projects = useMemo(() => query.data?.projects ?? [], [query.data]);
  return { projects, isLoading: query.isLoading, isError: query.isError, loaded: Boolean(query.data) };
}

interface Props {
  value: string | null;
  onChange: (projectId: string | null) => void;
  projects: LeadgridProjectOption[];
  loaded: boolean;
  disabled?: boolean;
  label?: string;
}

/**
 * Kontrollert velger. Holder valget gyldig (faller tilbake til første
 * prosjekt når husket id ikke finnes) og speiler det til localStorage.
 */
export function LeadgridProjectSelect({
  value,
  onChange,
  projects,
  loaded,
  disabled,
  label = "Kundeprosjekt",
}: Props) {
  useEffect(() => {
    if (!loaded) return;
    const next = projects.some((p) => p.id === value) ? value : projects[0]?.id ?? null;
    if (next !== value) onChange(next);
    storeProjectId(next);
  }, [loaded, projects, value, onChange]);

  return (
    <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 260 } }}>
      <InputLabel id="leadgrid-project-select-label">{label}</InputLabel>
      <Select
        labelId="leadgrid-project-select-label"
        label={label}
        value={value ?? ""}
        disabled={disabled || !loaded}
        onChange={(event) => onChange(String(event.target.value) || null)}
      >
        {projects.map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
