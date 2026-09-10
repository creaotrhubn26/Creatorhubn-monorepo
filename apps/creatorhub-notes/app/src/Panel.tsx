import type { Paragraph, Understanding } from "./api";

/// Hvilken del av panelet et avsnitt hører hjemme i. Rekkefølgen er
/// prioriteringen: er noe bestemt, står det som bestemt; ellers er det enten
/// noe brukeren luftet uten å velge, eller noe som står åpent.
///
/// Et referert eller avvist standpunkt havner blant idéene uansett om
/// klassifiseringen kalte det `hold` eller `marker_åpent`. Klassifiseringstesten
/// viste at den grensen er finere enn produktet trenger — begge betyr «ikke
/// bygg» — mens typen er stabil. Bare `tvil` er ekte tvetydig, og der får
/// handlingen avgjøre.
///
/// `null` betyr at avsnittet ikke vises. En observasjon, eller en beskjed til
/// seg selv, er ikke noe panelet har forstått om prosjektet.
function del(p: Paragraph): "bestemt" | "åpent" | "idé" | null {
  if (p.action === "bygg") return "bestemt";
  if (p.kind === "gjengivelse" || p.kind === "uenighet") return "idé";
  if (p.kind === "tvil") return p.action === "hold" ? "idé" : "åpent";
  if (p.kind === "spørsmål" || p.action === "marker_åpent") return "åpent";
  return null;
}

type Velg = (p: Paragraph) => void;

function Linje({
  p,
  tegn,
  åpent,
  onVelg,
}: {
  p: Paragraph;
  tegn: string;
  åpent?: boolean;
  onVelg: Velg;
}) {
  return (
    <li className={åpent ? "åpen" : undefined}>
      <button className="linje" onClick={() => onVelg(p)}>
        <span className="tegn" aria-hidden="true">
          {tegn}
        </span>
        <span className="kort">
          {p.summary}
          {åpent && <span className="merknad">uavklart</span>}
        </span>
      </button>
    </li>
  );
}

/** Det appen har lest ut av notatet, ved siden av notatet. Ingenting her er
 *  laget av appen — det er brukerens egne avsnitt, kortet ned og sortert. */
export function Panel({ forståelse, onVelg }: { forståelse: Understanding | null; onVelg: Velg }) {
  if (forståelse && !forståelse.on) {
    return (
      <aside className="panel" aria-label="Hva vi har forstått">
        <p className="av">
          Forståelsen er ikke tilgjengelig nå. Notatet lagres og søkes som før.
        </p>
      </aside>
    );
  }

  const avsnitt = forståelse?.paragraphs ?? [];
  const bestemt = avsnitt.filter((p) => del(p) === "bestemt");
  const åpne = avsnitt.filter((p) => del(p) === "åpent");
  const idéer = avsnitt.filter((p) => del(p) === "idé");

  return (
    <aside className="panel" aria-label="Hva vi har forstått">
      <h2>Hva vi har forstått</h2>
      {bestemt.length === 0 && åpne.length === 0 ? (
        <p className="ingenting">
          {forståelse ? "Ingenting er bestemt ennå." : "Leser notatet."}
        </p>
      ) : (
        <ul>
          {bestemt.map((p) => (
            <Linje key={p.start} p={p} tegn="✓" onVelg={onVelg} />
          ))}
          {åpne.map((p) => (
            <Linje key={p.start} p={p} tegn="?" åpent onVelg={onVelg} />
          ))}
        </ul>
      )}

      {idéer.length > 0 && (
        <>
          <h2>Idéer og alternativer</h2>
          <ul>
            {idéer.map((p) => (
              <Linje key={p.start} p={p} tegn="–" onVelg={onVelg} />
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
