//! Samtaleimport — en limt Slack-tråd, e-posttråd eller et møtetranskript blir
//! til innlegg med avsender.
//!
//! Ingenting her er et parallelt system ved siden av notatene. En importert
//! samtale er en fil i notatmappa, som alt annet: ett innlegg per avsnitt,
//! skrevet som «Navn (10:32): det personen sa». Da er den lesbar uten appen,
//! `understand::split` deler den i avsnitt uten å vite noe om samtaler, og
//! `avsnitt.avsender` — kolonnen som har stått ubrukt siden identitetsrunden —
//! er det eneste nye som lagres.
//!
//! **Gjenkjenningen er regelbasert.** Den kjører på innliming og må være
//! umiddelbar; et modellkall ville lagt tretten sekunder mellom ⌘V og teksten.
//!
//! **Presisjon foran dekning.** En feiltolket samtale er verre enn en
//! uoppdaget: kjenner vi den ikke igjen, står teksten som et vanlig notat, og
//! brukeren merker ingenting. Deler vi et notat i innlegg som ikke finnes, får
//! hun et panel fullt av påstander om hvem som sa hva. Derfor kreves tre ting
//! samtidig — nok innlegg, minst to avsendere der én tar ordet mer enn én
//! gang, og at nesten hele teksten faktisk er innlegg — og derfor finnes
//! [`STOPPORD`], som holder «Konklusjon:» og «Fra:» utenfor.
//!
//! Bommer den likevel, kan brukeren overstyre begge veier. Valget står i
//! toppfeltet (`kilde: samtale` eller `kilde: notat`) og overlever i fila.

use serde::Serialize;
use std::collections::HashMap;

/// Ett innlegg i en samtale.
#[derive(Clone, Debug, PartialEq)]
pub struct Innlegg {
    pub avsender: String,
    /// Klokkeslettet, når kilden hadde ett. Det bæres videre til fila, slik at
    /// importen ikke kaster bort noe brukeren limte inn.
    pub tid: Option<String>,
    pub tekst: String,
}

/// Toppfeltverdier for `kilde`. `samtale` og `notat` er brukerens overstyring;
/// står det ingenting, avgjør [`del`].
pub const SAMTALE: &str = "samtale";
pub const NOTAT: &str = "notat";

/// Terskler for at en tekst skal leses som en samtale. Tre uavhengige krav —
/// hvert av dem alene ville sluppet gjennom en vanlig tekst med kolon i seg.
const MINST_INNLEGG: usize = 3;
const MINST_AVSENDERE: usize = 2;
/// Hvor stor del av linjene som må høre til et innlegg. Ikke 1,0: en limt
/// tråd har gjerne en løs linje eller to i seg.
const MINST_DEKNING: f64 = 0.8;

/// Ord som aldri er et navn, selv om de står først på linja med kolon etter.
///
/// Uten denne lista blir «Spørsmål:» og «Svar:» to deltakere i en samtale som
/// aldri fant sted, og et limt e-posthode gir deltakerne «Fra», «Til» og
/// «Emne». Det er nøyaktig den dyre feilen.
const STOPPORD: &[&str] = &[
    // notatetiketter
    "spørsmål", "spørsmålet", "svar", "svaret", "konklusjon", "konklusjonen", "begrunnelse",
    "merk", "obs", "nb", "ps", "notat", "notater", "oppgave", "oppgaver", "status", "mål",
    "problem", "problemet", "løsning", "løsningen", "forslag", "tips", "advarsel", "eksempel",
    "kilde", "kilder", "dato", "tid", "tidspunkt", "sted", "agenda", "referat", "deltakere",
    "neste", "huskeliste", "viktig", "poeng", "poenget", "resultat", "resultatet", "bakgrunn",
    "formål", "hensikt", "fordeler", "ulemper", "risiko", "beslutning", "beslutningen",
    "ansvar", "frist", "budsjett", "oppsummering", "sammendrag", "definisjon", "regel",
    "unntak", "krav", "mangler", "feil", "årsak", "tiltak", "anbefaling", "vurdering",
    "hypotese", "antakelse", "plan", "planen", "del", "kapittel", "avsnitt", "tema", "emne",
    "oppdatering", "endring", "vedtak", "innhold", "formatet", "eksempler", "kl", "klokka",
    // e-posthoder
    "fra", "til", "sendt", "kopi", "blindkopi", "vedlegg", "re", "sv", "vs", "svar_til",
    // engelsk
    "note", "notes", "todo", "warning", "summary", "conclusion", "question", "answer",
    "background", "goal", "goals", "solution", "example", "source", "sources", "decision",
    "action", "actions", "next", "step", "steps", "result", "results", "issue", "fix",
    "why", "what", "how", "when", "where", "who", "update", "edit", "subject", "from",
    "sent", "date", "cc", "bcc", "attachment", "reply",
    // ukedager og måneder
    "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag",
    "januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september",
    "oktober", "november", "desember",
];

// ---- linja: hode eller ikke --------------------------------------------

/// Er hele strengen et klokkeslett? `10:32`, `10:32:05`, `9:05`.
fn er_klokkeslett(s: &str) -> bool {
    let mut deler = s.split(':');
    let (Some(t), Some(m)) = (deler.next(), deler.next()) else {
        return false;
    };
    let sek = deler.next();
    if deler.next().is_some() {
        return false;
    }
    let tall = |d: &str, n: usize| d.len() == n && d.chars().all(|c| c.is_ascii_digit());
    (tall(t, 1) || tall(t, 2)) && tall(m, 2) && sek.map(|s| tall(s, 2)).unwrap_or(true)
}

/// `AM`/`PM` i den formen en eksport skriver dem.
fn er_am_pm(s: &str) -> bool {
    matches!(s.to_lowercase().as_str(), "am" | "pm" | "a.m." | "p.m.")
}

/// Et klokkeslett fremst på linja: `[10:32] `, `(10:32) `, `10:32 `.
fn skrell_tid_foran(linje: &str) -> (Option<String>, &str) {
    let første = linje.split_whitespace().next().unwrap_or("");
    let naken = første.trim_start_matches(['[', '(']).trim_end_matches([']', ')']);
    if !er_klokkeslett(naken) {
        return (None, linje);
    }
    let resten = linje[første.len()..].trim_start();
    if resten.is_empty() {
        return (None, linje); // bare et klokkeslett er ikke et innlegg
    }
    (Some(naken.to_string()), resten)
}

/// Et klokkeslett bakerst i hodet: `Marius (10:32)`, `Marius [10:32]`,
/// `Marius  10:32`, `Marius 10:32 AM`.
fn skrell_tid_bak(hode: &str) -> (Option<String>, &str) {
    let hode = hode.trim_end();
    if let Some(rest) = hode.strip_suffix(')').or_else(|| hode.strip_suffix(']')) {
        if let Some(åpen) = rest.rfind(['(', '[']) {
            let inni = rest[åpen + 1..].trim();
            let (tid, resten) = match inni.rsplit_once(' ') {
                Some((t, ap)) if er_am_pm(ap) => (t.trim(), true),
                _ => (inni, false),
            };
            let _ = resten;
            if er_klokkeslett(tid) {
                return (Some(tid.to_string()), rest[..åpen].trim_end());
            }
        }
        return (None, hode);
    }

    let mut ord: Vec<&str> = hode.split_whitespace().collect();
    if ord.last().map(|o| er_am_pm(o)).unwrap_or(false) {
        ord.pop();
    }
    let Some(siste) = ord.last().copied() else {
        return (None, hode);
    };
    if !er_klokkeslett(siste) {
        return (None, hode);
    }
    // Navnet er alt foran klokkeslettet, i den formen det sto på linja.
    let kutt = hode.rfind(siste).unwrap_or(hode.len());
    (Some(siste.to_string()), hode[..kutt].trim_end())
}

/// Første kolon som skiller hode fra tekst. Kolonet i et klokkeslett teller
/// ikke — verken inne i en parentes (`Marius (10:32): hei`) eller bart
/// (`Marius Nygård  10:32`).
fn kolon(s: &str) -> Option<usize> {
    let b = s.as_bytes();
    let mut dybde = 0i32;
    for (i, c) in s.char_indices() {
        match c {
            '(' | '[' => dybde += 1,
            ')' | ']' => dybde -= 1,
            ':' if dybde <= 0 => {
                let siffer = |j: Option<usize>| {
                    j.and_then(|j| b.get(j)).map(|c| c.is_ascii_digit()).unwrap_or(false)
                };
                if !(siffer(i.checked_sub(1)) && siffer(Some(i + 1))) {
                    return Some(i);
                }
            }
            _ => {}
        }
    }
    None
}

/// Ser dette ut som et navn? Strengt med vilje: hvert ord skal begynne med en
/// stor bokstav, ingen tall, høyst fire ord, og ingen av dem på [`STOPPORD`].
///
/// ponytail: et Slack-håndtak med liten forbokstav («marius») avvises. Det er
/// riktig vei å bomme — hun kan overstyre — og en liste over hvilke små ord
/// som likevel er navn er ikke verdt det før noen møter problemet.
fn navn_ok(navn: &str) -> bool {
    let navn = navn.trim();
    if navn.is_empty() || navn.chars().count() > 40 {
        return false;
    }
    let ord: Vec<&str> = navn.split_whitespace().collect();
    if ord.is_empty() || ord.len() > 4 {
        return false;
    }
    for o in &ord {
        let mut tegn = o.chars();
        let Some(først) = tegn.next() else { return false };
        if !først.is_alphabetic() || !først.is_uppercase() {
            return false;
        }
        if !tegn.all(|c| c.is_alphabetic() || c == '.' || c == '-' || c == '\'') {
            return false;
        }
        if STOPPORD.contains(&o.to_lowercase().as_str()) {
            return false;
        }
    }
    !STOPPORD.contains(&navn.to_lowercase().as_str())
}

/// Hodet på et innlegg: hvem som snakker, når, og det som står igjen på linja.
///
/// Tre former, som er de vanlige i limt tekst:
///
/// ```text
/// Marius: Vi bør bruke Stripe.          ← det vanligste
/// Marius Nygård  10:32                  ← Slacks eksportform, teksten under
/// [00:12:03] Marius: Vi bør ...         ← møtetranskript, med eller uten tid
/// ```
pub fn hode(linje: &str) -> Option<(String, Option<String>, String)> {
    let linje = linje.trim();
    if linje.is_empty() {
        return None;
    }
    let (tid_foran, resten) = skrell_tid_foran(linje);

    match kolon(resten) {
        Some(k) => {
            let (hodedel, tekst) = (&resten[..k], resten[k + 1..].trim());
            let (tid_bak, navn) = skrell_tid_bak(hodedel);
            if !navn_ok(navn) {
                return None;
            }
            Some((navn.to_string(), tid_foran.or(tid_bak), tekst.to_string()))
        }
        // Uten kolon må det stå et klokkeslett der: en naken linje med et navn
        // på er bare en linje med et navn på.
        None => {
            let (tid_bak, navn) = skrell_tid_bak(resten);
            let tid = tid_foran.or(tid_bak)?;
            if !navn_ok(navn) {
                return None;
            }
            Some((navn.to_string(), Some(tid), String::new()))
        }
    }
}

/// Avsenderen til ett avsnitt, når avsnittet er et innlegg. Brukes på avsnitt
/// fra en kilde som allerede er avgjort å være en samtale — et vanlig notat
/// med «Marius: ja» i seg skal ikke plutselig få deltakere.
pub fn avsender(avsnitt: &str) -> Option<String> {
    let første = avsnitt.lines().next()?;
    hode(første).map(|(navn, _, _)| navn)
}

// ---- teksten: samtale eller ikke ---------------------------------------

/// Deler en limt tekst i innlegg, eller svarer `None`.
///
/// `None` er den trygge utgangen og skal være det vanlige svaret for alt som
/// ikke er en samtale. Er du i tvil, ikke del den i innlegg.
pub fn del(tekst: &str) -> Option<Vec<Innlegg>> {
    let hopp = crate::understand::frontmatter_lines(tekst);
    let mut ut: Vec<Innlegg> = Vec::new();
    let mut med = 0usize; // linjer som hører til et innlegg
    let mut løse = 0usize; // linjer som ikke gjør det
    let mut åpent = false;

    for (i, linje) in tekst.split('\n').enumerate() {
        if i < hopp {
            continue;
        }
        let l = linje.trim();
        if l.is_empty() {
            åpent = false;
            continue;
        }
        if l.starts_with('#') {
            continue; // overskrift er struktur, og teller ingen vei
        }
        if let Some((navn, tid, tekst)) = hode(l) {
            ut.push(Innlegg { avsender: navn, tid, tekst });
            åpent = true;
            med += 1;
        } else if åpent {
            // Slacks form har teksten på linjene under hodet.
            let siste = ut.last_mut().expect("åpent innlegg finnes");
            if siste.tekst.is_empty() {
                siste.tekst = l.to_string();
            } else {
                siste.tekst.push(' ');
                siste.tekst.push_str(l);
            }
            med += 1;
        } else {
            løse += 1;
        }
    }

    // Et hode uten tekst under er ikke et innlegg — det er et navn og et
    // klokkeslett, og det skal ikke bli en linje i panelet.
    ut.retain(|i| !i.tekst.trim().is_empty());

    let mut antall: HashMap<&str, usize> = HashMap::new();
    for i in &ut {
        *antall.entry(i.avsender.as_str()).or_default() += 1;
    }
    let dekning = med as f64 / (med + løse).max(1) as f64;
    let tar_ordet_igjen = antall.values().any(|n| *n > 1);

    if ut.len() >= MINST_INNLEGG
        && antall.len() >= MINST_AVSENDERE
        && tar_ordet_igjen
        && dekning >= MINST_DEKNING
    {
        Some(ut)
    } else {
        None
    }
}

/// Innleggene som markdown: ett avsnitt per innlegg, avsenderen først.
///
/// Dette er hele formatet. Et menneske kan lese fila uten appen, og appen
/// leser den tilbake til de samme innleggene — [`del`] av dette gir `ut`
/// igjen, uendret.
///
/// ponytail: et innlegg over flere linjer blir én linje. Et limt kodeblokk-
/// innlegg mister linjeskiftene sine. Skal det bevares, er neste steg å rykke
/// inn fortsettelseslinjene og la `del` lese dem tilbake.
pub fn skriv(innlegg: &[Innlegg]) -> String {
    innlegg
        .iter()
        .map(|i| match &i.tid {
            Some(tid) => format!("{} ({tid}): {}", i.avsender, i.tekst),
            None => format!("{}: {}", i.avsender, i.tekst),
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

// ---- toppfeltet: brukerens overstyring ---------------------------------

/// `kilde`-feltet i toppfeltblokka, om det står der.
pub fn kilde(doc: &str) -> Option<String> {
    let slutt = crate::understand::frontmatter_lines(doc);
    if slutt == 0 {
        return None;
    }
    doc.split('\n')
        .take(slutt)
        .filter_map(|l| l.split_once(':'))
        .find(|(navn, _)| navn.trim() == "kilde")
        .map(|(_, verdi)| verdi.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// Skal denne teksten leses som en samtale? Brukerens valg vinner over
/// gjenkjenningen, begge veier.
pub fn er_samtale(doc: &str) -> bool {
    match kilde(doc).as_deref() {
        Some(SAMTALE) => true,
        Some(NOTAT) => false,
        _ => del(doc).is_some(),
    }
}

/// Setter `kilde` i toppfeltet, og lager blokka om notatet ikke har en.
/// Returnerer hele notatet slik det skal stå på disk.
pub fn sett_kilde(doc: &str, verdi: &str) -> String {
    let slutt = crate::understand::frontmatter_lines(doc);
    let mut linjer: Vec<String> = doc.split('\n').map(str::to_string).collect();
    if slutt == 0 {
        return format!("---\nkilde: {verdi}\n---\n\n{doc}");
    }
    let ny = format!("kilde: {verdi}");
    match (0..slutt).find(|i| {
        linjer[*i]
            .split_once(':')
            .map(|(navn, _)| navn.trim() == "kilde")
            .unwrap_or(false)
    }) {
        Some(i) => linjer[i] = ny,
        // Rett før den avsluttende `---`-linja, som er linje `slutt - 1`.
        None => linjer.insert(slutt - 1, ny),
    }
    linjer.join("\n")
}

/// Hvordan appen leser notatet nå, slik grensesnittet kan vise valget i
/// stedet for å skjule det.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Form {
    /// Leses notatet som en samtale?
    pub er: bool,
    /// `samtale` eller `notat` når brukeren har bestemt det selv, ellers
    /// `null` — da er det gjenkjenningen som svarer.
    pub tvunget: Option<String>,
    pub deltakere: Vec<String>,
}

/// Formen notatet leses i. Deltakerne telles slik panelet vil vise dem: én
/// gang per navn, i den rekkefølgen de tar ordet.
pub fn form(doc: &str) -> Form {
    let tvunget = kilde(doc).filter(|k| k == SAMTALE || k == NOTAT);
    let er = er_samtale(doc);
    let mut deltakere: Vec<String> = Vec::new();
    if er {
        for bit in crate::understand::split(doc) {
            if let Some(navn) = avsender(&bit.text) {
                if !deltakere.contains(&navn) {
                    deltakere.push(navn);
                }
            }
        }
    }
    Form { er, tvunget, deltakere }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn innlegg(avsender: &str, tid: Option<&str>, tekst: &str) -> Innlegg {
        Innlegg {
            avsender: avsender.to_string(),
            tid: tid.map(str::to_string),
            tekst: tekst.to_string(),
        }
    }

    /// Det vanligste i limt tekst: navn, kolon, tekst.
    #[test]
    fn navn_kolon_tekst_deles_i_innlegg() {
        let limt = "Marius: Vi bør bruke Stripe.\n\
                    Kari Nordmann: Enig, men hva med Vipps?\n\
                    Marius: Vipps koster mer i oppsett.";
        assert_eq!(
            del(limt).unwrap(),
            vec![
                innlegg("Marius", None, "Vi bør bruke Stripe."),
                innlegg("Kari Nordmann", None, "Enig, men hva med Vipps?"),
                innlegg("Marius", None, "Vipps koster mer i oppsett."),
            ]
        );
    }

    /// Slacks eksportform: navn og klokkeslett på egen linje, teksten under.
    #[test]
    fn slack_eksport_deles_i_innlegg() {
        let limt = "Marius Nygård  10:32\n\
                    Vi bør bruke Stripe.\n\
                    Det er billigst i oppsett.\n\
                    \n\
                    Kari  10:35\n\
                    Enig.\n\
                    \n\
                    Marius Nygård  10:36\n\
                    Da tar vi det.";
        let ut = del(limt).unwrap();
        assert_eq!(
            ut,
            vec![
                innlegg("Marius Nygård", Some("10:32"), "Vi bør bruke Stripe. Det er billigst i oppsett."),
                innlegg("Kari", Some("10:35"), "Enig."),
                innlegg("Marius Nygård", Some("10:36"), "Da tar vi det."),
            ]
        );
    }

    /// Møtetranskript: taler og tidsstempel, i de formene et transkript
    /// skriver dem.
    #[test]
    fn møtetranskript_deles_i_innlegg() {
        let limt = "[00:12:03] Marius: Vi bør bruke Stripe.\n\
                    [00:12:20] Kari: Hva med Vipps?\n\
                    [00:12:41] Marius: Dyrere i oppsett.";
        assert_eq!(
            del(limt).unwrap(),
            vec![
                innlegg("Marius", Some("00:12:03"), "Vi bør bruke Stripe."),
                innlegg("Kari", Some("00:12:20"), "Hva med Vipps?"),
                innlegg("Marius", Some("00:12:41"), "Dyrere i oppsett."),
            ]
        );

        // Og med tida i parentes etter navnet, som er den andre vanlige.
        let annen = "Marius Nygård (00:12): Vi bør bruke Stripe.\n\
                     Kari (00:13): Hva med Vipps?\n\
                     Marius Nygård (00:14): Dyrere.";
        let ut = del(annen).unwrap();
        assert_eq!(ut[0].avsender, "Marius Nygård");
        assert_eq!(ut[0].tid.as_deref(), Some("00:12"));
        assert_eq!(ut[2].tekst, "Dyrere.");
    }

    /// **Den dyre feilen.** Vanlig prosa med kolon i seg er ikke en samtale,
    /// og skal aldri bli det. Hver av disse har brutt gjenkjenningen på en
    /// annen måte, og hver av dem er noe et menneske faktisk skriver.
    #[test]
    fn prosa_som_ligner_på_en_samtale_deles_ikke() {
        let prøver: &[(&str, &str)] = &[
            (
                "notatetiketter",
                "Konklusjon: vi går for Stripe.\n\n\
                 Begrunnelse: det er billigst i oppsett.\n\n\
                 Neste steg: sende faktura.",
            ),
            (
                "spørsmål og svar, gjentatt",
                "Spørsmål: trenger vi innlogging?\n\n\
                 Svar: ja, for lagring på tvers av enheter.\n\n\
                 Spørsmål: hva med Vipps?\n\n\
                 Svar: dyrere i oppsett.",
            ),
            (
                "e-posthode",
                "Fra: Marius Nygård\n\
                 Sendt: 12. september 2026\n\
                 Til: Daniel\n\
                 Emne: Betaling\n\
                 \n\
                 Fra: Kari\n\
                 Sendt: 12. september 2026\n\
                 Til: Daniel\n\
                 Emne: Betaling",
            ),
            (
                "ett menneske nevnt to ganger i prosa",
                "Marius: han mente vi burde bruke Stripe.\n\n\
                 Det er billigere enn Vipps, og enklere å sette opp.\n\n\
                 Marius: han skal sjekke prisene til fredag.",
            ),
            (
                "kolon midt i vanlige setninger",
                "Én ting er sikkert: vi rekker ikke fristen.\n\n\
                 Viktig: bestill utstyret før mandag.\n\n\
                 Se her: https://stripe.com/no\n\n\
                 Kl 10: vi møtes på kontoret.",
            ),
            (
                "punktliste med navn",
                "- Marius: sjekke prisene\n\
                 - Kari: ringe kunden\n\
                 - Marius: sende tilbud",
            ),
            (
                "to innlegg er ikke en tråd",
                "Marius: Vi bør bruke Stripe.\n\nKari: Enig.",
            ),
            (
                "overskrift og brødtekst",
                "# Betaling\n\n\
                 Stripe: den vi lener oss mot.\n\n\
                 Vipps koster mer i oppsett, men flere kjenner den igjen. \
                 Vi bestemmer oss i neste møte.",
            ),
        ];
        for (hva, tekst) in prøver {
            assert!(del(tekst).is_none(), "{hva} er ikke en samtale");
            assert!(!er_samtale(tekst), "{hva} skal leses som et vanlig notat");
        }
    }

    /// Fila på disk er lesbar for et menneske, og leses tilbake til nøyaktig
    /// de samme innleggene.
    #[test]
    fn fila_leses_tilbake_til_de_samme_innleggene() {
        let limt = "Marius Nygård  10:32\n\
                    Vi bør bruke Stripe.\n\
                    \n\
                    Kari  10:35\n\
                    Enig, men hva med Vipps?\n\
                    \n\
                    Marius Nygård  10:36\n\
                    Dyrere i oppsett.";
        let innleggene = del(limt).unwrap();
        let fil = skriv(&innleggene);

        assert_eq!(
            fil,
            "Marius Nygård (10:32): Vi bør bruke Stripe.\n\n\
             Kari (10:35): Enig, men hva med Vipps?\n\n\
             Marius Nygård (10:36): Dyrere i oppsett."
        );
        assert_eq!(del(&fil).unwrap(), innleggene, "fila leses tilbake uendret");
        assert_eq!(skriv(&del(&fil).unwrap()), fil, "og skrives likt igjen");

        // Og appen deler den i ett avsnitt per innlegg, uten å vite noe om
        // samtaler — det er hele poenget med å skrive den slik.
        let notat = format!("---\nid: x\nkilde: samtale\n---\n\n# Samtale\n\n{fil}\n");
        let biter = crate::understand::split(&notat);
        assert_eq!(biter.len(), 3);
        assert_eq!(avsender(&biter[1].text).as_deref(), Some("Kari"));
    }

    /// Samme setning fra to avsendere er to innlegg — og to ulike avsnitt,
    /// fordi avsenderen står i teksten.
    #[test]
    fn samme_setning_fra_to_avsendere_er_to_innlegg() {
        let limt = "Marius: Vi bør bruke Stripe.\n\
                    Kari: Vi bør bruke Stripe.\n\
                    Marius: Da er vi enige.";
        let ut = del(limt).unwrap();
        assert_eq!(ut.len(), 3);
        assert_eq!(ut[0].tekst, ut[1].tekst, "samme setning");
        assert_ne!(ut[0].avsender, ut[1].avsender);

        let biter = crate::understand::split(&skriv(&ut));
        assert_eq!(biter.len(), 3);
        assert_ne!(
            crate::understand::nøkkel(&biter[0].text),
            crate::understand::nøkkel(&biter[1].text),
            "to avsendere er to avsnitt, ikke ett"
        );
    }

    #[test]
    fn overstyringen_går_begge_veier_og_står_i_fila() {
        let samtale = "---\nid: x\n---\n\nMarius: Vi bør bruke Stripe.\n\n\
                       Kari: Enig.\n\nMarius: Da tar vi det.\n";
        let notat = "---\nid: x\n---\n\nEn helt vanlig tanke om betaling.\n";
        assert!(er_samtale(samtale));
        assert!(!er_samtale(notat));

        // «Dette er ikke en samtale» — og det huskes i fila.
        let rettet = sett_kilde(samtale, NOTAT);
        assert!(rettet.contains("kilde: notat"));
        assert!(!er_samtale(&rettet));
        assert_eq!(form(&rettet).tvunget.as_deref(), Some(NOTAT));

        // «Dette er en samtale», på noe gjenkjenningen ikke så.
        let tvunget = sett_kilde(notat, SAMTALE);
        assert!(er_samtale(&tvunget));
        assert_eq!(form(&tvunget).tvunget.as_deref(), Some(SAMTALE));

        // Og tilbake igjen: feltet byttes, det legges ikke til et nytt.
        let om_igjen = sett_kilde(&tvunget, NOTAT);
        assert_eq!(om_igjen.matches("kilde:").count(), 1);
        assert!(!er_samtale(&om_igjen));

        // Uten toppfelt fra før lages blokka.
        let bart = sett_kilde("Bare tekst.\n", SAMTALE);
        assert!(bart.starts_with("---\nkilde: samtale\n---\n"));
        assert_eq!(kilde(&bart).as_deref(), Some(SAMTALE));
    }

    #[test]
    fn deltakerne_telles_én_gang_hver_i_den_rekkefølgen_de_tar_ordet() {
        let fil = skriv(&del("Marius: En.\nKari: To.\nMarius: Tre.").unwrap());
        let f = form(&fil);
        assert!(f.er);
        assert_eq!(f.tvunget, None, "gjenkjent, ikke overstyrt");
        assert_eq!(f.deltakere, vec!["Marius".to_string(), "Kari".to_string()]);
    }

    /// Hodet alene, med det ruskete rundt seg som limt tekst har.
    #[test]
    fn hodet_leses_ut_av_de_formene_som_finnes() {
        assert_eq!(hode("Marius: hei").unwrap(), ("Marius".into(), None, "hei".into()));
        assert_eq!(
            hode("Marius Nygård  10:32").unwrap(),
            ("Marius Nygård".into(), Some("10:32".into()), String::new())
        );
        assert_eq!(
            hode("Kari 2:05 PM").unwrap(),
            ("Kari".into(), Some("2:05".into()), String::new())
        );
        assert_eq!(
            hode("[00:12:03] Marius: hei").unwrap(),
            ("Marius".into(), Some("00:12:03".into()), "hei".into())
        );
        assert_eq!(
            hode("Marius (10:32): hei").unwrap(),
            ("Marius".into(), Some("10:32".into()), "hei".into())
        );

        for ikke in [
            "Se her: https://stripe.com",
            "Konklusjon: vi tar Stripe",
            "det er avgjort: vi tar Stripe",
            "Fra: Marius",
            "Marius",
            "- Marius: hei",
            "Vi må huske: fristen er fredag",
            "Kunde 2: vil ha innlogging",
            "10:32",
        ] {
            assert!(hode(ikke).is_none(), "«{ikke}» er ikke et innleggshode");
        }
    }
}
