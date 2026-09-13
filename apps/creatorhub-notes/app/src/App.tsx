import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Editor } from "./Editor";
import { linjetekst, Panel } from "./Panel";
import {
  avbrytLesning,
  avvisKobling,
  createNote,
  finnAvsnitt,
  påLesning,
  påNotatEndret,
  listNotes,
  readNote,
  reindex,
  rettAvsnitt,
  samtaleform,
  searchNotes,
  settLesning,
  settPrivat,
  settSamtale,
  sporNotater,
  understandNote,
  writeNote,
  type Angring,
  type Framdrift,
  type Note,
  type Paragraph,
  type Retting,
  type Samtaleform,
  type Tidligere,
  type SearchHit,
  type Sporsmal,
  type Understanding,
} from "./api";
import { lagBuffer } from "./buffer";
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

/** Hvordan søket leses. Står der hun leter når hun ikke fant det hun så
 *  etter, og i tittelteksten på søkefeltet — ikke i en README hun aldri
 *  åpner. */
function SøkeSyntaks() {
  return (
    <dl className="søkesyntaks">
      <dt>to ord</dt>
      <dd>ett av dem; notater med begge kommer først</dd>
      <dt>ord AND ord</dt>
      <dd>begge må stå i notatet</dd>
      <dt>«"flere ord"»</dt>
      <dd>ordene ved siden av hverandre, i den rekkefølgen</dd>
      <dt>-ord</dt>
      <dd>uten det ordet</dd>
    </dl>
  );
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
  const [framdrift, setFramdrift] = useState<{
    lest: number;
    totalt: number;
    fase: string | null;
  } | null>(null);
  /** Angrehistorikken for økta. Den bor her, ikke i panelet: panelet er
   *  `key={path}` og rives ved hvert notatbytte, og en feilklikket «Ikke
   *  relevant» skal ikke bli permanent fordi hun rakk å se på et annet
   *  notat. Rettingen bærer stien sin, så den virker uansett hva som er
   *  åpent. */
  const [angre, setAngre] = useState<Angring[]>([]);
  /** Notatet som står åpent ble endret utenfra mens hun hadde ulagrede
   *  endringer. Skriveflaten er urørt — dette er bare et varsel, med et valg
   *  hun tar selv. `false` når det ikke er noen konflikt å vise fram. */
  const [endretUtenfor, setEndretUtenfor] = useState(false);
  const [peker, setPeker] = useState<{ from: number; to: number; n: number } | null>(null);
  /** Leses notatet som en samtale, og hvem er i så fall med? `null` før vi har
   *  spurt. Valget er synlig i notatlinja, ikke gjemt i en meny. */
  const [samtale, setSamtale] = useState<Samtaleform | null>(null);
  const [tema, setTema] = useState<Tema>(() => lesTema());

  const søkefelt = useRef<HTMLInputElement>(null);
  /** Lista slik den er nå, uten å binde tilbakekallene til den. */
  const notater = useRef(notes);
  notater.current = notes;
  /** Gjeldende tekst og det uskrevne, ett sted. `doc` er bare det
   *  skriveflaten ble matet med sist — den følger verken tastingen eller
   *  disken, og alt som leser den som «teksten nå» tar feil. */
  const buffer = useRef(lagBuffer(writeNote)).current;
  const timer = useRef<number | undefined>(undefined);
  // Toppfeltene, lest av den ene kilden til gjeldende tekst. `doc` ville vist
  // dem slik de var da notatet ble åpnet.
  const topp = toppfelt(buffer.nå());
  /** Notatet er merket `privat: ja` og sendes aldri noe sted. */
  const privat = topp?.felt.some(([k, v]) => k === "privat" && v === "ja") ?? false;
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
          grunn: null,
          lesning: d.lesning,
          paragraphs: [...før, ...d.paragraphs].sort((a, b) => a.start - b.start),
          reread: fersk || !f ? [] : f.reread,
          earlier: fersk || !f ? [] : f.earlier,
          uleste: f?.uleste ?? 0,
          kall: f?.kall ?? 0,
        };
      });
      // Fasen etter avsnittene — sammenligningen mot det hun har skrevet før
      // — er to modellkall til. Panelet så ferdig ut gjennom hele den.
      setFramdrift(
        d.fase
          ? { lest: d.lest, totalt: d.totalt, fase: d.fase }
          : d.lest < d.totalt
            ? { lest: d.lest, totalt: d.totalt, fase: null }
            : null,
      );
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
    const utfall = await buffer.lagre();
    if (!utfall) return;
    if ("feil" in utfall) {
      // Teksten står fortsatt i bufferet — det er det eneste stedet den
      // finnes. Vi prøver igjen av oss selv, og hun kan skrive videre imens.
      setFeil(`Kunne ikke lagre: ${utfall.feil}. Teksten står, og vi prøver igjen.`);
      setStatus("Ikke lagret");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void lagreIgjen.current(), 4000);
      return;
    }
    const p = utfall.skrevet;
    setStatus(`Lagret ${klokke.format(new Date())}`);
    // Det som eventuelt sto uoppgjort er avgjort nå: hennes versjon er den
    // som ligger på disk, og det er nettopp det hun valgte ved å fortsette
    // å skrive og la det autolagre.
    setEndretUtenfor(false);
    void les(p.sti, p.tekst);
    // Ble en samtale limt inn, er notatet en samtale nå. Formen leses av
    // teksten som faktisk står på disk, ikke av det appen trodde.
    void samtaleform(p.tekst).then(setSamtale).catch(() => undefined);
    try {
      await reindex();
      setNotes(await listNotes());
    } catch {
      // Teksten ligger trygt på disk; det er bare søket som henger etter.
      setFeil("Notatet er lagret, men søket er ikke oppdatert ennå.");
    }
  }, [buffer, les]);
  /** Så den utsatte omkampen kan kalle den nyeste `lagre` uten å binde den
   *  til seg selv. */
  const lagreIgjen = useRef(lagre);
  lagreIgjen.current = lagre;

  const skriv = useCallback(
    (tekst: string) => {
      if (!path) return;
      buffer.endret(tekst);
      setStatus("Lagrer …");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void lagre(), 900);
    },
    [buffer, path, lagre],
  );

  const åpne = useCallback(
    async (p: string, ferskt = false, avsnitt?: string) => {
      await lagre();
      // Gikk ikke lagringen gjennom, står teksten fra det forrige notatet
      // fortsatt i bufferet. Å bytte notat nå ville skrevet den til feil fil
      // eller kastet den; feilmeldingen står, og omkampen kommer.
      if (buffer.venter()) return;
      try {
        const tekst = await readNote(p);
        setNytt(ferskt);
        buffer.sett(p, tekst);
        setDoc(tekst);
        setPath(p);
        setDetaljer(false);
        setPeker(null);
        setForståelse(null);
        setFramdrift(null);
        setSamtale(null);
        setEndretUtenfor(false);
        void samtaleform(tekst).then(setSamtale).catch(() => undefined);
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
    [buffer, lagre, les],
  );

  /** «Last inn på nytt» — svaret på varselet om at notatet ble endret utenfra
   *  mens hun hadde ulagrede endringer. Det hun skrev forsvinner til fordel
   *  for det som står på disk; det var nettopp det hun ba om ved å trykke. */
  const lastInnPåNytt = useCallback(async () => {
    if (!path) return;
    window.clearTimeout(timer.current);
    buffer.forkast();
    try {
      const tekst = await readNote(path);
      buffer.sett(path, tekst);
      setDoc(tekst);
      setEndretUtenfor(false);
      setStatus(`Lastet inn på nytt ${klokke.format(new Date())}`);
      void les(path, tekst);
    } catch (e) {
      setFeil(String(e));
    }
  }, [buffer, path, les]);

  /** Brukerens egen retting av én linje. Den lagres, og panelet leses opp
   *  igjen fra den samme teksten — avsnittene er uendret, så det koster
   *  ingenting utover et oppslag. */
  const rett = useCallback(
    async (r: Retting, tekst: string) => {
      try {
        await rettAvsnitt(r);
      } catch (e) {
        setFeil(String(e));
        return;
      }
      // Panelet oppdateres her, ikke ved en ny lesning. Avsnittene er
      // uendret, så klassifiseringen ville vært gratis — men `minne::tidligere`
      // kjøres på nytt, og har noen par stått udømt, koster hver eneste
      // retting en Haiku- og en Sonnet-tur. Å rette en skrivefeil i en
      // kortform skal ikke ta minutter og penger.
      const rettelse =
        r.plass === null
          ? null
          : { plass: r.plass, summary: r.kortform ?? "", venter: "" };
      setForståelse((f) =>
        f
          ? {
              ...f,
              paragraphs: f.paragraphs.map((p) =>
                p.id === r.avsnittId && p.text === tekst ? { ...p, correction: rettelse } : p,
              ),
            }
          : f,
      );
    },
    [],
  );

  /** «Henger ikke sammen» på en linje under «Tidligere om dette». Dommen
   *  hennes vinner over modellens, og linja er borte med en gang — uten å
   *  vente på en ny lesning. */
  const avvis = useCallback(
    async (t: Tidligere, avvist: boolean) => {
      try {
        await avvisKobling(t.gjelder, t.hash, t.sti, avvist);
      } catch (e) {
        setFeil(String(e));
        return;
      }
      setForståelse((f) =>
        f
          ? {
              ...f,
              earlier: avvist
                ? f.earlier.filter((l) => !(l.gjelder === t.gjelder && l.hash === t.hash))
                : [...f.earlier, t],
            }
          : f,
      );
    },
    [],
  );

  /** «Dette er en samtale» / «dette er det ikke». Valget skrives i toppfeltet,
   *  så det står i fila og gjelder neste gang også. */
  const byttSamtale = useCallback(async () => {
    if (!path) return;
    try {
      const ny = await settSamtale(buffer.nå(), !samtale?.er);
      buffer.endret(ny);
      setDoc(ny);
      await lagre();
    } catch (e) {
      setFeil(String(e));
    }
  }, [buffer, path, samtale, lagre]);

  /** «Aldri les dette notatet» / «Les dette notatet». Som samtalevalget:
   *  valget skrives i toppfeltet, så det står i fila og gjelder neste gang. */
  const byttPrivat = useCallback(async () => {
    if (!path) return;
    try {
      const ny = await settPrivat(buffer.nå(), !privat);
      buffer.endret(ny);
      setDoc(ny);
      await lagre();
    } catch (e) {
      setFeil(String(e));
    }
  }, [buffer, path, privat, lagre]);

  /** Brukerens svar på om notatene får leses, begge veier. Panelet svarer med
   *  en gang: på gir lesningen, av gir spørsmålet tilbake. */
  const settLesningPå = useCallback(
    async (på: boolean) => {
      try {
        await settLesning(på);
        setForståelse(null);
        if (path) void les(path, buffer.nå());
      } catch (e) {
        setFeil(String(e));
      }
    },
    [buffer, path, les],
  );

  const nyttNotat = useCallback(async () => {
    await lagre();
    // Som i `åpne`: står det uskrevet igjen, har lagringen feilet, og et nytt
    // notat vi ikke får åpnet er bare en tom fil på disk.
    if (buffer.venter()) return;
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
  }, [buffer, lagre, åpne]);

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

  /** Notatmappen endret seg mens appen kjørte — en ny fil, en slettet fil,
   *  eller en fil skrevet i av noe annet enn appen selv. Appens egne
   *  lagringer kommer aldri hit; det er allerede luket bort i Rust, så det
   *  denne må ta stilling til er ekte endringer utenfra. */
  useEffect(() => {
    const av = påNotatEndret((stier) => {
      // Lista kan ha fått nye eller borte notater, og modifiserte tidspunkt
      // uansett hvilket notat som er åpent.
      void listNotes().then(setNotes).catch(() => undefined);
      void reindex().catch(() => undefined);

      const nå = stiNå.current;
      if (!nå || !stier.includes(nå)) return;
      if (buffer.venter()) {
        // Hun har ulagrede endringer. Skriveflaten røres ikke — bare si ifra.
        setEndretUtenfor(true);
        return;
      }
      // Ingen ulagrede endringer: trygt å laste inn stille, uten å spørre.
      void readNote(nå)
        .then((tekst) => {
          // Notatet kan være byttet, eller hun kan ha begynt å skrive, mens
          // lesningen var underveis.
          if (stiNå.current !== nå || buffer.venter()) return;
          buffer.sett(nå, tekst);
          setDoc(tekst);
        })
        .catch(() => undefined);
    });
    return () => {
      void av.then((stopp) => stopp()).catch(() => undefined);
    };
  }, [buffer]);

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

  /** Siste setning skal ikke koste et ⌘Q. Debouncen er 900 ms; alt som kan
   *  bety at hun er ferdig med å skrive nå — vinduet mister fokus, vinduet
   *  lukkes — skriver bufferet med en gang.
   *
   *  Tauris `onCloseRequested` venter på handleren før vinduet lukkes, så
   *  lagringen rekker å bli ferdig. Går den likevel galt, står bufferet, og
   *  vinduet lukkes ikke: da er feilbanneret det siste hun ser, og teksten er
   *  fortsatt i appen. */
  useEffect(() => {
    const tøm = () => void lagre();
    window.addEventListener("blur", tøm);
    const vindu = getCurrentWindow();
    const av = vindu.onCloseRequested(async (e) => {
      if (!buffer.venter()) return;
      await lagre();
      if (buffer.venter()) e.preventDefault();
    });
    return () => {
      window.removeEventListener("blur", tøm);
      void av.then((stopp) => stopp()).catch(() => undefined);
    };
  }, [buffer, lagre]);

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
              title={'To ord: ett av dem. "flere ord": frase. -ord: uten. AND: begge.'}
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
            if (på && path) void les(path, buffer.nå());
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
                  <span className="tittel">{linjetekst(t.avsender, t.kortform)}</span>
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
                <SøkeSyntaks />
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
                  <span>
                    {topp?.etikett ?? "Notat"}
                    {samtale?.er &&
                      ` · Samtale${
                        samtale.deltakere.length ? ` med ${samtale.deltakere.join(", ")}` : ""
                      }`}
                  </span>
                  <span className="status" aria-live="polite">
                    {status}
                  </span>
                  <button onClick={() => void byttSamtale()}>
                    {samtale?.er ? "Ikke en samtale" : "Dette er en samtale"}
                  </button>
                  <button onClick={() => void byttPrivat()} aria-pressed={privat}>
                    {privat ? "Kan leses" : "Aldri les dette notatet"}
                  </button>
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
              {endretUtenfor && (
                <p className="feil" role="status">
                  Notatet er endret utenfor appen.
                  <button onClick={() => void lastInnPåNytt()}>Last inn på nytt</button>
                </p>
              )}
              <Editor
                path={path}
                doc={doc}
                onChange={skriv}
                selectTitle={nytt}
                peker={peker}
                onSamtale={() => setSamtale((f) => ({ er: true, tvunget: "samtale", deltakere: f?.deltakere ?? [] }))}
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
              angre={angre}
              onHusk={(a) => setAngre((s) => [...s, a])}
              onAngre={() => {
                const sist = angre[angre.length - 1];
                if (!sist) return;
                setAngre((s) => s.slice(0, -1));
                void rett(sist.angre, sist.angre.tekst);
              }}
              onRett={(r, tekst) => void rett(r, tekst)}
              onAvvis={(t, avvist) => void avvis(t, avvist)}
              onLukkMerknad={() =>
                setForståelse((f) => (f ? { ...f, reread: [] } : f))
              }
              onÅpne={(annen, avsnitt) => void åpne(annen, false, avsnitt)}
              onSlåPå={() => void settLesningPå(true)}
              onSlåAv={() => void settLesningPå(false)}
            />
          ) : (
            // Ingen notat åpent: spalten holder plassen sin, og sier ingenting.
            <aside className="panel" />
          ))}
      </div>
    </div>
  );
}
