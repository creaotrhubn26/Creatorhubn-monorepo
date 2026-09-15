//! Datasettet terskelen er målt på — 34 par av før-tekst og etter-tekst for en
//! kilde, med fasit for hvilke avsnitt som er de samme.
//!
//! Kjør sveipet med:
//!   cargo test --test identitet_datasett terskelen_er_målt -- --nocapture

use creatorhub_notes_indexer::identitet::{match_med_terskel, Kjent, Match, Ny, MINSTE_ORD, TERSKEL};

/// Fasit for ett nytt avsnitt: enten er det avsnitt nr. N i før-teksten
/// (nullindeksert), eller så er det nytt.
#[derive(Debug, Clone, Copy, PartialEq)]
enum F {
    Lik(usize),
    Ny,
}

struct Par {
    navn: &'static str,
    krav: u8,
    før: &'static [&'static str],
    etter: &'static [&'static str],
    fasit: &'static [F],
}

use F::{Lik, Ny as FNy};

// Tekster som går igjen i flere par.
const KART: &str =
    "Kartvisningen skal vise alle prosjekter på et norgeskart, med filter på fylke og på status.";
const STRIPE: &str =
    "Vi bør bruke Stripe til betaling fordi det er raskest å sette opp for en enkeltmann.";
const FARGE: &str = "Fargekorrigeringen kan ikke starte før klippet er låst av kunden.";
const MØTE: &str = "Møtet med Marius flyttes til torsdag klokka ni, han rekker ikke onsdag.";
const BACKUP: &str = "Alt råmateriale skal ligge på to disker før kortet formateres, uten unntak.";

#[rustfmt::skip]
const DATASETT: &[Par] = &[
    // ---- 1. Uendret ----
    Par { navn: "uendret, tre avsnitt", krav: 1,
        før: &[KART, STRIPE, FARGE], etter: &[KART, STRIPE, FARGE],
        fasit: &[Lik(0), Lik(1), Lik(2)] },
    Par { navn: "uendret, ett avsnitt", krav: 1,
        før: &[BACKUP], etter: &[BACKUP], fasit: &[Lik(0)] },
    Par { navn: "uendret, fem avsnitt", krav: 1,
        før: &[KART, STRIPE, FARGE, MØTE, BACKUP],
        etter: &[KART, STRIPE, FARGE, MØTE, BACKUP],
        fasit: &[Lik(0), Lik(1), Lik(2), Lik(3), Lik(4)] },

    // ---- 2. Skrivefeil rettet ----
    Par { navn: "ett tegn rettet midt i ordet", krav: 2,
        før: &["Kartvisnignen skal vise alle prosjekter på et norgeskart, med filter på fylke og på status.", STRIPE],
        etter: &[KART, STRIPE],
        fasit: &[Lik(0), Lik(1)] },
    Par { navn: "manglende komma satt inn", krav: 2,
        før: &["Vi bør bruke Stripe til betaling fordi det er raskest å sette opp for en enkeltmann"],
        etter: &[STRIPE],
        fasit: &[Lik(0)] },
    Par { navn: "stor forbokstav rettet i kort avsnitt", krav: 2,
        før: &["lyd tas i Fairlight, etter at bildet står."],
        etter: &["Lyd tas i Fairlight, etter at bildet står."],
        fasit: &[Lik(0)] },
    Par { navn: "to skrivefeil i samme avsnitt", krav: 2,
        før: &["Alt råmatriale skal ligge på to disekr før kortet formateres, uten unntak."],
        etter: &[BACKUP],
        fasit: &[Lik(0)] },

    // ---- 3. Avsnitt utvidet ----
    Par { navn: "en setning lagt til på slutten", krav: 3,
        før: &[FARGE, MØTE],
        etter: &["Fargekorrigeringen kan ikke starte før klippet er låst av kunden. Lyd tas etterpå, i Fairlight.", MØTE],
        fasit: &[Lik(0), Lik(1)] },
    Par { navn: "avsnittet doblet i lengde", krav: 3,
        før: &[STRIPE],
        etter: &["Vi bør bruke Stripe til betaling fordi det er raskest å sette opp for en enkeltmann. Vipps kommer senere, når det finnes tid til å lese vilkårene og sette opp avtalen med banken."],
        fasit: &[Lik(0)] },
    Par { navn: "presisering satt inn midt i", krav: 3,
        før: &[KART],
        etter: &["Kartvisningen skal vise alle prosjekter, også de avsluttede, på et norgeskart, med filter på fylke og på status."],
        fasit: &[Lik(0)] },

    // ---- 4. Avsnitt satt inn ----
    Par { navn: "nytt avsnitt mellom to gamle", krav: 4,
        før: &[KART, STRIPE], etter: &[KART, MØTE, STRIPE],
        fasit: &[Lik(0), FNy, Lik(1)] },
    Par { navn: "nytt avsnitt øverst forskyver alle", krav: 4,
        før: &[KART, STRIPE, FARGE], etter: &[BACKUP, KART, STRIPE, FARGE],
        fasit: &[FNy, Lik(0), Lik(1), Lik(2)] },
    Par { navn: "to nye avsnitt satt inn", krav: 4,
        før: &[KART, FARGE], etter: &[MØTE, KART, BACKUP, FARGE],
        fasit: &[FNy, Lik(0), FNy, Lik(1)] },

    // ---- 5. Avsnitt slettet ----
    Par { navn: "midterste avsnitt slettet", krav: 5,
        før: &[KART, STRIPE, FARGE], etter: &[KART, FARGE],
        fasit: &[Lik(0), Lik(2)] },
    Par { navn: "første avsnitt slettet", krav: 5,
        før: &[KART, STRIPE, FARGE, MØTE], etter: &[STRIPE, FARGE, MØTE],
        fasit: &[Lik(1), Lik(2), Lik(3)] },
    Par { navn: "alt slettet", krav: 5,
        før: &[KART, STRIPE], etter: &[], fasit: &[] },

    // ---- 6. Avsnitt flyttet ----
    Par { navn: "siste flyttet til topp", krav: 6,
        før: &[KART, STRIPE, FARGE], etter: &[FARGE, KART, STRIPE],
        fasit: &[Lik(2), Lik(0), Lik(1)] },
    Par { navn: "hele rekkefølgen snudd", krav: 6,
        før: &[KART, STRIPE, FARGE, MØTE], etter: &[MØTE, FARGE, STRIPE, KART],
        fasit: &[Lik(3), Lik(2), Lik(1), Lik(0)] },
    Par { navn: "flyttet og rettet skrivefeil samtidig", krav: 6,
        før: &[KART, STRIPE, FARGE],
        etter: &["Fargekorigeringen kan ikke starte før klippet er låst av kunden.", KART, STRIPE],
        fasit: &[Lik(2), Lik(0), Lik(1)] },

    // ---- 7. To like avsnitt ----
    Par { navn: "samme tekst to steder", krav: 7,
        før: &[BACKUP, KART, BACKUP], etter: &[BACKUP, KART, BACKUP],
        fasit: &[Lik(0), Lik(1), Lik(2)] },
    Par { navn: "samme tekst to steder, ett avsnitt satt inn mellom", krav: 7,
        før: &[BACKUP, BACKUP], etter: &[BACKUP, MØTE, BACKUP],
        fasit: &[Lik(0), FNy, Lik(1)] },
    Par { navn: "tre like avsnitt, ett slettet", krav: 7,
        før: &[BACKUP, BACKUP, BACKUP], etter: &[BACKUP, BACKUP],
        fasit: &[Lik(0), Lik(1)] },

    // ---- 8. Avsnitt delt i to ----
    // Regelen er «beste likhet arver», som i praksis betyr den største delen.
    Par { navn: "delt i en stor og en liten del", krav: 8,
        før: &["Kunden vil ha to leveranser: en kort versjon til Instagram på under førti sekunder, og en lang versjon til nettsiden som kan vare i tre minutter og vise hele prosessen fra start til slutt."],
        etter: &[
            "Kort versjon til Instagram, under førti sekunder.",
            "Den lange versjonen til nettsiden kan vare i tre minutter og vise hele prosessen fra start til slutt.",
        ],
        fasit: &[FNy, Lik(0)] },
    Par { navn: "delt der første del er størst", krav: 8,
        før: &["Alt råmateriale skal ligge på to disker før kortet formateres, uten unntak, og den ene disken skal stå hos kunden i Oslo mens den andre blir med i bilen hjem."],
        etter: &[
            "Alt råmateriale skal ligge på to disker før kortet formateres, uten unntak, og den ene disken skal stå hos kunden i Oslo.",
            "Den andre blir med i bilen hjem.",
        ],
        fasit: &[Lik(0), FNy] },
    Par { navn: "delt mens naboavsnittene står", krav: 8,
        før: &[KART, "Fargekorrigeringen kan ikke starte før klippet er låst av kunden, og kunden har bedt om to runder med tilbakemelding før det skjer, én på grovklipp og én på ferdig bilde."],
        etter: &[
            KART,
            "Fargekorrigeringen kan ikke starte før klippet er låst av kunden, og kunden har bedt om to runder med tilbakemelding før det skjer.",
            "Én runde på grovklipp og én på ferdig bilde.",
        ],
        fasit: &[Lik(0), Lik(1), FNy] },

    // ---- 9. To avsnitt slått sammen ----
    Par { navn: "stor og liten slått sammen", krav: 9,
        før: &[
            "Fargekorrigeringen kan ikke starte før klippet er låst av kunden, og kunden har bedt om to runder med tilbakemelding før det skjer.",
            "Lyd tas i Fairlight.",
        ],
        etter: &["Fargekorrigeringen kan ikke starte før klippet er låst av kunden, og kunden har bedt om to runder med tilbakemelding før det skjer. Lyd tas i Fairlight."],
        fasit: &[Lik(0)] },
    Par { navn: "slått sammen, det store avsnittet står sist", krav: 9,
        før: &[
            "Kort versjon til Instagram.",
            "Den lange versjonen til nettsiden kan vare i tre minutter og vise hele prosessen fra start til slutt, med intervju og droneklipp.",
        ],
        etter: &["Kort versjon til Instagram. Den lange versjonen til nettsiden kan vare i tre minutter og vise hele prosessen fra start til slutt, med intervju og droneklipp."],
        fasit: &[Lik(1)] },
    Par { navn: "slått sammen mens et tredje avsnitt står", krav: 9,
        før: &[KART, BACKUP, "Kortet formateres først når begge diskene er verifisert."],
        etter: &[KART, "Alt råmateriale skal ligge på to disker før kortet formateres, uten unntak. Kortet formateres først når begge diskene er verifisert."],
        fasit: &[Lik(0), Lik(1)] },

    // ---- 10. Alt skrevet om ----
    // Minst fem par der noen ord overlapper, men fasiten er `Ny`. Dette er
    // den dyre feilen: arvet id sender brukerens rettelse til feil avsnitt.
    Par { navn: "helt urelatert tekst", krav: 10,
        før: &[KART, STRIPE],
        etter: &[
            "Hunden må til veterinæren for vaksine i løpet av oktober.",
            "Frokosten på hotellet i Bergen var inkludert i prisen.",
        ],
        fasit: &[FNy, FNy] },
    Par { navn: "samme setningsform, annet innhold", krav: 10,
        før: &["Vi må hente inn tilbud fra tre leverandører før vi bestemmer oss for kamerahus."],
        etter: &["Vi må hente barna i barnehagen før klokka fire på fredag."],
        fasit: &[FNy] },
    Par { navn: "delt ordstamme, annen sak", krav: 10,
        før: &["Klippet skal være ferdig før fredag, ellers rekker vi ikke visningen hos kunden."],
        etter: &["Klippekortet på treningssenteret går ut før fredag, så det må brukes denne uka."],
        fasit: &[FNy] },
    Par { navn: "samme tall og prisformulering, annet kjøp", krav: 10,
        før: &["Prisen for pakke to er tolv tusen kroner eksklusiv moms, med to runder retting."],
        etter: &["Prisen på ny mikrofon er tolv tusen kroner, og den bør kjøpes brukt hvis mulig."],
        fasit: &[FNy] },
    Par { navn: "samme navn, ny beskjed", krav: 10,
        før: &[MØTE],
        etter: &["Marius har sagt opp abonnementet på lagringsplassen, så filene må flyttes."],
        fasit: &[FNy] },
    Par { navn: "samme tema, motsatt beslutning skrevet fra bunnen", krav: 10,
        før: &["Kartvisningen skal vise alle prosjekter på et norgeskart, med filter på fylke og på status."],
        etter: &["Vi dropper kart i denne runden. En sortert liste med søkefelt dekker behovet og koster en brøkdel."],
        fasit: &[FNy] },
    Par { navn: "hele kilden skrevet om", krav: 10,
        før: &[KART, STRIPE, FARGE],
        etter: &[
            "Skatteavsetningen settes til trettifem prosent av hver faktura, på egen konto.",
            "Bestill ny bagasjerem før avreise til Tromsø på fredag.",
            "Kaffemaskinen på kontoret lekker, ring vaktmester.",
        ],
        fasit: &[FNy, FNy, FNy] },

    // ---- Blandet, slik en ekte redigeringsøkt ser ut ----
    Par { navn: "skrivefeil rettet, avsnitt satt inn og ett slettet", krav: 0,
        før: &[KART, STRIPE, FARGE, MØTE],
        etter: &[
            "Kartvisningen skal vise alle prosjekter på et norgeskart, med filter på fylke og på status og på kunde.",
            BACKUP,
            FARGE,
            MØTE,
        ],
        fasit: &[Lik(0), FNy, Lik(2), Lik(3)] },
    Par { navn: "flyttet, utvidet og et urelatert avsnitt lagt til", krav: 0,
        før: &[FARGE, KART, STRIPE],
        etter: &[
            "Kartvisningen skal vise alle prosjekter på et norgeskart, med filter på fylke og på status. Zoom lagres per bruker.",
            "Rydd i kameraveska før helgen.",
            FARGE,
        ],
        fasit: &[Lik(1), FNy, Lik(0)] },
    Par { navn: "tom kilde får sitt første avsnitt", krav: 0,
        før: &[], etter: &[KART], fasit: &[FNy] },
];

fn kjør(par: &Par, terskel: f64) -> Vec<Match> {
    let kjente: Vec<Kjent> = par
        .før
        .iter()
        .enumerate()
        .map(|(i, t)| Kjent {
            id: i as i64 + 1,
            rekkefolge: i,
            tekst: (*t).to_string(),
        })
        .collect();
    let nye: Vec<Ny> = par
        .etter
        .iter()
        .enumerate()
        .map(|(i, t)| Ny {
            rekkefolge: i,
            tekst: (*t).to_string(),
        })
        .collect();
    match_med_terskel(&kjente, &nye, terskel)
}

/// (falsk arv, tapt id): fremmed avsnitt arvet en id / kjent avsnitt mistet den.
fn feil_ved(terskel: f64) -> (usize, usize) {
    let (mut falsk, mut tapt) = (0, 0);
    for par in DATASETT {
        let ut = kjør(par, terskel);
        for (n, fasit) in par.fasit.iter().enumerate() {
            match (fasit, ut[n]) {
                (F::Ny, Match::Samme(_)) | (F::Ny, Match::Endret(_)) => falsk += 1,
                (F::Lik(_), Match::Nytt) => tapt += 1,
                (F::Lik(i), Match::Samme(id)) | (F::Lik(i), Match::Endret(id)) => {
                    if id != *i as i64 + 1 {
                        falsk += 1;
                    }
                }
                (F::Ny, Match::Nytt) => {}
            }
        }
    }
    (falsk, tapt)
}

#[test]
fn datasettet_dekker_alle_ti_kravene_og_er_stort_nok() {
    assert!(DATASETT.len() >= 30, "minst 30 par kreves");
    for krav in 1..=10u8 {
        assert!(
            DATASETT.iter().any(|p| p.krav == krav),
            "ingen par dekker krav {krav}"
        );
    }
    let omskrevet = DATASETT.iter().filter(|p| p.krav == 10).count();
    assert!(omskrevet >= 5, "minst fem omskrevne par kreves");
}

#[test]
fn valgt_terskel_gir_ingen_feil_på_datasettet() {
    for par in DATASETT {
        let ut = kjør(par, TERSKEL);
        for (n, fasit) in par.fasit.iter().enumerate() {
            let faktisk = ut[n];
            let ok = match (fasit, faktisk) {
                (F::Ny, Match::Nytt) => true,
                (F::Lik(i), Match::Samme(id)) | (F::Lik(i), Match::Endret(id)) => {
                    id == *i as i64 + 1
                }
                _ => false,
            };
            assert!(
                ok,
                "«{}», avsnitt {n}: fasit {fasit:?}, fikk {faktisk:?}",
                par.navn
            );
        }
    }
}

#[test]
fn terskelen_er_målt_over_et_spekter() {
    eprintln!("terskel  falsk arv  tapt id");
    for steg in 2..=45 {
        let t = steg as f64 / 50.0;
        let (falsk, tapt) = feil_ved(t);
        eprintln!("  {t:.2}       {falsk:>2}        {tapt:>2}");
    }
    // Ved den valgte terskelen skal begge være null, og en høy terskel skal
    // gjøre vondt i den billige retningen (tapte id-er), ikke i den dyre.
    assert_eq!(feil_ved(TERSKEL), (0, 0));
    let (falsk_høyt, tapt_høyt) = feil_ved(0.90);
    assert_eq!(falsk_høyt, 0, "en høy terskel skal aldri arve feil id");
    assert!(
        tapt_høyt > 0,
        "en høy terskel må tape id-er, ellers måler vi ingenting"
    );
}

/// Navnene på parene som brekker ved en gitt terskel, til rapporten.
fn brekker_ved(terskel: f64) -> (Vec<String>, Vec<String>) {
    let (mut falsk, mut tapt) = (Vec::new(), Vec::new());
    for par in DATASETT {
        let ut = kjør(par, terskel);
        for (n, fasit) in par.fasit.iter().enumerate() {
            match (fasit, ut[n]) {
                (F::Ny, Match::Samme(_)) | (F::Ny, Match::Endret(_)) => {
                    falsk.push(format!("{} [{n}]", par.navn))
                }
                (F::Lik(_), Match::Nytt) => tapt.push(format!("{} [{n}]", par.navn)),
                (F::Lik(i), Match::Samme(id)) | (F::Lik(i), Match::Endret(id)) => {
                    if id != *i as i64 + 1 {
                        falsk.push(format!("{} [{n}] feil id", par.navn));
                    }
                }
                (F::Ny, Match::Nytt) => {}
            }
        }
    }
    (falsk, tapt)
}

#[test]
fn hvor_det_brekker_i_hver_retning() {
    for t in [0.04, 0.18, 0.54, 0.70, 0.90] {
        let (falsk, tapt) = brekker_ved(t);
        eprintln!("terskel {t:.2}\n  falsk arv: {falsk:?}\n  tapt id:   {tapt:?}");
    }
}

/// Ordbasert Jaccard var det andre kandidatmålet. Den faller sammen på korte
/// avsnitt, der én skrivefeil sletter et helt ord i stedet for tre trigram.
#[test]
fn ordbasert_jaccard_taper_på_korte_avsnitt() {
    fn ord_jaccard(a: &str, b: &str) -> f64 {
        let sett = |s: &str| -> std::collections::HashSet<String> {
            s.to_lowercase()
                .split_whitespace()
                .map(|o| o.trim_matches(|c: char| !c.is_alphanumeric()).to_string())
                .filter(|o| !o.is_empty())
                .collect()
        };
        let (a, b) = (sett(a), sett(b));
        if a.is_empty() || b.is_empty() {
            return 0.0;
        }
        a.intersection(&b).count() as f64 / a.union(&b).count() as f64
    }
    use creatorhub_notes_indexer::identitet::likhet;

    // Kort avsnitt, én skrivefeil. Samme avsnitt for et menneske.
    let (a, b) = ("Kjøp nytt batteri", "Kjøp nyt batteri");
    eprintln!(
        "kort avsnitt med skrivefeil: trigram {:.2}, ord {:.2}",
        likhet(a, b),
        ord_jaccard(a, b)
    );
    assert!(likhet(a, b) > 0.6, "trigram: {}", likhet(a, b));
    assert!(ord_jaccard(a, b) < 0.55, "ord: {}", ord_jaccard(a, b));

    // Omskrevet avsnitt med felles ord. Skal ligge lavt for begge.
    let (c, d) = (
        "Prisen for pakke to er tolv tusen kroner eksklusiv moms, med to runder retting.",
        "Prisen på ny mikrofon er tolv tusen kroner, og den bør kjøpes brukt hvis mulig.",
    );
    eprintln!(
        "omskrevet med ordoverlapp: trigram {:.2}, ord {:.2}",
        likhet(c, d),
        ord_jaccard(c, d)
    );
    assert!(likhet(c, d) < TERSKEL);
}

// ---------------------------------------------------------------------------
// Korte innlegg. Målt 13. september 2026, etter at samtaleimporten kom.
// ---------------------------------------------------------------------------

/// Chat-innlegg fra **samme avsender** — `minne::match_per_avsender` grupperer
/// allerede per person, så det er innenfor én persons egne innlegg id-ene kan
/// bytte plass. Et innlegg er ofte ett til fem ord, og `IDENTITET.md` sa selv
/// at Jaccard er svakest der. Dette er målingen forbeholdet ba om.
///
/// `LANG` er med i hvert par bare for å gi gruppa noe å bestå av; den er
/// alltid uendret og alltid eksakt treff.
const LANG: &str =
    "Vi bør ta depositum på tretti prosent før oppstart, ellers bærer vi hele risikoen selv.";

#[rustfmt::skip]
const KORTE: &[Par] = &[
    // ---- Skal IKKE arve: to ulike korte innlegg fra samme person ----
    Par { navn: "«Enig.» byttet ut med «Uenig.»", krav: 11,
        før: &["Enig.", LANG], etter: &[LANG, "Uenig."],
        fasit: &[Lik(1), FNy] },
    Par { navn: "«Vi tar det senere» byttet ut med «Vi tar det nå»", krav: 11,
        før: &["Vi tar det senere.", LANG], etter: &[LANG, "Vi tar det nå."],
        fasit: &[Lik(1), FNy] },
    Par { navn: "«Ja, det tror jeg» byttet ut med «Nei, det tror jeg ikke»", krav: 11,
        før: &["Ja, det tror jeg.", LANG], etter: &[LANG, "Nei, det tror jeg ikke."],
        fasit: &[Lik(1), FNy] },
    Par { navn: "«i morgen» byttet ut med «på torsdag»", krav: 11,
        før: &["Kan vi ta det i morgen?", LANG], etter: &[LANG, "Kan vi ta det på torsdag?"],
        fasit: &[Lik(1), FNy] },
    Par { navn: "«Depositum?» byttet ut med «Deposit?»", krav: 11,
        før: &["Depositum?", LANG], etter: &[LANG, "Deposit?"],
        fasit: &[Lik(1), FNy] },

    // ---- Uendret kort innlegg: skal alltid holde, via eksakt treff ----
    Par { navn: "uendret tråd med tre korte innlegg", krav: 11,
        før: &["Enig.", "Kanskje.", "Dyrere i oppsett.", LANG],
        etter: &["Enig.", "Kanskje.", "Dyrere i oppsett.", LANG],
        fasit: &[Lik(0), Lik(1), Lik(2), Lik(3)] },
    Par { navn: "kort innlegg flyttet i tråden", krav: 11,
        før: &["Enig.", "Kanskje.", LANG], etter: &[LANG, "Kanskje.", "Enig."],
        fasit: &[Lik(2), Lik(1), Lik(0)] },
    Par { navn: "kort innlegg slettet, resten står", krav: 11,
        før: &["Enig.", "Kanskje.", LANG], etter: &["Enig.", LANG],
        fasit: &[Lik(0), Lik(2)] },
];

/// De korte innleggene som er *redigert*. Fasiten sier «samme innlegg», og
/// lengdegulvet gjør at de likevel blir `Nytt`. Det er den billige feilen, og
/// den er betalt med vilje — se `identitet::MINSTE_ORD`.
#[rustfmt::skip]
const KORTE_REDIGERT: &[Par] = &[
    Par { navn: "«Enig.» → «Enig!»", krav: 11,
        før: &["Enig.", LANG], etter: &["Enig!", LANG], fasit: &[Lik(0), Lik(1)] },
    Par { navn: "«Kanskje.» → «Kanskje?»", krav: 11,
        før: &["Kanskje.", LANG], etter: &["Kanskje?", LANG], fasit: &[Lik(0), Lik(1)] },
    Par { navn: "«Dyrere i oppsett.» → «Dyrere i oppsettet.»", krav: 11,
        før: &["Dyrere i oppsett.", LANG], etter: &["Dyrere i oppsettet.", LANG],
        fasit: &[Lik(0), Lik(1)] },
    Par { navn: "«ok» → «ok.»", krav: 11,
        før: &["ok", LANG], etter: &["ok.", LANG], fasit: &[Lik(0), Lik(1)] },
];

fn feil_i(sett: &[Par], terskel: f64) -> (usize, usize) {
    let (mut falsk, mut tapt) = (0, 0);
    for par in sett {
        let ut = kjør(par, terskel);
        for (n, fasit) in par.fasit.iter().enumerate() {
            match (fasit, ut[n]) {
                (F::Ny, Match::Samme(_)) | (F::Ny, Match::Endret(_)) => falsk += 1,
                (F::Lik(_), Match::Nytt) => tapt += 1,
                (F::Lik(i), Match::Samme(id)) | (F::Lik(i), Match::Endret(id)) => {
                    if id != *i as i64 + 1 {
                        falsk += 1;
                    }
                }
                (F::Ny, Match::Nytt) => {}
            }
        }
    }
    (falsk, tapt)
}

/// Hovedfunnet: for korte innlegg finnes det ingen terskel som virker. De to
/// fordelingene — «samme innlegg, redigert» og «to ulike innlegg» — ligger
/// oppå hverandre. «Enig.» mot «Uenig.» er 0,75; «Enig.» mot «Enig!» er 0,50.
#[test]
fn korte_innlegg_har_ikke_noe_vindu_i_det_hele_tatt() {
    use creatorhub_notes_indexer::identitet::likhet;

    // Motsatt mening, høyere likhet enn den ekte redigeringen. Det er hele
    // problemet på én linje: «uenig» inneholder «enig».
    let motsatt = likhet("Enig.", "Uenig.");
    let redigert = likhet("Enig.", "Enig!");
    eprintln!("«Enig.»/«Uenig.» {motsatt:.2}   «Enig.»/«Enig!» {redigert:.2}");
    assert!(
        motsatt > redigert,
        "hvis dette snur, finnes det plutselig et vindu, og gulvet kan tas bort"
    );

    // Fem par korte innlegg som betyr forskjellige ting. Uten lengdegulvet
    // ville hvert eneste av dem arvet en fremmed id ved 0,36.
    let ulike = [
        ("Enig.", "Uenig."),
        ("Vi tar det senere.", "Vi tar det nå."),
        ("Ja, det tror jeg.", "Nei, det tror jeg ikke."),
        ("Kan vi ta det i morgen?", "Kan vi ta det på torsdag?"),
        ("Depositum?", "Deposit?"),
    ];
    // Fire ekte redigeringer av korte innlegg, til sammenlikning.
    let samme = [
        ("Enig.", "Enig!"),
        ("Kanskje.", "Kanskje?"),
        ("Dyrere i oppsett.", "Dyrere i oppsettet."),
        ("Sender i kveld.", "Sender det i kveld."),
    ];
    eprintln!("ulike innlegg:");
    for (a, b) in ulike {
        eprintln!("  {:.2}  «{a}» / «{b}»", likhet(a, b));
    }
    eprintln!("samme innlegg, redigert:");
    for (a, b) in samme {
        eprintln!("  {:.2}  «{a}» / «{b}»", likhet(a, b));
    }
    assert!(
        ulike.iter().all(|(a, b)| likhet(a, b) >= TERSKEL),
        "alle fem ville arvet en fremmed id ved {TERSKEL}"
    );
    // Og fordelingene overlapper: det laveste ekte paret ligger under det
    // høyeste falske. Derfor finnes det ingen terskel — bare et gulv.
    let lavest_ekte = samme.iter().map(|(a, b)| likhet(a, b)).fold(1.0, f64::min);
    let høyest_falsk = ulike.iter().map(|(a, b)| likhet(a, b)).fold(0.0, f64::max);
    assert!(
        lavest_ekte < høyest_falsk,
        "ekte {lavest_ekte:.2} mot falsk {høyest_falsk:.2} — hadde disse ikke \
         overlappet, ville en terskel holdt"
    );
}

/// Den dyre feilen skal være borte, ved enhver terskel. Det er lengdegulvet
/// som gjør det, ikke terskelen — så sveipet skal være flatt på null.
#[test]
fn et_kort_innlegg_arver_aldri_en_fremmed_id() {
    eprintln!("terskel  falsk arv  tapt id   (korte innlegg)");
    for steg in 2..=45 {
        let t = steg as f64 / 50.0;
        let (falsk, tapt) = feil_i(KORTE, t);
        eprintln!("  {t:.2}       {falsk:>2}        {tapt:>2}");
        assert_eq!(
            falsk, 0,
            "terskel {t:.2}: et kort innlegg arvet en fremmed id"
        );
        assert_eq!(tapt, 0, "terskel {t:.2}: et uendret kort innlegg mistet id-en");
    }
}

/// Prisen, målt og oppført. Et redigert kort innlegg mister id-en sin — den
/// billige feilen, og dagens oppførsel for alt.
#[test]
fn prisen_for_gulvet_er_at_et_redigert_kort_innlegg_blir_nytt() {
    let (falsk, tapt) = feil_i(KORTE_REDIGERT, TERSKEL);
    eprintln!("redigerte korte innlegg: falsk arv {falsk}, tapt id {tapt} av 4");
    assert_eq!(falsk, 0, "den dyre feilen skal ikke finnes noe sted");
    assert_eq!(tapt, 4, "alle fire mister id-en, og det er valget som ble tatt");
}

/// Gulvet slår bare til under `MINSTE_ORD`. Over det skal alt være som før —
/// og de 34 parene i `DATASETT` er beviset: de er uberørt.
#[test]
fn gulvet_rører_ikke_avsnitt_som_er_lange_nok() {
    assert_eq!(feil_ved(TERSKEL), (0, 0));
    let langt_nok = DATASETT
        .iter()
        .flat_map(|p| p.før.iter().chain(p.etter.iter()))
        .filter(|t| t.split_whitespace().count() >= MINSTE_ORD)
        .count();
    let alle = DATASETT.iter().map(|p| p.før.len() + p.etter.len()).sum::<usize>();
    eprintln!("{langt_nok} av {alle} tekster i datasettet er sju ord eller mer");
}
