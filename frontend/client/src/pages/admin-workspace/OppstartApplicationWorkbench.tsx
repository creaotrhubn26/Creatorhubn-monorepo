import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import KeyboardArrowUpOutlinedIcon from "@mui/icons-material/KeyboardArrowUpOutlined";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import RadioButtonUncheckedOutlinedIcon from "@mui/icons-material/RadioButtonUncheckedOutlined";
import SourceOutlinedIcon from "@mui/icons-material/SourceOutlined";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";

import {
  analyzeOppstartApplication,
  findOppstartSectionAtPosition,
  listOppstartOpenFields,
  type OppstartApplicationSectionAnalysis,
} from "./oppstartApplicationModel";

const OFFICIAL_SERVICE_URL =
  "https://www.innovasjonnorge.no/tjeneste/oppstartstilskudd-1";
const OFFICIAL_GUIDE_URL =
  "https://cdn.sanity.io/files/loal7n8w/inno-prod/bc7103bdd2d6fb7757272dffb35b336b88d3f9a5.xlsx";
const APPLICATION_PORTAL_URL = "https://start.innovasjonnorge.no/";

export interface ApplicationNavigationTarget {
  position: number;
  length?: number;
  sectionHeading: string;
  requestId: number;
}

interface OppstartApplicationWorkbenchProps {
  content: string;
  attachmentCount: number;
  dueDate: string | null;
  cursorPosition: number;
  focusedSectionHeading: string | null;
  onNavigate: (target: Omit<ApplicationNavigationTarget, "requestId">) => void;
  onFocusSection: (heading: string | null) => void;
  onOpenWritingReview: (section: OppstartApplicationSectionAnalysis) => void;
  onOpenSources: (section: OppstartApplicationSectionAnalysis | null) => void;
  onOpenPortalExport: () => void;
  compact?: boolean;
}

function formatDate(value: string | null): string {
  if (!value) return "ikke satt";
  return new Date(value.slice(0, 10) + "T12:00:00").toLocaleDateString(
    "nb-NO",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
}

function sectionNumber(heading: string): string {
  return heading.match(/^##\s+(\d+)\./u)?.[1] ?? "";
}

export function OppstartApplicationWorkbench({
  content,
  attachmentCount,
  dueDate,
  cursorPosition,
  focusedSectionHeading,
  onNavigate,
  onFocusSection,
  onOpenWritingReview,
  onOpenSources,
  onOpenPortalExport,
  compact = false,
}: OppstartApplicationWorkbenchProps) {
  const sections = useMemo(
    () => analyzeOppstartApplication(content),
    [content],
  );
  const openFields = useMemo(
    () => listOppstartOpenFields(sections),
    [sections],
  );
  const readyCount = sections.filter((section) => section.ready).length;
  const activeSection =
    sections.find((section) => section.heading === focusedSectionHeading) ??
    findOppstartSectionAtPosition(sections, cursorPosition) ??
    sections.find((section) => section.present) ??
    null;
  const gateStart = content.indexOf("## 0. Kvalifiseringssjekk");
  const gateEnd = gateStart < 0 ? -1 : content.indexOf("\n## 1.", gateStart);
  const gate =
    gateStart < 0
      ? ""
      : content.slice(gateStart, gateEnd < 0 ? content.length : gateEnd);
  const gateItems = gate.match(/- \[[ xX]\]/gu) ?? [];
  const gateChecked = gateItems.filter((item) => /\[[xX]\]/u.test(item)).length;
  const [detailsOpen, setDetailsOpen] = useState(!compact);

  useEffect(() => {
    setDetailsOpen(!compact);
  }, [compact]);

  const navigateToField = (direction: "previous" | "next") => {
    if (!openFields.length) return;
    let index = 0;
    if (direction === "next") {
      index = openFields.findIndex((field) => field.position > cursorPosition);
      if (index < 0) index = 0;
    } else {
      const reverseIndex = [...openFields]
        .reverse()
        .findIndex((field) => field.position < cursorPosition);
      index =
        reverseIndex < 0
          ? openFields.length - 1
          : openFields.length - 1 - reverseIndex;
    }
    const field = openFields[index];
    onNavigate({
      position: field.position,
      length: "[MÅ FYLLES UT]".length,
      sectionHeading: field.sectionHeading,
    });
  };

  return (
    <Box
      data-testid="oppstart-application-workbench"
      component="aside"
      aria-label="Søknadsassistent for Oppstartstilskudd 1"
      sx={{
        mt: compact ? 0 : 2,
        position: { xl: compact ? "static" : "sticky" },
        top: { xl: compact ? "auto" : 12 },
        maxHeight: { xl: compact ? "none" : "calc(100vh - 24px)" },
        overflowY: { xl: compact ? "visible" : "auto" },
        alignSelf: "start",
        p: 1.5,
        borderRadius: 2,
        border: "1px solid rgba(249,115,22,0.34)",
        bgcolor: "rgba(24, 11, 30, 0.97)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        gap={1}
        alignItems="flex-start"
      >
        <Box>
          <Typography sx={{ color: "#f1f5f9", fontWeight: 850, fontSize: 14 }}>
            Søknadsassistent
          </Typography>
          <Typography sx={{ color: "rgba(241,245,249,0.58)", fontSize: 11.2 }}>
            Oppstartstilskudd 1
          </Typography>
        </Box>
        <Chip
          size="small"
          label={String(readyCount) + "/9 klare"}
          sx={{ color: readyCount === sections.length ? "#86efac" : "#fdba74" }}
        />
      </Stack>

      <Box data-testid="oppstart-application-progress" sx={{ mt: 1.3 }}>
        <LinearProgress
          variant="determinate"
          value={(readyCount / sections.length) * 100}
          sx={{
            height: 6,
            borderRadius: 10,
            bgcolor: "rgba(255,255,255,0.08)",
            "& .MuiLinearProgress-bar": {
              bgcolor: readyCount === sections.length ? "#22c55e" : "#f97316",
            },
          }}
        />
        <Stack direction="row" justifyContent="space-between" mt={0.55}>
          <Typography sx={{ color: "rgba(241,245,249,0.62)", fontSize: 10.8 }}>
            {readyCount} av {sections.length} søknadsdeler klare
          </Typography>
          <Typography
            sx={{
              color: openFields.length ? "#fdba74" : "#86efac",
              fontSize: 10.8,
            }}
          >
            {openFields.length} svarfelt gjenstår
          </Typography>
        </Stack>
      </Box>

      <Stack direction="row" gap={0.6} mt={1.15}>
        <Button
          data-testid="application-previous-open"
          fullWidth
          size="small"
          variant="outlined"
          startIcon={<KeyboardArrowUpOutlinedIcon />}
          disabled={!openFields.length}
          onClick={() => navigateToField("previous")}
          sx={{
            borderColor: "rgba(249,115,22,0.28)",
            color: "#fed7aa",
            textTransform: "none",
          }}
        >
          Forrige
        </Button>
        <Button
          data-testid="application-next-open"
          fullWidth
          size="small"
          variant="contained"
          endIcon={<KeyboardArrowDownOutlinedIcon />}
          disabled={!openFields.length}
          onClick={() => navigateToField("next")}
          sx={{ bgcolor: "#c2410c", textTransform: "none" }}
        >
          Neste åpne
        </Button>
      </Stack>

      {activeSection && (
        <Box
          data-testid="application-active-section"
          sx={{
            mt: 1.25,
            p: 1.15,
            borderRadius: 1.5,
            bgcolor: "rgba(249,115,22,0.1)",
            border: "1px solid rgba(249,115,22,0.24)",
          }}
        >
          <Typography
            sx={{
              color: "#fdba74",
              fontSize: 10.5,
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            Aktiv del {sectionNumber(activeSection.heading)}
          </Typography>
          <Typography
            sx={{ color: "#f1f5f9", fontSize: 12.5, fontWeight: 800, mt: 0.25 }}
          >
            {activeSection.label}
          </Typography>
          <Typography
            sx={{
              color: "rgba(241,245,249,0.62)",
              fontSize: 10.8,
              lineHeight: 1.45,
              mt: 0.35,
            }}
          >
            {activeSection.help}
          </Typography>
          <Stack direction="row" justifyContent="space-between" mt={0.75}>
            <Typography sx={{ color: "rgba(241,245,249,0.5)", fontSize: 10.5 }}>
              {activeSection.words} ord ·{" "}
              {activeSection.characters.toLocaleString("nb-NO")} tegn
            </Typography>
            <Typography
              sx={{
                color:
                  activeSection.characters > activeSection.workingCharacterLimit
                    ? "#fca5a5"
                    : "rgba(241,245,249,0.5)",
                fontSize: 10.5,
              }}
            >
              arbeidsmål{" "}
              {activeSection.workingCharacterLimit.toLocaleString("nb-NO")}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.min(
              100,
              (activeSection.characters / activeSection.workingCharacterLimit) *
                100,
            )}
            sx={{
              mt: 0.5,
              height: 4,
              borderRadius: 5,
              bgcolor: "rgba(255,255,255,0.07)",
              "& .MuiLinearProgress-bar": {
                bgcolor:
                  activeSection.characters > activeSection.workingCharacterLimit
                    ? "#ef4444"
                    : "#a78bfa",
              },
            }}
          />
          <Stack direction="row" gap={0.4} mt={0.8}>
            <Button
              data-testid="application-writing-review-open"
              size="small"
              startIcon={<AutoAwesomeOutlinedIcon />}
              onClick={() => onOpenWritingReview(activeSection)}
              sx={{ color: "#c4b5fd", textTransform: "none", minWidth: 0 }}
            >
              Skrivekontroll
            </Button>
            <Button
              data-testid="application-sources-open"
              size="small"
              startIcon={<SourceOutlinedIcon />}
              onClick={() => onOpenSources(activeSection)}
              sx={{ color: "#bae6fd", textTransform: "none", minWidth: 0 }}
            >
              Kilder
            </Button>
          </Stack>
        </Box>
      )}

      <Divider sx={{ my: 1.25, borderColor: "rgba(249,115,22,0.16)" }} />

      <Button
        data-testid="application-details-toggle"
        fullWidth
        size="small"
        onClick={() => setDetailsOpen((current) => !current)}
        sx={{
          mb: detailsOpen ? 0.75 : 0,
          color: "#ddd6fe",
          textTransform: "none",
        }}
      >
        {detailsOpen ? "Skjul søknadsdelene" : "Vis alle søknadsdeler"}
      </Button>
      {detailsOpen && (
        <Stack gap={0.55}>
          {sections.map((section) => {
            const active = section.heading === activeSection?.heading;
            const focused = section.heading === focusedSectionHeading;
            const overTarget =
              section.characters > section.workingCharacterLimit;
            return (
              <Box
                key={section.heading}
                data-testid={
                  "application-section-" + (section.ready ? "ready" : "open")
                }
                sx={{
                  p: 0.85,
                  borderRadius: 1.25,
                  bgcolor: active
                    ? "rgba(124,58,237,0.16)"
                    : "rgba(0,0,0,0.12)",
                  border:
                    "1px solid " +
                    (active ? "rgba(167,139,250,0.3)" : "transparent"),
                }}
              >
                <Stack direction="row" gap={0.7} alignItems="flex-start">
                  {section.ready ? (
                    <CheckCircleOutlinedIcon
                      sx={{ color: "#22c55e", fontSize: 16, mt: 0.15 }}
                    />
                  ) : (
                    <RadioButtonUncheckedOutlinedIcon
                      sx={{ color: "#fb923c", fontSize: 16, mt: 0.15 }}
                    />
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Button
                      data-testid={
                        "application-section-navigate-" +
                        sectionNumber(section.heading)
                      }
                      fullWidth
                      disabled={!section.present}
                      onClick={() =>
                        onNavigate({
                          position: section.bodyStart,
                          sectionHeading: section.heading,
                        })
                      }
                      sx={{
                        justifyContent: "flex-start",
                        color: "#f1f5f9",
                        textTransform: "none",
                        textAlign: "left",
                        p: 0,
                        minWidth: 0,
                        fontSize: 11.5,
                        fontWeight: 750,
                        lineHeight: 1.3,
                      }}
                    >
                      {sectionNumber(section.heading)}. {section.label}
                    </Button>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      gap={0.5}
                      mt={0.25}
                    >
                      <Typography
                        sx={{
                          color: section.remaining
                            ? "#fdba74"
                            : "rgba(241,245,249,0.44)",
                          fontSize: 9.8,
                        }}
                      >
                        {section.present
                          ? section.remaining
                            ? String(section.remaining) + " åpne"
                            : String(section.words) + " ord"
                          : "Mangler"}
                      </Typography>
                      {section.present && (
                        <Typography
                          sx={{
                            color: overTarget
                              ? "#fca5a5"
                              : "rgba(241,245,249,0.4)",
                            fontSize: 9.8,
                          }}
                        >
                          {section.characters.toLocaleString("nb-NO")}/
                          {section.workingCharacterLimit.toLocaleString(
                            "nb-NO",
                          )}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                  {section.present && (
                    <Tooltip
                      title={
                        focused
                          ? "Vis hele dokumentet"
                          : "Skriv bare denne delen"
                      }
                    >
                      <Button
                        data-testid={
                          "application-section-focus-" +
                          sectionNumber(section.heading)
                        }
                        size="small"
                        onClick={() =>
                          onFocusSection(focused ? null : section.heading)
                        }
                        aria-pressed={focused}
                        sx={{
                          minWidth: 28,
                          width: 28,
                          height: 28,
                          p: 0,
                          color: focused ? "#fdba74" : "rgba(241,245,249,0.5)",
                        }}
                      >
                        {focused ? (
                          <ViewAgendaOutlinedIcon sx={{ fontSize: 15 }} />
                        ) : (
                          <MenuBookOutlinedIcon sx={{ fontSize: 15 }} />
                        )}
                      </Button>
                    </Tooltip>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}

      <Stack direction="row" gap={0.6} mt={1.2}>
        <Button
          data-testid="application-portal-export"
          fullWidth
          size="small"
          variant="outlined"
          startIcon={<ContentCopyOutlinedIcon />}
          onClick={onOpenPortalExport}
          sx={{
            borderColor: "rgba(249,115,22,0.28)",
            color: "#fed7aa",
            textTransform: "none",
          }}
        >
          Portaleksport
        </Button>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={<SourceOutlinedIcon />}
          onClick={() => onOpenSources(activeSection)}
          sx={{
            borderColor: "rgba(56,189,248,0.25)",
            color: "#bae6fd",
            textTransform: "none",
          }}
        >
          Kildebank
        </Button>
      </Stack>

      <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1.1 }}>
        <Chip
          size="small"
          label={
            "Kvalifisering " + gateChecked + "/" + String(gateItems.length || 8)
          }
          sx={{
            color:
              gateChecked === gateItems.length && gateItems.length
                ? "#86efac"
                : "#fdba74",
            fontSize: 10,
          }}
        />
        <Chip
          size="small"
          label={String(attachmentCount) + " vedlegg koblet"}
          sx={{
            color: attachmentCount >= 2 ? "#86efac" : "rgba(241,245,249,0.62)",
            fontSize: 10,
          }}
        />
        <Chip
          size="small"
          label={"Frist " + formatDate(dueDate)}
          sx={{ color: "rgba(241,245,249,0.62)", fontSize: 10 }}
        />
      </Stack>

      <Stack direction="row" gap={0.25} mt={0.75} flexWrap="wrap">
        <Button
          component="a"
          href={OFFICIAL_GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          startIcon={<LaunchOutlinedIcon />}
          sx={{ color: "#fb923c", textTransform: "none", fontSize: 10 }}
        >
          Veiledning
        </Button>
        <Button
          component="a"
          href={OFFICIAL_SERVICE_URL}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          startIcon={<LaunchOutlinedIcon />}
          sx={{ color: "#fb923c", textTransform: "none", fontSize: 10 }}
        >
          Ordningen
        </Button>
        <Button
          component="a"
          href={APPLICATION_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          sx={{ color: "#f1f5f9", textTransform: "none", fontSize: 10 }}
        >
          Min side
        </Button>
      </Stack>
      <Typography
        sx={{
          color: "rgba(241,245,249,0.42)",
          fontSize: 9.6,
          mt: 0.6,
          lineHeight: 1.4,
        }}
      >
        Tegnverdiene er interne arbeidsmål. Kontroller portalens gjeldende felt
        før innsending.
      </Typography>
    </Box>
  );
}
