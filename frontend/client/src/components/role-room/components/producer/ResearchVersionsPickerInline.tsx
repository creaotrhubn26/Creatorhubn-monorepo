/**
 * ResearchVersionsPickerInline — wrapper rundt VersionPicker for
 * intake/research-versjoner. Henter listen ved mount + ved refresh-
 * trigger, og gir det videre til den generiske VersionPicker.
 */

import { useCallback, useEffect, useState } from 'react';
import VersionPicker, { type VersionItem } from './VersionPicker';
import roleRoomAgentService, {
  type IntakeVersion,
} from '../../services/roleRoomAgentService';

interface Props {
  projectId: string;
  /** Bumpes når intake har blitt re-lagret — får picker til å re-hente. */
  refreshNonce?: number;
  /** Kalt etter vellykket aktivering, så parent kan refreshe egen intake-state. */
  onActivated?: () => void;
}

export function ResearchVersionsPickerInline({
  projectId, refreshNonce = 0, onActivated,
}: Props) {
  const [versions, setVersions] = useState<IntakeVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const v = await roleRoomAgentService.listIntakeVersions(projectId);
      setVersions(v);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load, refreshNonce]);

  const items: VersionItem[] = versions.map(v => ({
    id: v.id,
    versionNumber: v.versionNumber,
    label: v.label,
    isActive: v.isActive,
    generatedByKind: v.generatedByKind,
    createdAt: v.createdAt,
    previewText: v.goalPreview,
  }));

  return (
    <VersionPicker
      title="Research-versjoner"
      versions={items}
      loading={loading}
      onActivate={(versionId) => roleRoomAgentService.activateIntakeVersion(projectId, versionId)}
      onAfterActivate={() => {
        void load();
        onActivated?.();
      }}
      accentColor="#22d3ee"
    />
  );
}

export default ResearchVersionsPickerInline;
