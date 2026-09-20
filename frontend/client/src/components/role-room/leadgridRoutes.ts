/**
 * Rutevalg for Leadgrid-sider som finnes under to adresser.
 *
 * leadgrid.no serverer de samme sidene både på ren sti («/reset-passord/x»,
 * som er den e-postene sender) og på prefikset sti («/leadgrid/reset-passord/x»,
 * som gamle lenker og bokmerker bruker). Internt normaliseres begge til den
 * prefiksede formen, og det var der feilen lå: rutemønsteret ble valgt etter
 * host i stedet for etter adressen brukeren faktisk står på, så den prefiksede
 * lenken på leadgrid.no matchet ingenting og siden ble blank.
 */

/** Rutemønsteret passordtilbakestillingen skal matche for denne adressen. */
export function resetRoutePathFor(pathname: string): string {
  return pathname.startsWith('/leadgrid/')
    ? '/leadgrid/reset-passord/:token'
    : '/reset-passord/:token';
}
