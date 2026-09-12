import { useState } from "react";
import type { Paragraph, Retting, Tidligere, Understanding } from "./api";

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

const FJERNET = "fjernet";

const tegnet = (plass: Plass) => PLASSER.find((p) => p.verdi === plass)?.tegn ?? "";

/// Hvor systemet ville plassert avsnittet. Rekkefølgen er prioriteringen: en
/// oppgave er en oppgave uansett hvor bestemt den er; ellers gjelder det at er
/// noe bestemt, står det som bestemt, og resten er enten noe brukeren luftet
/// uten å velge, eller noe som står åpent.
///
/// Et referert eller avvist standpunkt havner blant idéene uansett om
/// klassifiseringen kalte det `hold` eller `marker_åpent`. Klassifiseringstesten
/// viste at den grensen er finere enn produktet trenger — begge betyr «ikke
/// bygg» — mens typen er stabil. Bare `tvil` er ekte tvetydig, og der får
/// handlingen avgjøre.
///
/// `null` betyr at avsnittet ikke vises. En observasjon, eller en beskjed til
/// seg selv, er ikke noe panelet har forstått om prosjektet.
function lest(p: Paragraph): Plass | null {
  if (p.kind === "oppgave") return "oppgave";
  if (p.action === "bygg") return "forstått";
  if (p.kind === "gjengivelse" || p.kind === "uenighet") return "idé";
  if (p.kind === "tvil") return p.action === "hold" ? "idé" : "uavklart";
  if (p.kind === "spørsmål" || p.action === "marker_åpent") return "uavklart";
  return null;
}

/// Rettelsen vinner. Den er skrevet av den som vet.
function plassen(p: Paragraph): Plass | typeof FJERNET | null {
  return (p.correction?.plass as Plass | typeof FJERNET | undefined) ?? lest(p);
}

const kortformen = (p: Paragraph) => p.correction?.summary?.trim() || p.summary;

/// Linja slik den leses: «Marius: bruke Stripe» i en samtale, «bruke Stripe» i
/// et vanlig notat. Forskjellen på en beslutningslogg og en haug med løsrevne
/// påstander er hvem som sa det.
export function linjetekst(avsender: string | null, kortform: string): string {
  return avsender ? `${avsender}: ${kortform}` : kortform;
}

type Velg = (p: Paragraph) => void;
type Rett = (r: Retting) => void;
type Åpne = (sti: string, hash: string) => void;

const dagMåned = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long" });
const dagMånedÅr = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function dato(sekunder: number) {
  const d = new Date(sekunder * 1000);
  return d.getFullYear() === new Date().getFullYear() ? dagMåned.format(d) : dagMånedÅr.format(d);
}

/// Hva forholdet er, sagt på vanlig norsk. Et forhold som ikke står her — det
/// som bare deler et ord — har ingen setning, og vises derfor aldri.
///
/// `nevnt` er linja appen viser når de to lesningene så en kobling men ikke
/// den samme retningen. Den skal ikke antyde retning i det hele tatt: ikke
/// gjentakelse («du har vært innom dette før»), ikke relevans uten innhold
/// («se også»). Datoen og kortformen er alt hun trenger for å lese selv.
const SETNINGER: Record<string, (dato: string) => string> = {
  motsier: (d) => `Du forkastet dette ${d}`,
  besvarer: (d) => `Dette svarer på spørsmålet du stilte ${d}`,
  bekrefter: (d) => `Du bestemte det samme ${d}`,
  nevnt: (d) => `Du skrev om dette ${d}`,
};

/// Linjene som skal vises, i den rekkefølgen de kom — motsigelsen først, fordi
/// den er den eneste som er verdt å avbryte skrivingen for. Det samme
/// tidligere avsnittet står bare én gang, selv om flere avsnitt peker på det.
export function tidligereLinjer(alle: Tidligere[]): Tidligere[] {
  const sett = new Set<string>();
  return alle.filter((t) => {
    if (!(t.forhold in SETNINGER) || sett.has(t.hash)) return false;
    sett.add(t.hash);
    return true;
  });
}

/// Det hun har tenkt om dette før. Klikk åpner notatet og markerer avsnittet:
/// uten det er koblingen en påstand hun ikke kan etterprøve.
function Tidligere_({ linjer, onÅpne }: { linjer: Tidligere[]; onÅpne: Åpne }) {
  return (
    <>
      <h2>Tidligere om dette</h2>
      <ul className="tidligere">
        {linjer.map((t) => (
          <li key={`${t.gjelder}-${t.hash}`} className={t.forhold === "motsier" ? "mot" : undefined}>
            <button onClick={() => onÅpne(t.sti, t.hash)}>
              <span className="forhold">{SETNINGER[t.forhold](dato(t.tidspunkt))}</span>
              <span className="kilde">
                «{t.kortform}» · {t.tittel}
              </span>
            </button>
          </li>
        ))}
      </ul>
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
  onAvbryt,
}: {
  p: Paragraph;
  plass: Plass;
  onLagre: (plass: Plass, kortform: string) => void;
  onFjern: () => void;
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
              name={`plass-${p.start}`}
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
      </div>
    </form>
  );
}

function Linje({
  p,
  plass,
  onVelg,
  onEndre,
}: {
  p: Paragraph;
  plass: Plass;
  onVelg: Velg;
  onEndre: () => void;
}) {
  return (
    <div className="linjerad">
      <button className="linje" onClick={() => onVelg(p)}>
        <span className={`tegn tegn-${plass}`} aria-hidden="true">
          {tegnet(plass)}
        </span>
        <span className="kort">
          {p.avsender && <span className="avsender">{p.avsender}:</span>}
          {kortformen(p)}
          {plass === "oppgave" && p.dependency && (
            <span className="venter"> — venter på {p.dependency}</span>
          )}
          {plass === "uavklart" && <span className="merknad">uavklart</span>}
        </span>
      </button>
      <button className="endre" onClick={onEndre}>
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
  onVelg,
  onRett,
  onLukkMerknad,
  onÅpne,
}: {
  forståelse: Understanding | null;
  /** Hvor langt en lang lesning er kommet, eller `null` når det ikke er noe
   *  på gang. En importert samtale tar minutter; hun skal se at det går
   *  framover, ikke om det er ferdig. */
  framdrift: { lest: number; totalt: number } | null;
  sti: string;
  onVelg: Velg;
  onRett: Rett;
  onLukkMerknad: () => void;
  onÅpne: Åpne;
}) {
  /// Hvilken linje som rettes, og veien tilbake fra hver retting. Stabelen er
  /// hele angrehistorikken for økta: en feilklikket sletting skal ikke være
  /// permanent bare fordi man rakk å gjøre noe annet etterpå.
  const [redigerer, setRedigerer] = useState<number | null>(null);
  const [angre, setAngre] = useState<{ tekst: string; retting: Retting }[]>([]);

  const rett = (p: Paragraph, plass: string | null, kortform: string | null, sagt: string) => {
    const før = p.correction;
    setAngre((s) => [
      ...s,
      {
        tekst: sagt,
        retting: {
          avsnittId: p.id,
          sti,
          tekst: p.text,
          lestType: p.kind,
          lestHandling: p.action,
          lestKortform: p.summary,
          plass: før?.plass ?? null,
          kortform: før?.summary ?? null,
        },
      },
    ]);
    setRedigerer(null);
    onRett({
      avsnittId: p.id,
      sti,
      tekst: p.text,
      lestType: p.kind,
      lestHandling: p.action,
      lestKortform: p.summary,
      plass,
      kortform,
    });
  };

  if (forståelse && !forståelse.on) {
    return (
      <aside className="panel" aria-label="Hva vi har forstått">
        <p className="av">Forståelsen er ikke tilgjengelig nå. Notatet lagres og søkes som før.</p>
      </aside>
    );
  }

  const avsnitt = forståelse?.paragraphs ?? [];
  const i = (plass: Plass) => avsnitt.filter((p) => plassen(p) === plass);
  const forstått = i("forstått");
  const uavklarte = i("uavklart");
  const oppgaver = i("oppgave");
  const idéer = i("idé");
  const sist = angre[angre.length - 1];
  const lestPåNytt = forståelse?.reread ?? [];
  const tidligere = tidligereLinjer(forståelse?.earlier ?? []);

  const rad = (p: Paragraph, plass: Plass) =>
    redigerer === p.start ? (
      <li key={p.start} className={plass === "uavklart" ? "åpen" : undefined}>
        <Retteskjema
          p={p}
          plass={plass}
          onLagre={(valgt, kortform) =>
            rett(p, valgt, kortform, `«${kortform}» er endret.`)
          }
          onFjern={() => rett(p, FJERNET, "", `«${kortformen(p)}» er fjernet fra panelet.`)}
          onAvbryt={() => setRedigerer(null)}
        />
      </li>
    ) : (
      <li key={p.start} className={plass === "uavklart" ? "åpen" : undefined}>
        <Linje p={p} plass={plass} onVelg={onVelg} onEndre={() => setRedigerer(p.start)} />
      </li>
    );

  return (
    <aside className="panel" aria-label="Hva vi har forstått">
      {sist && (
        <p className="angre">
          <span>{sist.tekst}</span>
          <button
            onClick={() => {
              setAngre((s) => s.slice(0, -1));
              onRett(sist.retting);
            }}
          >
            Angre
          </button>
        </p>
      )}

      {lestPåNytt.length > 0 && (
        <p className="påNytt">
          <span>
            {lestPåNytt.length === 1
              ? `«${lestPåNytt[0]}» er lest på nytt, fordi avsnittet er skrevet om.`
              : `Disse er lest på nytt, fordi avsnittene er skrevet om: ${lestPåNytt
                  .map((t) => `«${t}»`)
                  .join(", ")}.`}
          </span>
          <button onClick={onLukkMerknad}>Lukk</button>
        </p>
      )}

      {tidligere.length > 0 && <Tidligere_ linjer={tidligere} onÅpne={onÅpne} />}

      {framdrift && (
        <p className="framdrift">
          Leser avsnitt {framdrift.lest} av {framdrift.totalt}.
        </p>
      )}

      <h2>Hva vi har forstått</h2>
      {forstått.length === 0 && uavklarte.length === 0 ? (
        <p className="ingenting">{forståelse ? "Ingenting er bestemt ennå." : "Leser notatet."}</p>
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

      {idéer.length > 0 && (
        <>
          <h2>Idéer og alternativer</h2>
          <ul>{idéer.map((p) => rad(p, "idé"))}</ul>
        </>
      )}
    </aside>
  );
}

/** Eksportert for testing: plasseringen er produktlogikk, ikke pynt. */
export const _test = {
  lest,
  plassen,
  kortformen,
  linjetekst,
  tidligereLinjer,
  SETNINGER,
  PLASSER,
  FJERNET,
};
