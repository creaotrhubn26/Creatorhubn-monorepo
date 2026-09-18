/**
 * Story Graph Fase 8d — KI-manusvakt («script-guardian-agent»).
 *
 * To pass, i denne rekkefølgen:
 *   1. Deterministisk (uten modell): strukturelle regler over scener, replikker, episoder,
 *      kilder, gater og karakterer — epoke-brudd, ukjent taler, replikk uten kilde, scene uten
 *      episode, «bestått» bilde/lyd uten bevis-referanse, gamle åpne spørsmål, ufullstendige
 *      kunnskapsfelt. Konfidens 0.95, kjører alltid.
 *   2. LLM (claude-opus-5, effort medium, cache_control på systemprompten): bare scener som er
 *      endret siden forrige kjøring (kostnadskontroll), maks 20. Finner kontinuitet,
 *      kunnskapslekkasje (karakter sier noe den ikke kan vite), tidslinje, stemme og kildeavvik.
 *      Mangler ANTHROPIC_API_KEY → kun deterministisk pass, med advarsel.
 *
 * Funn er `story.guardian-issue`-forslag (eget type: film-agentens `story.continuity-issue`
 * har en no-op-applier). Godta et funn = det opprettes et åpent spørsmål til neste
 * manusgjennomgang (aldri automatisk endring av manus).
 */
import type { Pool } from "pg";
import { logAIUsage } from "./ai-usage-tracker.js";
import type { AIAgent, AIAgentInput, AIAgentOutput, AISuggestion, ApplyContext, SuggestionApplier } from "./ai-suggestion-service.js";
import * as narrative from "./role-room-narrative-service.js";

export const SCRIPT_GUARDIAN_AGENT_NAME = "script-guardian-agent";
export const SUGGESTION_TYPE_GUARDIAN_ISSUE = "story.guardian-issue";
const MODEL_VERSION = "claude-opus-5";
const MAX_TOKENS = 4096;
const MIN_CONFIDENCE = 0.5;
const MAX_LLM_SCENES = 20;
const STALE_QUESTION_DAYS = 30;

export type GuardianIssueType =
  | "era_mismatch" | "speaker_unknown" | "line_without_source" | "scene_without_episode"
  | "gate_without_evidence_ref" | "open_question_stale" | "knowledge_incomplete"
  | "continuity" | "knowledge_leak" | "timeline" | "voice" | "source";
export type GuardianSeverity = "low" | "medium" | "high";

export interface GuardianIssuePayload {
  issueType: GuardianIssueType;
  severity: GuardianSeverity;
  title: string;
  description: string;
  sceneIds: string[];
  sceneCodes: string[];
  evidence: Array<{ ref: string; quote: string }>;
  suggestedQuestion: string;
  /** 'rule' = deterministisk, 'llm' = modell. */
  origin: "rule" | "llm";
}

type Row = Record<string, unknown>;
type Queryable = narrative.Queryable;

interface SceneRec {
  id: string; code: string; workingId: string | null; title: string; era: string; episodeId: string | null;
  knowledge: Record<string, string>; sourceRefs: Array<{ tag?: string; ref?: string }>; updatedAt: string;
  beforeState: string; action: string; afterState: string; subtitle: string;
}
interface LineRec { id: string; sceneId: string; cueId: string; speakerComponentId: string | null; speakerLabel: string; sourceType: string; textEn: string }
interface CharacterRec { id: string; name: string; profile: Record<string, unknown> }
interface EpisodeRec { id: string; code: string; title: string; playersLearn: string }
interface QuestionRec { id: string; code: string; status: string; createdAt: string; question: string }
interface GateRec { sceneId: string; gateKey: string; status: string; evidenceRefs: string[] }

export interface GuardianSnapshot {
  scenes: SceneRec[]; lines: LineRec[]; characters: CharacterRec[]; episodes: EpisodeRec[]; questions: QuestionRec[]; gates: GateRec[];
}

const str = (v: unknown) => (v == null ? "" : String(v));
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : new Date(0).toISOString());
function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return fallback; } }
  return v as T;
}

export async function loadGuardianSnapshot(db: Queryable, projectId: string): Promise<GuardianSnapshot> {
  const [scenes, lines, chars, episodes, questions, gates] = await Promise.all([
    db.query(`SELECT id, code, working_id, title, subtitle, era, episode_id, knowledge, source_refs, updated_at, before_state, action, after_state FROM narrative_scenes WHERE project_id = $1 ORDER BY sort_order, code`, [projectId]),
    db.query(`SELECT id, scene_id, cue_id, speaker_component_id, speaker_label, source_type, text_en FROM narrative_scene_lines WHERE project_id = $1 ORDER BY scene_id, sort_order`, [projectId]),
    db.query(`SELECT id, name, profile FROM narrative_components WHERE project_id = $1 AND kind = 'character'`, [projectId]),
    db.query(`SELECT id, code, title, players_learn FROM narrative_episodes WHERE project_id = $1`, [projectId]),
    db.query(`SELECT id, code, status, created_at, question FROM narrative_open_questions WHERE project_id = $1`, [projectId]),
    db.query(`SELECT scene_id, gate_key, status, evidence_refs FROM narrative_scene_gates WHERE project_id = $1`, [projectId]),
  ]);
  return {
    scenes: (scenes.rows as Row[]).map((r) => ({
      id: str(r.id), code: str(r.code), workingId: r.working_id == null ? null : str(r.working_id), title: str(r.title), subtitle: str(r.subtitle),
      era: str(r.era || "other"), episodeId: r.episode_id == null ? null : str(r.episode_id),
      knowledge: parseJson<Record<string, string>>(r.knowledge, {}), sourceRefs: parseJson<Array<{ tag?: string; ref?: string }>>(r.source_refs, []),
      updatedAt: iso(r.updated_at), beforeState: str(r.before_state), action: str(r.action), afterState: str(r.after_state),
    })),
    lines: (lines.rows as Row[]).map((r) => ({ id: str(r.id), sceneId: str(r.scene_id), cueId: str(r.cue_id), speakerComponentId: r.speaker_component_id == null ? null : str(r.speaker_component_id), speakerLabel: str(r.speaker_label), sourceType: str(r.source_type), textEn: str(r.text_en) })),
    characters: (chars.rows as Row[]).map((r) => ({ id: str(r.id), name: str(r.name), profile: parseJson<Record<string, unknown>>(r.profile, {}) })),
    episodes: (episodes.rows as Row[]).map((r) => ({ id: str(r.id), code: str(r.code), title: str(r.title), playersLearn: str(r.players_learn) })),
    questions: (questions.rows as Row[]).map((r) => ({ id: str(r.id), code: str(r.code), status: str(r.status), createdAt: iso(r.created_at), question: str(r.question) })),
    gates: (gates.rows as Row[]).map((r) => ({ sceneId: str(r.scene_id), gateKey: str(r.gate_key), status: str(r.status), evidenceRefs: parseJson<string[]>(r.evidence_refs, []) })),
  };
}

// ─── Deterministisk pass ─────────────────────────────────────────────

/** Epoke fra undertittel/tittel-tekst («W06 · 1817, tjue år senere» → 1817). */
function eraFromText(s: string): string | null {
  const m = /\b(1797|1802|1817)\b/.exec(s);
  return m ? m[1] : null;
}

export function runGuardianRules(snap: GuardianSnapshot, now = new Date()): GuardianIssuePayload[] {
  const issues: GuardianIssuePayload[] = [];
  const charById = new Map(snap.characters.map((c) => [c.id, c]));
  const charByName = new Map(snap.characters.map((c) => [c.name.trim().toLowerCase(), c]));
  const linesByScene = new Map<string, LineRec[]>();
  for (const l of snap.lines) linesByScene.set(l.sceneId, [...(linesByScene.get(l.sceneId) ?? []), l]);
  const push = (p: Omit<GuardianIssuePayload, "origin">) => issues.push({ ...p, origin: "rule" });
  const label = (sc: SceneRec) => `${sc.code}${sc.title ? ` — ${sc.title}` : ""}`;

  for (const sc of snap.scenes) {
    // 1) Epoke i undertittelen motsier scenens epoke-felt.
    const textEra = eraFromText(sc.subtitle) ?? eraFromText(sc.title);
    if (textEra && sc.era !== "other" && sc.era !== textEra) {
      push({ issueType: "era_mismatch", severity: "high", title: `Epoke-brudd i ${sc.code}`, description: `Scenen er merket epoke ${sc.era}, men undertittelen sier ${textEra}.`, sceneIds: [sc.id], sceneCodes: [sc.code], evidence: [{ ref: sc.code, quote: sc.subtitle || sc.title }], suggestedQuestion: `${sc.code}: er epoken ${sc.era} eller ${textEra}? Rett feltet eller undertittelen.` });
    }
    // 2) Scene uten episode (bare når prosjektet har episoder).
    if (snap.episodes.length > 0 && !sc.episodeId) {
      push({ issueType: "scene_without_episode", severity: "low", title: `${sc.code} mangler episode`, description: `Scenen er ikke knyttet til noen episode (E01–E${String(snap.episodes.length).padStart(2, "0")}).`, sceneIds: [sc.id], sceneCodes: [sc.code], evidence: [], suggestedQuestion: `Hvilken episode hører ${sc.code} (${sc.title}) til?` });
    }
    const lines = linesByScene.get(sc.id) ?? [];
    for (const l of lines) {
      // 3) Taler uten karakter i arkivet (verken id eller navn matcher).
      const byId = l.speakerComponentId ? charById.get(l.speakerComponentId) : undefined;
      const base = l.speakerLabel.split(",")[0].trim().toLowerCase();
      const byName = base ? charByName.get(base) : undefined;
      if (!byId && !byName && l.speakerLabel.trim() && !/^(minnet av|stemme|forteller|ukjent)/i.test(l.speakerLabel.trim())) {
        push({ issueType: "speaker_unknown", severity: "medium", title: `Ukjent taler «${l.speakerLabel}» i ${sc.code}`, description: `Replikk ${l.cueId} har taler «${l.speakerLabel}» som ikke finnes som karakter i komponentarkivet.`, sceneIds: [sc.id], sceneCodes: [sc.code], evidence: [{ ref: l.cueId, quote: l.textEn }], suggestedQuestion: `Hvem er «${l.speakerLabel}» (${l.cueId})? Opprett karakteren eller rett taleren.` });
      }
    }
    // 4) Replikker uten kildetype i en scene som har kildemerker (dokumentet er kjent, replikken ikke sporet).
    if (sc.sourceRefs.length > 0) {
      const untyped = lines.filter((l) => !l.sourceType);
      if (untyped.length) push({ issueType: "line_without_source", severity: "low", title: `${untyped.length} replikk(er) uten kildetype i ${sc.code}`, description: `Scenen har kildemerker, men replikkene ${untyped.map((l) => l.cueId).join(", ")} mangler type (E/T/E+T/U/A).`, sceneIds: [sc.id], sceneCodes: [sc.code], evidence: untyped.slice(0, 3).map((l) => ({ ref: l.cueId, quote: l.textEn })), suggestedQuestion: `Er ${untyped.map((l) => l.cueId).join(", ")} bevart engelsk (E), ny oversettelse (T) eller brukertillegg (U)?` });
    }
    // 5) Kunnskapsfelt: «sagt høyt» fylt, men hva de andre kan observere er tomt → lekkasje kan ikke vurderes.
    const k = sc.knowledge;
    if (k.saidAloud?.trim() && !k.othersObserve?.trim()) {
      push({ issueType: "knowledge_incomplete", severity: "low", title: `Kunnskapsfelt ufullstendig i ${sc.code}`, description: "«Sagt høyt» er fylt, men «hva de andre observerer» er tomt — kunnskapslekkasje kan ikke vurderes.", sceneIds: [sc.id], sceneCodes: [sc.code], evidence: [{ ref: `${sc.code}/knowledge.saidAloud`, quote: k.saidAloud.slice(0, 200) }], suggestedQuestion: `${sc.code}: hva kan de andre faktisk observere når dette sies høyt?` });
    }
  }
  // 6) Bilde/lyd «bestått» uten en eneste bevis-referanse (fil, xcresult, asset, run).
  for (const g of snap.gates) {
    if (g.status === "passed" && (g.gateKey === "picture" || g.gateKey === "audio") && g.evidenceRefs.length === 0) {
      const sc = snap.scenes.find((s) => s.id === g.sceneId);
      if (sc) push({ issueType: "gate_without_evidence_ref", severity: "medium", title: `${sc.code}: ${g.gateKey === "picture" ? "bilde" : "lyd"} bestått uten bevis-referanse`, description: "Gaten er satt «bestått» med tekst, men uten referanse til fil, xcresult, asset eller CI-kjøring.", sceneIds: [sc.id], sceneCodes: [sc.code], evidence: [{ ref: `${sc.code}/${g.gateKey}`, quote: "evidence_refs = []" }], suggestedQuestion: `${sc.code}: hvor ligger beviset for ${g.gateKey === "picture" ? "bildegodkjenning" : "lydgodkjenning"}? Legg til referanse eller sett gaten tilbake.` });
    }
  }
  // 7) Åpne spørsmål eldre enn 30 dager.
  const staleBefore = now.getTime() - STALE_QUESTION_DAYS * 86_400_000;
  const stale = snap.questions.filter((q) => q.status === "open" && new Date(q.createdAt).getTime() < staleBefore);
  if (stale.length) {
    push({ issueType: "open_question_stale", severity: "low", title: `${stale.length} åpne spørsmål eldre enn ${STALE_QUESTION_DAYS} dager`, description: `Uavklarte: ${stale.slice(0, 6).map((q) => q.code).join(", ")}${stale.length > 6 ? " …" : ""}.`, sceneIds: [], sceneCodes: [], evidence: stale.slice(0, 3).map((q) => ({ ref: q.code, quote: q.question.slice(0, 160) })), suggestedQuestion: `Ta ${stale.slice(0, 3).map((q) => q.code).join(", ")} på neste manusgjennomgang — avgjør eller dropp.` });
  }
  return issues;
}

// ─── LLM-pass ────────────────────────────────────────────────────────

const TOOL_SCHEMA = {
  name: "report_issues",
  description: "Rapporter manusvakt-funn for de gitte scenene. Tomt array når alt henger sammen.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            issueType: { type: "string", enum: ["continuity", "knowledge_leak", "timeline", "voice", "source"] },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            title: { type: "string" },
            description: { type: "string" },
            sceneCodes: { type: "array", items: { type: "string" } },
            evidence: { type: "array", items: { type: "object", properties: { ref: { type: "string" }, quote: { type: "string" } }, required: ["ref", "quote"], additionalProperties: false } },
            suggestedQuestion: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["issueType", "severity", "title", "description", "sceneCodes", "evidence", "suggestedQuestion", "confidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["issues"],
    additionalProperties: false,
  },
} as const;

interface ToolIssue { issueType: string; severity: string; title: string; description: string; sceneCodes: string[]; evidence: Array<{ ref: string; quote: string }>; suggestedQuestion: string; confidence: number }

function buildSystemPrompt(): string {
  return [
    "Du er manusvakt for et narrativt spill (Story Graph). Du leser scenekort med felt",
    "Før / Handling / Etter, replikker med cue-ID og taler, karakterenes forfatterfasit",
    "(intern sannhet) og hva spillerne kan observere, og episodens «hva spillerne lærer».",
    "Du fyller ut verktøyet report_issues — aldri prosa.",
    "",
    "Flagg BARE reelle avvik med sitat som bevis:",
    "  - continuity: fakta/objekter/tilstander som motsier hverandre mellom scener",
    "  - knowledge_leak: en karakter sier eller gjør noe den ikke kan vite ut fra det",
    "    spillerne og karakteren har observert (bruk forfatterfasit vs. observerbart)",
    "  - timeline: årstall/epoke/rekkefølge som ikke henger sammen (1797 / 1802 / 1817)",
    "  - voice: en replikk som bryter tydelig med karakterens alder/stemme i epoken",
    "  - source: replikk merket E (bevart engelsk) som åpenbart er omskrevet, eller",
    "    scenetekst som motsier sitt eget kildemerke",
    "",
    "Ikke flagg stil, smak eller ting som bevisst holdes skjult for spillerne.",
    "Konfidens 0–1; under 0.5 forkastes. Skriv norsk. suggestedQuestion er ett konkret",
    "spørsmål til neste manusgjennomgang.",
  ].join("\n");
}

function buildUserPrompt(snap: GuardianSnapshot, scenes: SceneRec[]): string {
  const epById = new Map(snap.episodes.map((e) => [e.id, e]));
  const charById = new Map(snap.characters.map((c) => [c.id, c]));
  const linesByScene = new Map<string, LineRec[]>();
  for (const l of snap.lines) linesByScene.set(l.sceneId, [...(linesByScene.get(l.sceneId) ?? []), l]);
  const parts: string[] = [];
  const usedChars = new Set<string>();
  for (const sc of scenes) {
    const ep = sc.episodeId ? epById.get(sc.episodeId) : undefined;
    parts.push(`## Scene ${sc.code}${sc.workingId && sc.workingId !== sc.code ? ` (${sc.workingId})` : ""} — ${sc.title} · epoke ${sc.era}${ep ? ` · ${ep.code} «${ep.title}»` : ""}`);
    if (ep?.playersLearn) parts.push(`Spillerne lærer i episoden: ${ep.playersLearn}`);
    if (sc.beforeState) parts.push(`Før: ${sc.beforeState}`);
    if (sc.action) parts.push(`Handling: ${sc.action}`);
    if (sc.afterState) parts.push(`Etter: ${sc.afterState}`);
    const k = sc.knowledge;
    const kn = ["actualPast", "recollection", "ownerPerspective", "othersObserve", "audienceKnows", "saidAloud"].filter((key) => k[key]?.trim()).map((key) => `  ${key}: ${k[key]}`);
    if (kn.length) parts.push(`Kunnskap:\n${kn.join("\n")}`);
    const lines = linesByScene.get(sc.id) ?? [];
    if (lines.length) parts.push(`Replikker:\n${lines.map((l) => { if (l.speakerComponentId) usedChars.add(l.speakerComponentId); return `  ${l.cueId} ${l.speakerLabel} [${l.sourceType || "?"}]: ${l.textEn}`; }).join("\n")}`);
    parts.push("");
  }
  const chars = [...usedChars].map((id) => charById.get(id)).filter((c): c is CharacterRec => !!c);
  if (chars.length) {
    parts.push("## Karakterer (forfatterfasit er INTERN — spillerne kjenner bare det observerbare)");
    for (const c of chars) {
      const p = c.profile;
      const bits = [
        typeof p.authorTruth === "string" && p.authorTruth ? `forfatterfasit: ${p.authorTruth}` : "",
        typeof p.observable === "string" && p.observable ? `observerbart: ${p.observable}` : "",
        typeof p.drive === "string" && p.drive ? `drivkraft: ${p.drive}` : "",
        p.ages && typeof p.ages === "object" ? `aldre: ${JSON.stringify(p.ages)}` : "",
      ].filter(Boolean);
      parts.push(`- ${c.name}: ${bits.join(" · ") || "(ingen profil)"}`);
    }
  }
  return parts.join("\n").slice(0, 60_000);
}

function clampConfidence(v: unknown): number { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; }

export async function runGuardianLlm(snap: GuardianSnapshot, scenes: SceneRec[]): Promise<Array<GuardianIssuePayload & { confidence: number }>> {
  if (scenes.length === 0) return [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.warn("[script-guardian-agent] ANTHROPIC_API_KEY mangler — kun deterministisk pass"); return []; }
  let issues: ToolIssue[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("@anthropic-ai/sdk");
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = new AnthropicCtor({ apiKey, maxRetries: 3, timeout: 120_000 });
    const response = await client.messages.create({
      model: MODEL_VERSION,
      max_tokens: MAX_TOKENS,
      output_config: { effort: "medium" },
      system: [{ type: "text", text: buildSystemPrompt(), cache_control: { type: "ephemeral" } }],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: buildUserPrompt(snap, scenes) }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logAIUsage(response as any, { feature: "role-room/script-guardian" }).catch(() => undefined);
    if (response.stop_reason === "max_tokens") console.warn("[script-guardian-agent] response truncated at max_tokens");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolBlock = (response.content ?? []).find((b: any) => b?.type === "tool_use" && b?.name === TOOL_SCHEMA.name);
    issues = Array.isArray(toolBlock?.input?.issues) ? (toolBlock.input.issues as ToolIssue[]) : [];
  } catch (err) {
    console.error("[script-guardian-agent] Claude-kall feilet:", err);
    return [];
  }
  const byCode = new Map(scenes.map((s) => [s.code.toUpperCase(), s]));
  for (const s of scenes) if (s.workingId) byCode.set(s.workingId.toUpperCase(), s);
  const out: Array<GuardianIssuePayload & { confidence: number }> = [];
  const types = new Set<GuardianIssueType>(["continuity", "knowledge_leak", "timeline", "voice", "source"]);
  for (const it of issues) {
    const confidence = clampConfidence(it?.confidence);
    if (confidence < MIN_CONFIDENCE || !it?.title || !it?.description) continue;
    const matched = (Array.isArray(it.sceneCodes) ? it.sceneCodes : []).map((c) => byCode.get(String(c).toUpperCase())).filter((s): s is SceneRec => !!s);
    if (matched.length === 0) continue;
    out.push({
      issueType: types.has(it.issueType as GuardianIssueType) ? (it.issueType as GuardianIssueType) : "continuity",
      severity: it.severity === "high" || it.severity === "medium" ? it.severity : "low",
      title: String(it.title).slice(0, 200), description: String(it.description).slice(0, 2000),
      sceneIds: matched.map((s) => s.id), sceneCodes: matched.map((s) => s.code),
      evidence: (Array.isArray(it.evidence) ? it.evidence : []).slice(0, 5).map((e) => ({ ref: String(e?.ref ?? "").slice(0, 80), quote: String(e?.quote ?? "").slice(0, 300) })),
      suggestedQuestion: String(it.suggestedQuestion || it.title).slice(0, 500),
      origin: "llm", confidence,
    });
  }
  return out;
}

// ─── Agent + applier ─────────────────────────────────────────────────

export interface GuardianRunPayload { mode?: "deterministic" | "full"; changedSince?: string | null }

export function createScriptGuardianAgent(pool: Pool): AIAgent {
  return {
    name: SCRIPT_GUARDIAN_AGENT_NAME,
    modelVersion: MODEL_VERSION,
    async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
      const payload = (input.payload ?? {}) as GuardianRunPayload;
      const snap = await loadGuardianSnapshot(pool, input.projectId);
      const outputs: AIAgentOutput[] = runGuardianRules(snap).map((p) => ({
        suggestionType: SUGGESTION_TYPE_GUARDIAN_ISSUE, payload: p, confidence: 0.95, sourceType: "project", sourceId: input.projectId,
      }));
      if (payload.mode !== "deterministic") {
        // Kostnadskontroll: bare scener endret siden forrige kjøring (eller eksplisitt changedSince).
        let since: string | null = payload.changedSince ?? null;
        if (!since) {
          const { rows } = await pool.query(
            `SELECT MAX(created_at) AS last FROM casting_ai_suggestions WHERE project_id = $1 AND agent_name = $2`,
            [input.projectId, SCRIPT_GUARDIAN_AGENT_NAME],
          );
          since = (rows[0] as Row | undefined)?.last ? iso((rows[0] as Row).last) : null;
        }
        const changed = snap.scenes.filter((s) => !since || s.updatedAt > since).slice(0, MAX_LLM_SCENES);
        for (const p of await runGuardianLlm(snap, changed)) {
          const { confidence, ...rest } = p;
          outputs.push({ suggestionType: SUGGESTION_TYPE_GUARDIAN_ISSUE, payload: rest, confidence, sourceType: "project", sourceId: input.projectId });
        }
      }
      return outputs;
    },
  };
}

/** Godta = åpent spørsmål til neste manusgjennomgang. Manus endres aldri automatisk. */
export const scriptGuardianIssueApplier: SuggestionApplier<GuardianIssuePayload> = {
  suggestionType: SUGGESTION_TYPE_GUARDIAN_ISSUE,
  async apply(suggestion: AISuggestion<GuardianIssuePayload>, ctx: ApplyContext): Promise<Record<string, unknown>> {
    const p = suggestion.payload;
    const code = `AI-${suggestion.id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}`;
    const q = await narrative.createOpenQuestion(ctx.client, ctx.projectId, ctx.userId, {
      code, kind: "question", question: p.suggestedQuestion || p.title,
      context: `${p.description}${p.evidence.length ? `\n\nBevis: ${p.evidence.map((e) => `${e.ref}: «${e.quote}»`).join("; ")}` : ""}\n\n(Manusvakt, ${p.origin === "rule" ? "regel" : "modell"}: ${p.issueType}, ${p.severity})`,
      sourceRefs: [{ tag: "A", ref: "script-guardian", note: p.sceneCodes.join(", ") || "prosjekt" }],
    });
    return { openQuestionId: q.id, code: q.code, sceneIds: p.sceneIds, issueType: p.issueType };
  },
};
