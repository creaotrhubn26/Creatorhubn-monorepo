/**
 * leadgrid-workflow-webhooks.tsx — /leadgrid/workflows/webhooks
 *
 * Webhook-destinasjoner som workflows kan poste til
 * (post_to_webhook / trigger_zapier actions, mig 0350).
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
  Tooltip,
} from "@mui/material";
import WebhookIcon from "@mui/icons-material/Webhook";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SendIcon from "@mui/icons-material/Send";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";

interface WebhookDestination {
  id: string;
  name: string;
  url: string;
  has_secret: boolean;
  destination_type: string;
  is_active: boolean;
  created_by: string | null;
  last_invoked_at: string | null;
  last_status_code: number | null;
  invocation_count: number;
  created_at: string;
  updated_at: string;
}

const DESTINATION_TYPES = [
  { value: "generic", label: "Generic webhook" },
  { value: "zapier", label: "Zapier" },
  { value: "make", label: "Make (Integromat)" },
  { value: "n8n", label: "n8n" },
  { value: "slack", label: "Slack" },
  { value: "teams", label: "Teams" },
];

export default function LeadgridWorkflowWebhooksPage(): JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<WebhookDestination | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ destinations: WebhookDestination[] }>({
    queryKey: ["leadgrid-workflow-webhooks"],
    queryFn: () => apiRequest("/api/leadgrid/workflows/webhooks"),
  });
  const destinations = data?.destinations ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/leadgrid/workflows/webhooks/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["leadgrid-workflow-webhooks"],
      }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/leadgrid/workflows/webhooks/${id}/test`, {
        method: "POST",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["leadgrid-workflow-webhooks"],
      }),
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mb={3}
      >
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <WebhookIcon sx={{ color: "#a855f7" }} />
            <Typography variant="h4" fontWeight={700}>
              Webhook-destinasjoner
            </Typography>
          </Stack>
          <Typography color="text.secondary">
            Endepunkter som workflows kan poste til via{" "}
            <code>post_to_webhook</code> / <code>trigger_zapier</code> actions.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowCreate(true)}
        >
          Ny destinasjon
        </Button>
      </Stack>

      {isLoading ? (
        <CircularProgress />
      ) : destinations.length === 0 ? (
        <Alert severity="info">
          Ingen webhook-destinasjoner enda. Opprett én for å la workflows
          poste til Zapier, n8n, eller egne endepunkter.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {destinations.map((d) => (
            <Card key={d.id} variant="outlined">
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <Box flex={1}>
                    <Stack direction="row" gap={1} alignItems="center">
                      <Typography variant="h6">{d.name}</Typography>
                      <Chip size="small" label={d.destination_type} />
                      {!d.is_active && (
                        <Chip size="small" color="warning" label="Inaktiv" />
                      )}
                      <Tooltip
                        title={
                          d.has_secret
                            ? "HMAC-signering aktivert"
                            : "Ingen HMAC-secret — anbefalt for prod"
                        }
                      >
                        {d.has_secret ? (
                          <LockIcon fontSize="small" color="success" />
                        ) : (
                          <LockOpenIcon fontSize="small" color="warning" />
                        )}
                      </Tooltip>
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                        mt: 0.5,
                      }}
                    >
                      {d.url}
                    </Typography>
                    <Stack direction="row" gap={1} mt={1} flexWrap="wrap">
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`ID: ${d.id.slice(0, 8)}…`}
                      />
                      <Chip
                        size="small"
                        label={`${d.invocation_count} kall`}
                      />
                      {d.last_invoked_at && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Sist: ${new Date(d.last_invoked_at).toLocaleString("nb-NO")}`}
                        />
                      )}
                      {d.last_status_code !== null && (
                        <Chip
                          size="small"
                          color={
                            d.last_status_code >= 200 &&
                            d.last_status_code < 300
                              ? "success"
                              : "error"
                          }
                          label={`HTTP ${d.last_status_code}`}
                        />
                      )}
                    </Stack>
                  </Box>
                  <Stack direction="row" gap={1}>
                    <Tooltip title="Test-fyr">
                      <IconButton
                        size="small"
                        onClick={() => testMutation.mutate(d.id)}
                        disabled={testMutation.isPending}
                      >
                        <SendIcon />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={() => setEditing(d)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        if (confirm(`Slette destinasjon "${d.name}"?`)) {
                          deleteMutation.mutate(d.id);
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

      {showCreate && (
        <DestinationDialog
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({
              queryKey: ["leadgrid-workflow-webhooks"],
            });
          }}
        />
      )}
      {editing && (
        <DestinationDialog
          destination={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            queryClient.invalidateQueries({
              queryKey: ["leadgrid-workflow-webhooks"],
            });
          }}
        />
      )}
    </Container>
  );
}

function DestinationDialog({
  destination,
  onClose,
  onSaved,
}: {
  destination?: WebhookDestination;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element {
  const [name, setName] = useState(destination?.name ?? "");
  const [url, setUrl] = useState(destination?.url ?? "");
  const [destType, setDestType] = useState(
    destination?.destination_type ?? "generic",
  );
  const [secret, setSecret] = useState("");
  const [isActive, setIsActive] = useState(destination?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name,
        url,
        destination_type: destType,
        is_active: isActive,
      };
      if (secret) body.hmac_secret = secret;
      const path = destination
        ? `/api/leadgrid/workflows/webhooks/${destination.id}`
        : `/api/leadgrid/workflows/webhooks`;
      return apiRequest(path, {
        method: destination ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => onSaved(),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {destination ? "Rediger destinasjon" : "Ny webhook-destinasjon"}
      </DialogTitle>
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
            label="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            fullWidth
            required
            placeholder="https://hooks.zapier.com/..."
          />
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={destType}
              onChange={(e) => setDestType(String(e.target.value))}
            >
              {DESTINATION_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={
              destination?.has_secret
                ? "HMAC-secret (la stå tom for å beholde)"
                : "HMAC-secret (valgfri men anbefalt)"
            }
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            fullWidth
            type="password"
            helperText="X-Signature-Sha256-header sendes hvis satt"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={() => saveMutation.mutate()}
          disabled={!name || !url || saveMutation.isPending}
        >
          {destination ? "Oppdater" : "Lagre"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
