import type { Workflow, WorkflowMap } from "../types";

interface Props {
  workflows: WorkflowMap;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function WorkflowPicker({ workflows, selectedId, onSelect }: Props) {
  const entries = Object.values(workflows);
  const selected: Workflow | undefined = selectedId ? workflows[selectedId] : undefined;

  return (
    <div className="workflow-picker">
      <h3 className="section-title">Workflow Preset</h3>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>
          Velg arbeidsflyt…
        </option>
        {entries.map((wf) => (
          <option key={wf.id} value={wf.id}>
            {wf.name}
          </option>
        ))}
      </select>
      {selected && <div className="workflow-desc">{selected.description}</div>}
    </div>
  );
}
