/**
 * SuperadminNotificationLog.tsx
 *
 * Superadmin oversikt: alle utsendte klient-varsler (e-post/SMS/WhatsApp).
 * Filter på kunde, sortert nyeste først.
 */

import React, { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Chip, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, IconButton,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import SmsIcon from "@mui/icons-material/Sms";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

interface LogRow {
  id: string;
  customer_id: string;
  channel: "email" | "sms" | "whatsapp";
  event_type: string;
  recipient: string;
  subject: string;
  sent_at: string;
  delivery_status: string;
  external_message_id: string | null;
  error_message: string | null;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <EmailIcon fontSize="small" sx={{ color: "#a78bfa" }} />,
  sms: <SmsIcon fontSize="small" sx={{ color: "#9be15d" }} />,
  whatsapp: <WhatsAppIcon fontSize="small" sx={{ color: "#25D366" }} />,
};

export function SuperadminNotificationLog() {
  const [items, setItems] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = filter.trim()
        ? `/api/superadmin/notification-log?customer_id=${encodeURIComponent(filter.trim())}`
        : `/api/superadmin/notification-log`;
      const r = await fetch(url, { credentials: "include" });
      if (r.ok) setItems((await r.json()).items ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  const sentCount = items.filter((i) => i.delivery_status === "sent").length;
  const failedCount = items.filter((i) => i.delivery_status === "failed").length;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2} mb={2}>
          <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
            Klient-varsler
          </Typography>
          <Chip size="small" icon={<CheckCircleIcon />}
                label={`${sentCount} sendt`} color="success" />
          {failedCount > 0 && (
            <Chip size="small" icon={<ErrorIcon />}
                  label={`${failedCount} feil`} color="error" />
          )}
          <TextField size="small" placeholder="kunde-id filter"
                     value={filter} onChange={(e) => setFilter(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && load()} />
          <IconButton onClick={load} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Stack>

        <Box sx={{ overflow: "auto", maxHeight: 600 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tidspunkt</TableCell>
                <TableCell>Kanal</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Mottaker</TableCell>
                <TableCell>Tittel</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id} hover>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(i.sent_at).toLocaleString("no-NO")}
                    </Typography>
                  </TableCell>
                  <TableCell>{CHANNEL_ICONS[i.channel] ?? i.channel}</TableCell>
                  <TableCell>
                    <Chip size="small" label={i.event_type}
                          sx={{ fontSize: 10, height: 18 }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{i.recipient}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{
                      maxWidth: 280, display: "inline-block",
                      whiteSpace: "nowrap", overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {i.subject}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {i.delivery_status === "sent" ? (
                      <Chip size="small" color="success"
                            icon={<CheckCircleIcon />} label="OK" />
                    ) : (
                      <Chip size="small" color="error"
                            icon={<ErrorIcon />}
                            label={i.error_message?.slice(0, 30) ?? "Feil"} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary"
                              sx={{ textAlign: "center", py: 3 }}>
                    Ingen varsler enda.
                  </Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
}
