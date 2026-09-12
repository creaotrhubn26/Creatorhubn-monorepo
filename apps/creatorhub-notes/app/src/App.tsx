import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "./Editor";
import { Panel } from "./Panel";
import {
  avbrytLesning,
  createNote,
  finnAvsnitt,
  påLesning,
  listNotes,
  readNote,
  reindex,
  rettAvsnitt,
  searchNotes,
  sporNotater,
  understandNote,
  writeNote,
  type Framdrift,
  type Note,
  type Paragraph,
  type Retting,
  type SearchHit,
  type Sporsmal,
  type Understanding,
} from "./api";
import { lesTema, settTema, TEMAER, type Tema } from "./tema";

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
  const [spurt, setSpurt] = useState<Sporsmal | null>(null);
  const [query, setQuery] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [doc, setDoc] = useState("");
  const [nytt, setNytt] = useState(false);
  const [status, setStatus] = useState("");
  const [detaljer, setDetaljer] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [panel, setPanel] = useState(() => localStorage.getItem("forstaelse") !== "skjult");
  const [forståelse, setForståelse] = useState<Understanding | null>(null);
  /** Hvor langt en lang lesning er kommet. `null` når det ikke er noe på gang
   *  — da står det ingenting i panelet. */
  const [framdrift, setFramdrift] = useState<{ lest: number; totalt: number } | null>(null);
  const [peker, setPeker] = useState<{ from: number; to: number; n: number } | null>(null);
  const [tema, setTema] = useState<Tema>(() => lesTema());

  const søkefelt = useRef<HTMLInputElement>(null);
  /** Lista slik den er nå, uten å binde tilbakekallene til den. */
  const notater = useRef(notes);
  notater.current = notes;
  const uskrevet = useRef<{ path: string; content: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  /** Panelet slik det er nå, uten å binde lagringen til det. */
  const panelPå = useRef(panel);
  panelPå.current = panel;
  /** Lesningen tar sekunder. Én av gangen, og alltid på den ferskeste
   *  teksten — starter man en ny for hvert tastetrykk, køer de seg opp og
   *  panelet viser noe som var sant for et halvt minutt siden. */
  const leser = useRef(false);
  const køet = useRef<{ sti: string; tekst: string } | null>(null);
  /** Løpenummeret til den ferskeste lesningen vi har hørt fra. Et delresultat
   *  fra en eldre lesning skal ikke skrive over den som gjelder nå. */
  const lesningNå = useRef(0);
  /** Notatet som står åpent, uten å binde lesningen til det. */
  const stiNå = useRef<string | null>(null);
  stiNå.current = path;
  /** Området editoren viser, som CodeMirror teller det — samme telling som
   *  avsnittsposisjonene. Det avgjør bare hva som leses først. */
  const synlig = useRef<[number, number] | null>(null);

  /** Les notatet på nytt. Ingen venter på dette: teksten er allerede på disk,
   *  og panelet fyller seg ut når svaret kommer. */
  const les: (sti: string, tekst: string) => Promise<void> = useCallback(
    async (sti: string, tekst: string) => {
      if (!panelPå.current) return;
      if (leser.current) {
        køet.current = { sti, tekst };
        // En lang kilde tar minutter. Den som kjører skal forlates, ikke stå
        // og lese ferdig noe brukeren har gått bort fra — det den rakk står.
        void avbrytLesning().catch(() => undefined);
        return;
      }
      leser.current = true;
      try {
        const svar = await understandNote(sti, tekst, synlig.current);
        // Delresultater kan ha kommet fra en nyere lesning mens denne holdt
        // på, og notatet kan være byttet. Da er dette svaret gammelt.
        if (svar.lesning >= lesningNå.current && sti === stiNå.current) {
          lesningNå.current = svar.lesning;
          setForståelse(svar);
          setFramdrift(null);
        }
      } catch {
        // Panelet blir stående som det var. Notatet er lagret uansett.
      } finally {
        leser.current = false;
        const neste = køet.current;
        køet.current = null;
        if (neste && (neste.sti !== sti || neste.tekst !== tekst)) void les(neste.sti, neste.tekst);
      }
    },
    [],
  );

  /** Delresultatene fra en lang lesning. Panelet fylles ut ovenfra og nedover
   *  mens den står på, i stedet for å stå tomt til alt er ferdig. */
  useEffect(() => {
    const av = påLesning((d: Framdrift) => {
      if (d.lesning < lesningNå.current) return; // en forlatt lesning
      const fersk = d.lesning > lesningNå.current;
      lesningNå.current = d.lesning;
      setForståelse((f) => {
        const før = fersk || !f ? [] : f.paragraphs;
        return {
          on: true,
          lesning: d.lesning,
          paragraphs: [...før, ...d.paragraphs].sort((a, b) => a.start - b.start),
          reread: fersk || !f ? [] : f.reread,
          earlier: fersk || !f ? [] : f.earlier,
        };
      });
      setFramdrift(d.lest < d.totalt ? { lest: d.lest, totalt: d.totalt } : null);
    });
    return () => {
      void av.then((stopp) => stopp()).catch(() => undefined);
    };
  }, []);

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
      void les(p.path, p.content);
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
  }, [les]);

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
    async (p: string, ferskt = false, avsnitt?: string) => {
      await lagre();
      try {
        const tekst = await readNote(p);
        setNytt(ferskt);
        setDoc(tekst);
        setPath(p);
        setDetaljer(false);
        setPeker(null);
        setForståelse(null);
        setFramdrift(null);
        void les(p, tekst);
        // Kom man hit fra en linje om noe som ble skrevet før, skal avsnittet
        // markeres. Er det skrevet om siden, står notatet åpent uten merke.
        if (avsnitt) {
          finnAvsnitt(p, avsnitt)
            .then((sted) => {
              if (sted) setPeker((forrige) => ({ from: sted[0], to: sted[1], n: (forrige?.n ?? 0) + 1 }));
            })
            .catch(() => undefined);
        }
        // Lagringsmerket står alltid. Er ingenting endret ennå, er sannheten
        // tidspunktet fila sist ble skrevet.
        const rørt = notater.current.find((n) => n.path === p)?.modified;
        setStatus(rørt ? `Lagret ${klokke.format(new Date(rørt * 1000))}` : "Lagret");
      } catch (e) {
        setFeil(String(e));
      }
    },
    [lagre, les],
  );

  /** Brukerens egen retting av én linje. Den lagres, og panelet leses opp
   *  igjen fra den samme teksten — avsnittene er uendret, så det koster
   *  ingenting utover et oppslag. */
  const rett = useCallback(
    async (r: Retting) => {
      try {
        await rettAvsnitt(r);
      } catch (e) {
        setFeil(String(e));
        return;
      }
      if (path) void les(path, uskrevet.current?.content ?? doc);
    },
    [path, doc, les],
  );

  const nyttNotat = useCallback(async () => {
    await lagre();
    try {
      const p = await createNote("");
      setQuery("");
      setTreff(null);
      setSpurt(null);
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
      setSpurt(null);
      return;
    }
    const t = window.setTimeout(async () => {
      await lagre();
      try {
        setTreff(await searchNotes(q));
      } catch (e) {
        setFeil(String(e));
      }
      // Treffer ordene et av spørsmålene appen kjenner, kommer de strukturerte
      // treffene i tillegg. Bommer den, er fritekstsøket akkurat som før.
      setSpurt(await sporNotater(q).catch(() => null));
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
        setSpurt(null);
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
                setSpurt(null);
                søkefelt.current?.focus();
              }}
            >
              Vis alle
            </button>
          )}
        </div>
        <label className="tema">
          Tema
          <select
            value={tema}
            onChange={(e) => setTema(settTema(e.target.value as Tema))}
          >
            {TEMAER.map((t) => (
              <option key={t.verdi} value={t.verdi}>
                {t.navn}
              </option>
            ))}
          </select>
        </label>
        <button
          className="bryter"
          aria-pressed={panel}
          onClick={() => {
            const på = !panel;
            setPanel(på);
            localStorage.setItem("forstaelse", på ? "vist" : "skjult");
            if (på && path) void les(path, uskrevet.current?.content ?? doc);
          }}
        >
          {panel ? "Skjul forståelse" : "Vis forståelse"}
        </button>
        <button className="nytt" onClick={() => void nyttNotat()}>
          Nytt notat <kbd>⌘N</kbd>
        </button>
      </header>

      <div className={panel ? "kropp med-panel" : "kropp"}>
        <nav className="liste" aria-label="Notater">
          {spurt && spurt.treff.length > 0 && (
            <section className="spurt">
              <h2 className="dag">{spurt.overskrift}</h2>
              <p className="spurtOm">Fra det du har skrevet før, ikke fra ordene du søkte på.</p>
              {spurt.treff.map((t) => (
                <button
                  key={`${t.sti}-${t.hash}`}
                  className="rad"
                  onClick={() => void åpne(t.sti, false, t.hash)}
                >
                  <span className="tittel">{t.kortform}</span>
                  <span className="fra">
                    {t.venter ? `venter på ${t.venter} · ` : ""}
                    {t.tittel}
                  </span>
                </button>
              ))}
            </section>
          )}
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
              {/* Lagringsmerket står her, ikke nede i hjørnet: det er her øyet
                  allerede er når man ser på notatet, og et lagringsmerke ingen
                  finner gjør ingen trygge. */}
              <div className="notatinfo">
                <div className="notatlinje">
                  <span>{topp?.etikett ?? "Notat"}</span>
                  <span className="status" aria-live="polite">
                    {status}
                  </span>
                  {topp && (
                    <button onClick={() => setDetaljer(!detaljer)}>
                      {detaljer ? "Skjul detaljer" : "Vis detaljer"}
                    </button>
                  )}
                </div>
                {detaljer && topp && (
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
              <Editor
                path={path}
                doc={doc}
                onChange={skriv}
                selectTitle={nytt}
                peker={peker}
                onSynlig={(fra, til) => {
                  synlig.current = [fra, til];
                }}
              />
            </>
          ) : (
            <div className="velkomst">
              <h1>{tomtArkiv ? "Ingen notater ennå" : "Velg et notat"}</h1>
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
        </main>

        {panel &&
          (path ? (
            <Panel
              key={path}
              forståelse={forståelse}
              framdrift={framdrift}
              sti={path}
              onVelg={(p: Paragraph) =>
                setPeker((forrige) => ({ from: p.start, to: p.end, n: (forrige?.n ?? 0) + 1 }))
              }
              onRett={(r) => void rett(r)}
              onLukkMerknad={() =>
                setForståelse((f) => (f ? { ...f, reread: [] } : f))
              }
              onÅpne={(annen, avsnitt) => void åpne(annen, false, avsnitt)}
            />
          ) : (
            // Ingen notat åpent: spalten holder plassen sin, og sier ingenting.
            <aside className="panel" />
          ))}
      </div>
    </div>
  );
}
