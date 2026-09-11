//! Gjenkjenner et avsnitt etter at brukeren har redigert det.
//!
//! Identitet tildeles én gang og gjenfinnes ved neste lesning. Gitt avsnittene
//! vi kjente til i en kilde og avsnittene som står der nå: hvilke er de samme?
//!
//! Ren funksjon. Ingen database, ingen nettverk, ingen modellkall.

use std::collections::HashSet;

/// Et avsnitt vi allerede har gitt en id.
#[derive(Debug, Clone)]
pub struct Kjent {
    pub id: i64,
    pub rekkefolge: usize,
    pub tekst: String,
}

/// Et avsnitt slik det står i kilden nå.
#[derive(Debug, Clone)]
pub struct Ny {
    pub rekkefolge: usize,
    pub tekst: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Match {
    /// Uendret — treff på innhold.
    Samme(i64),
    /// Samme avsnitt, redigert tekst.
    Endret(i64),
    /// Fantes ikke før.
    Nytt,
}

/// Målt på datasettet i `tests/identitet_datasett.rs`, begrunnelse i
/// `klassifiseringstest/IDENTITET.md`.
pub const TERSKEL: f64 = 0.36;

/// Posisjon teller, men svakt: den rangerer bare mellom kandidater som
/// allerede er over terskelen, og kan aldri løfte et par over den. Et flyttet
/// avsnitt med lik tekst vinner derfor alltid over en nabo med lik posisjon.
const POSISJONSVEKT: f64 = 0.03;

/// Én `Match` per element i `nye`, i samme rekkefølge. En id tildeles aldri to
/// nye avsnitt.
///
/// Målt: 300 avsnitt der ett er redigert tar 190 µs, som er veien en lagring
/// går. Skrives hele kilden om på én gang tar samme størrelse 84 ms.
// ponytail: steg 2 er O(n·m) trigramsammenligninger. Eksakt treff fjerner
// nesten alt ved vanlig skriving, og lengdegrensen luker resten. Blir import
// av store transkripter tregt, er neste steg å indeksere trigrammene i stedet
// for å pare alle mot alle.
pub fn match_avsnitt(kjente: &[Kjent], nye: &[Ny]) -> Vec<Match> {
    match_med_terskel(kjente, nye, TERSKEL)
}

/// Som `match_avsnitt`, men med valgfri terskel. Finnes for at terskelen skal
/// kunne måles over et spekter i stedet for gjettes.
pub fn match_med_terskel(kjente: &[Kjent], nye: &[Ny], terskel: f64) -> Vec<Match> {
    let mut ut = vec![Match::Nytt; nye.len()];
    let mut brukt = vec![false; kjente.len()];

    // 1. Eksakt treff på innhold. Gratis, og dekker det vanligste tilfellet.
    //    Er teksten lik flere steder, tas den kjente som står nærmest i
    //    rekkefølgen — lavest id avgjør likt, slik at kjøringen er stabil.
    for (n, ny) in nye.iter().enumerate() {
        let treff = kjente
            .iter()
            .enumerate()
            .filter(|(k, kj)| !brukt[*k] && kj.tekst == ny.tekst)
            .min_by_key(|(_, kj)| (kj.rekkefolge.abs_diff(ny.rekkefolge), kj.id));
        if let Some((k, kj)) = treff {
            brukt[k] = true;
            ut[n] = Match::Samme(kj.id);
        }
    }

    // 2. Resten: tekstlikhet over terskelen, beste tilgjengelige treff først.
    //    Trigrammene bygges én gang per avsnitt, ikke én gang per par — uten
    //    det koster en kilde på 300 redigerte avsnitt et halvt sekund.
    let åpne_n: Vec<usize> = (0..nye.len()).filter(|n| ut[*n] == Match::Nytt).collect();
    let åpne_k: Vec<usize> = (0..kjente.len()).filter(|k| !brukt[*k]).collect();
    let tri_n: Vec<Trigram> = åpne_n.iter().map(|&n| trigrammer(&nye[n].tekst)).collect();
    let tri_k: Vec<Trigram> = åpne_k
        .iter()
        .map(|&k| trigrammer(&kjente[k].tekst))
        .collect();

    let mut par: Vec<(f64, usize, usize)> = Vec::new();
    for (i, &n) in åpne_n.iter().enumerate() {
        for (j, &k) in åpne_k.iter().enumerate() {
            let (a, b) = (&tri_n[i], &tri_k[j]);
            // Jaccard kan aldri overstige min/maks av mengdestørrelsene. Den
            // sjekken er to heltall og luker ut de fleste parene gratis.
            let (lav, høy) = (a.len().min(b.len()), a.len().max(b.len()));
            if høy == 0 || (lav as f64) < terskel * høy as f64 {
                continue;
            }
            let l = jaccard(a, b);
            if l >= terskel {
                let nærhet = 1.0 / (1.0 + kjente[k].rekkefolge.abs_diff(nye[n].rekkefolge) as f64);
                par.push((l + POSISJONSVEKT * nærhet, n, k));
            }
        }
    }
    // Synkende rang, deretter indeks: samme inndata gir samme utfall hver gang.
    par.sort_by(|a, b| {
        b.0.partial_cmp(&a.0)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.1.cmp(&b.1))
            .then(a.2.cmp(&b.2))
    });
    for (_, n, k) in par {
        if ut[n] == Match::Nytt && !brukt[k] {
            brukt[k] = true;
            ut[n] = Match::Endret(kjente[k].id);
        }
    }

    ut
}

/// Jaccard over tegn-trigram: |A ∩ B| / |A ∪ B|.
///
/// Tegn og ikke ord, fordi en skrivefeil ødelegger hele ordet men bare tre
/// trigram. Jaccard og ikke overlapp, fordi nevneren må straffe at den ene
/// teksten er noe helt annet — ellers arver et kort omskrevet avsnitt id-en
/// til et langt.
pub fn likhet(a: &str, b: &str) -> f64 {
    jaccard(&trigrammer(a), &trigrammer(b))
}

type Trigram = HashSet<(char, char, char)>;

fn jaccard(a: &Trigram, b: &Trigram) -> f64 {
    if a.is_empty() || b.is_empty() {
        return if a.is_empty() && b.is_empty() {
            1.0
        } else {
            0.0
        };
    }
    // Gå alltid gjennom den minste mengden: oppslagene blir like mange som
    // det minste avsnittet har trigram.
    let (lite, stort) = if a.len() <= b.len() { (a, b) } else { (b, a) };
    let felles = lite.iter().filter(|t| stort.contains(t)).count() as f64;
    felles / (a.len() as f64 + b.len() as f64 - felles)
}

fn trigrammer(s: &str) -> Trigram {
    let tegn: Vec<char> = s
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .collect();
    if tegn.len() < 3 {
        // Kortere enn ett trigram: polstres, så «ja» og «jo» fortsatt kan
        // skilles fra hverandre i stedet for å bli tomme mengder.
        let mut p = vec![' '];
        p.extend(tegn);
        p.push(' ');
        return p.windows(3).map(|w| (w[0], w[1], w[2])).collect();
    }
    tegn.windows(3).map(|w| (w[0], w[1], w[2])).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kjente(tekster: &[&str]) -> Vec<Kjent> {
        tekster
            .iter()
            .enumerate()
            .map(|(i, t)| Kjent {
                id: i as i64 + 1,
                rekkefolge: i,
                tekst: (*t).to_string(),
            })
            .collect()
    }

    fn nye(tekster: &[&str]) -> Vec<Ny> {
        tekster
            .iter()
            .enumerate()
            .map(|(i, t)| Ny {
                rekkefolge: i,
                tekst: (*t).to_string(),
            })
            .collect()
    }

    const A: &str =
        "Kartvisningen skal vise alle prosjekter på et norgeskart, med filter på fylke.";
    const B: &str =
        "Vi bør bruke Stripe til betaling fordi det er raskest å sette opp for en enkeltmann.";
    const C: &str = "Fargekorrigeringen kan ikke starte før klippet er låst av kunden.";

    #[test]
    fn uendret_kilde_gir_samme_id_på_alt() {
        let ut = match_avsnitt(&kjente(&[A, B, C]), &nye(&[A, B, C]));
        assert_eq!(ut, vec![Match::Samme(1), Match::Samme(2), Match::Samme(3)]);
    }

    #[test]
    fn rettet_skrivefeil_beholder_id_en() {
        let rettet =
            "Kartvisningen skal vise alle prosjekter på et norgeskart, med filter på fylker.";
        let ut = match_avsnitt(&kjente(&[A, B, C]), &nye(&[rettet, B, C]));
        assert_eq!(ut[0], Match::Endret(1));
    }

    #[test]
    fn utvidet_avsnitt_beholder_id_en() {
        let utvidet = format!("{C} Lyd tas etterpå, i Fairlight, når bildet står.");
        let ut = match_avsnitt(&kjente(&[A, B, C]), &nye(&[A, B, &utvidet]));
        assert_eq!(ut[2], Match::Endret(3));
    }

    #[test]
    fn innsatt_avsnitt_forskyver_ingen_id() {
        let ny = "Møtet med Marius flyttes til torsdag klokka ni.";
        let ut = match_avsnitt(&kjente(&[A, B, C]), &nye(&[A, ny, B, C]));
        assert_eq!(
            ut,
            vec![
                Match::Samme(1),
                Match::Nytt,
                Match::Samme(2),
                Match::Samme(3)
            ]
        );
    }

    #[test]
    fn slettet_avsnitt_lar_de_andre_beholde_id_en() {
        let ut = match_avsnitt(&kjente(&[A, B, C]), &nye(&[A, C]));
        assert_eq!(ut, vec![Match::Samme(1), Match::Samme(3)]);
    }

    #[test]
    fn flyttet_avsnitt_beholder_id_en() {
        let ut = match_avsnitt(&kjente(&[A, B, C]), &nye(&[C, A, B]));
        assert_eq!(ut, vec![Match::Samme(3), Match::Samme(1), Match::Samme(2)]);
    }

    #[test]
    fn to_like_avsnitt_får_hver_sin_id_og_samme_svar_hver_gang() {
        let k = kjente(&[A, B, A]);
        let n = nye(&[A, B, A]);
        let ut = match_avsnitt(&k, &n);
        assert_eq!(ut, vec![Match::Samme(1), Match::Samme(2), Match::Samme(3)]);
        for _ in 0..20 {
            assert_eq!(match_avsnitt(&k, &n), ut);
        }
    }

    #[test]
    fn delt_avsnitt_lar_den_største_halvdelen_arve_id_en() {
        let helt = "Kunden vil ha to leveranser: en kort versjon til Instagram på under \
                    førti sekunder, og en lang versjon til nettsiden som kan vare i tre \
                    minutter og vise hele prosessen fra start til slutt.";
        let stor = "Kunden vil ha to leveranser. Den lange versjonen til nettsiden kan \
                    vare i tre minutter og vise hele prosessen fra start til slutt.";
        let liten = "Kort versjon til Instagram.";
        let ut = match_avsnitt(&kjente(&[helt]), &nye(&[liten, stor]));
        assert_eq!(ut, vec![Match::Nytt, Match::Endret(1)]);
    }

    #[test]
    fn sammenslåtte_avsnitt_arver_id_en_til_den_som_bidrar_mest() {
        let stor = "Fargekorrigeringen kan ikke starte før klippet er låst av kunden, og \
                    kunden har bedt om to runder med tilbakemelding før det skjer.";
        let liten = "Lyd tas i Fairlight.";
        let slått = format!("{stor} {liten}");
        let ut = match_avsnitt(&kjente(&[stor, liten]), &nye(&[&slått]));
        assert_eq!(ut, vec![Match::Endret(1)]);
    }

    #[test]
    fn omskrevet_kilde_arver_ingen_id() {
        let ut = match_avsnitt(
            &kjente(&[A, B, C]),
            &nye(&[
                "Frokosten på hotellet i Bergen var inkludert i prisen.",
                "Bestill ny bagasjerem før avreise til Tromsø på fredag.",
                "Hunden må til veterinæren for vaksine i løpet av oktober.",
            ]),
        );
        assert_eq!(ut, vec![Match::Nytt, Match::Nytt, Match::Nytt]);
    }

    #[test]
    fn stor_kilde_med_én_redigering_beholder_alle_id_er() {
        let tekster: Vec<String> = (0..300)
            .map(|i| format!("Avsnitt {i} handler om kartvisning, betaling og fargekorrigering i prosjekt {i}."))
            .collect();
        let k: Vec<Kjent> = tekster
            .iter()
            .enumerate()
            .map(|(i, t)| Kjent {
                id: i as i64 + 1,
                rekkefolge: i,
                tekst: t.clone(),
            })
            .collect();
        let mut n: Vec<Ny> = tekster
            .iter()
            .enumerate()
            .map(|(i, t)| Ny {
                rekkefolge: i,
                tekst: t.clone(),
            })
            .collect();
        n[150].tekst =
            "Avsnitt 150 handlar om kartvisning, betaling og fargekorrigering i prosjekt 150."
                .to_string();

        let ut = match_avsnitt(&k, &n);
        assert_eq!(ut[150], Match::Endret(151));
        assert_eq!(ut.iter().filter(|m| **m == Match::Nytt).count(), 0);
        for (i, m) in ut.iter().enumerate() {
            if i != 150 {
                assert_eq!(*m, Match::Samme(i as i64 + 1));
            }
        }
    }
}
