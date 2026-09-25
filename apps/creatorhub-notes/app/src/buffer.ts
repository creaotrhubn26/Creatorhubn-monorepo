/** Én kilde til gjeldende tekst, og det eneste stedet et ulagret skriv finnes.
 *
 *  `doc`-tilstanden i App er bare det skriveflaten ble matet med sist. Den
 *  følger ikke tastingen, og etter en autolagring følger den heller ikke det
 *  som ligger på disk. Alt som trenger teksten *slik den er nå* — «dette er en
 *  samtale», en retting, panelbryteren, toppfeltene — spør denne i stedet.
 *
 *  Bufferet står til skrivet faktisk lyktes. Det er forskjellen på en full
 *  disk som gir en feilmelding, og en full disk som spiser siste avsnitt. */

export type Skriv = (sti: string, tekst: string) => Promise<void>;

export type Ventende = { sti: string; tekst: string };

/** `null` når det ikke var noe å skrive. */
export type Utfall = { skrevet: Ventende } | { feil: unknown } | null;

export function lagBuffer(skriv: Skriv) {
  let tekst = "";
  let sti: string | null = null;
  let uskrevet: Ventende | null = null;

  return {
    /** Teksten slik den står nå. Den ene kilden. */
    nå: () => tekst,
    /** Notatet ble åpnet, eller appen byttet teksten selv. Ikke en redigering. */
    sett(nySti: string | null, nyTekst: string) {
      sti = nySti;
      tekst = nyTekst;
    },
    /** Brukeren skrev, eller appen skrev om notatet på hennes vegne. */
    endret(nyTekst: string) {
      tekst = nyTekst;
      if (sti !== null) uskrevet = { sti, tekst: nyTekst };
    },
    /** Kast det uskrevne. Bare «last inn på nytt» gjør dette, og bare fordi
     *  brukeren nettopp ba om det. */
    forkast() {
      uskrevet = null;
    },
    venter: () => uskrevet !== null,
    ventende: () => uskrevet,
    /** Skriv til disk. Bufferet tømmes først når skrivet gikk gjennom, og bare
     *  hvis det er nøyaktig det som ble skrevet som fortsatt står der — skrev
     *  hun videre mens skrivet pågikk, er det nye fortsatt uskrevet. */
    async lagre(): Promise<Utfall> {
      const p = uskrevet;
      if (!p) return null;
      try {
        await skriv(p.sti, p.tekst);
      } catch (feil) {
        return { feil };
      }
      if (uskrevet === p) uskrevet = null;
      return { skrevet: p };
    },
  };
}

export type Buffer = ReturnType<typeof lagBuffer>;
