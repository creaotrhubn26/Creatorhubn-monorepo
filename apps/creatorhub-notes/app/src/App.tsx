import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as TastHendelse,
  type ReactNode,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Editor, ordtelling, åpneSøkINotatet } from "./Editor";
import { linjetekst, Panel } from "./Panel";
import {
  avbrytLesning,
  avvisKobling,
  createNote,
  finnAvsnitt,
  lastNedOrdbank,
  MERKE_SLUTT,
  MERKE_START,
  ordbankStatus,
  påLesning,
  påNotatEndret,
  påOrdbank,
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
  type Ordbankstatus,
  type Paragraph,
  type Retting,
  type Samtaleform,
  type Søkesvar,
  type Tidligere,
  type Sporsmal,
  type Understanding,
} from "./api";
import { lagBuffer } from "./buffer";
import { lesTema, settTema, TEMAER, type Tema } from "./tema";

const klokke = new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" });
const dagIAr = new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short" });
const dagFor = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" });

/** Når panelet skal si at det første svaret drøyer. Under den målte
 *  spredningen på ett kall (13–78 s, `understand.rs`), så den treffer bare
 *  når det faktisk tar tid. */
const VENTER_MS = 25_000;
/** Og når lesningen skal stanses. Over Rusts egen grense på 300 s per kall,
 *  så den fanger en lesning som har stoppet opp — ikke en som bare er lang. */
const GRENSE_MS = 360_000;

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

/** Utdraget, delt i det som traff og det som står rundt.
 *
 *  Merkene er styretegn fra FTS5, ikke `**`. Delte man på `**` og markerte
 *  annethvert stykke, forskjøv et notat med sin egen fete skrift pariteten:
 *  markeringen la seg på ord som ikke traff, og treffordet sto umarkert. Nå
 *  bæres markeringen av tegn som ikke kan stå i et notat, og hvert stykke vet
 *  selv om det traff. */
export function utdragsdeler(tekst: string): { tekst: string; traff: boolean }[] {
  const ut: { tekst: string; traff: boolean }[] = [];
  let rest = tekst;
  while (rest) {
    const start = rest.indexOf(MERKE_START);
    if (start < 0) break;
    const slutt = rest.indexOf(MERKE_SLUTT, start + 1);
    if (slutt < 0) break;
    if (start > 0) ut.push({ tekst: rest.slice(0, start), traff: false });
    ut.push({ tekst: rest.slice(start + 1, slutt), traff: true });
    rest = rest.slice(slutt + 1);
  }
  if (rest) ut.push({ tekst: rest, traff: false });
  return ut;
}

function Utdrag({ tekst }: { tekst: string }) {
  return (
    <p className="utdrag">
      {utdragsdeler(tekst).map((del, i) =>
        del.traff ? <mark key={i}>{del.tekst}</mark> : <span key={i}>{del.tekst}</span>,
      )}
    </p>
  );
}

/** Tegnposisjonene til et linjeområde, talt slik editoren teller. Linjene er
 *  1-baserte og peker inn i fila slik den ligger på disk, som er nøyaktig det
 *  søketreffet bærer med seg.
 *
 *  `null` når linja ikke finnes i teksten lenger — da hopper vi heller ingen
 *  steder enn til feil sted. */
export function linjeområde(
  tekst: string,
  fra: number,
  til: number,
): { from: number; to: number } | null {
  if (fra < 1) return null;
  const linjer = tekst.split("\n");
  if (fra > linjer.length) return null;
  let from = 0;
  for (let i = 0; i < fra - 1; i++) from += linjer[i].length + 1;
  // Til og med siste linje, men uten linjeskiftet etter den: markeringen skal
  // ligge på teksten, ikke på tomrommet under den.
  let to = from;
  for (let i = fra - 1; i < Math.min(til, linjer.length); i++) {
    if (i > fra - 1) to += 1;
    to += linjer[i].length;
  }
  return { from, to: Math.max(to, from) };
}

/** Overskriften over søketreffene. Tallet var lengden på den kappede lista,
 *  presentert som om det var totalen — hun så fem treff og trodde det var
 *  alt. */
export function treffmelding(antall: number, avkortet: boolean): string {
  if (antall === 0) return "Ingen treff";
  if (avkortet) return `De ${antall} første treffene`;
  return antall === 1 ? "1 treff" : `${antall} treff`;
}

/** Hva brukeren skal få se når noe går galt.
 *
 *  Kommandoene i Rust svarer med hele setningen — `lesefeil`, `skrivefeil`,
 *  `si` — og den er skrevet for henne. En feil som *ikke* er en slik streng
 *  er en JavaScript-feil eller et brudd i broen, og har ingen setning; da er
 *  reserven det ærligste vi har. `String(e)` på alt var det som ga
 *  «Error: Os { code: 2, kind: NotFound }» i et varsel. */
function feiltekst(e: unknown, reserve: string): string {
  console.error(reserve, e);
  return typeof e === "string" && e.trim() ? e : reserve;
}

/** Dagen noe ble skrevet, eller `null` når kilden ikke visste den. */
function dato(sekunder: number): string | null {
  return sekunder > 0 ? dagsetikett(sekunder) : null;
}

/** Én rad i registeret.
 *
 *  Lista er ett tabstopp: bare raden `stopp` peker på har `tabIndex=0`, og
 *  pilene i `nav.liste` flytter fokus mellom radene. Før var hvert notat sitt
 *  eget tabstopp, og hundre notater var hundre trykk på Tab.
 *
 *  Det åpne notatet bærer `aria-current`, ikke bare en farge: en 9 %-tone
 *  mot bakgrunnen er 1,1:1, og en skjermleser fikk ingenting. */
function Rad({
  nøkkel,
  stopp,
  valgt,
  onKlikk,
  onFokus,
  children,
}: {
  nøkkel: string;
  stopp: string | undefined;
  valgt: boolean;
  onKlikk: () => void;
  onFokus: (nøkkel: string) => void;
  children: ReactNode;
}) {
  const meg = useRef<HTMLButtonElement>(null);
  // Åpner hun et notat fra et søk og trykker «Vis alle», er lista tilbake på
  // toppen og det åpne notatet står markert et sted hun ikke ser.
  useEffect(() => {
    if (valgt) meg.current?.scrollIntoView({ block: "nearest" });
  }, [valgt]);
  return (
    <li>
      <button
        ref={meg}
        className={valgt ? "rad valgt" : "rad"}
        aria-current={valgt ? "true" : undefined}
        tabIndex={nøkkel === stopp ? 0 : -1}
        onFocus={() => onFokus(nøkkel)}
        onClick={onKlikk}
      >
        {children}
      </button>
    </li>
  );
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [treff, setTreff] = useState<Søkesvar | null>(null);
  const [spurt, setSpurt] = useState<Sporsmal | null>(null);
  const [query, setQuery] = useState("");
  /** Søket hun nettopp tømte med Escape. Ingenting skal gå tapt uten en vei
   *  tilbake, og en lang søkestreng er noe. */
  const [tømt, setTømt] = useState("");
  /** Norsk Ordbank: uten den finner ikke «utstyret» ordet «utstyr». `null`
   *  til vi har spurt. */
  const [ordbank, setOrdbank] = useState<Ordbankstatus | null>(null);
  /** Nedlastingen som pågår, med den siste beskjeden fra Rust. */
  const [ordbankArbeid, setOrdbankArbeid] = useState<string | null>(null);
  /** Raden som sist hadde fokus. Den bærer lista sitt ene tabstopp, slik at
   *  Tab tilbake til lista lander der pilene forlot den. */
  const [fokusRad, setFokusRad] = useState<string | null>(null);
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
  /** En rolig beskjed under skriveflaten — ikke en feil, bare noe hun bør
   *  vite. «Avsnittet er skrevet om siden» er den viktigste: uten den lander
   *  hun i et fremmed notat uten markering og uten forklaring. */
  const [merknad, setMerknad] = useState<string | null>(null);
  /** Det hun hadde skrevet da hun ba om å laste notatet inn på nytt. Står
   *  her til hun tar det tilbake eller går videre. */
  const [forkastet, setForkastet] = useState<{ sti: string; tekst: string } | null>(null);
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
  /** Ord og tegn, av den samme ene kilden. Regnes ved hvert tastetrykk, som
   *  App uansett tegner om for å sette lagringsmerket. Målt: 0,21 ms på et
   *  notat på 1000 linjer / 114 KB, 1,97 ms på ti tusen linjer. Se
   *  `klassifiseringstest/YTELSE.md`. */
  const tall = ordtelling(buffer.nå());
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
      // Frontend hadde ingen tidsgrense i det hele tatt, og ingen «dette tar
      // tid»-tilstand, enda 13–78 sekunder for *ett* kall er målt og
      // dokumentert i `understand.rs`. Første pakke i et langt notat kunne
      // stå på «Leser notatet.» i over et minutt uten et tegn til liv.
      const treg = window.setTimeout(
        () => setFramdrift((f) => f ?? { lest: 0, totalt: 0, fase: "venter" }),
        VENTER_MS,
      );
      // Og en øvre grense med tenner: `avbrytLesning` er den ene bryteren som
      // faktisk stopper arbeidet, mellom to pakker. Rust har 300 s per kall,
      // så grensa her ligger over den — den skal fange en lesning som har
      // stoppet opp, ikke en som bare er lang.
      const grense = window.setTimeout(() => {
        void avbrytLesning().catch(() => undefined);
        setFramdrift(null);
        setMerknad(
          "Lesningen av notatet tok for lang tid, og ble stanset. Det den rakk å lese står " +
            "i panelet, og notatet er lagret som vanlig.",
        );
      }, GRENSE_MS);
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
        window.clearTimeout(treg);
        window.clearTimeout(grense);
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
      setFeil(
        `${feiltekst(utfall.feil, "Kunne ikke lagre notatet.")} Teksten står i appen, og vi prøver igjen.`,
      );
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
    async (
      p: string,
      /** Hvor i notatet hun skal lande. `avsnitt` er en hash fra panelet;
       *  `linjer` er `[fra, til]` fra et søketreff, talt fra 1 i fila. Uten
       *  noen av dem havner markøren nederst, som er der ingenting står. */
      valg: { ferskt?: boolean; avsnitt?: string; linjer?: [number, number] } = {},
    ) => {
      const { ferskt = false, avsnitt, linjer } = valg;
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
        setMerknad(null);
        void samtaleform(tekst).then(setSamtale).catch(() => undefined);
        void les(p, tekst);
        // Kom hun hit fra et søketreff, bærer treffet linjene sine. De peker
        // inn i fila slik den ligger på disk, og det er nøyaktig teksten vi
        // nettopp leste — så det er bare å regne dem om til tegnposisjoner.
        if (linjer) {
          const sted = linjeområde(tekst, linjer[0], linjer[1]);
          if (sted) setPeker((forrige) => ({ ...sted, n: (forrige?.n ?? 0) + 1 }));
        }
        // Kom man hit fra en linje om noe som ble skrevet før, skal avsnittet
        // markeres. Er det skrevet om siden, sier vi det — før sto notatet
        // åpent uten merke og uten forklaring på hvorfor.
        if (avsnitt) {
          finnAvsnitt(p, avsnitt)
            .then((sted) => {
              if (sted) {
                setPeker((forrige) => ({ from: sted[0], to: sted[1], n: (forrige?.n ?? 0) + 1 }));
              } else {
                setMerknad(
                  "Avsnittet er skrevet om siden appen leste det, så vi kan ikke peke på " +
                    "det. Notatet står åpent.",
                );
              }
            })
            .catch(() => undefined);
        }
        // Lagringsmerket står alltid. Er ingenting endret ennå, er sannheten
        // tidspunktet fila sist ble skrevet.
        const rørt = notater.current.find((n) => n.path === p)?.modified;
        setStatus(rørt ? `Lagret ${klokke.format(new Date(rørt * 1000))}` : "Lagret");
      } catch (e) {
        setFeil(feiltekst(e, "Kunne ikke åpne notatet."));
      }
    },
    [buffer, lagre, les],
  );

  /** «Last inn på nytt» — svaret på varselet om at notatet ble endret utenfra
   *  mens hun hadde ulagrede endringer. Det som står på disk vinner.
   *
   *  Men det hun skrev kastes ikke: det legges til side, og banneret som
   *  kommer i stedet sier hvor mye det var og gir det tilbake med ett trykk.
   *  Før var ⌘Z i CodeMirror den eneste veien tilbake, og ingenting i
   *  grensesnittet nevnte den. */
  const lastInnPåNytt = useCallback(async () => {
    if (!path) return;
    window.clearTimeout(timer.current);
    const mitt = buffer.ventende();
    buffer.forkast();
    try {
      const tekst = await readNote(path);
      buffer.sett(path, tekst);
      setDoc(tekst);
      setEndretUtenfor(false);
      setForkastet(mitt && mitt.tekst !== tekst ? mitt : null);
      setStatus(`Lastet inn på nytt ${klokke.format(new Date())}`);
      void les(path, tekst);
    } catch (e) {
      setFeil(feiltekst(e, "Kunne ikke laste notatet inn på nytt."));
    }
  }, [buffer, path, les]);

  /** Angre «Last inn på nytt»: sett tilbake det hun hadde skrevet. Det er
   *  hennes tekst, og den skal ikke være borte fordi hun trykket på noe. */
  const taTilbake = useCallback(() => {
    if (!forkastet || forkastet.sti !== path) return;
    buffer.endret(forkastet.tekst);
    setDoc(forkastet.tekst);
    setForkastet(null);
    setStatus("Lagrer …");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void lagre(), 900);
  }, [buffer, forkastet, path, lagre]);

  /** Brukerens egen retting av én linje. Den lagres, og panelet leses opp
   *  igjen fra den samme teksten — avsnittene er uendret, så det koster
   *  ingenting utover et oppslag. */
  const rett = useCallback(
    async (r: Retting, tekst: string) => {
      try {
        await rettAvsnitt(r);
      } catch (e) {
        setFeil(feiltekst(e, "Klarte ikke å lagre rettelsen. Linja står som den var."));
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
        setFeil(feiltekst(e, "Klarte ikke å lagre dommen din over koblingen."));
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
      setFeil(feiltekst(e, "Klarte ikke å endre om notatet leses som en samtale."));
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
      setFeil(feiltekst(e, "Klarte ikke å endre om notatet får leses."));
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
        setFeil(feiltekst(e, "Klarte ikke å lagre valget om lesning."));
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
      await åpne(p, { ferskt: true });
      setNotes(await listNotes());
      await reindex().catch(() => undefined);
    } catch (e) {
      setFeil(feiltekst(e, "Klarte ikke å lage et nytt notat."));
    }
  }, [buffer, lagre, åpne]);

  useEffect(() => {
    void (async () => {
      try {
        setNotes(await listNotes());
      } catch (e) {
        setFeil(feiltekst(e, "Klarte ikke å hente notatlista."));
      }
      // Notater kan ha kommet til utenfor appen. Feiler dette, virker alt
      // annet fortsatt, og brukeren har ingenting å gjøre med beskjeden.
      await reindex().catch(() => undefined);
      // Og hva søket kan: er ordlista ikke lastet ned, finner ikke «utstyret»
      // ordet «utstyr», og det skal stå et sted hun kan se det.
      setOrdbank(await ordbankStatus().catch(() => null));
    })();
  }, []);

  /** Beskjedene fra nedlastingen av ordlista. Den tar minutter, og et vindu
   *  som ikke sier noe på to minutter ser ødelagt ut. */
  useEffect(() => {
    const av = påOrdbank((tekst) => setOrdbankArbeid(tekst));
    return () => {
      void av.then((stopp) => stopp()).catch(() => undefined);
    };
  }, []);

  const hentOrdlista = useCallback(async () => {
    setOrdbankArbeid("Begynner …");
    try {
      setOrdbank(await lastNedOrdbank());
    } catch (e) {
      setFeil(feiltekst(e, "Klarte ikke å hente ordlista."));
    } finally {
      setOrdbankArbeid(null);
    }
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
        setFeil(feiltekst(e, "Søket virker ikke akkurat nå. Notatene dine er trygge."));
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

  /** Tøm søket, og husk det så det kan hentes tilbake. */
  const tømSøket = useCallback(() => {
    setQuery((q) => {
      if (q.trim()) setTømt(q);
      return "";
    });
    setTreff(null);
    setSpurt(null);
  }, []);

  /** De to hurtigtastene som gjelder overalt. Begge har en synlig knapp ved
   *  siden av seg — «Nytt notat» i toppen, og søkefeltet er alltid der.
   *
   *  Escape er **ikke** blant dem lenger. Den lå på `window` og tømte søket
   *  fra hvor som helst i appen, også midt i skrivingen og midt i
   *  rettingsskjemaet, og kastet fokus inn i skriveflaten etterpå. Nå
   *  håndteres den der fokus er: i søkefeltet, og i rettefeltet i panelet. */
  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      const kommando = e.metaKey || e.ctrlKey;
      if (kommando && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void nyttNotat();
      } else if (kommando && e.key.toLowerCase() === "f") {
        // Står hun i skriveflaten, mener hun notatet hun har foran seg — det
        // er hva ⌘F gjør i enhver editor, og det var det eneste søket appen
        // ikke hadde. Skriveflaten tar tasten selv; her skal den bare ikke
        // rives ut derfra og over i registersøket, som uansett står synlig
        // øverst hele tiden.
        if ((e.target as HTMLElement | null)?.closest?.(".cm-editor")) return;
        e.preventDefault();
        søkefelt.current?.focus();
        søkefelt.current?.select();
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [nyttNotat]);

  /** Piltaster i registeret. Hundre notater var hundre tabstopp; nå er lista
   *  ett stopp, og pilene flytter seg innenfor den — mønsteret alle
   *  listekontroller bruker.
   *
   *  Radene finnes gjennom DOM-en i stedet for gjennom hundre refs: lista er
   *  én `nav`, radene er `button.rad` i den, og rekkefølgen på skjermen er
   *  akkurat den rekkefølgen pilene skal følge. */
  const listetast = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const retning = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    const kant = e.key === "Home" ? 0 : e.key === "End" ? -1 : null;
    if (!retning && kant === null) return;
    const rader = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button.rad"));
    if (rader.length === 0) return;
    e.preventDefault();
    if (kant !== null) {
      (kant === 0 ? rader[0] : rader[rader.length - 1]).focus();
      return;
    }
    const nå = rader.indexOf(document.activeElement as HTMLElement);
    const neste = nå < 0 ? 0 : Math.min(rader.length - 1, Math.max(0, nå + retning));
    rader[neste]?.focus();
  }, []);

  const tomtArkiv = notes.length === 0;
  const tittel = notes.find((n) => n.path === path)?.title ?? "Notat";

  /** Radene i registeret, i den rekkefølgen de står på skjermen. Lista er
   *  ett tabstopp: én rad har `tabIndex=0`, resten −1, og pilene flytter
   *  fokus mellom dem. Hundre notater var før hundre tabstopp. */
  const radnøkler: string[] = (spurt?.treff ?? []).map((_, i) => `s${i}`);
  if (treff) radnøkler.push(...treff.treff.map((t) => `t${t.path}`));
  else if (!tomtArkiv) radnøkler.push(...notes.map((n) => `n${n.path}`));
  const stopp = fokusRad && radnøkler.includes(fokusRad) ? fokusRad : radnøkler[0];

  /** Hva søket fant, sagt i én setning. Den står i et live-område, fordi
   *  lista bytter seg ut mens hun skriver og fokus blir i søkefeltet — en
   *  blind bruker fikk aldri vite om det fantes treff. */
  const søkemelding = (() => {
    if (treff === null) return "";
    const deler = [treffmelding(treff.treff.length, treff.avkortet)];
    if (spurt) {
      deler.push(
        spurt.treff.length > 0
          ? `${spurt.treff.length} svar under «${spurt.overskrift}»`
          : `Ingen svar under «${spurt.overskrift}»`,
      );
    }
    return `${deler.join(". ")}.`;
  })();

  const søketast = (e: TastHendelse<HTMLInputElement>) => {
    if (e.key === "Escape") {
      // Escape hører hjemme her, i feltet den tømmer — ikke på `window`, der
      // den tømte søket midt i skrivingen og midt i rettingsskjemaet.
      e.preventDefault();
      tømSøket();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const første = treff?.treff[0];
      if (første) void åpne(første.path, { linjer: [første.startLine, første.endLine] });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      document.querySelector<HTMLElement>("nav.liste button.rad")?.focus();
    }
  };

  return (
    <div className="skall">
      {/* Første fokuserbare element. Uten den måtte man shift-tabbe gjennom
          hver eneste notatrad for å komme fra panelet til søket, og Escape
          var den eneste veien til skriveflaten — en hurtigtast uten knapp. */}
      <button
        className="hopp"
        onClick={() => document.querySelector<HTMLElement>(".cm-content")?.focus()}
      >
        Hopp til skriveflaten
      </button>

      <header className="topp">
        <div className="søk">
          <span className="søkfelt">
            <input
              ref={søkefelt}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={søketast}
              placeholder="Søk i notatene"
              aria-label="Søk i notatene"
              aria-keyshortcuts="Meta+F"
              title={'To ord: ett av dem. "flere ord": frase. -ord: uten. AND: begge.'}
              spellCheck={false}
            />
            {/* Et tegn uten et ord ved seg. Det er en påminnelse for øyet, og
                skjermleseren skal ikke lese «kommando F» inne i feltnavnet —
                hurtigtasten står i `aria-keyshortcuts` i stedet. */}
            {!query && <kbd aria-hidden="true">⌘F</kbd>}
          </span>
          {query ? (
            <button
              className="tøm"
              onClick={() => {
                tømSøket();
                søkefelt.current?.focus();
              }}
            >
              Vis alle
            </button>
          ) : tømt ? (
            // Escape tømte søket. Det skal gå an å få det tilbake.
            <button
              className="tøm"
              onClick={() => {
                setQuery(tømt);
                setTømt("");
                søkefelt.current?.focus();
              }}
            >
              Søk «{tømt.length > 24 ? `${tømt.slice(0, 24)}…` : tømt}» igjen
            </button>
          ) : null}
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
        {/* Etiketten bytter, og da skal det ikke stå en trykt-tilstand ved
            siden av: «Skjul forståelse, veksleknapp, aktivert» er en dobbel
            negasjon. Ordene alene sier hva knappen gjør. */}
        <button
          className={panel ? "bryter på" : "bryter"}
          onClick={() => {
            const på = !panel;
            setPanel(på);
            localStorage.setItem("forstaelse", på ? "vist" : "skjult");
            if (på && path) void les(path, buffer.nå());
          }}
        >
          {panel ? "Skjul forståelse" : "Vis forståelse"}
        </button>
        <button className="nytt" onClick={() => void nyttNotat()} aria-keyshortcuts="Meta+N">
          Nytt notat{" "}
          <kbd aria-hidden="true">⌘N</kbd>
        </button>
      </header>

      <div className={panel ? "kropp med-panel" : "kropp"}>
        <div className="spalte">
          <p className="skjult" role="status">
            {søkemelding}
          </p>
          <nav className="liste" aria-label="Notater" onKeyDown={listetast}>
            {spurt && (
              <section className="spurt">
                <h2 className="dag">{spurt.overskrift}</h2>
                <p className="spurtOm">
                  Fra det du har skrevet før, ikke fra ordene du søkte på.
                  {spurt.filter.length > 0 && ` Snevret inn med «${spurt.filter.join(", ")}».`}
                  {/* Appen har ikke noe tidsfilter. Før ble «forrige uke» til
                      to filterord, og svaret var en kort, troverdig og gal
                      liste. Nå står det hva som skjedde med dem. */}
                  {spurt.tid.length > 0 &&
                    ` Ordene «${spurt.tid.join(", ")}» handler om tid, og søket kan ikke` +
                      " begrense på tid ennå — dette er alt, uansett når det ble skrevet."}
                </p>
                {spurt.treff.length === 0 && (
                  <p className="tomt">
                    {spurt.lest === 0
                      ? "Appen har ikke lest noen notater ennå, så det finnes ikke noe å svare med. «Hva vi har forstått» må være slått på."
                      : "Ingen av linjene appen har lest passer på dette."}
                  </p>
                )}
                <ul className="rader">
                  {spurt.treff.map((t, i) => (
                    <Rad
                      key={`${t.sti}-${t.hash}-${i}`}
                      nøkkel={`s${i}`}
                      stopp={stopp}
                      valgt={false}
                      onFokus={setFokusRad}
                      onKlikk={() => void åpne(t.sti, { avsnitt: t.hash })}
                    >
                      <span className="tittel">{linjetekst(t.avsender, t.kortform)}</span>
                      {dato(t.tidspunkt) && <span className="tid">{dato(t.tidspunkt)}</span>}
                      <span className="fra">
                        {t.venter ? `venter på ${t.venter} · ` : ""}
                        {t.tittel}
                      </span>
                    </Rad>
                  ))}
                </ul>
              </section>
            )}
            {treff !== null ? (
              treff.treff.length === 0 ? (
                // Står det strukturerte svar over, er «fant ingen notater»
                // bare halve sannheten — og de to sto rett under hverandre.
                <p className="tomt">
                  {spurt && spurt.treff.length > 0
                    ? `Ingen notater har ordene «${query.trim()}» i teksten.`
                    : `Fant ingen notater med «${query.trim()}».`}
                  <span>Søket leter etter hele ord. Prøv ett ord færre, eller et annet ord.</span>
                  <SøkeSyntaks />
                </p>
              ) : (
                <section>
                  <h2 className="dag">{treffmelding(treff.treff.length, treff.avkortet)}</h2>
                  {treff.avkortet && (
                    <p className="spurtOm">
                      Det finnes flere. Skriv ett ord til for å snevre inn.
                    </p>
                  )}
                  <ul className="rader">
                    {treff.treff.map((t) => (
                      <Rad
                        key={t.path}
                        nøkkel={`t${t.path}`}
                        stopp={stopp}
                        valgt={t.path === path}
                        onFokus={setFokusRad}
                        onKlikk={() =>
                          void åpne(t.path, { linjer: [t.startLine, t.endLine] })
                        }
                      >
                        <span className="tittel">{t.title}</span>
                        {t.modified > 0 && (
                          <span className="tid">{dagsetikett(t.modified)}</span>
                        )}
                        <Utdrag tekst={t.snippet} />
                      </Rad>
                    ))}
                  </ul>
                </section>
              )
            ) : tomtArkiv ? (
              <p className="tomt">Ingen notater ennå.</p>
            ) : (
              grupper(notes).map(([etikett, rader]) => (
                <section key={etikett}>
                  <h2 className="dag">{etikett}</h2>
                  <ul className="rader">
                    {rader.map((n) => (
                      <Rad
                        key={n.path}
                        nøkkel={`n${n.path}`}
                        stopp={stopp}
                        valgt={n.path === path}
                        onFokus={setFokusRad}
                        onKlikk={() => void åpne(n.path)}
                      >
                        <span className="tittel">{n.title}</span>
                        <span className="tid">
                          {klokke.format(new Date(n.modified * 1000))}
                        </span>
                      </Rad>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </nav>
          {/* Hva søket kan. Den står nederst i registerspalten, utenfor
              rullingen, så den er der uten å ta plass fra notatene — og hun
              slipper å lure på hvorfor «utstyret» ikke finner «utstyr». */}
          {ordbank && (
            <div className="ordbank">
              <p role={ordbankArbeid ? "status" : undefined}>{ordbankArbeid ?? ordbank.tekst}</p>
              {ordbank.mangler && (
                <button onClick={() => void hentOrdlista()} disabled={ordbankArbeid !== null}>
                  {ordbankArbeid ? "Henter ordlista …" : "Last ned ordlista (15 MB)"}
                </button>
              )}
            </div>
          )}
        </div>

        <main className="ark">
          {path ? (
            <>
              {/* Notatets egen overskrift er markdown inne i skriveflaten, og
                  `#` er fjernet fra DOM-en. Dokumentet hadde derfor ingen h1,
                  og ingen overskrift å navigere til. */}
              <h1 className="skjult">{tittel}</h1>
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
                    {samtale?.er && samtale.utenAvsender > 0 &&
                      ` · ${samtale.utenAvsender} avsnitt uten avsender`}
                  </span>
                  {/* Ikke et live-område. «Lagrer …» kom ved hvert opphold i
                      skrivingen, og skjermleseren avbrøt seg selv hvert par
                      sekunder. Merket leses når hun går til det; det som
                      *må* sies — at lagringen feilet — står i feilbanneret. */}
                  {/* «Hvor mye har jeg skrevet» — det enkleste målet som
                      finnes, og det eneste som ikke krever at hun holder noe
                      ved like selv. Ikke et live-område: tallet endrer seg
                      ved hvert tastetrykk, og en skjermleser som leste det
                      ville avbrutt seg selv i ett kjør. */}
                  <span className="ordtall">
                    {tall.ord === 1 ? "1 ord" : `${tall.ord} ord`} · {tall.tegn} tegn
                  </span>
                  <span className="status">{status}</span>
                  <button className="finn" onClick={() => åpneSøkINotatet()} aria-keyshortcuts="Meta+F">
                    Finn i notatet <kbd aria-hidden="true">⌘F</kbd>
                  </button>
                  <button onClick={() => void byttSamtale()}>
                    {samtale?.er ? "Ikke en samtale" : "Dette er en samtale"}
                  </button>
                  <button onClick={() => void byttPrivat()} aria-pressed={privat}>
                    {privat ? "Kan leses" : "Aldri les dette notatet"}
                  </button>
                  {topp && (
                    <button onClick={() => setDetaljer(!detaljer)}>
                      {detaljer ? "Skjul feltene" : "Vis feltene slik de står i fila"}
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
                navn={tittel}
                onChange={skriv}
                selectTitle={nytt}
                peker={peker}
                onSamtale={() => setSamtale((f) => ({
                  er: true,
                  tvunget: "samtale",
                  deltakere: f?.deltakere ?? [],
                  utenAvsender: f?.utenAvsender ?? 0,
                }))}
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

          {/* Beskjedene står under skriveflaten, ikke over den. Satt inn over
              editoren dyttet de hele teksten nedover mens hun skrev, og linja
              hoppet under fingeren. */}
          <div className="beskjeder">
            {feil && (
              <p className="feil" role="alert">
                {feil}
                <button
                  onClick={() => {
                    setFeil(null);
                    document.querySelector<HTMLElement>(".cm-content")?.focus();
                  }}
                >
                  Lukk
                </button>
              </p>
            )}
            {endretUtenfor && (
              // «Notatet du skriver i ble endret et annet sted» er nettopp
              // meldingen som ikke skal stå i kø bak noe annet.
              <p className="feil" role="alert">
                Notatet er endret utenfor appen, og du har skrevet noe som ikke er lagret.
                <button onClick={() => void lastInnPåNytt()}>
                  Last inn på nytt, og legg det jeg skrev til side
                </button>
              </p>
            )}
            {forkastet && forkastet.sti === path && (
              <p className="feil" role="status">
                Det du hadde skrevet ({forkastet.tekst.length} tegn) er lagt til side.
                <button onClick={taTilbake}>Ta det tilbake</button>
              </p>
            )}
            {merknad && (
              <p className="feil" role="status">
                {merknad}
                <button onClick={() => setMerknad(null)}>Lukk</button>
              </p>
            )}
          </div>
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
                if ("kobling" in sist) void avvis(sist.kobling, false);
                else void rett(sist.angre, sist.angre.tekst);
              }}
              onRett={(r, tekst) => void rett(r, tekst)}
              onAvvis={(t, avvist) => void avvis(t, avvist)}
              onLukkMerknad={() =>
                setForståelse((f) => (f ? { ...f, reread: [] } : f))
              }
              onÅpne={(annen, avsnitt) => void åpne(annen, { avsnitt })}
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
