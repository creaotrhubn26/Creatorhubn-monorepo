/**
 * useDanceAnnotationCatalog — auto-fetch + cache + mutations for
 * categories + labels.
 *
 * Source-of-truth: backend (migrasjon 217). Defaults auto-seedes ved første
 * GET. Local cache invalidates ved alle mutations.
 *
 * Bruk:
 *   const catalog = useDanceAnnotationCatalog({ projectId });
 *   catalog.categories      — readonly liste
 *   catalog.labels          — readonly liste (alle)
 *   catalog.labelsFor(catId) — filtrert per kategori
 *   catalog.createCategory(input) — async, oppdaterer cache
 *   ...
 */
import React from 'react';

import {
  listAnnotationCategories,
  createAnnotationCategory,
  patchAnnotationCategory,
  deleteAnnotationCategory,
  listAnnotationLabels,
  createAnnotationLabel,
  patchAnnotationLabel,
  deleteAnnotationLabel,
  type AnnotationCategoryRecord,
  type AnnotationCategoryInput,
  type AnnotationCategoryPatch,
  type AnnotationLabelRecord,
  type AnnotationLabelInput,
  type AnnotationLabelPatch,
} from './danceAnnotationCatalogService';

export interface UseDanceAnnotationCatalogOptions {
  projectId: string | null;
  /** Skip backend-tilkobling for tester / SSR. */
  disabled?: boolean;
}

export interface DanceAnnotationCatalogHandle {
  categories: readonly AnnotationCategoryRecord[];
  labels: readonly AnnotationLabelRecord[];
  loading: boolean;
  error: string | null;
  labelsFor: (categoryId: string | null) => readonly AnnotationLabelRecord[];
  /** Hent på nytt fra backend. */
  refresh: () => Promise<void>;
  createCategory: (input: AnnotationCategoryInput) => Promise<AnnotationCategoryRecord>;
  patchCategory: (id: string, patch: AnnotationCategoryPatch) => Promise<AnnotationCategoryRecord>;
  deleteCategory: (id: string) => Promise<boolean>;
  createLabel: (input: AnnotationLabelInput) => Promise<AnnotationLabelRecord>;
  patchLabel: (id: string, patch: AnnotationLabelPatch) => Promise<AnnotationLabelRecord>;
  deleteLabel: (id: string) => Promise<void>;
}

export function useDanceAnnotationCatalog(
  options: UseDanceAnnotationCatalogOptions,
): DanceAnnotationCatalogHandle {
  const [categories, setCategories] = React.useState<readonly AnnotationCategoryRecord[]>([]);
  const [labels, setLabels] = React.useState<readonly AnnotationLabelRecord[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (): Promise<void> => {
    if (options.disabled) return;
    setLoading(true);
    setError(null);
    try {
      const [cats, lbls] = await Promise.all([
        listAnnotationCategories(options.projectId ?? undefined),
        listAnnotationLabels({ projectId: options.projectId ?? undefined }),
      ]);
      setCategories(cats);
      setLabels(lbls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste kategorier');
    } finally {
      setLoading(false);
    }
  }, [options.disabled, options.projectId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const labelsFor = React.useCallback(
    (categoryId: string | null): readonly AnnotationLabelRecord[] => {
      if (categoryId == null) return labels;
      // Inkluder labels for spesifikk kategori + kategoriløse (global)
      return labels.filter((l) => l.categoryId === categoryId || l.categoryId == null);
    },
    [labels],
  );

  // ─── Mutations (alle oppdaterer cache lokalt) ────────────────────────

  const handleCreateCategory = React.useCallback(async (
    input: AnnotationCategoryInput,
  ): Promise<AnnotationCategoryRecord> => {
    const projectId = options.projectId ?? null;
    const created = await createAnnotationCategory({ ...input, projectId });
    setCategories((prev) => [...prev, created].sort(
      (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder,
    ));
    return created;
  }, [options.projectId]);

  const handlePatchCategory = React.useCallback(async (
    id: string,
    patch: AnnotationCategoryPatch,
  ): Promise<AnnotationCategoryRecord> => {
    const updated = await patchAnnotationCategory(id, patch);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const handleDeleteCategory = React.useCallback(async (id: string): Promise<boolean> => {
    const ok = await deleteAnnotationCategory(id);
    if (ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      // Orphan-labels på frontend cache
      setLabels((prev) => prev.filter((l) => l.categoryId !== id));
    }
    return ok;
  }, []);

  const handleCreateLabel = React.useCallback(async (
    input: AnnotationLabelInput,
  ): Promise<AnnotationLabelRecord> => {
    const projectId = options.projectId ?? null;
    const created = await createAnnotationLabel({ ...input, projectId });
    setLabels((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
    return created;
  }, [options.projectId]);

  const handlePatchLabel = React.useCallback(async (
    id: string,
    patch: AnnotationLabelPatch,
  ): Promise<AnnotationLabelRecord> => {
    const updated = await patchAnnotationLabel(id, patch);
    setLabels((prev) => prev.map((l) => (l.id === id ? updated : l)));
    return updated;
  }, []);

  const handleDeleteLabel = React.useCallback(async (id: string): Promise<void> => {
    await deleteAnnotationLabel(id);
    setLabels((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return {
    categories,
    labels,
    loading,
    error,
    labelsFor,
    refresh,
    createCategory: handleCreateCategory,
    patchCategory: handlePatchCategory,
    deleteCategory: handleDeleteCategory,
    createLabel: handleCreateLabel,
    patchLabel: handlePatchLabel,
    deleteLabel: handleDeleteLabel,
  };
}
