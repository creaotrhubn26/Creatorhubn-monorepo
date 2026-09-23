import releaseNotesData from "../release-notes.json";

export type ReleaseSectionKind = "new" | "improved" | "fixed" | "security";

export interface ReleaseNoteSection {
  kind: ReleaseSectionKind;
  title: string;
  items: string[];
}

export interface ReleaseNote {
  version: string;
  publishedAt: string;
  title: string;
  summary: string;
  critical: boolean;
  sections: ReleaseNoteSection[];
}

export const releaseHistory = releaseNotesData.releases as ReleaseNote[];

export function releaseNoteForVersion(version: string): ReleaseNote | null {
  return releaseHistory.find((release) => release.version === version) ?? null;
}

const SECTION_KIND_BY_TITLE: Record<string, ReleaseSectionKind> = {
  nytt: "new",
  forbedret: "improved",
  rettet: "fixed",
  sikkerhet: "security",
};

function parseMarkdownUpdaterNotes(notes: string, version: string): ReleaseNote | null {
  const lines = notes.split(/\r?\n/).map((line) => line.trim());
  const titleLine = lines.find((line) => line.startsWith("# "));
  if (!titleLine) return null;

  const firstSectionIndex = lines.findIndex((line) => line.startsWith("## "));
  const summary = lines
    .slice(lines.indexOf(titleLine) + 1, firstSectionIndex < 0 ? undefined : firstSectionIndex)
    .filter((line) => line && !line.startsWith(">"))
    .join(" ");
  const sections: ReleaseNoteSection[] = [];
  let current: ReleaseNoteSection | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      current = {
        kind: SECTION_KIND_BY_TITLE[title.toLocaleLowerCase("nb-NO")] ?? "improved",
        title,
        items: [],
      };
      sections.push(current);
    } else if (current && line.startsWith("- ")) {
      current.items.push(line.slice(2).trim());
    }
  }

  if (!summary || sections.length === 0 || sections.some((section) => section.items.length === 0)) {
    return null;
  }

  return {
    version,
    publishedAt: releaseNoteForVersion(version)?.publishedAt ?? "",
    title: titleLine.slice(2).trim(),
    summary,
    critical: lines.some((line) => line.toLocaleLowerCase("nb-NO").includes("kritisk oppdatering")),
    sections,
  };
}

export function parseUpdaterNotes(notes: string | null, version: string): ReleaseNote {
  if (notes) {
    try {
      const parsed = JSON.parse(notes) as Partial<ReleaseNote>;
      if (
        parsed.version === version &&
        typeof parsed.title === "string" &&
        typeof parsed.summary === "string" &&
        Array.isArray(parsed.sections)
      ) {
        return parsed as ReleaseNote;
      }
    } catch {
      const parsedMarkdown = parseMarkdownUpdaterNotes(notes, version);
      if (parsedMarkdown) return parsedMarkdown;
    }
  }

  return (
    releaseNoteForVersion(version) ?? {
      version,
      publishedAt: "",
      title: `CreatorHub One Desk ${version}`,
      summary: notes?.trim() || "En ny versjon av CreatorHub One Desk er tilgjengelig.",
      critical: false,
      sections: [],
    }
  );
}

export function formatReleaseDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
