//! Datasettet terskelen er målt på — 34 par av før-tekst og etter-tekst for en
//! kilde, med fasit for hvilke avsnitt som er de samme.
//!
//! Kjør sveipet med:
//!   cargo test --test identitet_datasett terskelen_er_målt -- --nocapture

use creatorhub_notes_indexer::identitet::{match_med_terskel, Kjent, Match, Ny, TERSKEL};

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
