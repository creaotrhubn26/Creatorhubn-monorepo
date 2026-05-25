import { useEffect, useState } from "react";
import { listProjectTemplates } from "../api";
import type { CullPreflight, ProjectTemplateSummary } from "../types";

interface Props {
  sourceLabel: string;
  clipCount: number;
  totalBytes: number;
  defaultTemplateId?: string;
  onCancel: () => void;
  onStart: (preflight: CullPreflight, model: string, skipVision: boolean) => void;
}

const FORMAT_GB = (bytes: number) => `${(bytes / 1_073_741_824).toFixed(1)} GB`;

export function CullPreflight({
  sourceLabel,
  clipCount,
  totalBytes,
  defaultTemplateId = "corporate_video",
  onCancel,
  onStart,
}: Props) {
  const [multiCamera, setMultiCamera] = useState(true);
  const [externalAudio, setExternalAudio] = useState(true);
  const [groupByTimecode, setGroupByTimecode] = useState(true);
  const [rejectTcDuplicates, setRejectTcDuplicates] = useState(false);
  const [projectTemplate, setProjectTemplate] = useState(defaultTemplateId);
  const [templates, setTemplates] = useState<ProjectTemplateSummary[]>([]);
  const [model, setModel] = useState("claude-haiku-4-5");
  const [skipVision, setSkipVision] = useState(false);

  useEffect(() => {
    listProjectTemplates()
      .then((index) => setTemplates(index.templates))
      .catch(() => {});
  }, []);

  const estApiCalls = skipVision ? 0 : clipCount;
  const estCost = skipVision
    ? 0
    : model.includes("haiku")
    ? (clipCount * 3 * 0.0003).toFixed(2)
    : (clipCount * 3 * 0.003).toFixed(2);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
        <h2>Pre-flight — {sourceLabel}</h2>
        <div className="desc">
          {clipCount} klipp · {FORMAT_GB(totalBytes)}. Svarene former pipeline-en.
        </div>

        <div className="preflight-question">
          <input
            id="pf-multicam"
            type="checkbox"
            checked={multiCamera}
            onChange={(e) => setMultiCamera(e.target.checked)}
          />
          <label htmlFor="pf-multicam">
            <strong>Har du filmet med flere kamera samtidig?</strong>
            <div className="desc">
              Hvis ja, AI-en forstår at flere klipp dekker samme øyeblikk og prioriterer den beste vinkelen.
            </div>
          </label>
        </div>

        <div className="preflight-question">
          <input
            id="pf-audio"
            type="checkbox"
            checked={externalAudio}
            onChange={(e) => setExternalAudio(e.target.checked)}
          />
          <label htmlFor="pf-audio">
            <strong>Brukte du eksterne lydopptakere (Zoom, Rode, etc.)?</strong>
            <div className="desc">
              Etter cull foreslås sync_audio_by_timecode eller sync_audio_by_filename_pattern automatisk.
            </div>
          </label>
        </div>

        <div className="preflight-question">
          <input
            id="pf-tc-group"
            type="checkbox"
            checked={groupByTimecode}
            onChange={(e) => setGroupByTimecode(e.target.checked)}
          />
          <label htmlFor="pf-tc-group">
            <strong>Gruppere klipp etter timecode?</strong>
            <div className="desc">
              Oppdager multicam-øyeblikk når klipp har samme start-TC fra forskjellige kameraer.
            </div>
          </label>
        </div>

        <div className="preflight-question">
          <input
            id="pf-tc-dup"
            type="checkbox"
            checked={rejectTcDuplicates}
            onChange={(e) => setRejectTcDuplicates(e.target.checked)}
          />
          <label htmlFor="pf-tc-dup">
            <strong>Foreslå reject på TC-duplikater?</strong>
            <div className="desc">
              Når samme kamera har to klipp med samme TC (utløst dobbelt), markeres det minste som "maybe".
            </div>
          </label>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="pf-template">Prosjekt-mal</label>
          <select id="pf-template" value={projectTemplate} onChange={(e) => setProjectTemplate(e.target.value)}>
            {(templates.length > 0 ? templates : [
              { id: "corporate_video", name: "Corporate Video" },
              { id: "documentary", name: "Documentary" },
              { id: "podcast", name: "Podcast (Video)" },
              { id: "course_academy", name: "Course / Academy" },
              { id: "music_video", name: "Music Video" },
              { id: "social_media", name: "Social Media Batch" },
              { id: "wedding_film", name: "Wedding Film" },
            ]).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="pf-model">AI-modell</label>
          <select id="pf-model" value={model} onChange={(e) => setModel(e.target.value)} disabled={skipVision}>
            <option value="claude-haiku-4-5">Haiku (rask + billig — ~${(clipCount * 3 * 0.0003).toFixed(2)})</option>
            <option value="claude-sonnet-4-6">Sonnet (nøyaktig — ~${(clipCount * 3 * 0.003).toFixed(2)})</option>
          </select>
        </div>

        <div className="preflight-question">
          <input
            id="pf-skip-vision"
            type="checkbox"
            checked={skipVision}
            onChange={(e) => setSkipVision(e.target.checked)}
          />
          <label htmlFor="pf-skip-vision">
            <strong>Hopp over Claude Vision (kun lokal pre-filter)</strong>
            <div className="desc">Gratis. Reject åpenbart dårlige klipp, men ingen scene-tagging eller score.</div>
          </label>
        </div>

        <div className="dialog-warning" style={{ marginTop: 12 }}>
          Estimat: {estApiCalls === 0 ? "ingen API-kall" : `${estApiCalls * 3} bilder til ${model.includes("haiku") ? "Haiku" : "Sonnet"} ≈ $${estCost}`}
        </div>

        <div className="actions">
          <button onClick={onCancel}>Cancel</button>
          <button
            className="primary"
            onClick={() =>
              onStart(
                {
                  multiCamera,
                  externalAudio,
                  groupByTimecode,
                  rejectTcDuplicates,
                  projectTemplate,
                },
                model,
                skipVision,
              )
            }
          >
            Start Cull
          </button>
        </div>
      </div>
    </div>
  );
}
