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

Handling — hva som bør gjøres:
bygg          Utvid modellen. Dette er bestemt.
hold          Noter som mulighet. Ikke rør hovedflyten.
marker_åpent  Registrer som ubesvart spørsmål.
ingenting     Gjør ingenting.

Å bygge på noe brukeren ikke har bestemt seg for er den dyreste feilen. Den \
produserer arbeid ingen har bedt om, og brukeren må oppdage det selv. Motsatt \
feil koster ingenting. Er du i tvil, velg det som gjør minst.

Kortform: én kort norsk substantivfrase som fanger hva avsnittet slår fast eller \
spør om. Naken og konkret — ikke en setning om brukeren.
«Jeg vil lage en app der folk kan låne verktøy av hverandre» → App for å låne verktøy mellom privatpersoner
«Først ser man et kart med tilgjengelig verktøy i nærheten» → Kartvisning
«Kanskje vi burde ha depositum, men jeg er usikker» → Depositum

Svar med nøyaktig én linje per avsnitt, og ingenting annet:
<nummer>|<type>|<handling>|<kortform>";

const KINDS: [&str; 8] = [
    "beslutning",
    "spørsmål",
    "tvil",
    "gjengivelse",
    "uenighet",
    "begrensning",
    "observasjon",
    "meta",
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
    pub summary: String,
    pub kind: String,
    pub action: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Understanding {
    /// Falsk når det ikke finnes noen nøkkel i miljøet. Da viser panelet én
    /// rolig linje, og resten av appen merker ingenting.
    pub on: bool,
    pub paragraphs: Vec<Paragraph>,
}

impl Understanding {
    pub fn off() -> Self {
        Understanding { on: false, paragraphs: Vec::new() }
    }
    pub fn on(paragraphs: Vec<Paragraph>) -> Self {
        Understanding { on: true, paragraphs }
    }
}

/// Klassifiseringen av ett avsnitt.
#[derive(Clone, Debug, PartialEq)]
pub struct Label {
    pub kind: String,
    pub action: String,
    pub summary: String,
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

/// Én hukommelse for hele appen, på tvers av notater.
///
/// ponytail: lever bare mens appen kjører. Å legge den i sqlite ville spart
/// én runde per notat etter omstart — verdt det først om oppstart blir dyrt.
pub fn memo() -> &'static Mutex<Memo> {
    static M: OnceLock<Mutex<Memo>> = OnceLock::new();
    M.get_or_init(Default::default)
}

fn utf16_len(s: &str) -> usize {
    s.encode_utf16().count()
}

fn hash(s: &str) -> u64 {
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
        out[n - 1] = Some(Label { kind, action, summary: summary.to_string() });
    }
    out
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
                summary: label.summary.clone(),
                kind: label.kind.clone(),
                action: label.action.clone(),
            })
        })
        .collect())
}

// ---- kommandolinja -----------------------------------------------------

pub struct Cli;

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

pub fn prompt(texts: &[String]) -> String {
    let avsnitt = texts
        .iter()
        .enumerate()
        .map(|(i, t)| format!("{}. {t}", i + 1))
        .collect::<Vec<_>>()
        .join("\n\n");
    format!("{SYSTEM}\n\nAvsnittene:\n\n{avsnitt}")
}

impl Classifier for Cli {
    fn ask(&self, texts: &[String]) -> Result<String, String> {
        // Ingen verktøy, ingen arbeidskatalog med et git-repo i: kommandoen
        // skal lese en prompt og skrive tekst, ingenting annet.
        let mut barn = std::process::Command::new(binary())
            .args(["-p", "--model", MODEL, "--output-format", "text"])
            .arg(prompt(texts))
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
        let p = prompt(&["Vi skal ha innlogging.".into(), "Kanskje depositum.".into()]);
        assert!(p.contains("velg det som gjør minst"));
        assert!(p.contains("marker_åpent"));
        assert!(p.contains("<nummer>|<type>|<handling>|<kortform>"));
        assert!(p.contains("1. Vi skal ha innlogging."));
        assert!(p.contains("2. Kanskje depositum."));
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
        let svar = Cli.ask(&tekster).expect("claude svarte ikke");
        let ut = parse(&svar, 3);
        eprintln!("{svar}");
        assert!(ut.iter().all(Option::is_some), "alle tre skal ha et merke");
        assert_eq!(ut[0].as_ref().unwrap().action, "bygg");
        assert_ne!(ut[1].as_ref().unwrap().action, "bygg", "tvil skal ikke bygges på");
        assert_ne!(ut[2].as_ref().unwrap().action, "bygg", "uenighet skal ikke bygges på");
    }

    #[test]
    fn toppfelt_og_overskrifter_leses_ikke() {
        let doc = "---\nid: 2026-09-10-x\ntype: \n---\n\n# Uten tittel\n\nEn ekte tanke.\n";
        let biter = split(doc);
        assert_eq!(biter.len(), 1);
        assert_eq!(biter[0].text, "En ekte tanke.");
    }
}
