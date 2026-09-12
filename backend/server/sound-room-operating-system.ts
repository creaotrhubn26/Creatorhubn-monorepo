import Anthropic from "@anthropic-ai/sdk";

export type SoundRoomPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
  connect?: () => Promise<SoundRoomPool & { release?: () => void }>;
  release?: () => void;
};

export type RevisionComment = {
  id: string;
  body: string;
  category?: string | null;
  status?: string | null;
  author?: string | null;
  timecode_seconds?: number | null;
  version_label?: string | null;
};

export type RevisionPriority = {
  title: string;
  detail: string;
  category: string;
  commentIds: string[];
  timecodes: number[];
};

export type RevisionBriefDraft = {
  title: string;
  summary: string;
  priorities: RevisionPriority[];
  conflicts: string[];
  resolvedCount: number;
  unresolvedCount: number;
  generationMode: "ai" | "deterministic";
};

const CATEGORY_LABELS: Record<string, string> = {
  balance: "Balanse og nivå",
  tone: "Klang og tone",
  timing: "Timing",
  arrangement: "Arrangement",
  vocal: "Vokal",
  lyrics: "Tekst",
  general: "Generelt",
};

const text = (value: unknown, max = 4000): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function secondsLabel(value: number | null | undefined): string {
  const seconds = Math.max(0, Number(value) || 0);
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function buildDeterministicRevisionBrief(
  projectTitle: string,
  comments: RevisionComment[],
): RevisionBriefDraft {
  const resolved = comments.filter((comment) => comment.status === "resolved");
  const unresolved = comments.filter((comment) => comment.status !== "resolved" && comment.status !== "rejected");
  const grouped = new Map<string, RevisionComment[]>();
  for (const comment of unresolved) {
    const category = text(comment.category, 40).toLowerCase() || "general";
    grouped.set(category, [...(grouped.get(category) || []), comment]);
  }

  const priorities: RevisionPriority[] = [...grouped.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8)
    .map(([category, items]) => ({
      title: CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1),
      detail: items
        .slice(0, 4)
        .map((item) => `${secondsLabel(item.timecode_seconds)} ${text(item.body, 260)}`)
        .join(" · "),
      category,
      commentIds: items.map((item) => String(item.id)),
      timecodes: items.map((item) => Math.max(0, Number(item.timecode_seconds) || 0)),
    }));

  const authorsByCategory = new Map<string, Set<string>>();
  for (const comment of unresolved) {
    const category = text(comment.category, 40).toLowerCase() || "general";
    const author = text(comment.author, 100);
    if (!author) continue;
    if (!authorsByCategory.has(category)) authorsByCategory.set(category, new Set());
    authorsByCategory.get(category)!.add(author);
  }
  const conflicts = [...authorsByCategory.entries()]
    .filter(([, authors]) => authors.size > 1)
    .map(([category, authors]) =>
      `${CATEGORY_LABELS[category] || category}: innspill fra ${[...authors].join(", ")} må avklares samlet.`,
    );

  const summary = unresolved.length
    ? `${unresolved.length} åpne innspill er samlet i ${priorities.length} prioriterte arbeidsområder. ${resolved.length} innspill er allerede løst.`
    : `Alle ${resolved.length} registrerte innspill er løst. Prosjektet er klart for en ny lytting eller godkjenning.`;

  return {
    title: `Revisjonsbrief – ${text(projectTitle, 160) || "Sound Room"}`,
    summary,
    priorities,
    conflicts,
    resolvedCount: resolved.length,
    unresolvedCount: unresolved.length,
    generationMode: "deterministic",
  };
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function buildRevisionBrief(
  projectTitle: string,
  comments: RevisionComment[],
  useAi = true,
): Promise<RevisionBriefDraft> {
  const fallback = buildDeterministicRevisionBrief(projectTitle, comments);
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!useAi || !apiKey || comments.length === 0) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const source = comments.slice(0, 120).map((comment) => ({
      id: comment.id,
      status: comment.status || "unresolved",
      category: comment.category || "general",
      author: comment.author || "Ukjent",
      timecode: secondsLabel(comment.timecode_seconds),
      body: text(comment.body, 600),
    }));
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1800,
      temperature: 0.1,
      system: "Du er en erfaren norsk mix- og masteringprodusent. Returner kun gyldig JSON. Ikke finn på problemer som ikke finnes i kildedataene.",
      messages: [{
        role: "user",
        content: `Lag en kort, handlingsrettet revisjonsbrief for ${JSON.stringify(projectTitle)}. Behold commentIds eksakt. Returner {"title":string,"summary":string,"priorities":[{"title":string,"detail":string,"category":string,"commentIds":string[]}],"conflicts":string[]}. Kommentarer: ${JSON.stringify(source)}`,
      }],
    });
    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const parsed = parseJsonObject(responseText);
    if (!parsed) return fallback;
    const priorities = Array.isArray(parsed.priorities)
      ? parsed.priorities.slice(0, 8).map((item: any) => {
          const ids = Array.isArray(item?.commentIds)
            ? item.commentIds.map((id: unknown) => text(id, 80)).filter(Boolean)
            : [];
          const sourceItems = comments.filter((comment) => ids.includes(String(comment.id)));
          return {
            title: text(item?.title, 160) || "Prioritet",
            detail: text(item?.detail, 1200),
            category: text(item?.category, 40) || "general",
            commentIds: sourceItems.map((comment) => String(comment.id)),
            timecodes: sourceItems.map((comment) => Math.max(0, Number(comment.timecode_seconds) || 0)),
          };
        }).filter((item: RevisionPriority) => item.commentIds.length > 0)
      : [];
    return {
      ...fallback,
      title: text(parsed.title, 200) || fallback.title,
      summary: text(parsed.summary, 2000) || fallback.summary,
      priorities: priorities.length ? priorities : fallback.priorities,
      conflicts: Array.isArray(parsed.conflicts)
        ? parsed.conflicts.slice(0, 8).map((item) => text(item, 600)).filter(Boolean)
        : fallback.conflicts,
      generationMode: "ai",
    };
  } catch {
    return fallback;
  }
}

export async function recordSoundRoomActivity(
  pool: SoundRoomPool,
  input: {
    projectId: string;
    eventType: string;
    summary: string;
    actorId?: string | null;
    actorName?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO audio_review_activity
       (project_id, actor_id, actor_name, event_type, summary, metadata)
     VALUES ($1::uuid,$2,$3,$4,$5,$6::jsonb)`,
    [
      input.projectId,
      input.actorId || null,
      input.actorName || null,
      input.eventType,
      text(input.summary, 500),
      JSON.stringify(input.metadata || {}),
    ],
  ).catch(() => undefined);
}

export function anonymousCandidateLabel(index: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return index < alphabet.length ? `Versjon ${alphabet[index]}` : `Versjon ${index + 1}`;
}
