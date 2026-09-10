import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "./Editor";
import {
  createNote,
  listNotes,
  readNote,
  reindex,
  searchNotes,
  writeNote,
  type Note,
  type SearchHit,
} from "./api";

const klokke = new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" });
const dagIAr = new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short" });
const dagFor = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" });

function midnatt(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dagsetikett(sekunder: number) {
  const d = new Date(sekunder * 1000);
  const dager = Math.round((midnatt(new Date()) - midnatt(d)) / 86_400_000);
  if (dager <= 0) return "i dag";
  if (dager === 1) return "i går";
  const nå = new Date();
  return d.getFullYear() === nå.getFullYear() ? dagIAr.format(d) : dagFor.format(d);
}

/** Notatene i den rekkefølgen de kom, gruppert på dagen de sist ble rørt. */
function grupper(notes: Note[]): [string, Note[]][] {
  const ut: [string, Note[]][] = [];
  for (const n of notes) {
    const etikett = dagsetikett(n.modified);
    const siste = ut[ut.length - 1];
    if (siste && siste[0] === etikett) siste[1].push(n);
    else ut.push([etikett, [n]]);
  }
  return ut;
}

const dagMåned = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long" });
const dagMånedÅr = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Toppfeltene i fila, lest for visning. Fila selv røres ikke. */
function toppfelt(doc: string): { felt: [string, string][]; etikett: string } | null {
  const linjer = doc.split("\n");
  if (linjer[0]?.trim() !== "---") return null;
  const slutt = linjer.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (slutt < 0) return null;

  const felt: [string, string][] = [];
  for (const linje of linjer.slice(1, slutt)) {
    const skille = linje.indexOf(":");
    if (skille > 0) felt.push([linje.slice(0, skille).trim(), linje.slice(skille + 1).trim()]);
  }

  const verdi = (navn: string) => felt.find(([k]) => k === navn)?.[1] ?? "";
  const type = verdi("type");
  const dato = /^(\d{4})-(\d{2})-(\d{2})/.exec(verdi("id"));
  const deler = [type ? type[0].toUpperCase() + type.slice(1) : "Notat"];
  if (dato) {
    const d = new Date(Number(dato[1]), Number(dato[2]) - 1, Number(dato[3]));
    deler.push(
      d.getFullYear() === new Date().getFullYear() ? dagMåned.format(d) : dagMånedÅr.format(d),
    );
  }
  return { felt, etikett: deler.join(" · ") };
}

/** FTS5 markerer treffordene med `**…**`. */
function Utdrag({ tekst }: { tekst: string }) {
  return (
    <p className="utdrag">
      {tekst.split("**").map((del, i) => (i % 2 ? <mark key={i}>{del}</mark> : <span key={i}>{del}</span>))}
    </p>
  );
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [treff, setTreff] = useState<SearchHit[] | null>(null);
  const [query, setQuery] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [doc, setDoc] = useState("");
  const [nytt, setNytt] = useState(false);
  const [status, setStatus] = useState("");
  const [detaljer, setDetaljer] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const søkefelt = useRef<HTMLInputElement>(null);
  /** Lista slik den er nå, uten å binde tilbakekallene til den. */
  const notater = useRef(notes);
  notater.current = notes;
  const uskrevet = useRef<{ path: string; content: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  /** Skriv til disk, indekser, oppdater lista. Kalles på pause, før bytte av
   *  notat og før søk — det siste er det som gjør at et notat fra ett minutt
   *  siden faktisk er søkbart. */
  const lagre = useCallback(async () => {
    window.clearTimeout(timer.current);
    const p = uskrevet.current;
    if (!p) return;
    uskrevet.current = null;
    try {
      await writeNote(p.path, p.content);
      setStatus(`Lagret ${klokke.format(new Date())}`);
    } catch (e) {
      setFeil(String(e));
      return;
    }
    try {
      await reindex();
      setNotes(await listNotes());
    } catch {
      // Teksten ligger trygt på disk; det er bare søket som henger etter.
      setFeil("Notatet er lagret, men søket er ikke oppdatert ennå.");
    }
  }, []);

  const skriv = useCallback(
    (tekst: string) => {
      if (!path) return;
      uskrevet.current = { path, content: tekst };
      setStatus("Lagrer …");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void lagre(), 900);
    },
    [path, lagre],
  );

  const åpne = useCallback(
    async (p: string, ferskt = false) => {
      await lagre();
      try {
        const tekst = await readNote(p);
        setNytt(ferskt);
        setDoc(tekst);
        setPath(p);
        setDetaljer(false);
        // Lagringsmerket står alltid. Er ingenting endret ennå, er sannheten
        // tidspunktet fila sist ble skrevet.
        const rørt = notater.current.find((n) => n.path === p)?.modified;
        setStatus(rørt ? `Lagret ${klokke.format(new Date(rørt * 1000))}` : "Lagret");
      } catch (e) {
        setFeil(String(e));
      }
    },
    [lagre],
  );

  const nyttNotat = useCallback(async () => {
    await lagre();
    try {
      const p = await createNote("");
      setQuery("");
      setTreff(null);
      await åpne(p, true);
      setNotes(await listNotes());
      await reindex().catch(() => undefined);
    } catch (e) {
      setFeil(String(e));
    }
  }, [lagre, åpne]);

  useEffect(() => {
    void (async () => {
      try {
        setNotes(await listNotes());
      } catch (e) {
        setFeil(String(e));
      }
      // Notater kan ha kommet til utenfor appen. Feiler dette, virker alt
      // annet fortsatt, og brukeren har ingenting å gjøre med beskjeden.
      await reindex().catch(() => undefined);
    })();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setTreff(null);
      return;
    }
    const t = window.setTimeout(async () => {
      await lagre();
      try {
        setTreff(await searchNotes(q));
      } catch (e) {
        setFeil(String(e));
      }
    }, 160);
    return () => window.clearTimeout(t);
  }, [query, lagre]);

  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      const kommando = e.metaKey || e.ctrlKey;
      if (kommando && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void nyttNotat();
      } else if (kommando && e.key.toLowerCase() === "f") {
        e.preventDefault();
        søkefelt.current?.focus();
        søkefelt.current?.select();
      } else if (e.key === "Escape") {
        setQuery("");
        setTreff(null);
        document.querySelector<HTMLElement>(".cm-content")?.focus();
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [nyttNotat]);

  const tomtArkiv = notes.length === 0;
  const topp = path ? toppfelt(doc) : null;

  return (
    <div className="skall">
      <header className="topp">
        <div className="søk">
          <span className="søkfelt">
            <input
              ref={søkefelt}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk i notatene"
              aria-label="Søk i notatene"
              spellCheck={false}
            />
            {!query && <kbd>⌘F</kbd>}
          </span>
          {query && (
            <button
              className="tøm"
              onClick={() => {
                setQuery("");
                setTreff(null);
                søkefelt.current?.focus();
              }}
            >
              Vis alle
            </button>
          )}
        </div>
        <button className="nytt" onClick={() => void nyttNotat()}>
          Nytt notat <kbd>⌘N</kbd>
        </button>
      </header>

      <div className="kropp">
        <nav className="liste" aria-label="Notater">
          {treff !== null ? (
            treff.length === 0 ? (
              <p className="tomt">
                Fant ingen notater med «{query.trim()}».
                <span>Søket leter etter hele ord. Prøv ett ord færre, eller et annet ord.</span>
              </p>
            ) : (
              <section>
                <h2 className="dag">{treff.length} treff</h2>
                {treff.map((t) => (
                  <button
                    key={t.path}
                    className={`rad${t.path === path ? " valgt" : ""}`}
                    onClick={() => void åpne(t.path)}
                  >
                    <span className="tittel">{t.title}</span>
                    <Utdrag tekst={t.snippet} />
                  </button>
                ))}
              </section>
            )
          ) : tomtArkiv ? (
            <p className="tomt">Ingen notater ennå.</p>
          ) : (
            grupper(notes).map(([etikett, rader]) => (
              <section key={etikett}>
                <h2 className="dag">{etikett}</h2>
                {rader.map((n) => (
                  <button
                    key={n.path}
                    className={`rad${n.path === path ? " valgt" : ""}`}
                    onClick={() => void åpne(n.path)}
                  >
                    <span className="tittel">{n.title}</span>
                    <span className="tid">{klokke.format(new Date(n.modified * 1000))}</span>
                  </button>
                ))}
              </section>
            ))
          )}
        </nav>

        <main className="ark">
          {feil && (
            <p className="feil" role="alert">
              {feil}
              <button onClick={() => setFeil(null)}>Lukk</button>
            </p>
          )}
          {path ? (
            <>
              {topp && (
                <div className="notatinfo">
                  <div className="notatlinje">
                    <span>{topp.etikett}</span>
                    <button onClick={() => setDetaljer(!detaljer)}>
                      {detaljer ? "Skjul detaljer" : "Vis detaljer"}
                    </button>
                  </div>
                  {detaljer && (
                    <dl className="detaljer">
                      {topp.felt.map(([navn, verdi]) => (
                        <Fragment key={navn}>
                          <dt>{navn}</dt>
                          <dd>{verdi || "—"}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  )}
                </div>
              )}
              <Editor path={path} doc={doc} onChange={skriv} selectTitle={nytt} />
            </>
          ) : (
            <div className="velkomst">
              <h1>{tomtArkiv ? "Ingen notater ennå" : "Ingen notat er åpent"}</h1>
              <p>
                {tomtArkiv
                  ? "Her skriver du ned det du vil huske senere. Notatene lagrer seg selv, og du kan søke i alt du har skrevet."
                  : "Velg et notat i lista til venstre, eller skriv et nytt."}
              </p>
              <button onClick={() => void nyttNotat()}>
                {tomtArkiv ? "Skriv det første notatet" : "Nytt notat"}
              </button>
            </div>
          )}
          <span className="status" aria-live="polite">
            {status}
          </span>
        </main>
      </div>
    </div>
  );
}
