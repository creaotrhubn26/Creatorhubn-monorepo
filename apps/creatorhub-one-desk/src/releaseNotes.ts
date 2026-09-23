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
      // Eldre manifester inneholder fritekst. Vis dem i et kompatibelt format.
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
