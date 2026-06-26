/**
 * leadgrid-workflows.tsx — /leadgrid/workflows
 *
 * Smart Workflow Builder (#203 fra 500-roadmap, mig 0349).
 *
 * Funksjonalitet:
 *   - Liste alle workflows m/ status + execution-count + sist kjørt
 *   - "+ Ny workflow" → åpne builder (trigger-velger, conditions, actions)
 *   - "Templates" tab — 10 forhåndsbygde templates m/ "Bruk denne"-knapp
 *   - "Aktiv"-toggle per workflow
 *   - Eksekverings-historikk per workflow (sidebar)
 *
 * Backend:
 *   GET    /api/leadgrid/workflows
 *   GET    /api/leadgrid/workflows/templates
 *   POST   /api/leadgrid/workflows  (med template_key eller full payload)
 *   PATCH  /api/leadgrid/workflows/:id
 *   DELETE /api/leadgrid/workflows/:id
 *   GET    /api/leadgrid/workflows/:id/executions
 *   POST   /api/leadgrid/workflows/:id/execute
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Box,
  Container,
  Typography,
  Stack,
  Button,
  Card,
  CardContent,
  Chip,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  CircularProgress,
  Alert,
  Divider,
  Tooltip,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import BoltIcon from "@mui/icons-material/Bolt";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";

const TRIGGER_TYPES = [
  { value: "lead.created", label: "Ny lead opprettet" },
  { value: "lead.status_changed", label: "Lead-status endret" },
  { value: "lead.temperature_changed", label: "Lead-temperatur endret" },
  { value: "pipeline.stage_changed", label: "Pipeline-stage endret" },
  { value: "deal.probability_changed", label: "Deal-probability endret" },
  { value: "deal.amount_changed", label: "Deal-amount endret" },
  { value: "recommendation.published", label: "NBA publisert" },
  { value: "manual", label: "Manuelt utløst" },
  // mig 0350 — 6 nye triggers
  { value: "email.opened", label: "E-post åpnet" },
  { value: "email.link_clicked", label: "E-post-lenke klikket" },
  { value: "meeting.booked", label: "Møte booket" },
  { value: "meeting.no_show", label: "Møte no-show" },
  { value: "proposal.opened", label: "Proposal åpnet" },
  { value: "contract.signed", label: "Kontrakt signert" },
];

const ACTION_TYPES = [
  { value: "send_email", label: "Send e-post" },
  { value: "send_sms", label: "Send SMS" },
  { value: "send_whatsapp", label: "Send WhatsApp" },
  { value: "create_task", label: "Opprett oppgave" },
  { value: "change_pipeline_stage", label: "Endre pipeline-stage" },
  { value: "set_lead_status", label: "Sett lead-status" },
  { value: "assign_to_user", label: "Tildel til bruker" },
  { value: "add_tag", label: "Legg til tag" },
  { value: "notify_channel", label: "Varsle kanal (Slack/Teams)" },
  { value: "wait", label: "Vent (minutter)" },
  { value: "ai_pitch_generate", label: "AI: Generer pitch" },
  // mig 0350 — 9 nye actions
  { value: "schedule_call", label: "Planlegg telefonsamtale" },
  { value: "book_meeting", label: "Book møte" },
  { value: "update_lead_fields", label: "Oppdater lead-felter" },
  { value: "post_to_webhook", label: "Post til webhook" },
  { value: "trigger_zapier", label: "Trigger Zapier" },
  { value: "send_internal_notification", label: "Intern varsling" },
  { value: "remove_tag", label: "Fjern tag" },
  { value: "archive_lead", label: "Arkiver lead" },
  { value: "revive_lead", label: "Reviviser lead" },
];

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  conditions: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  executionCount: number;
  lastExecutedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  templateKey: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowTemplate {
  key: string;
  name: string;
  description: string;
  category: string;
  trigger: { type: string };
  actions: Array<{ type: string }>;
}

export default function LeadgridWorkflowsPage(): JSX.Element {
  const [tab, setTab] = useState<"list" | "templates">("list");
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(
    null,
  );
  const queryClient = useQueryClient();

  const { data: listData, isLoading } = useQuery<{ workflows: Workflow[] }>({
    queryKey: ["leadgrid-workflows"],
    queryFn: () => apiRequest("/api/leadgrid/workflows"),
  });
  const { data: templateData } = useQuery<{ templates: WorkflowTemplate[] }>({
    queryKey: ["leadgrid-workflow-templates"],
    queryFn: () => apiRequest("/api/leadgrid/workflows/templates"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (vars: { id: string; isActive: boolean }) =>
      apiRequest(`/api/leadgrid/workflows/${vars.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: vars.isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadgrid-workflows"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest(`/api/leadgrid/workflows/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadgrid-workflows"] });
    },
  });

  const useTemplateMutation = useMutation({
    mutationFn: async (templateKey: string) =>
      apiRequest("/api/leadgrid/workflows", {
        method: "POST",
        body: JSON.stringify({ template_key: templateKey }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leadgrid-workflows"] });
      setTab("list");
    },
  });

  const workflows = listData?.workflows ?? [];
  const templates = templateData?.templates ?? [];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <BoltIcon sx={{ color: "#a855f7" }} />
            <Typography variant="h4" fontWeight={700}>
              Smart Workflows
            </Typography>
          </Stack>
          <Typography color="text.secondary">
            Automatiser oppfølging, varsler og pipeline-flyt — koblet til
            Leadgrid-events.
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Button
            variant="outlined"
            onClick={() => {
              window.location.href = "/leadgrid/workflows/webhooks";
            }}
          >
            Webhook-destinasjoner
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedWorkflow(null);
              setShowBuilder(true);
            }}
          >
            Ny workflow
          </Button>
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={`Mine workflows (${workflows.length})`} value="list" />
        <Tab label={`Templates (${templates.length})`} value="templates" />
      </Tabs>

      {tab === "list" && (
        <>
          {isLoading ? (
            <CircularProgress />
          ) : workflows.length === 0 ? (
            <Alert severity="info">
              Ingen workflows enda. Lag en fra bunnen, eller velg en template.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {workflows.map((w) => (
                <Card key={w.id} variant="outlined">
                  <CardContent>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                    >
                      <Box flex={1}>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Typography variant="h6">{w.name}</Typography>
                          {w.lastErrorAt && (
                            <Tooltip title={w.lastErrorMessage ?? "Sist feil"}>
                              <Chip
                                size="small"
                                color="error"
                                icon={<ErrorIcon />}
                                label="Feilet sist"
                              />
                            </Tooltip>
                          )}
                          {!w.isActive && (
                            <Chip
                              size="small"
                              icon={<PauseCircleIcon />}
                              label="Inaktiv"
                            />
                          )}
                          {w.templateKey && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`Template: ${w.templateKey}`}
                            />
                          )}
                        </Stack>
                        {w.description && (
                          <Typography variant="body2" color="text.secondary" mt={0.5}>
                            {w.description}
                          </Typography>
                        )}
                        <Stack direction="row" gap={1} mt={1} flexWrap="wrap">
                          <Chip
                            size="small"
                            color="primary"
                            variant="outlined"
                            label={`Trigger: ${labelForTrigger(w.triggerType)}`}
                          />
                          <Chip
                            size="small"
                            label={`${w.actions.length} actions`}
                          />
                          {w.conditions.length > 0 && (
                            <Chip
                              size="small"
                              label={`${w.conditions.length} conditions`}
                            />
                          )}
                          <Chip
                            size="small"
                            icon={<PlayArrowIcon />}
                            label={`Kjørt ${w.executionCount} ganger`}
                          />
                          {w.lastExecutedAt && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`Sist: ${new Date(w.lastExecutedAt).toLocaleString("nb-NO")}`}
                            />
                          )}
                        </Stack>
                      </Box>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={w.isActive}
                              onChange={(e) =>
                                toggleMutation.mutate({
                                  id: w.id,
                                  isActive: e.target.checked,
                                })
                              }
                            />
                          }
                          label="Aktiv"
                        />
                        <IconButton
                          size="small"
                          onClick={() => setSelectedWorkflow(w)}
                          title="Eksekverings-historikk"
                        >
                          <HistoryIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            if (confirm(`Slette workflow "${w.name}"?`)) {
                              deleteMutation.mutate(w.id);
                            }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}

      {tab === "templates" && (
        <Stack spacing={2}>
          {templates.map((t) => (
            <Card key={t.key} variant="outlined">
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box flex={1}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography variant="h6">{t.name}</Typography>
                      <Chip size="small" label={t.category} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                      {t.description}
                    </Typography>
                    <Stack direction="row" gap={1} mt={1}>
                      <Chip
                        size="small"
                        variant="outlined"
                        color="primary"
                        label={`Trigger: ${labelForTrigger(t.trigger.type)}`}
                      />
                      <Chip size="small" label={`${t.actions.length} actions`} />
                    </Stack>
                  </Box>
                  <Button
                    variant="outlined"
                    onClick={() => useTemplateMutation.mutate(t.key)}
                    disabled={useTemplateMutation.isPending}
                  >
                    Bruk denne
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {showBuilder && (
        <WorkflowBuilderDialog
          onClose={() => setShowBuilder(false)}
          onSaved={() => {
            setShowBuilder(false);
            queryClient.invalidateQueries({ queryKey: ["leadgrid-workflows"] });
          }}
        />
      )}

      {selectedWorkflow && (
        <ExecutionHistoryDialog
          workflow={selectedWorkflow}
          onClose={() => setSelectedWorkflow(null)}
        />
      )}
    </Container>
  );
}

function labelForTrigger(value: string): string {
  return TRIGGER_TYPES.find((t) => t.value === value)?.label ?? value;
}

// ─── Workflow Builder Dialog ─────────────────────────────────────────
interface BuilderAction {
  type: string;
  template_id?: string;
  title?: string;
  stage?: string;
  user_id?: string;
  tag?: string;
  channel?: string;
  message_template?: string;
  duration_minutes?: number;
  save_to_notes?: boolean;
  status?: string;
  // mig 0350 — nye actions
  when?: string;
  notes?: string;
  meeting_type?: string;
  fields?: Record<string, unknown>;
  fields_json?: string;
  destination_id?: string;
  payload_template?: string;
  payload?: Record<string, unknown>;
  recipient?: string;
  body?: string;
  reason?: string;
}

function WorkflowBuilderDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("lead.created");
  const [triggerTo, setTriggerTo] = useState("");
  const [triggerEmailId, setTriggerEmailId] = useState("");
  const [triggerLinkPattern, setTriggerLinkPattern] = useState("");
  const [triggerMeetingType, setTriggerMeetingType] = useState("");
  const [triggerProposalId, setTriggerProposalId] = useState("");
  const [triggerContractProvider, setTriggerContractProvider] = useState("");
  const [actions, setActions] = useState<BuilderAction[]>([
    { type: "send_email", template_id: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const trigger: Record<string, unknown> = { type: triggerType };
      if (
        ["lead.status_changed", "pipeline.stage_changed", "lead.temperature_changed"].includes(
          triggerType,
        ) &&
        triggerTo
      ) {
        trigger.to = triggerTo;
      }
      // mig 0350 — nye trigger-config-felt
      if (triggerType === "email.opened" && triggerEmailId)
        trigger.email_id = triggerEmailId;
      if (triggerType === "email.link_clicked" && triggerLinkPattern)
        trigger.link_url_pattern = triggerLinkPattern;
      if (triggerType === "meeting.booked" && triggerMeetingType)
        trigger.meeting_type = triggerMeetingType;
      if (triggerType === "proposal.opened" && triggerProposalId)
        trigger.proposal_id = triggerProposalId;
      if (triggerType === "contract.signed" && triggerContractProvider)
        trigger.provider = triggerContractProvider;

      // update_lead_fields: parse fields_json → fields-objekt
      const cleanedActions = actions.map((a) => {
        if (a.type === "update_lead_fields" && a.fields_json) {
          try {
            return { ...a, fields: JSON.parse(a.fields_json), fields_json: undefined };
          } catch {
            throw new Error(`Action #${actions.indexOf(a) + 1}: ugyldig JSON i fields`);
          }
        }
        return a;
      });

      return apiRequest("/api/leadgrid/workflows", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          trigger_type: triggerType,
          trigger_config: trigger,
          conditions: [],
          actions: cleanedActions,
        }),
      });
    },
    onSuccess: () => onSaved(),
    onError: (e: Error) => setError(e.message),
  });

  function addAction(): void {
    setActions((prev) => [...prev, { type: "send_email", template_id: "" }]);
  }
  function removeAction(idx: number): void {
    setActions((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateAction(idx: number, patch: Partial<BuilderAction>): void {
    setActions((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    );
  }

  const requiresTo = [
    "lead.status_changed",
    "pipeline.stage_changed",
    "lead.temperature_changed",
  ].includes(triggerType);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Ny workflow</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Navn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Beskrivelse"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <Divider>Trigger</Divider>
          <FormControl fullWidth>
            <InputLabel>Trigger-type</InputLabel>
            <Select
              label="Trigger-type"
              value={triggerType}
              onChange={(e) => setTriggerType(String(e.target.value))}
            >
              {TRIGGER_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {requiresTo && (
            <TextField
              label='"To"-verdi (f.eks. "won", "hot")'
              value={triggerTo}
              onChange={(e) => setTriggerTo(e.target.value)}
              fullWidth
              helperText="For status/stage/temperature: hvilken verdi som skal trigge"
            />
          )}
          {triggerType === "email.opened" && (
            <TextField
              label="Email-ID (valgfri)"
              value={triggerEmailId}
              onChange={(e) => setTriggerEmailId(e.target.value)}
              fullWidth
              helperText="Filtrer på spesifikk e-post-kampanje/template. Tom = alle."
            />
          )}
          {triggerType === "email.link_clicked" && (
            <TextField
              label="Lenke-URL-pattern (valgfri)"
              value={triggerLinkPattern}
              onChange={(e) => setTriggerLinkPattern(e.target.value)}
              fullWidth
              helperText="Substring som må forekomme i URL-en (case-insensitive). F.eks. 'pricing'."
            />
          )}
          {triggerType === "meeting.booked" && (
            <FormControl fullWidth>
              <InputLabel>Møte-type (valgfri)</InputLabel>
              <Select
                label="Møte-type (valgfri)"
                value={triggerMeetingType}
                onChange={(e) => setTriggerMeetingType(String(e.target.value))}
              >
                <MenuItem value="">Alle</MenuItem>
                <MenuItem value="discovery">Discovery</MenuItem>
                <MenuItem value="demo">Demo</MenuItem>
                <MenuItem value="closing">Closing</MenuItem>
                <MenuItem value="followup">Followup</MenuItem>
                <MenuItem value="other">Annet</MenuItem>
              </Select>
            </FormControl>
          )}
          {triggerType === "proposal.opened" && (
            <TextField
              label="Proposal-ID (valgfri)"
              value={triggerProposalId}
              onChange={(e) => setTriggerProposalId(e.target.value)}
              fullWidth
            />
          )}
          {triggerType === "contract.signed" && (
            <TextField
              label="Provider (valgfri)"
              value={triggerContractProvider}
              onChange={(e) => setTriggerContractProvider(e.target.value)}
              fullWidth
              helperText="docusign / posten_signering / hellosign / manual"
            />
          )}

          <Divider>Actions (kjøres i rekkefølge)</Divider>
          {actions.map((a, idx) => (
            <Card key={idx} variant="outlined">
              <CardContent>
                <Stack direction="row" gap={1} alignItems="center" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    #{idx + 1}
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <Select
                      value={a.type}
                      onChange={(e) =>
                        updateAction(idx, { type: String(e.target.value) })
                      }
                    >
                      {ACTION_TYPES.map((t) => (
                        <MenuItem key={t.value} value={t.value}>
                          {t.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Box flex={1} />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removeAction(idx)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
                <ActionConfigFields
                  action={a}
                  onChange={(patch) => updateAction(idx, patch)}
                />
              </CardContent>
            </Card>
          ))}
          <Button startIcon={<AddIcon />} onClick={addAction}>
            Legg til action
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={() => createMutation.mutate()}
          disabled={!name || actions.length === 0 || createMutation.isPending}
        >
          Lagre workflow
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ActionConfigFields({
  action,
  onChange,
}: {
  action: BuilderAction;
  onChange: (patch: Partial<BuilderAction>) => void;
}): JSX.Element {
  switch (action.type) {
    case "send_email":
    case "send_sms":
    case "send_whatsapp":
      return (
        <TextField
          label="Template ID"
          value={action.template_id ?? ""}
          onChange={(e) => onChange({ template_id: e.target.value })}
          fullWidth
          size="small"
        />
      );
    case "create_task":
      return (
        <TextField
          label="Tittel"
          value={action.title ?? ""}
          onChange={(e) => onChange({ title: e.target.value })}
          fullWidth
          size="small"
        />
      );
    case "change_pipeline_stage":
      return (
        <FormControl fullWidth size="small">
          <InputLabel>Stage</InputLabel>
          <Select
            label="Stage"
            value={action.stage ?? ""}
            onChange={(e) => onChange({ stage: String(e.target.value) })}
          >
            {[
              "new",
              "first_contact",
              "qualified",
              "meeting",
              "proposal",
              "negotiation",
              "won",
              "lost",
            ].map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    case "set_lead_status":
      return (
        <TextField
          label="Status-key"
          value={action.status ?? ""}
          onChange={(e) => onChange({ status: e.target.value })}
          fullWidth
          size="small"
        />
      );
    case "assign_to_user":
      return (
        <TextField
          label="Bruker-ID"
          value={action.user_id ?? ""}
          onChange={(e) => onChange({ user_id: e.target.value })}
          fullWidth
          size="small"
        />
      );
    case "add_tag":
      return (
        <TextField
          label="Tag"
          value={action.tag ?? ""}
          onChange={(e) => onChange({ tag: e.target.value })}
          fullWidth
          size="small"
        />
      );
    case "notify_channel":
      return (
        <Stack spacing={1}>
          <FormControl size="small" fullWidth>
            <InputLabel>Kanal</InputLabel>
            <Select
              label="Kanal"
              value={action.channel ?? "slack"}
              onChange={(e) => onChange({ channel: String(e.target.value) })}
            >
              <MenuItem value="slack">Slack</MenuItem>
              <MenuItem value="teams">Teams</MenuItem>
              <MenuItem value="email_admin">Admin-epost</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Melding"
            value={action.message_template ?? ""}
            onChange={(e) => onChange({ message_template: e.target.value })}
            fullWidth
            multiline
            minRows={2}
            size="small"
          />
        </Stack>
      );
    case "wait":
      return (
        <TextField
          label="Minutter"
          type="number"
          value={action.duration_minutes ?? 60}
          onChange={(e) =>
            onChange({ duration_minutes: Number(e.target.value) })
          }
          fullWidth
          size="small"
        />
      );
    case "ai_pitch_generate":
      return (
        <FormControlLabel
          control={
            <Switch
              checked={action.save_to_notes ?? true}
              onChange={(e) => onChange({ save_to_notes: e.target.checked })}
            />
          }
          label="Lagre som lead-notat"
        />
      );

    // ─── Mig 0350 nye actions ──────────────────────────────────────
    case "schedule_call":
      return (
        <Stack spacing={1}>
          <TextField
            label="Når (ISO eller 'in_X_days')"
            value={action.when ?? ""}
            onChange={(e) => onChange({ when: e.target.value })}
            fullWidth
            size="small"
            helperText="F.eks. 'in_2_days', 'in_4_hours' eller '2026-07-01T09:00:00Z'"
          />
          <TextField
            label="Notater"
            value={action.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            fullWidth
            size="small"
          />
        </Stack>
      );

    case "book_meeting":
      return (
        <Stack spacing={1}>
          <FormControl size="small" fullWidth>
            <InputLabel>Møte-type</InputLabel>
            <Select
              label="Møte-type"
              value={action.meeting_type ?? "discovery"}
              onChange={(e) =>
                onChange({ meeting_type: String(e.target.value) })
              }
            >
              <MenuItem value="discovery">Discovery</MenuItem>
              <MenuItem value="demo">Demo</MenuItem>
              <MenuItem value="closing">Closing</MenuItem>
              <MenuItem value="followup">Followup</MenuItem>
              <MenuItem value="other">Annet</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Når"
            value={action.when ?? ""}
            onChange={(e) => onChange({ when: e.target.value })}
            fullWidth
            size="small"
            helperText="ISO eller 'in_X_days'/'in_X_hours'"
          />
          <TextField
            label="Varighet (min)"
            type="number"
            value={action.duration_minutes ?? 30}
            onChange={(e) =>
              onChange({ duration_minutes: Number(e.target.value) })
            }
            fullWidth
            size="small"
          />
        </Stack>
      );

    case "update_lead_fields":
      return (
        <TextField
          label="Fields JSON"
          value={action.fields_json ?? ""}
          onChange={(e) => onChange({ fields_json: e.target.value })}
          fullWidth
          multiline
          minRows={3}
          size="small"
          helperText='F.eks. {"lead_temperature": "warm", "notes": "Auto-oppfølging trigget"}. Kun whitelistede felt skrives.'
        />
      );

    case "post_to_webhook":
      return (
        <Stack spacing={1}>
          <TextField
            label="Destination ID"
            value={action.destination_id ?? ""}
            onChange={(e) => onChange({ destination_id: e.target.value })}
            fullWidth
            size="small"
            helperText="UUID fra webhook-destinasjoner-siden"
          />
          <TextField
            label="Payload-template (valgfri)"
            value={action.payload_template ?? ""}
            onChange={(e) => onChange({ payload_template: e.target.value })}
            fullWidth
            multiline
            minRows={3}
            size="small"
            helperText='JSON med {{lead.name}} / {{event.foo}} placeholders. Tom = default-shape.'
          />
        </Stack>
      );

    case "trigger_zapier":
      return (
        <TextField
          label="Destination ID"
          value={action.destination_id ?? ""}
          onChange={(e) => onChange({ destination_id: e.target.value })}
          fullWidth
          size="small"
        />
      );

    case "send_internal_notification":
      return (
        <Stack spacing={1}>
          <FormControl size="small" fullWidth>
            <InputLabel>Mottaker</InputLabel>
            <Select
              label="Mottaker"
              value={action.recipient ?? "owner"}
              onChange={(e) => onChange({ recipient: String(e.target.value) })}
            >
              <MenuItem value="owner">Lead owner</MenuItem>
              <MenuItem value="assignee">Assignee (= owner)</MenuItem>
              <MenuItem value="manager">Manager (admin/salgssjef/teamleder)</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Tittel"
            value={action.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
            fullWidth
            size="small"
            helperText="Støtter {{lead.name}}, {{lead.score}}, {{event.foo}}"
          />
          <TextField
            label="Body"
            value={action.body ?? ""}
            onChange={(e) => onChange({ body: e.target.value })}
            fullWidth
            multiline
            minRows={2}
            size="small"
          />
        </Stack>
      );

    case "remove_tag":
      return (
        <TextField
          label="Tag som skal fjernes"
          value={action.tag ?? ""}
          onChange={(e) => onChange({ tag: e.target.value })}
          fullWidth
          size="small"
        />
      );

    case "archive_lead":
      return (
        <TextField
          label="Årsak (valgfri)"
          value={action.reason ?? ""}
          onChange={(e) => onChange({ reason: e.target.value })}
          fullWidth
          size="small"
        />
      );

    case "revive_lead":
      return <Box>(ingen ekstra config)</Box>;

    default:
      return <Box />;
  }
}

// ─── Execution History Dialog ────────────────────────────────────────
interface Execution {
  id: string;
  leadId: string | null;
  status: string;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  actionsExecuted: Array<{
    index: number;
    type: string;
    status: string;
    message?: string;
    durationMs?: number;
  }>;
}

function ExecutionHistoryDialog({
  workflow,
  onClose,
}: {
  workflow: Workflow;
  onClose: () => void;
}): JSX.Element {
  const { data, isLoading } = useQuery<{ executions: Execution[] }>({
    queryKey: ["leadgrid-workflow-executions", workflow.id],
    queryFn: () =>
      apiRequest(`/api/leadgrid/workflows/${workflow.id}/executions`),
  });
  const executions = data?.executions ?? [];

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Historikk: {workflow.name}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <CircularProgress />
        ) : executions.length === 0 ? (
          <Alert severity="info">Ingen eksekveringer enda.</Alert>
        ) : (
          <List>
            {executions.map((e) => (
              <ListItem key={e.id} divider alignItems="flex-start">
                <ListItemText
                  primary={
                    <Stack direction="row" gap={1} alignItems="center">
                      <Chip
                        size="small"
                        color={
                          e.status === "completed"
                            ? "success"
                            : e.status === "failed"
                              ? "error"
                              : "default"
                        }
                        icon={
                          e.status === "completed" ? (
                            <CheckCircleIcon />
                          ) : e.status === "failed" ? (
                            <ErrorIcon />
                          ) : undefined
                        }
                        label={e.status}
                      />
                      <Typography variant="body2">
                        {new Date(e.startedAt).toLocaleString("nb-NO")}
                      </Typography>
                      {e.durationMs !== null && (
                        <Typography variant="caption" color="text.secondary">
                          ({e.durationMs} ms)
                        </Typography>
                      )}
                      {e.leadId && (
                        <Typography variant="caption" color="text.secondary">
                          Lead: {e.leadId.slice(0, 8)}…
                        </Typography>
                      )}
                    </Stack>
                  }
                  secondary={
                    <Box>
                      {e.errorMessage && (
                        <Alert severity="error" sx={{ my: 1 }}>
                          {e.errorMessage}
                        </Alert>
                      )}
                      <Stack direction="row" gap={0.5} flexWrap="wrap" mt={0.5}>
                        {e.actionsExecuted.map((a, i) => (
                          <Chip
                            key={i}
                            size="small"
                            variant="outlined"
                            color={
                              a.status === "ok"
                                ? "success"
                                : a.status === "error"
                                  ? "error"
                                  : a.status === "deferred"
                                    ? "warning"
                                    : "default"
                            }
                            label={`${a.type}: ${a.status}`}
                          />
                        ))}
                      </Stack>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
}
