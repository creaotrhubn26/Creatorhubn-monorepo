import { useRef, useState } from "react";
import { AVSLATT, PRIVAT } from "./api";
import type { Angring, Paragraph, Retting, Tidligere, Understanding } from "./api";

/// Plassene i panelet, med brukerens ord. De rå typene og handlingene —
/// `beslutning`, `marker_åpent`, `hold` — er vårt vokabular, ikke hennes.
/// Hun ser fire plasser, én per seksjon i panelet, og velger en.
export type Plass = "forstått" | "uavklart" | "oppgave" | "idé";

const PLASSER: { verdi: Plass; navn: string; tegn: string }[] = [
  { verdi: "forstått", navn: "Forstått", tegn: "✓" },
  { verdi: "uavklart", navn: "Uavklart", tegn: "?" },
  { verdi: "oppgave", navn: "Oppgave", tegn: "→" },
  { verdi: "idé", navn: "Idé", tegn: "◇" },
];

/** Første svar drøyer. Målt mot den ekte kommandolinja: 13 til 78 sekunder
 *  for ett kall, og nesten alt er oppstart. Panelet sto tomt og taust gjennom
 *  hele det — og et vindu som ikke sier noe på et minutt ser ødelagt ut. */
const VENTETEKST =
  "Leser notatet. Det første svaret tar vanligvis et halvt til ett minutt, " +
  "og linjene kommer etter hvert.";

const FJERNET = "fjernet";
/// Oppgaven er gjort. Ikke en lesning av avsnittet, men en beskjed om
/// virkeligheten — derfor er den ikke en av plassene hun kan velge i skjemaet.
const FERDIG = "ferdig";

const tegnet = (plass: Plass) => PLASSER.find((p) => p.verdi === plass)?.tegn ?? "";

/// Hvor systemet ville plassert avsnittet. Rekkefølgen er prioriteringen:
///
/// - En oppgave er en oppgave uansett hvor bestemt den er.
/// - Et referert eller avvist standpunkt er en idé, **også når modellen sa
///   `bygg`**. Kundens ønske er ikke hennes beslutning, og skal ikke stå med
///   samme hake som hennes egne.
/// - `marker_åpent` er uavklart. Det er både hennes åpne spørsmål og modellens
///   egen usikkerhetsutgang — `RESULTAT.md` viste at ni av elleve ekstra feil
///   var nettopp den — og begge hører hjemme samme sted. Linja sier hvilken av
///   delene det er.
/// - **Et krav er avgjort.** `RESULTAT.md` avgjorde den saken: «bestemorvennlig»
///   og «det må støtte RAW» er beslutninger om *hvordan*, og begge modellene var
///   uavhengig enige mot fasiten. Før traff en `begrensning` ingen gren her og
///   forsvant helt ut av panelet — kravet hun formulerte var borte uten spor,
///   og et avsnitt uten linje ser ut som et avsnitt uten innhold.
///
/// Samme rekkefølge som `rettelser::lest_plass` i Rust, og de to må følge
/// hverandre: står de ulikt, tror appen at hun flyttet en linje hun lot stå,
/// og et eksempel i prompten blir en rettelse hun aldri gjorde.
///
/// `null` betyr at avsnittet ikke vises. En observasjon, eller en beskjed til
/// seg selv, er ikke noe panelet har forstått om prosjektet — men panelet sier
/// hvor mange de er, i stedet for å late som de ikke fantes.
function lest(p: Paragraph): Plass | null {
  if (p.kind === "oppgave") return "oppgave";
  if (p.kind === "gjengivelse" || p.kind === "uenighet") return "idé";
  if (p.action === "marker_åpent") return "uavklart";
  if (p.kind === "begrensning") return "forstått";
  if (p.action === "bygg") return "forstått";
  if (p.kind === "tvil") return "idé";
  if (p.kind === "spørsmål") return "uavklart";
  // `hold` er «noter som mulighet», og det er nøyaktig hva en idé er. Uten
  // denne falt en `beslutning|hold` — en modell som sier «bestemt» og «ikke
  // bygg» i samme åndedrag — ut av panelet uten spor.
  if (p.action === "hold") return "idé";
  return null;
}

/// Rettelsen vinner. Den er skrevet av den som vet.
function plassen(p: Paragraph): Plass | typeof FJERNET | typeof FERDIG | null {
  return (p.correction?.plass as Plass | typeof FJERNET | undefined) ?? lest(p);
}

const kortformen = (p: Paragraph) => p.correction?.summary?.trim() || p.summary;

/// Hva oppgaven venter på: hennes egen pil om hun skrev en, ellers modellens.
const venteren = (p: Paragraph) => p.correction?.venter?.trim() || p.dependency;

/// Linja slik den leses: «Marius: bruke Stripe» i en samtale, «bruke Stripe» i
/// et vanlig notat. Forskjellen på en beslutningslogg og en haug med løsrevne
/// påstander er hvem som sa det.
export function linjetekst(avsender: string | null, kortform: string): string {
  return avsender ? `${avsender}: ${kortform}` : kortform;
}

type Velg = (p: Paragraph) => void;
type Rett = (r: Retting, tekst: string) => void;
type Åpne = (sti: string, hash: string) => void;
type Avvis = (t: Tidligere, avvist: boolean) => void;

const dagMåned = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long" });
const dagMånedÅr = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/// Datoen tanken ble skrevet, eller `null` når kilden ikke visste den. En dato
/// vi ikke kan fastslå skal være borte, ikke gjettet: «Du forkastet dette
/// 10. september» er en påstand om brukerens egen historikk, og en usann
/// påstand sagt med sikker stemme er verre enn ingen dato.
function dato(sekunder: number): string | null {
  if (!sekunder || sekunder <= 0) return null;
  const d = new Date(sekunder * 1000);
  return d.getFullYear() === new Date().getFullYear() ? dagMåned.format(d) : dagMånedÅr.format(d);
}

/// Når en lesning begynner å bli gammel nok til å si det.
///
/// Tretti dager. Under det er datoen støy — hun skrev jo notatet nylig, og en
/// dato på hver linje ville skjult linjene. Over det er den svaret på et
/// spørsmål hun ellers ikke kan stille: *når* leste appen dette? En linje lest
/// av en eldre modell, under eldre regler, så før nøyaktig ut som en fersk.
///
/// Selve foreldelsen skjer i Rust ([`understand::FERSKHET`], nitti dager): da
/// leses linja om igjen ved neste lesning av notatet. Datoen her er det hun
/// ser mens det står på, og det hun blir stående med hvis lesningen ikke går
/// gjennom.
const GAMMEL = 30 * 24 * 60 * 60;

function lestFor(sekunder: number): string | null {
  if (!sekunder || sekunder <= 0) return null;
  if (Date.now() / 1000 - sekunder < GAMMEL) return null;
  return dato(sekunder);
}

/// Hva forholdet er, sagt på vanlig norsk. Et forhold som ikke står her — det
/// som bare deler et ord — har ingen setning, og vises derfor aldri.
///
/// `nevnt` er linja appen viser når de to lesningene så en kobling men ikke
/// den samme retningen. Den skal ikke antyde retning i det hele tatt: ikke
/// gjentakelse («du har vært innom dette før»), ikke relevans uten innhold
/// («se også»). Datoen og kortformen er alt hun trenger for å lese selv.
const SETNINGER: Record<string, (dato: string | null) => string> = {
  motsier: (d) => (d ? `Du forkastet dette ${d}` : "Du forkastet dette før"),
  besvarer: (d) =>
    d ? `Dette svarer på spørsmålet du stilte ${d}` : "Dette svarer på et spørsmål du stilte før",
  bekrefter: (d) => (d ? `Du bestemte det samme ${d}` : "Du bestemte det samme før"),
  nevnt: (d) => (d ? `Du skrev om dette ${d}` : "Du skrev om dette før"),
};

/// Linjene som skal vises, i den rekkefølgen de kom — motsigelsen først, fordi
/// den er den eneste som er verdt å avbryte skrivingen for. Det samme
/// tidligere avsnittet står bare én gang, selv om flere avsnitt peker på det.
///
/// `sti` er notatet som står åpent. Peker linja på et avsnitt i det samme
/// notatet, er den ikke «tidligere» — den er to linjer opp på skjermen, og
/// «Du forkastet dette 13. september» om noe hun ser er ikke en opplysning.
/// Den koblingen brukes i stedet til å ta haken av det som ble overstyrt, se
/// [`overstyrte`].
export function tidligereLinjer(alle: Tidligere[], sti?: string): Tidligere[] {
  const sett = new Set<string>();
  return alle.filter((t) => {
    if (!(t.forhold in SETNINGER) || sett.has(t.hash) || t.sti === sti) return false;
    sett.add(t.hash);
    return true;
  });
}

/// Avsnitt i dette notatet som et senere avsnitt motsier.
///
/// Sier Marius «Vi går for Stripe» klokka 10:32 og «Nei, Vipps likevel» 10:41,
/// sto begge som ✓ under «Hva vi har forstått» — to motstridende beslutninger,
/// begge presentert som gjeldende. Koblingen fantes allerede; den ble bare
/// brukt til å skrive en linje om historikk i stedet for å ta haken av den
/// utdaterte.
///
/// Bare bakover: det som står *før* i notatet er det som blir overstyrt.
export function overstyrte(avsnitt: Paragraph[], earlier: Tidligere[], sti: string): Set<string> {
  const plass = new Map(avsnitt.map((p) => [p.hash, p.start]));
  const ut = new Set<string>();
  for (const t of earlier) {
    if (t.forhold !== "motsier" || t.sti !== sti) continue;
    const gammel = plass.get(t.hash);
    const ny = avsnitt.find((p) => p.id === t.gjelder)?.start;
    if (gammel !== undefined && ny !== undefined && gammel < ny) ut.add(t.hash);
  }
  return ut;
}

/// Hvor mange linjer «Tidligere om dette» viser før hun ber om resten.
///
/// Uten et tak vokser seksjonen monotont — det lagres nye dommer ved hver
/// lagring, og ingen av dem slettes — og ved hundre koblinger skyves «Hva vi
/// har forstått» ut av synsfeltet av en historikk hun ikke ba om.
const FØRST = 5;

/// Det hun har tenkt om dette før. Klikk åpner notatet og markerer avsnittet:
/// uten det er koblingen en påstand hun ikke kan etterprøve.
function Tidligere_({
  linjer,
  gjelder,
  onÅpne,
  onAvvis,
}: {
  linjer: Tidligere[];
  /** Kortformen på linja i dette notatet som utløste koblingen. */
  gjelder: (id: number) => string | null;
  onÅpne: Åpne;
  onAvvis: (t: Tidligere) => void;
}) {
  const [alle, setAlle] = useState(false);
  const vist = alle ? linjer : linjer.slice(0, FØRST);
  return (
    <>
      <h2>Tidligere om dette</h2>
      <ul className="tidligere">
        {vist.map((t) => {
          const om = gjelder(t.gjelder);
          return (
            <li
              key={`${t.gjelder}-${t.hash}`}
              className={t.forhold === "motsier" ? "mot" : t.forhold === "nevnt" ? "nøytral" : undefined}
            >
              <button onClick={() => onÅpne(t.sti, t.hash)}>
                <span className="forhold">{SETNINGER[t.forhold](dato(t.tidspunkt))}</span>
                <span className="kilde">
                  «{t.kortform}» · {t.tittel}
                </span>
                {/* Uten dette er linja en påstand om historikken hennes uten
                    at hun ser hvilken setning hun nettopp skrev som utløste
                    den — og da kan påstanden ikke etterprøves. */}
                {om && <span className="omLinja">om linja «{om}»</span>}
                {/* 7–8 % av linjene er den nøytrale, og en leser kunne ikke se
                    hvilke. Nå står det. */}
                {t.forhold === "nevnt" && (
                  <span className="omLinja">Vi er ikke sikre på hvordan de henger sammen.</span>
                )}
              </button>
              <button className="endre" onClick={() => onAvvis(t)}>
                Henger ikke sammen
              </button>
            </li>
          );
        })}
      </ul>
      {linjer.length > FØRST && !alle && (
        <p className="framdrift">
          <button className="mer" onClick={() => setAlle(true)}>
            Vis de {linjer.length - FØRST} andre
          </button>
        </p>
      )}
    </>
  );
}

/// Én linje som brukeren holder på å rette. Ingen dialog, ingen overlegg:
/// skjemaet står der linja sto, og linja kommer tilbake når hun er ferdig.
function Retteskjema({
  p,
  plass,
  onLagre,
  onFjern,
  onTilbakestill,
  onAvbryt,
}: {
  p: Paragraph;
  plass: Plass;
  onLagre: (plass: Plass, kortform: string) => void;
  onFjern: () => void;
  /** Ta rettelsen bort igjen og la lesningen stå. Bare når det finnes en. */
  onTilbakestill: () => void;
  onAvbryt: () => void;
}) {
  const [kortform, setKortform] = useState(kortformen(p));
  const [valgt, setValgt] = useState<Plass>(plass);

  return (
    <form
      className="retting"
      onSubmit={(e) => {
        e.preventDefault();
        onLagre(valgt, kortform.trim() || kortformen(p));
      }}
    >
      <label className="rettefelt">
        Linja skal stå som
        <input
          type="text"
          value={kortform}
          onChange={(e) => setKortform(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === "Escape" && onAvbryt()}
        />
      </label>

      <fieldset className="plassvalg">
        <legend>Hører hjemme under</legend>
        {PLASSER.map((v) => (
          <label key={v.verdi}>
            <input
              type="radio"
              name={`plass-${p.id || p.start}`}
              value={v.verdi}
              checked={valgt === v.verdi}
              onChange={() => setValgt(v.verdi)}
            />
            <span className={`tegn tegn-${v.verdi}`} aria-hidden="true">
              {v.tegn}
            </span>
            {v.navn}
          </label>
        ))}
      </fieldset>

      <div className="retteknapper">
        <button type="submit" className="lagre">
          Lagre
        </button>
        <button type="button" onClick={onAvbryt}>
          Avbryt
        </button>
        <button type="button" className="fjern" onClick={onFjern}>
          Ikke relevant
        </button>
        {p.correction && (
          <button type="button" onClick={onTilbakestill}>
            Bruk lesningen igjen
          </button>
        )}
      </div>
    </form>
  );
}

function Linje({
  p,
  plass,
  nøkkel,
  overstyrt,
  onVelg,
  onEndre,
  onFerdig,
}: {
  p: Paragraph;
  plass: Plass;
  /** Linjas identitet, så fokus finner veien tilbake hit når rettingen
   *  lukkes. */
  nøkkel: string;
  /** Et senere avsnitt i det samme notatet motsier dette. */
  overstyrt: boolean;
  onVelg: Velg;
  onEndre: () => void;
  onFerdig: (() => void) | null;
}) {
  const gammel = lestFor(p.lest);
  return (
    <div className="linjerad">
      <button className="linje" onClick={() => onVelg(p)}>
        <span className={`tegn tegn-${overstyrt ? "endret" : plass}`} aria-hidden="true">
          {overstyrt ? "·" : tegnet(plass)}
        </span>
        <span className="kort">
          {p.avsender && <span className="avsender">{p.avsender}:</span>}
          {kortformen(p)}
          {plass === "oppgave" && venteren(p) && (
            <span className="venter"> — venter på {venteren(p)}</span>
          )}
          {/* «Uavklart» dekket både hennes åpne spørsmål og modellens egen
              usikkerhet. Linja sier nå hvilken av delene den er. */}
          {plass === "uavklart" && (
            <span className="merknad">
              {p.correction ? "uavklart" : p.kind === "spørsmål" ? "du spurte" : "ikke avgjort"}
            </span>
          )}
          {overstyrt && <span className="merknad">endret lenger ned</span>}
          {p.correction && <span className="merknad">rettet av deg</span>}
          {gammel && <span className="merknad">lest {gammel}</span>}
        </span>
      </button>
      {onFerdig && (
        <button className="endre" onClick={onFerdig}>
          Ferdig
        </button>
      )}
      <button className="endre" data-endre={nøkkel} onClick={onEndre}>
        Endre
      </button>
    </div>
  );
}

/// Det appen har lest ut av notatet, ved siden av notatet. Ingenting her er
/// laget av appen — det er brukerens egne avsnitt, kortet ned og sortert, og
/// rettet av henne selv der lesningen bommet.
export function Panel({
  forståelse,
  framdrift,
  sti,
  angre,
  onHusk,
  onAngre,
  onVelg,
  onRett,
  onAvvis,
  onLukkMerknad,
  onÅpne,
  onSlåPå,
  onSlåAv,
}: {
  forståelse: Understanding | null;
  /** Hvor langt en lang lesning er kommet, eller `null` når det ikke er noe
   *  på gang. En importert samtale tar minutter; hun skal se at det går
   *  framover, ikke om det er ferdig. */
  framdrift: { lest: number; totalt: number; fase: string | null } | null;
  sti: string;
  /** Angrehistorikken for økta. Den bor i `App`, ikke her: panelet rives og
   *  bygges opp igjen ved hvert notatbytte, og en feilklikket «Ikke relevant»
   *  skal ikke bli permanent fordi hun rakk å se på et annet notat. */
  angre: Angring[];
  onHusk: (a: Angring) => void;
  onAngre: () => void;
  onVelg: Velg;
  onRett: Rett;
  onAvvis: Avvis;
  onLukkMerknad: () => void;
  onÅpne: Åpne;
  /** Brukeren sier ja til lesningen, etter å ha lest hva den gjør. */
  onSlåPå: () => void;
  /** Og trekker det tilbake. En ekte av-bryter, ikke en visningsbryter. */
  onSlåAv: () => void;
}) {
  /// Hvilken linje som rettes. Nøkkelen er avsnittets identitet, ikke
  /// posisjonen: lander en lesning mens hun skriver i feltet, flytter
  /// posisjonene seg, og skjemaet hoppet før til en annen linje eller
  /// forsvant med teksten hun hadde skrevet.
  const [redigerer, setRedigerer] = useState<string | null>(null);
  const nøkkel = (p: Paragraph) => (p.id > 0 ? `id:${p.id}` : `pos:${p.start}`);

  const flate = useRef<HTMLElement>(null);

  /** Fokus tilbake dit hun kom fra.
   *
   *  «Avbryt», «Lagre», «Angre» og «Lukk» avmonterer elementet som hadde
   *  fokus, og da faller fokus til `<body>`: neste Tab begynner på toppen av
   *  dokumentet. Rettingen har en «Endre»-knapp å gå tilbake til; banneret
   *  har ingen, og da er panelet selv nærmeste sted. */
  const tilbake = (til?: string) => {
    queueMicrotask(() => {
      const knapp = til
        ? flate.current?.querySelector<HTMLElement>(`[data-endre="${CSS.escape(til)}"]`)
        : null;
      (knapp ?? flate.current)?.focus();
    });
  };

  const lukkSkjema = (nøkkel: string) => {
    setRedigerer(null);
    tilbake(nøkkel);
  };

  const rett = (p: Paragraph, plass: string | null, kortform: string | null, sagt: string) => {
    const før = p.correction;
    onHusk({
      tekst: sagt,
      angre: {
        avsnittId: p.id,
        sti,
        tekst: p.text,
        lestType: p.kind,
        lestHandling: p.action,
        lestKortform: p.summary,
        plass: før?.plass ?? null,
        kortform: før?.summary ?? null,
      },
    });
    lukkSkjema(nøkkel(p));
    onRett(
      {
        avsnittId: p.id,
        sti,
        tekst: p.text,
        lestType: p.kind,
        lestHandling: p.action,
        lestKortform: p.summary,
        plass,
        kortform,
      },
      p.text,
    );
  };

  if (forståelse && !forståelse.on) {
    return (
      <aside className="panel" aria-label="Hva vi har forstått">
        {forståelse.grunn === AVSLATT ? (
          // Ikke en visningsbryter. Dette er spørsmålet hun aldri ble stilt.
          <div className="av">
            <h2>Skal notatene leses?</h2>
            <p>
              «Hva vi har forstått» leser notatet ved å sende avsnittene ordrett til{" "}
              <code>claude</code> på maskinen din. Programmet sender dem videre til Anthropic, og
              legger igjen en kopi av samtalen i <code>~/.claude/projects</code>. Kopien blir
              liggende til du sletter den.
            </p>
            <p>
              Alt annet i appen — skriving, lagring, søk — forlater aldri maskinen. Du kan slå
              lesningen av igjen når som helst, og et notat med <code>privat: ja</code> i
              toppfeltet sendes aldri, uansett hva denne står på.
            </p>
            <button onClick={onSlåPå}>Slå på lesning</button>
          </div>
        ) : forståelse.grunn === PRIVAT ? (
          <p className="av">
            Dette notatet er merket privat. Det sendes ingen steder, og leses derfor ikke.
          </p>
        ) : forståelse.grunn ? (
          <p className="av">
            Lesningen feilet: {forståelse.grunn}. Notatet lagres og søkes som før.
          </p>
        ) : (
          <p className="av">Forståelsen er ikke tilgjengelig nå. Notatet lagres og søkes som før.</p>
        )}
      </aside>
    );
  }

  const avsnitt = forståelse?.paragraphs ?? [];
  const i = (plass: string) => avsnitt.filter((p) => plassen(p) === plass);
  const forstått = i("forstått");
  const uavklarte = i("uavklart");
  const oppgaver = i("oppgave");
  const idéer = i("idé");
  const gjort = i(FERDIG);
  const skjulte = avsnitt.filter((p) => plassen(p) === null).length;
  const uleste = forståelse?.uleste ?? 0;
  const sist = angre[angre.length - 1];
  const lestPåNytt = forståelse?.reread ?? [];
  const alleTidligere = forståelse?.earlier ?? [];
  const tidligere = tidligereLinjer(alleTidligere, sti);
  const overstyrt = overstyrte(avsnitt, alleTidligere, sti);
  const kortformFor = (id: number) => {
    const p = avsnitt.find((a) => a.id === id && a.id > 0);
    return p ? kortformen(p) : null;
  };

  const rad = (p: Paragraph, plass: Plass) =>
    redigerer === nøkkel(p) ? (
      <li key={nøkkel(p)} className={plass === "uavklart" ? "åpen" : undefined}>
        <Retteskjema
          p={p}
          plass={plass}
          onLagre={(valgt, kortform) => rett(p, valgt, kortform, `«${kortform}» er endret.`)}
          onFjern={() => rett(p, FJERNET, "", `«${kortformen(p)}» er fjernet fra panelet.`)}
          onTilbakestill={() =>
            rett(p, null, null, `Rettelsen på «${kortformen(p)}» er tatt bort.`)
          }
          onAvbryt={() => lukkSkjema(nøkkel(p))}
        />
      </li>
    ) : (
      <li key={nøkkel(p)} className={plass === "uavklart" ? "åpen" : undefined}>
        <Linje
          p={p}
          plass={plass}
          nøkkel={nøkkel(p)}
          overstyrt={overstyrt.has(p.hash)}
          onVelg={onVelg}
          onEndre={() => setRedigerer(nøkkel(p))}
          onFerdig={
            plass === "oppgave"
              ? () => rett(p, FERDIG, kortformen(p), `«${kortformen(p)}» er merket ferdig.`)
              : null
          }
        />
      </li>
    );

  return (
    <aside className="panel" aria-label="Hva vi har forstått" ref={flate} tabIndex={-1}>
      {/* Panelet fylles ut mens en lesning står på, og gjorde det uten et
          ord. Setningen her endrer seg når panelet gjør det, og leses da. */}
      <p className="skjult" role="status">
        {panelmelding(
          {
            forstått: forstått.length,
            uavklart: uavklarte.length,
            oppgave: oppgaver.length,
            idé: idéer.length,
          },
          framdrift,
          forståelse !== null,
        )}
      </p>
      {sist && (
        <p className="angre">
          <span>{sist.tekst}</span>
          <button
            onClick={() => {
              onAngre();
              tilbake();
            }}
          >
            Angre
          </button>
        </p>
      )}

      {lestPåNytt.length > 0 && (
        <p className="påNytt">
          {/* Sannheten er hardere enn «lest på nytt»: avsnittet står ikke i
              notatet lenger, og rettelsen gjelder ikke. Veien tilbake er ekte
              — skriver hun teksten inn igjen, finner rettelsen tilbake til
              den, også under et nytt filnavn. */}
          <span>
            {lestPåNytt.length === 1
              ? `«${lestPåNytt[0]}» gjelder ikke lenger, fordi avsnittet ikke står i notatet.`
              : `Disse gjelder ikke lenger, fordi avsnittene ikke står i notatet: ${lestPåNytt
                  .map((t) => `«${t}»`)
                  .join(", ")}.`}{" "}
            Skriver du teksten inn igjen, kommer rettelsen tilbake.
          </span>
          <button
            onClick={() => {
              onLukkMerknad();
              tilbake();
            }}
          >
            Lukk
          </button>
        </p>
      )}

      {/* Uten denne var avkortingen i `minne::tidligere` stum: et notat på
          fem tusen avsnitt fikk koblinger for to hundre av dem, og ingenting
          sa at resten aldri ble spurt om. */}
      {forståelse?.avkortet && (
        <p className="framdrift">Bare de 200 første avsnittene er sjekket mot tidligere notater.</p>
      )}

      {tidligere.length > 0 && (
        <Tidligere_
          linjer={tidligere}
          gjelder={kortformFor}
          onÅpne={onÅpne}
          onAvvis={(t) => {
            // Veien tilbake er den samme som for en retting: banneret over,
            // med hennes egne ord for hva hun gjorde.
            onHusk({ tekst: `Koblingen til «${t.kortform}» er tatt bort.`, kobling: t });
            onAvvis(t, true);
          }}
        />
      )}

      {framdrift && (
        <p className="framdrift">
          {framdrift.fase === "sammenligner"
            ? "Ser etter hva du har skrevet om dette før. Det tar litt."
            : framdrift.fase === "venter"
              ? VENTETEKST
              : `Leser avsnitt ${framdrift.lest} av ${framdrift.totalt}.`}
        </p>
      )}

      <h2>Hva vi har forstått</h2>
      {forstått.length === 0 && uavklarte.length === 0 ? (
        <p className="ingenting">
          {!forståelse || framdrift ? "Leser notatet." : "Ingenting er bestemt ennå."}
        </p>
      ) : (
        <ul>
          {forstått.map((p) => rad(p, "forstått"))}
          {uavklarte.map((p) => rad(p, "uavklart"))}
        </ul>
      )}

      {oppgaver.length > 0 && (
        <>
          <h2>Oppgaver</h2>
          <ul>{oppgaver.map((p) => rad(p, "oppgave"))}</ul>
        </>
      )}

      {gjort.length > 0 && (
        <>
          <h2>Gjort</h2>
          <ul className="gjort">{gjort.map((p) => rad(p, "oppgave"))}</ul>
        </>
      )}

      {idéer.length > 0 && (
        <>
          <h2>Idéer og alternativer</h2>
          <ul>{idéer.map((p) => rad(p, "idé"))}</ul>
        </>
      )}

      {/* Et avsnitt som ikke ble lest, og et avsnitt som ikke sier noe om
          prosjektet, så begge ut som et avsnitt uten innhold. «Ingenting er
          bestemt ennå» leses som «vi leste og fant ingenting», ikke som «vi
          leste og gjemte det». */}
      {(skjulte > 0 || uleste > 0) && (
        <p className="ingenting">
          {skjulte > 0 &&
            `${skjulte} ${skjulte === 1 ? "avsnitt sier" : "avsnitt sier"} ikke noe om prosjektet, og står ikke her.`}
          {skjulte > 0 && uleste > 0 && " "}
          {uleste > 0 &&
            `${uleste} ${uleste === 1 ? "avsnitt er" : "avsnitt er"} ikke lest ennå.`}
        </p>
      )}

      {/* Den ekte av-bryteren. «Skjul forståelse» i toppen skjuler bare
          spalten; denne stanser at notatteksten sendes noe sted. */}
      <p className="lesningsvalg">
        Linjene er lest av en maskin, og noen av dem er feil. Rett dem du ser er gale — det er
        rettelsene dine som lærer den opp.
        <br />
        Avsnittene sendes til <code>claude</code> for å leses.
        {forståelse ? ` Sendt ${forståelse.kall} ganger siden appen startet.` : ""}
        <button onClick={onSlåAv}>Slå av lesning</button>
      </p>
    </aside>
  );
}

/** Panelet i én setning, for den som ikke ser det.
 *
 *  Panelet er hele produktideen, og det fylles ut ovenfra og nedover mens en
 *  lesning står på — uten et ord til en skjermleser. Setningen her går i et
 *  `role="status"`: den endrer seg når panelet endrer seg, og blir lest når
 *  den gjør det.
 *
 *  Kortformene leses ikke opp: de er notatets egne setninger, og de står i
 *  lista rett under. Det som må sies er *hvor mange* og *hva som pågår*. */
export function panelmelding(
  antall: { forstått: number; uavklart: number; oppgave: number; idé: number },
  framdrift: { lest: number; totalt: number; fase: string | null } | null,
  lesning: boolean,
): string {
  if (framdrift) {
    if (framdrift.fase === "sammenligner") return "Ser etter hva du har skrevet om dette før.";
    if (framdrift.fase === "venter") return VENTETEKST;
    return `Leser avsnitt ${framdrift.lest} av ${framdrift.totalt}.`;
  }
  if (!lesning) return "";
  const deler: string[] = [];
  const si = (n: number, ett: string, flere: string) => {
    if (n > 0) deler.push(`${n} ${n === 1 ? ett : flere}`);
  };
  si(antall.forstått, "forstått linje", "forstått");
  si(antall.uavklart, "uavklart linje", "uavklarte");
  si(antall.oppgave, "oppgave", "oppgaver");
  si(antall.idé, "idé", "idéer");
  return deler.length === 0 ? "Ingenting er bestemt ennå." : `${deler.join(", ")}.`;
}

/** Eksportert for testing: plasseringen er produktlogikk, ikke pynt. */
export const _test = {
  dato,
  lestFor,
  lest,
  plassen,
  kortformen,
  venteren,
  linjetekst,
  panelmelding,
  tidligereLinjer,
  overstyrte,
  SETNINGER,
  PLASSER,
  FJERNET,
  FERDIG,
  FØRST,
};
