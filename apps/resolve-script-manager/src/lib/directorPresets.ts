/**
 * directorPresets — localStorage-baserte mål-presets for Multi-Agent
 * Creative Director. Lar brukeren lagre vellykkede goal-strenger som
 * gjenbrukbare flows ("Cinematic Wedding Touch-up", "Sosial-pakke 4
 * aspect"). Ett klikk gjentar oppskrift.
 *
 * Schema er enkelt — vi lagrer kun selve goal-strengen + navn + epoch.
 * Result-historikk lagres ikke (variere uansett per kjøring).
 */

const STORAGE_KEY = "trrpa.director.presets";
const SCHEMA_VERSION = 1;

export interface DirectorPreset {
  id: string;
  name: string;
  goal: string;
  createdAt: number;
  /** Antall ganger preset er kjørt — counter oppdateres via touchPreset(). */
  runCount: number;
}

interface StoredPresets {
  schema_version: number;
  items: DirectorPreset[];
}

function load(): StoredPresets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { schema_version: SCHEMA_VERSION, items: [] };
    const parsed = JSON.parse(raw) as StoredPresets;
    if (parsed.schema_version !== SCHEMA_VERSION) {
      return { schema_version: SCHEMA_VERSION, items: [] };
    }
    return parsed;
  } catch {
    return { schema_version: SCHEMA_VERSION, items: [] };
  }
}

function save(data: StoredPresets): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Stille feil — localStorage kan være disabled. Presets er en QoL-feature.
  }
}

export function listPresets(): DirectorPreset[] {
  const data = load();
  // Sorter etter sist-brukt-først, deretter alfabetisk
  return [...data.items].sort((a, b) => {
    if (b.runCount !== a.runCount) return b.runCount - a.runCount;
    return a.name.localeCompare(b.name, "nb");
  });
}

export function savePreset(input: { name: string; goal: string }): DirectorPreset {
  const data = load();
  const name = input.name.trim();
  const goal = input.goal.trim();
  if (!name) throw new Error("Preset må ha navn");
  if (!goal) throw new Error("Preset må ha goal");

  const id = `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const preset: DirectorPreset = {
    id,
    name,
    goal,
    createdAt: Date.now(),
    runCount: 0,
  };
  data.items.push(preset);
  save(data);
  return preset;
}

export function deletePreset(id: string): void {
  const data = load();
  data.items = data.items.filter((p) => p.id !== id);
  save(data);
}

export function touchPreset(id: string): void {
  const data = load();
  const p = data.items.find((x) => x.id === id);
  if (p) {
    p.runCount += 1;
    save(data);
  }
}

/** Builtin-presets som vises hvis brukeren ikke har lagret noen. */
export const BUILTIN_PRESETS: Array<{ name: string; goal: string }> = [
  {
    name: "Cinematic look på timeline",
    goal: "Kjør Cinematic-look (Curves S-kurve + Hue saturation +5 + Color Balance warm shadows) på timeline og lagre som PowerGrade-album 'Cinematic'.",
  },
  {
    name: "Sosial-pakke 4 aspect",
    goal: "Eksporter aktiv PSD til 4 aspect-ratios (1:1, 9:16, 16:9, 4:5) med target_long_edge=1080 til ~/Desktop/sosial-pakke/.",
  },
  {
    name: "Touch-up timeline-still",
    goal: "Åpne nyeste still fra Resolve, vis meg hva som er i bildet (see_canvas), fjern eventuelle distraherende elementer med gen.fill, og send tilbake til Resolve.",
  },
  {
    name: "Batch-render fra template",
    goal: "Scan template (spør brukeren om path først), foreslå 5 navn-variasjoner for batch-render til ~/Desktop/varianter/.",
  },
];
