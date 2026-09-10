import { useState } from "react";
import type { Paragraph, Retting, Understanding } from "./api";

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

type Velg = (p: Paragraph) => void;
type Rett = (r: Retting) => void;

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
  sti,
  onVelg,
  onRett,
  onLukkMerknad,
}: {
  forståelse: Understanding | null;
  sti: string;
  onVelg: Velg;
  onRett: Rett;
  onLukkMerknad: () => void;
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
          sti,
          hash: p.hash,
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
      sti,
      hash: p.hash,
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
export const _test = { lest, plassen, kortformen, PLASSER, FJERNET };
