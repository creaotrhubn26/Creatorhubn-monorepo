/**
 * budgetCategoriesApi.ts
 *
 * API-klient for budsjett-kategorier (system + per-prosjekt). System-
 * kategorier (is_system=true, project_id=null) seedes via migration 135
 * og deles på tvers av alle prosjekter. Brukere kan legge til egne
 * kategorier per prosjekt.
 */

import authSessionService from './authSessionService';

const API_BASE = '/api/role-room';

export interface BudgetCategory {
  id: string;
  project_id: string | null;
  parent_group: string;
  parent_group_label: string;
  category_name: string;
  description: string | null;
  sort_order: number;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
}

export interface BudgetCategoryGroup {
  parent_group: string;
  parent_group_label: string;
  categories: BudgetCategory[];
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((authSessionService.getAuthHeadersSync() ?? {}) as Record<string, string>),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

export const budgetCategoriesApi = {
  list: async (projectId: string): Promise<BudgetCategory[]> => {
    const data = await fetchJson<{ categories: BudgetCategory[] }>(
      `/projects/${encodeURIComponent(projectId)}/producer/economy/categories`,
    );
    return data.categories;
  },

  create: async (
    projectId: string,
    body: {
      parentGroup: string;
      parentGroupLabel: string;
      categoryName: string;
      description?: string;
      sortOrder?: number;
    },
  ): Promise<BudgetCategory> => {
    const data = await fetchJson<{ category: BudgetCategory }>(
      `/projects/${encodeURIComponent(projectId)}/producer/economy/categories`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return data.category;
  },

  remove: async (projectId: string, categoryId: string): Promise<void> => {
    await fetchJson(
      `/projects/${encodeURIComponent(projectId)}/producer/economy/categories/${encodeURIComponent(categoryId)}`,
      { method: 'DELETE' },
    );
  },
};

/**
 * Grupper kategorier per parent_group i samme rekkefølge som de er sortert
 * fra serveren (system-rader først, deretter prosjekt-egne).
 */
export function groupCategories(categories: BudgetCategory[]): BudgetCategoryGroup[] {
  const groups = new Map<string, BudgetCategoryGroup>();
  for (const cat of categories) {
    const existing = groups.get(cat.parent_group);
    if (existing) {
      existing.categories.push(cat);
    } else {
      groups.set(cat.parent_group, {
        parent_group: cat.parent_group,
        parent_group_label: cat.parent_group_label,
        categories: [cat],
      });
    }
  }
  return Array.from(groups.values());
}

/**
 * Faste parent-grupper i ønsket visningsrekkefølge — brukes som fallback
 * når man trenger å lage en ny gruppe (custom-kategori i en eksisterende
 * gruppe).
 */
export const PARENT_GROUP_ORDER: Array<{ key: string; label: string }> = [
  { key: 'ATL', label: 'Above-the-line' },
  { key: 'PRE', label: 'Pre-produksjon' },
  { key: 'PROD', label: 'Produksjon' },
  { key: 'LOG', label: 'Logistikk' },
  { key: 'POST', label: 'Post-produksjon' },
  { key: 'OH', label: 'Overhead' },
];
