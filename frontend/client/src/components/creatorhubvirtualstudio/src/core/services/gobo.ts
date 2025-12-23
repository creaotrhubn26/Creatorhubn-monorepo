export type Gobo = { id: string; title: string; tags?: string[] };

export const DEFAULT_GOBOS: Gobo[] = [
  { id: 'stripes-01', title: 'Stripes 01', tags: ['lines','stripes'] },
  { id: 'dots-01', title: 'Dots 01', tags: ['bokeh','dots'] },
  { id: 'leaf-01', title: 'Leaf 01', tags: ['organic','leaves'] },
  { id: 'venetian-01', title: 'Venetian 01', tags: ['shutters','lines'] },
  { id: 'window-01', title: 'Window 01', tags: ['window','frame'] },
];

export function getGoboUrl(id: string): string {
  return `/gobos/${id}.png`;
}

export function listGobos(): Gobo[] {
  // Later: merge DEFAULT_GOBOS with user-uploaded gobos
  return DEFAULT_GOBOS;
}

export function searchGobos(q: string): Gobo[] {
  const s = q.trim().toLowerCase();
  if (!s) return listGobos();
  return listGobos().filter(
    (g) =>
      g.id.toLowerCase().includes(s) ||
      g.title.toLowerCase().includes(s) ||
      (g.tags || []).some((t) => t.includes(s)),
  );
}
