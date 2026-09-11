//! «Hva vi har forstått» — leser avsnittene i et notat og sier hva hvert av
//! dem er, og hva som bør gjøres med det.
//!
//! Taksonomien og regelen som styrer den er den som ble målt i
//! `apps/creatorhub-notes/klassifiseringstest`. Hovedfunnet derfra bestemmer
//! to ting her: modellen er den billige (Haiku), og instruksen «er du i tvil,
//! velg det som gjør minst» står i prompten, fordi det er den som gjør at
//! feilene faller i trygg retning.
//!
//! Alt som forlater prosessen ligger i [`Cli`]. Resten — oppdeling i avsnitt,
//! tolkning av svaret, hukommelsen — er ren logikk og testes uten å kalle noe.
//!
//! **Testbackend.** Klassifiseringen kjøres gjennom `claude`-kommandolinja,
//! som forutsetter at Claude Code er installert og innlogget på maskinen.
//! Ingen API-nøkkel, men heller ingenting som kan sendes videre til andre.
//! Ett kall tar rundt tretten sekunder, det meste oppstart, og det er grunnen
//! til at hukommelsen og bunkingen ikke er valgfrie.

use serde::Serialize;
use std::collections::HashMap;
use std::io::Read;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

/// Målt i klassifiseringstesten 10. september 2026. Datostempelet er med med
/// vilje: resultatet gjelder denne utgaven av modellen, ikke det aliaset
/// måtte peke på om et halvt år.
pub const MODEL: &str = "claude-haiku-4-5-20251001";

/// Den dyre modellen, brukt på den ene avgjørelsen det koster noe å ta feil
/// av. Målt i `klassifiseringstest/RELASJONER.md` 12. september 2026: Haiku
/// alene kobler 0, 30 og 40 % av de urelaterte parene over tre kjøringer;
/// med denne som annenlesning faller det til 0, 0 og 10 %.
pub const STOR_MODEL: &str = "claude-sonnet-5";

/// Romslig: tretten sekunder er normalen for en håndfull avsnitt, og et helt
/// notat på én gang er tregere. Overskrides den, er panelet av — ingen får se
/// en feilmelding for det.
const TIMEOUT: Duration = Duration::from_secs(120);

/// Taksonomien, ordrett fra `klassifiseringstest/README.md`, pluss kortformen
/// som er det eneste nye. Regelen om tvil står sist fordi den er den som skal
/// vinne når resten er uklart.
const SYSTEM: &str = "\
Du leser ett notat, avsnitt for avsnitt, og sier hva hvert avsnitt er og hva som \
bør gjøres med det. Du skal ikke skrive notatet videre, ikke foreslå noe, og ikke \
lage innhold.

Type — hva avsnittet er:
beslutning   Avgjort, skal handles på. «Vi skal ha innlogging.»
spørsmål     Åpent, ingen retning valgt. «Trenger vi egentlig innlogging?»
tvil         Heller mot noe, men usikker. «Kanskje depositum, men det kan gjøre terskelen for høy.»
gjengivelse  Refererer andres syn. «Kunden ønsker innlogging.»
uenighet     Tar avstand fra et standpunkt. «Kunden vil ha det, men jeg er uenig.»
begrensning  Sier hvordan, ikke hva. «Det må være bestemorvennlig.»
observasjon  Konstaterer, uten retning. «Jeg ser ikke timelinen.»
meta         Om arbeidet, ikke innholdet. «Si ifra når det er klart.»
oppgave      Noe som skal gjøres, av deg eller noen andre. Ikke en beslutning om hva som skal lages. «Vi må få prototypen godkjent før vi kan begynne produksjonen.»

Handling — hva som bør gjøres:
bygg          Utvid modellen. Dette er bestemt.
hold          Noter som mulighet. Ikke rør hovedflyten.
marker_åpent  Registrer som ubesvart spørsmål.
ingenting     Gjør ingenting.

En oppgave har alltid handlingen `ingenting`. Den noteres fordi den er nevnt, \
ikke fordi modellen skal utvides.

Å bygge på noe brukeren ikke har bestemt seg for er den dyreste feilen. Den \
produserer arbeid ingen har bedt om, og brukeren må oppdage det selv. Motsatt \
feil koster ingenting. Er du i tvil, velg det som gjør minst.

Kortform: én kort norsk substantivfrase som fanger hva avsnittet slår fast eller \
spør om. Naken og konkret — ikke en setning om brukeren.
«Jeg vil lage en app der folk kan låne verktøy av hverandre» → App for å låne verktøy mellom privatpersoner
«Først ser man et kart med tilgjengelig verktøy i nærheten» → Kartvisning
«Kanskje vi burde ha depositum, men jeg er usikker» → Depositum

Venter en oppgave på at noe annet skjer først, skriv det etter en venstrepil \
sist i kortformen — kort, som en substantivfrase, uten «venter på»:
«Vi må få prototypen godkjent før vi kan begynne produksjonen» → Starte produksjon ← godkjent prototype
Bare oppgaver kan ha pil, og høyst én.

Svar med nøyaktig én linje per avsnitt, og ingenting annet:
<nummer>|<type>|<handling>|<kortform>";

const KINDS: [&str; 9] = [
    "beslutning",
    "spørsmål",
    "tvil",
    "gjengivelse",
    "uenighet",
    "begrensning",
    "observasjon",
    "meta",
    "oppgave",
];
const ACTIONS: [&str; 4] = ["bygg", "hold", "marker_åpent", "ingenting"];

/// Ett avsnitt slik panelet får det.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Paragraph {
    /// Posisjon i dokumentet, talt i UTF-16-enheter — det er slik JavaScript
    /// og CodeMirror teller. Byte-posisjoner ville bommet med ett tegn per
    /// æ, ø og å, og panelet ville markert feil sted.
    pub start: usize,
    pub end: usize,
    /// Avsnittsteksten som nøkkel. Det er den rettelser henger på, og den er
    /// stabil så lenge teksten er det — endres avsnittet, er det en ny linje.
    pub hash: String,
    /// Avsnittet slik det står. Panelet viser det ikke, men en rettelse
    /// lagres sammen med teksten den gjaldt.
    pub text: String,
    pub summary: String,
    pub kind: String,
    pub action: String,
    /// Bare oppgaver: hva oppgaven venter på, om modellen leste det ut.
    pub dependency: Option<String>,
    /// Brukerens egen retting, når hun har gjort en. Den vinner over
    /// klassifiseringen i panelet.
    pub correction: Option<crate::rettelser::Rettelse>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Understanding {
    /// Falsk når det ikke finnes noen nøkkel i miljøet. Da viser panelet én
    /// rolig linje, og resten av appen merker ingenting.
    pub on: bool,
    pub paragraphs: Vec<Paragraph>,
    /// Rettelser som gjaldt avsnitt som siden er skrevet om. Panelet sier
    /// ifra én gang, med brukerens egne ord, at linja er lest på nytt.
    pub reread: Vec<String>,
    /// Det hun har tenkt om det samme før. Tom til svarene kommer.
    pub earlier: Vec<crate::minne::Tidligere>,
}

impl Understanding {
    pub fn off() -> Self {
        Understanding {
            on: false,
            paragraphs: Vec::new(),
            reread: Vec::new(),
            earlier: Vec::new(),
        }
    }
    pub fn on(paragraphs: Vec<Paragraph>, reread: Vec<String>) -> Self {
        Understanding { on: true, paragraphs, reread, earlier: Vec::new() }
    }
}

/// Klassifiseringen av ett avsnitt.
#[derive(Clone, Debug, PartialEq)]
pub struct Label {
    pub kind: String,
    pub action: String,
    pub summary: String,
    pub dependency: Option<String>,
}

/// Ett avsnitt med posisjonen sin i dokumentet.
#[derive(Debug, PartialEq)]
pub struct Chunk {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

/// Alt som kan klassifisere. Ett kall for hele bunken, aldri ett per avsnitt.
/// Svaret er rå tekst, slik at tolkningen kan testes for seg.
pub trait Classifier {
    fn ask(&self, texts: &[String]) -> Result<String, String>;
}

/// Hash → klassifisering. Nøkkelen er avsnittsteksten, ikke notatet, så et
/// avsnitt som ikke er endret aldri klassifiseres på nytt.
pub type Memo = HashMap<u64, Label>;

/// Én hukommelse for hele appen, på tvers av notater. Den er bare det raske
/// laget: det som står her ligger også i `forstatt`-tabellen, og det er den
/// som gjør at forståelsen overlever at appen lukkes.
pub fn memo() -> &'static Mutex<Memo> {
    static M: OnceLock<Mutex<Memo>> = OnceLock::new();
    M.get_or_init(Default::default)
}

/// Nøkkelen en rettelse lagres under.
pub fn nøkkel(tekst: &str) -> String {
    format!("{:016x}", hash(tekst))
}

fn utf16_len(s: &str) -> usize {
    s.encode_utf16().count()
}

/// FNV-1a. Kort, stabil og nok til å kjenne igjen et avsnitt som ikke er
/// endret — ikke en sikkerhetsfunksjon.
pub fn hash(s: &str) -> u64 {
    let mut h: u64 = 1469598103934665603;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    h
}

/// Linjer i toppfeltblokka (`---` … `---`), som ikke er noe brukeren har
/// tenkt og derfor ikke skal klassifiseres.
fn frontmatter_lines(doc: &str) -> usize {
    let mut lines = doc.split('\n');
    if lines.next().map(str::trim) != Some("---") {
        return 0;
    }
    for (i, line) in lines.enumerate() {
        if line.trim() == "---" {
            return i + 2;
        }
    }
    0 // uavsluttet blokk: heller lese for mye enn å stryke hele notatet
}

/// Overskrifter er struktur, ikke påstander, og et helt ferskt notat har bare
/// «# Uten tittel». Ett tegn eller to er heller ikke en tanke.
fn worth_reading(text: &str) -> bool {
    text.trim().chars().count() >= 3 && !text.lines().all(|l| l.trim_start().starts_with('#'))
}

fn flush(buf: &mut Vec<&str>, start: usize, end: usize, out: &mut Vec<Chunk>) {
    if buf.is_empty() {
        return;
    }
    let text = buf.join("\n");
    buf.clear();
    if worth_reading(&text) {
        out.push(Chunk { start, end, text });
    }
}

/// Deler notatet i avsnitt på tomme linjer, med posisjon i UTF-16-enheter.
pub fn split(doc: &str) -> Vec<Chunk> {
    let skip = frontmatter_lines(doc);
    let mut out = Vec::new();
    let mut pos = 0usize;
    let mut start = 0usize;
    let mut end = 0usize;
    let mut buf: Vec<&str> = Vec::new();

    for (i, line) in doc.split('\n').enumerate() {
        let width = utf16_len(line);
        if i >= skip {
            if line.trim().is_empty() {
                flush(&mut buf, start, end, &mut out);
            } else {
                if buf.is_empty() {
                    start = pos;
                }
                buf.push(line);
                end = pos + width;
            }
        }
        pos += width + 1; // linjeskiftet
    }
    flush(&mut buf, start, end, &mut out);
    out
}

/// Tolker modellsvaret. Tåler rusk rundt: innledning, kodegjerder, punktlister
/// og etterprat. En linje som ikke er en gyldig klassifisering hoppes over —
/// avsnittet blir stående uten merke, som er den trygge utgangen.
pub fn parse(answer: &str, count: usize) -> Vec<Option<Label>> {
    let mut out = vec![None; count];
    for line in answer.lines() {
        let line = line.trim().trim_start_matches("```").trim();
        let line = line
            .strip_prefix("- ")
            .or_else(|| line.strip_prefix("* "))
            .unwrap_or(line);
        let mut parts = line.splitn(4, '|');
        let (Some(n), Some(kind), Some(action), Some(summary)) =
            (parts.next(), parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        let n = n.trim().trim_end_matches(['.', ')']).trim();
        let Ok(n) = n.parse::<usize>() else { continue };
        let kind = kind.trim().to_lowercase();
        let action = action.trim().to_lowercase();
        let summary = summary.trim().trim_matches('«').trim_matches('»').trim();
        if n == 0 || n > count || summary.is_empty() {
            continue;
        }
        if !KINDS.contains(&kind.as_str()) || !ACTIONS.contains(&action.as_str()) {
            continue;
        }
        let (summary, dependency) = del_avhengighet(summary);
        out[n - 1] = Some(Label { kind, action, summary, dependency });
    }
    out
}

/// Skiller «Starte produksjon ← godkjent prototype» i kortform og avhengighet.
///
/// Avhengigheten rir inne i det siste feltet, ikke i et femte felt. Det er
/// bevisst: `parse` deler linja i nøyaktig fire, slik at en kortform selv kan
/// inneholde `|`. Et femte felt ville tatt den friheten fra kortformen.
fn del_avhengighet(s: &str) -> (String, Option<String>) {
    for pil in ["←", "<-"] {
        if let Some((kort, venter)) = s.split_once(pil) {
            let (kort, venter) = (kort.trim(), venter.trim());
            if !kort.is_empty() && !venter.is_empty() {
                return (kort.to_string(), Some(venter.to_string()));
            }
        }
    }
    (s.to_string(), None)
}

/// Leser notatet. Bare avsnitt hukommelsen ikke kjenner sendes, og de sendes
/// i én forespørsel — skriver brukeren videre på siste avsnitt, er det bare
/// det ene som koster noe.
pub fn understand(
    doc: &str,
    classifier: &dyn Classifier,
    memo: &mut Memo,
) -> Result<Vec<Paragraph>, String> {
    let chunks = split(doc);
    let keys: Vec<u64> = chunks.iter().map(|c| hash(&c.text)).collect();

    // Ett avsnitt per ukjent tekst. To like avsnitt er én klassifisering, ikke
    // to — hukommelsen slår opp på teksten, ikke på plasseringen.
    let mut seen = std::collections::HashSet::new();
    let missing: Vec<usize> = (0..chunks.len())
        .filter(|i| !memo.contains_key(&keys[*i]) && seen.insert(keys[*i]))
        .collect();

    if !missing.is_empty() {
        let texts: Vec<String> = missing.iter().map(|i| chunks[*i].text.clone()).collect();
        let labels = parse(&classifier.ask(&texts)?, texts.len());
        // ponytail: tømmes helt når den blir stor. En LRU er riktig svar først
        // om noen faktisk har titusenvis av avsnitt åpne i én økt.
        if memo.len() > 4000 {
            memo.clear();
        }
        for (slot, label) in missing.iter().zip(labels) {
            if let Some(label) = label {
                memo.insert(keys[*slot], label);
            }
        }
    }

    Ok(chunks
        .into_iter()
        .zip(&keys)
        .filter_map(|(chunk, key)| {
            let label = memo.get(key)?;
            Some(Paragraph {
                start: chunk.start,
                end: chunk.end,
                hash: nøkkel(&chunk.text),
                summary: label.summary.clone(),
                kind: label.kind.clone(),
                action: label.action.clone(),
                dependency: label.dependency.clone(),
                text: chunk.text,
                correction: None,
            })
        })
        .collect())
}

// ---- kommandolinja -----------------------------------------------------

/// Kommandolinja, med de rettelsene brukeren har gjort til nå. De legges ved
/// prompten som eksempler: har hun rettet «bestemorvennlig» én gang, skal
/// neste krav av samme slag lande riktig uten at hun retter det igjen.
pub struct Cli {
    pub eksempler: Vec<crate::minne::Eksempel>,
}

impl Cli {
    pub fn new(eksempler: Vec<crate::minne::Eksempel>) -> Self {
        Cli { eksempler }
    }
}

/// Hvor `claude` ligger. En app startet fra Finder arver ikke skallets PATH,
/// så de vanlige stedene sjekkes direkte før vi håper på PATH.
fn binary() -> std::path::PathBuf {
    if let Ok(p) = std::env::var("CREATORHUB_CLAUDE_BIN") {
        if !p.is_empty() {
            return p.into();
        }
    }
    let home = std::env::var("HOME").unwrap_or_default();
    for kandidat in [
        format!("{home}/.local/bin/claude"),
        "/opt/homebrew/bin/claude".to_string(),
        "/usr/local/bin/claude".to_string(),
    ] {
        let sti = std::path::PathBuf::from(kandidat);
        if sti.exists() {
            return sti;
        }
    }
    "claude".into()
}

pub fn prompt(texts: &[String], eksempler: &[crate::minne::Eksempel]) -> String {
    let avsnitt = texts
        .iter()
        .enumerate()
        .map(|(i, t)| format!("{}. {t}", i + 1))
        .collect::<Vec<_>>()
        .join("\n\n");

    // Rettelsene står etter taksonomien og før avsnittene: de er unntakene fra
    // regelen, og gir bare mening når regelen alt er lest.
    let lært = if eksempler.is_empty() {
        String::new()
    } else {
        let linjer = eksempler
            .iter()
            .map(|e| format!("«{}»\ndu svarte {}, hun rettet det til {}", e.tekst, e.lest, e.rettet))
            .collect::<Vec<_>>()
            .join("\n\n");
        format!(
            "\n\nBrukeren har rettet disse tidligere. Ligner et avsnitt på et av dem, \
             følg rettelsen hennes:\n\n{linjer}"
        )
    };

    format!("{SYSTEM}{lært}\n\nAvsnittene:\n\n{avsnitt}")
}

/// Ett kall til kommandolinja. Ingen verktøy, ingen arbeidskatalog med et
/// git-repo i: kommandoen skal lese en prompt og skrive tekst, ingenting
/// annet.
pub fn kjør(model: &str, prompt: &str) -> Result<String, String> {
    let mut barn = std::process::Command::new(binary())
        .args(["-p", "--model", model, "--output-format", "text"])
        .arg(prompt)
        .current_dir(std::env::temp_dir())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("startet ikke: {e}"))?;

    let mut ut = barn.stdout.take().ok_or("ingen utdata")?;
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut s = String::new();
        let _ = ut.read_to_string(&mut s);
        let _ = tx.send(s);
    });

    match rx.recv_timeout(TIMEOUT) {
        Ok(svar) => {
            let _ = barn.wait();
            Ok(svar)
        }
        Err(_) => {
            let _ = barn.kill();
            let _ = barn.wait();
            Err("tok for lang tid".into())
        }
    }
}

impl Classifier for Cli {
    fn ask(&self, texts: &[String]) -> Result<String, String> {
        kjør(MODEL, &prompt(texts, &self.eksempler))
    }
}

/// Samme kommandolinje, annen prompt: hva forholdet er mellom et avsnitt hun
/// skriver nå og ett hun skrev før.
///
/// To lesninger, og grunnen er målt. Haiku mister nesten aldri et ekte
/// forhold, men den kobler for mye — og en falsk kobling er den ene feilen som
/// ødelegger funksjonen. Derfor dømmer Haiku alt, og bare parene den faktisk
/// koblet leses en gang til av den dyre modellen. Et par Haiku kalte urelatert
/// er ferdig der, og koster ingenting mer.
impl crate::minne::Dommer for Cli {
    fn døm(&self, par: &[(String, String)]) -> Result<String, String> {
        let svar = kjør(MODEL, &crate::minne::relasjonsprompt(par))?;
        let koblet: Vec<usize> = crate::minne::parse_forhold(&svar, par.len())
            .into_iter()
            .enumerate()
            .filter(|(_, f)| f.as_deref().is_some_and(|f| f != crate::minne::URELATERT))
            .map(|(i, _)| i)
            .collect();
        if koblet.is_empty() {
            return Ok(svar);
        }

        let delmengde: Vec<(String, String)> = koblet.iter().map(|i| par[*i].clone()).collect();
        // Feiler annenlesningen, feiler hele dømmingen. Det er med vilje:
        // ingenting lagres, og parene prøves igjen senere. Å slippe gjennom
        // Haikus egne koblinger ville vært å vise brukeren nøyaktig den støyen
        // annenlesningen finnes for.
        let stor = kjør(STOR_MODEL, &crate::minne::relasjonsprompt(&delmengde))?;
        let dom = crate::minne::parse_forhold(&stor, delmengde.len());
        Ok(crate::minne::slå_sammen(par.len(), &koblet, &dom))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// Falsk klassifikator, etter mønster av `FakeEmbedder` i indekseren:
    /// deterministisk, aldri nettverk, og teller hva den ble spurt om.
    struct Fake {
        calls: AtomicUsize,
        texts: Mutex<Vec<Vec<String>>>,
    }

    impl Fake {
        fn new() -> Self {
            Fake { calls: AtomicUsize::new(0), texts: Mutex::new(Vec::new()) }
        }
        fn last(&self) -> Vec<String> {
            self.texts.lock().unwrap().last().cloned().unwrap_or_default()
        }
    }

    impl Classifier for Fake {
        fn ask(&self, texts: &[String]) -> Result<String, String> {
            self.calls.fetch_add(1, Ordering::Relaxed);
            self.texts.lock().unwrap().push(texts.to_vec());
            Ok(texts
                .iter()
                .enumerate()
                .map(|(i, t)| {
                    let ord = t.split_whitespace().next().unwrap_or("x");
                    format!("{}|beslutning|bygg|{ord}", i + 1)
                })
                .collect::<Vec<_>>()
                .join("\n"))
        }
    }

    #[test]
    fn kortform_og_klassifisering_leses_ut_av_svaret() {
        let svar = "1|beslutning|bygg|App for å låne verktøy mellom privatpersoner\n\
                    2|tvil|hold|Depositum\n\
                    3|spørsmål|marker_åpent|Innlogging";
        let ut = parse(svar, 3);
        assert_eq!(
            ut[0],
            Some(Label {
                kind: "beslutning".into(),
                action: "bygg".into(),
                summary: "App for å låne verktøy mellom privatpersoner".into(),
                dependency: None,
            })
        );
        assert_eq!(ut[1].as_ref().unwrap().action, "hold");
        assert_eq!(ut[2].as_ref().unwrap().kind, "spørsmål");
    }

    #[test]
    fn rusk_rundt_svaret_hoppes_over() {
        let svar = "Her er klassifiseringen:\n\
                    \n\
                    ```\n\
                    1. | Beslutning | Bygg | Kartvisning\n\
                    - 2|tvil|hold|Depositum\n\
                    dette er ikke en linje i det hele tatt\n\
                    3|spørsmål|marker_åpent|Innlogging | ja eller nei\n\
                    4|finnesikke|bygg|Skal ikke telle\n\
                    9|beslutning|bygg|Utenfor rekkevidde\n\
                    ```\n\
                    Håper det hjelper!";
        let ut = parse(svar, 4);
        assert_eq!(ut[0].as_ref().unwrap().summary, "Kartvisning");
        assert_eq!(ut[0].as_ref().unwrap().kind, "beslutning", "store bokstaver skal tåles");
        assert_eq!(ut[1].as_ref().unwrap().summary, "Depositum");
        assert_eq!(
            ut[2].as_ref().unwrap().summary,
            "Innlogging | ja eller nei",
            "kortformen kan selv inneholde |"
        );
        assert!(ut[3].is_none(), "ukjent type skal ikke bli en linje i panelet");
    }

    #[test]
    fn uendret_avsnitt_gir_null_nye_kall() {
        let doc = "---\nid: x\n---\n\n# Tittel\n\nFørste tanke her.\n\nAndre tanke her.\n";
        let fake = Fake::new();
        let mut memo = Memo::new();

        let første = understand(doc, &fake, &mut memo).unwrap();
        assert_eq!(første.len(), 2, "overskrift og toppfelt skal ikke klassifiseres");
        assert_eq!(fake.calls.load(Ordering::Relaxed), 1, "alle avsnitt i én forespørsel");

        let igjen = understand(doc, &fake, &mut memo).unwrap();
        assert_eq!(fake.calls.load(Ordering::Relaxed), 1, "ingenting er endret");
        assert_eq!(igjen.len(), 2);
    }

    #[test]
    fn endret_avsnitt_gir_nøyaktig_ett() {
        let doc = "# Tittel\n\nFørste tanke her.\n\nAndre tanke her.\n";
        let fake = Fake::new();
        let mut memo = Memo::new();
        understand(doc, &fake, &mut memo).unwrap();

        let endret = "# Tittel\n\nFørste tanke her.\n\nAndre tanke her, og litt til.\n";
        understand(endret, &fake, &mut memo).unwrap();

        assert_eq!(fake.calls.load(Ordering::Relaxed), 2);
        assert_eq!(
            fake.last(),
            vec!["Andre tanke her, og litt til.".to_string()],
            "bare det endrede avsnittet skal sendes"
        );
    }

    /// Uten `claude` på maskinen — eller når kallet feiler av en hvilken som
    /// helst grunn — skal panelet vise av-tilstanden, og ingenting annet i
    /// appen skal merke det.
    #[test]
    fn uten_claude_er_forståelsen_av() {
        struct Nekter;
        impl Classifier for Nekter {
            fn ask(&self, _: &[String]) -> Result<String, String> {
                Err("startet ikke".into())
            }
        }
        let mut memo = Memo::new();
        assert!(understand("En tanke her.", &Nekter, &mut memo).is_err());
        assert!(memo.is_empty(), "et mislykket kall skal ikke etterlate seg noe");

        let av = Understanding::off();
        assert!(!av.on);
        assert!(av.paragraphs.is_empty());
    }

    /// Prompten skal bære taksonomien og regelen, og avsnittene skal være
    /// nummerert slik svaret refererer til dem.
    #[test]
    fn prompten_har_taksonomien_regelen_og_nummererte_avsnitt() {
        let p = prompt(&["Vi skal ha innlogging.".into(), "Kanskje depositum.".into()], &[]);
        assert!(p.contains("velg det som gjør minst"));
        assert!(p.contains("marker_åpent"));
        assert!(p.contains("<nummer>|<type>|<handling>|<kortform>"));
        assert!(p.contains("1. Vi skal ha innlogging."));
        assert!(p.contains("2. Kanskje depositum."));
    }

    /// Sløyfa som gjør at appen kjenner *henne* og ikke bare språket: har hun
    /// rettet en linje, står rettelsen i prompten neste gang.
    #[test]
    fn en_rettelse_står_som_eksempel_i_neste_prompt() {
        let eksempler = vec![crate::minne::Eksempel {
            tekst: "ux og ui må være bestemorvennlig".into(),
            lest: "begrensning|hold|Bestemorvennlig grensesnitt".into(),
            rettet: "beslutning|bygg|Bestemorvennlig grensesnitt".into(),
        }];
        let p = prompt(&["Det må være enkelt nok for mor.".into()], &eksempler);
        assert!(p.contains("ux og ui må være bestemorvennlig"));
        assert!(p.contains("du svarte begrensning|hold|Bestemorvennlig grensesnitt"));
        assert!(p.contains("hun rettet det til beslutning|bygg|Bestemorvennlig grensesnitt"));
        assert!(p.contains("velg det som gjør minst"), "regelen skal fortsatt stå");

        // Uten rettelser skal prompten være nøyaktig som før.
        assert!(!prompt(&["En tanke.".into()], &[]).contains("rettet det til"));
    }

    #[test]
    fn posisjonen_peker_på_riktig_avsnitt_selv_når_flere_er_like() {
        // Tre avsnitt med samme tekst, og æ/ø/å foran dem: bommer tellingen
        // med ett tegn per bokstav, markerer panelet feil sted.
        let doc = "Vi må også avklare størrelsen.\n\nSamme tekst.\n\nSamme tekst.\n\nSamme tekst.\n";
        let biter = split(doc);
        assert_eq!(biter.len(), 4);

        let enheter: Vec<u16> = doc.encode_utf16().collect();
        for bit in &biter {
            let utsnitt = String::from_utf16(&enheter[bit.start..bit.end]).unwrap();
            assert_eq!(utsnitt, bit.text);
        }
        assert_ne!(biter[1].start, biter[2].start);
        assert_ne!(biter[2].start, biter[3].start);

        // Og hele veien gjennom: hvert avsnitt beholder sin egen posisjon selv
        // om hukommelsen gjenbruker det samme merket for alle tre.
        let fake = Fake::new();
        let mut memo = Memo::new();
        let ut = understand(doc, &fake, &mut memo).unwrap();
        assert_eq!(ut.len(), 4);
        assert_eq!(fake.last().len(), 2, "like avsnitt sendes bare én gang");
        let starter: std::collections::HashSet<usize> = ut.iter().map(|p| p.start).collect();
        assert_eq!(starter.len(), 4, "hvert avsnitt beholder sin egen posisjon");
    }

    /// Den ene testen som faktisk kaller `claude`. Den kjøres ikke med de
    /// andre — den tar sekunder og krever en innlogget maskin:
    ///
    ///     cargo test -- --ignored ekte_kall
    #[test]
    #[ignore = "kaller claude-kommandolinja"]
    fn ekte_kall_gir_formatet_panelet_venter_seg() {
        let tekster = vec![
            "Jeg vil utvikle en app der folk kan låne verktøy av hverandre.".to_string(),
            "Kanskje vi burde ha depositum, men jeg er usikker.".to_string(),
            "Kunden ønsker innlogging, men jeg er uenig.".to_string(),
        ];
        let svar = Cli::new(Vec::new()).ask(&tekster).expect("claude svarte ikke");
        let ut = parse(&svar, 3);
        eprintln!("{svar}");
        assert!(ut.iter().all(Option::is_some), "alle tre skal ha et merke");
        assert_eq!(ut[0].as_ref().unwrap().action, "bygg");
        assert_ne!(ut[1].as_ref().unwrap().action, "bygg", "tvil skal ikke bygges på");
        assert_ne!(ut[2].as_ref().unwrap().action, "bygg", "uenighet skal ikke bygges på");
    }

    #[test]
    fn oppgave_leses_med_og_uten_avhengighet() {
        let svar = "1|oppgave|ingenting|Starte produksjon ← godkjent prototype\n\
                    2|oppgave|ingenting|Ringe fotografen";
        let ut = parse(svar, 2);
        let a = ut[0].as_ref().unwrap();
        assert_eq!(a.kind, "oppgave");
        assert_eq!(a.summary, "Starte produksjon");
        assert_eq!(a.dependency.as_deref(), Some("godkjent prototype"));
        let b = ut[1].as_ref().unwrap();
        assert_eq!(b.summary, "Ringe fotografen");
        assert_eq!(b.dependency, None, "en oppgave uten pil venter ikke på noe");
    }

    /// Samme svar, men med alt ruskete en modell kan finne på rundt seg — og
    /// med `<-` i stedet for pilen, som er den nærliggende varianten.
    #[test]
    fn oppgave_leses_også_ut_av_et_ruskete_svar() {
        let svar = "Klart! Her kommer linjene:\n\
                    ```\n\
                    - 1. | Oppgave | Ingenting | Starte produksjon <- godkjent prototype\n\
                    2|oppgave|ingenting|Sende faktura | purring hvis den ikke betales\n\
                    ```\n";
        let ut = parse(svar, 2);
        let a = ut[0].as_ref().unwrap();
        assert_eq!(a.summary, "Starte produksjon");
        assert_eq!(a.dependency.as_deref(), Some("godkjent prototype"));
        assert_eq!(
            ut[1].as_ref().unwrap().summary,
            "Sende faktura | purring hvis den ikke betales",
            "kortformen kan fortsatt inneholde |"
        );
    }

    #[test]
    fn avsnitt_har_nøkkel_og_tekst_med_seg() {
        let doc = "Første tanke her.\n\nAndre tanke her.\n";
        let fake = Fake::new();
        let mut memo = Memo::new();
        let ut = understand(doc, &fake, &mut memo).unwrap();
        assert_eq!(ut[0].text, "Første tanke her.");
        assert_eq!(ut[0].hash, nøkkel("Første tanke her."));
        assert_ne!(ut[0].hash, ut[1].hash);
        assert_ne!(
            nøkkel("Andre tanke her."),
            nøkkel("Andre tanke her, og litt til."),
            "endret tekst er en ny nøkkel"
        );
    }

    #[test]
    fn toppfelt_og_overskrifter_leses_ikke() {
        let doc = "---\nid: 2026-09-10-x\ntype: \n---\n\n# Uten tittel\n\nEn ekte tanke.\n";
        let biter = split(doc);
        assert_eq!(biter.len(), 1);
        assert_eq!(biter[0].text, "En ekte tanke.");
    }
}
