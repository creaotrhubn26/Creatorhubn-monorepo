//! Rettelser — det brukeren selv sier at linja skulle vært.
//!
//! En rettelse er fasit skrevet av den som vet: hun så at systemet leste henne
//! feil, og skrev om linja i det øyeblikket hun oppdaget det. Derfor lagres
//! ikke bare svaret hennes, men også hva systemet svarte og hvilken tekst det
//! gjaldt — det er det som gjør raden til noe man kan lære av senere.
//!
//! Nøkkelen er avsnittets identitet, ikke teksten. Retter hun en skrivefeil,
//! følger rettelsen med — det er hele poenget med `avsnitt`-tabellen. Først
//! når avsnittet er borte fra notatet gjelder ikke rettelsen lenger; den blir
//! stående i basen som historikk, men merkes foreldet og fortelles én gang til
//! brukeren.

use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Plassene i panelet, med brukerens ord. `fjernet` er den fjerde utgangen:
/// linja hører ikke hjemme noe sted.
pub const PLASSER: [&str; 4] = ["forstått", "uavklart", "oppgave", "idé"];
pub const FJERNET: &str = "fjernet";
/// Oppgaven er gjort. Ikke en lesning av avsnittet, men en beskjed om
/// virkeligheten — derfor blir den aldri et eksempel i prompten, og «hva
/// venter på noe» svarer ikke med den.
pub const FERDIG: &str = "ferdig";

/// Hvor lesningen selv ville plassert avsnittet.
///
/// Samme rekkefølge som `lest()` i `Panel.tsx`, og de to må følge hverandre:
/// står de ulikt, tror appen at brukeren flyttet en linje hun lot stå, og et
/// eksempel i prompten blir en rettelse hun aldri gjorde.
///
/// - En oppgave er en oppgave uansett hvor bestemt den er.
/// - Et referert eller avvist standpunkt er en idé, også når modellen sa
///   `bygg`. Kundens ønske er ikke hennes beslutning.
/// - `marker_åpent` er uavklart. Det er både hennes åpne spørsmål og
///   modellens egen usikkerhetsutgang, og begge hører hjemme samme sted.
/// - Et krav er avgjort: `RESULTAT.md` avgjorde at «bestemorvennlig» og «det
///   må støtte RAW» er beslutninger om *hvordan*, og at fasiten tok feil, ikke
///   modellene.
pub fn lest_plass(kind: &str, action: &str) -> Option<&'static str> {
    Some(match (kind, action) {
        ("oppgave", _) => "oppgave",
        ("gjengivelse", _) | ("uenighet", _) => "idé",
        (_, "marker_åpent") => "uavklart",
        ("begrensning", _) => "forstått",
        (_, "bygg") => "forstått",
        ("tvil", _) => "idé",
        ("spørsmål", _) => "uavklart",
        // `hold` er «noter som mulighet», og det er nøyaktig hva en idé er.
        (_, "hold") => "idé",
        _ => return None,
    })
}

/// Rettelsen slik panelet får den.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Rettelse {
    pub plass: String,
    pub summary: String,
    /// Hva oppgaven venter på, når hun skrev en pil i kortformen sin. Uten
    /// den ga hennes egen retting en dårligere oppgave enn maskinens: linja
    /// ble en oppgave i panelet, men kunne aldri finnes av «hva venter på
    /// noe».
    pub venter: String,
}

/// Én retting fra panelet. `plass: None` betyr «ta rettelsen bort igjen», som
/// er det angreknappen sender når det ikke var noen rettelse fra før.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Retting {
    pub avsnitt_id: i64,
    /// Notatet linja sto i. Ren historikk: oppslag går på `avsnitt_id`, men
    /// blir avsnittet borte er dette det eneste som sier hvor den hørte
    /// hjemme.
    pub sti: String,
    pub tekst: String,
    pub lest_type: String,
    pub lest_handling: String,
    pub lest_kortform: String,
    pub plass: Option<String>,
    pub kortform: Option<String>,
}

/// Egen tabell i den samme basen appen allerede bruker. Den hører til appen,
/// ikke til indekseren, og lages av appen — indeksen kan fortsatt slettes og
/// bygges opp igjen fra filene uten at rettelsene ryker.
pub const SKJEMA: &str = r#"
create table if not exists rettelser (
  avsnitt_id    integer primary key,
  sti           text not null,
  tekst         text not null,
  lest_type     text not null,
  lest_handling text not null,
  lest_kortform text not null,
  plass         text not null,
  kortform      text not null,
  tidspunkt     integer not null,
  foreldet      integer not null default 0,
  venter        text not null default ''
);
create index if not exists rettelser_sti on rettelser(sti);
"#;

pub fn sørg_for_tabell(conn: &Connection) -> Result<()> {
    conn.execute_batch(SKJEMA)?;
    // `create table if not exists` rører ikke en tabell som finnes. En base
    // fra i går mangler kolonnen; «duplicate column name» betyr at den ikke
    // gjør det.
    let _ = conn.execute("alter table rettelser add column venter text not null default ''", []);
    // Var basen nede da notatet ble lest, fikk alle avsnittene id 0, og en
    // rettelse gjort da havnet på id 0. Den vises aldri i panelet — `aktive`
    // joiner mot `avsnitt`, og der finnes ingen id 0 — men den er ekte nok
    // til å styre hver framtidige prompt. Rader som ikke kan tilhøre et
    // avsnitt ryddes bort hver gang basen åpnes.
    conn.execute("delete from rettelser where avsnitt_id <= 0", [])?;
    Ok(())
}

pub(crate) fn nå() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Rettelsene som fortsatt gjelder for ett notat, slått opp på avsnitts-id.
///
/// Kilden er `avsnitt`, ikke `sti`-kolonnen i raden: flytter et avsnitt seg,
/// er det `avsnitt.kilde` som er sant om hvor det står nå.
pub fn aktive(conn: &Connection, sti: &str) -> Result<HashMap<i64, Rettelse>> {
    let mut q = conn.prepare(
        "select r.avsnitt_id, r.plass, r.kortform, r.venter from rettelser r \
         join avsnitt a on a.id = r.avsnitt_id \
         where a.kilde = ?1 and r.foreldet = 0",
    )?;
    let rader = q.query_map([sti], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            Rettelse { plass: r.get(1)?, summary: r.get(2)?, venter: r.get(3)? },
        ))
    })?;
    rader.collect()
}

/// Lagrer rettelsen, eller fjerner den om `plass` er `None`.
///
/// En rettelse uten et gyldig avsnitt avvises. Var basen nede da notatet ble
/// lest, er alle id-er 0, og en rad på id 0 er usynlig i panelet, men styrer
/// likevel hver framtidige prompt. Bedre å si ifra med en gang enn å lagre
/// noe brukeren aldri får se og aldri får slettet.
pub fn lagre(conn: &Connection, r: &Retting) -> Result<()> {
    let Some(plass) = r.plass.as_deref() else {
        // Å fjerne noe krever ingen kontroll: det er nettopp radene som ikke
        // burde vært der man vil kunne bli kvitt.
        conn.execute("delete from rettelser where avsnitt_id = ?1", [r.avsnitt_id])?;
        return Ok(());
    };
    let kjent: i64 = conn.query_row(
        "select count(*) from avsnitt where id = ?1",
        [r.avsnitt_id],
        |rad| rad.get(0),
    )?;
    if kjent == 0 {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_MISUSE),
            Some(format!("rettelse uten gyldig avsnitt (id {})", r.avsnitt_id)),
        ));
    }
    // «Starte produksjon ← godkjent prototype» i hennes eget felt betyr det
    // samme som når modellen skriver det. Uten dette ble pila stående midt i
    // kortformen, og oppgaven kunne aldri finnes av «hva venter på noe».
    let (kortform, venter) = del_pil(r.kortform.as_deref().unwrap_or_default());
    let venter = if plass == "oppgave" { venter } else { String::new() };
    conn.execute(
        "insert into rettelser \
           (avsnitt_id, sti, tekst, lest_type, lest_handling, lest_kortform, plass, kortform, tidspunkt, foreldet, venter) \
         values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?10) \
         on conflict(avsnitt_id) do update set \
           sti = excluded.sti, tekst = excluded.tekst, \
           plass = excluded.plass, kortform = excluded.kortform, \
           lest_type = excluded.lest_type, lest_handling = excluded.lest_handling, \
           lest_kortform = excluded.lest_kortform, venter = excluded.venter, \
           tidspunkt = excluded.tidspunkt, foreldet = 0",
        rusqlite::params![
            r.avsnitt_id,
            r.sti,
            r.tekst,
            r.lest_type,
            r.lest_handling,
            r.lest_kortform,
            plass,
            kortform,
            nå(),
            venter,
        ],
    )?;
    Ok(())
}

/// Skiller «Starte produksjon ← godkjent prototype» i kortform og
/// avhengighet, som `understand::del_avhengighet` gjør for modellsvaret.
fn del_pil(s: &str) -> (String, String) {
    for pil in ["←", "<-"] {
        if let Some((kort, venter)) = s.split_once(pil) {
            let (kort, venter) = (kort.trim(), venter.trim());
            if !kort.is_empty() && !venter.is_empty() {
                return (kort.to_string(), venter.to_string());
            }
        }
    }
    (s.to_string(), String::new())
}

/// En rettelse finner tilbake til teksten sin.
///
/// Blir et avsnitt borte — slettet, eller notatet døpt om — merkes rettelsen
/// foreldet og raden blir stående. Dukker den *samme teksten* opp igjen som et
/// nytt avsnitt, er det hennes rettelse som hører til den, og den flyttes dit.
/// Uten dette var «Ikke relevant» på feil linje, en angret sletting eller et
/// filnavnbytte tre måter å miste det eneste i systemet hun har skrevet som
/// ikke kan gjenskapes fra markdown.
///
/// Bare rader hvis avsnitt ikke lenger finnes. En rettelse som gjelder et
/// avsnitt som står, røres aldri.
pub(crate) fn gjenopplivt(tx: &Connection, ider: &[i64], tekster: &[String]) -> Result<()> {
    let hjemløse: Vec<(i64, String)> = tx
        .prepare(
            "select avsnitt_id, tekst from rettelser r \
             where not exists (select 1 from avsnitt a where a.id = r.avsnitt_id)",
        )?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<_>>()?;
    if hjemløse.is_empty() {
        return Ok(());
    }
    for (gammel, tekst) in hjemløse {
        let Some(i) = tekster.iter().position(|t| *t == tekst) else { continue };
        let Some(ny) = ider.get(i).copied() else { continue };
        // Har det nye avsnittet allerede en rettelse, er den ferskere. Da er
        // den gamle raden historikk, og skal ikke skrive over noe.
        let opptatt: i64 =
            tx.query_row("select count(*) from rettelser where avsnitt_id = ?1", [ny], |r| {
                r.get(0)
            })?;
        if opptatt > 0 {
            continue;
        }
        tx.execute(
            "update rettelser set avsnitt_id = ?2, foreldet = 0 where avsnitt_id = ?1",
            [gammel, ny],
        )?;
    }
    Ok(())
}

/// Merker rettelser som gjaldt avsnitt som ikke lenger finnes i notatet, og
/// svarer med brukerens egne ord for dem — én gang. Raden blir stående.
///
/// Søker på `sti`-kolonnen og ikke på `avsnitt`, fordi raden skal finnes også
/// etter at avsnittet den pekte på er borte. Det er nettopp de radene denne
/// funksjonen finnes for.
pub fn foreldede(conn: &Connection, sti: &str, nåværende: &HashSet<i64>) -> Result<Vec<String>> {
    let mut q = conn.prepare(
        "select avsnitt_id, kortform, lest_kortform from rettelser \
         where sti = ?1 and foreldet = 0",
    )?;
    let rader: Vec<(i64, String, String)> = q
        .query_map([sti], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .collect::<Result<_>>()?;

    let mut ut = Vec::new();
    for (id, kortform, lest_kortform) in rader {
        if nåværende.contains(&id) {
            continue;
        }
        conn.execute("update rettelser set foreldet = 1 where avsnitt_id = ?1", [id])?;
        // En fjernet linje har ingen kortform brukeren skrev. Da er systemets
        // egen det eneste hun kan kjenne igjen linja på.
        ut.push(if kortform.is_empty() { lest_kortform } else { kortform });
    }
    Ok(ut)
}

/// Henger rettelsene på avsnittene. Rettelsen vinner: den er skrevet av den
/// som faktisk vet hva avsnittet betyr.
pub fn merge(avsnitt: &mut [crate::understand::Paragraph], rettelser: &HashMap<i64, Rettelse>) {
    for a in avsnitt.iter_mut() {
        a.correction = rettelser.get(&a.id).cloned();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::minne;
    use crate::understand::{self, Memo, Paragraph};

    /// Klassifikator uten nettverk, som den falske i `understand`: alt blir
    /// det samme, slik at det bare er rettelsene som skiller linjene.
    struct Fast;
    impl understand::Classifier for Fast {
        fn ask(&self, texts: &[String]) -> std::result::Result<String, String> {
            Ok(texts
                .iter()
                .enumerate()
                .map(|(i, _)| format!("{}|beslutning|bygg|Systemets kortform", i + 1))
                .collect::<Vec<_>>()
                .join("\n"))
        }
    }

    fn base() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        sørg_for_tabell(&conn).unwrap();
        minne::sørg_for_tabeller(&conn).unwrap();
        conn
    }

    /// Leser notatet slik appen gjør det: identitet først, så klassifisering,
    /// så rettelsene oppå.
    fn les(conn: &mut Connection, sti: &str, doc: &str) -> Vec<Paragraph> {
        let biter = understand::split(doc);
        let tekster: Vec<String> = biter.iter().map(|b| b.text.clone()).collect();
        let ider = minne::synk(conn, sti, &tekster, &[]).unwrap();
        let mut memo = Memo::new();
        let mut avsnitt = understand::les(doc, &Fast, &mut memo).unwrap();
        understand::sett_ider(&mut avsnitt, &biter, &ider);
        avsnitt
    }

    fn nåværende(conn: &Connection, sti: &str) -> HashSet<i64> {
        conn.prepare("select id from avsnitt where kilde = ?1")
            .unwrap()
            .query_map([sti], |r| r.get(0))
            .unwrap()
            .collect::<Result<_>>()
            .unwrap()
    }

    fn retting(id: i64, tekst: &str, plass: Option<&str>, kortform: &str) -> Retting {
        Retting {
            avsnitt_id: id,
            sti: "notat.md".into(),
            tekst: tekst.into(),
            lest_type: "beslutning".into(),
            lest_handling: "bygg".into(),
            lest_kortform: "Systemets kortform".into(),
            plass: plass.map(str::to_string),
            kortform: Some(kortform.into()),
        }
    }

    /// Var basen nede ved lesning, er alle id-er 0. Raden ville stått usynlig
    /// i basen for alltid og styrt hver framtidige prompt.
    #[test]
    fn rettelse_uten_gyldig_avsnitt_avvises() {
        let mut conn = base();
        assert!(
            lagre(&conn, &retting(0, "En tanke.", Some("uavklart"), "Noe")).is_err(),
            "id 0 er ikke et avsnitt"
        );
        assert!(
            lagre(&conn, &retting(9999, "En tanke.", Some("uavklart"), "Noe")).is_err(),
            "og en id som ikke finnes er det heller ikke"
        );
        assert_eq!(minne::eksempler(&conn, 6).unwrap(), Vec::new(), "og ingenting lærer av dem");

        // Et ekte avsnitt går fortsatt gjennom.
        let ut = les(&mut conn, "notat.md", "En tanke som står her.\n");
        lagre(&conn, &retting(ut[0].id, &ut[0].text, Some("uavklart"), "Noe")).unwrap();
        assert_eq!(minne::eksempler(&conn, 6).unwrap().len(), 1);
    }

    /// Rader fra før vakten fantes skal ikke bli liggende. `aktive` skjulte
    /// dem, `eksempler` gjorde det ikke.
    #[test]
    fn gamle_nullrader_ryddes_bort_naar_basen_aapnes() {
        let conn = base();
        conn.execute(
            "insert into rettelser (avsnitt_id, sti, tekst, lest_type, lest_handling, \
               lest_kortform, plass, kortform, tidspunkt, foreldet) \
             values (0, 'notat.md', 'En tanke.', 'beslutning', 'bygg', 'Systemets', \
               'uavklart', 'Hennes', 1757000000, 0)",
            [],
        )
        .unwrap();
        let antall = |conn: &Connection| -> i64 {
            conn.query_row("select count(*) from rettelser", [], |r| r.get(0)).unwrap()
        };
        assert_eq!(antall(&conn), 1, "raden ligger der");

        sørg_for_tabell(&conn).unwrap();
        assert_eq!(antall(&conn), 0, "og skal være borte etter en åpning");
    }

    /// Det som gjør rettelsen verdt å lagre: den skal fortsatt gjelde etter at
    /// avsnittet er lest på nytt.
    #[test]
    fn rettelse_overlever_ny_lesning_av_uendret_avsnitt() {
        let mut conn = base();
        let doc = "Kanskje vi burde ha depositum.\n";

        let første = les(&mut conn, "notat.md", doc);
        lagre(&conn, &retting(første[0].id, &første[0].text, Some("uavklart"), "Depositum")).unwrap();

        // Ny lesning, samme tekst — hukommelsen tømt, alt klassifisert på nytt.
        let mut igjen = les(&mut conn, "notat.md", doc);
        assert_eq!(igjen[0].summary, "Systemets kortform");
        merge(&mut igjen, &aktive(&conn, "notat.md").unwrap());
        assert_eq!(
            igjen[0].correction,
            Some(Rettelse {
                plass: "uavklart".into(),
                summary: "Depositum".into(),
                venter: String::new()
            }),
            "rettelsen skal vinne over klassifiseringen"
        );
    }

    /// Selve poenget med avsnittsidentitet. Hun retter linja i panelet, og så
    /// retter hun en skrivefeil i avsnittet. Før overlevde ikke rettelsen det,
    /// fordi teksten *var* identiteten.
    #[test]
    fn rettelse_overlever_at_en_skrivefeil_rettes() {
        let mut conn = base();
        let før = "Kartvisningen skal vise alle prosjekter på et norgeskart, med filter på fylke.\n";
        let etter =
            "Kartvisningen skal vise alle prosjekter på et norgeskart, med filter på fylker.\n";

        let første = les(&mut conn, "notat.md", før);
        lagre(
            &conn,
            &retting(første[0].id, &første[0].text, Some("uavklart"), "Kartvisning, ikke avgjort"),
        )
        .unwrap();

        let mut rettet = les(&mut conn, "notat.md", etter);
        assert_eq!(rettet[0].id, første[0].id, "en skrivefeil gjør det ikke til et nytt avsnitt");
        assert_ne!(rettet[0].hash, første[0].hash, "men teksten er en annen");

        merge(&mut rettet, &aktive(&conn, "notat.md").unwrap());
        assert_eq!(
            rettet[0].correction,
            Some(Rettelse {
                plass: "uavklart".into(),
                summary: "Kartvisning, ikke avgjort".into(),
                venter: String::new(),
            }),
            "rettelsen hennes skal fortsatt stå"
        );
        assert!(
            foreldede(&conn, "notat.md", &nåværende(&conn, "notat.md")).unwrap().is_empty(),
            "og hun skal ikke få beskjed om at den ble borte"
        );
    }

    #[test]
    fn endret_avsnittstekst_gjør_rettelsen_ugyldig_og_sier_ifra() {
        let mut conn = base();
        let før = les(&mut conn, "notat.md", "Kanskje vi burde ha depositum.\n");
        lagre(&conn, &retting(før[0].id, &før[0].text, Some("uavklart"), "Depositum")).unwrap();

        let mut etter = les(&mut conn, "notat.md", "Alle bilder skal leveres i full oppløsning.\n");
        assert_ne!(etter[0].id, før[0].id, "en helt annen tanke er et nytt avsnitt");

        let nå = nåværende(&conn, "notat.md");
        let sagt = foreldede(&conn, "notat.md", &nå).unwrap();
        assert_eq!(sagt, vec!["Depositum".to_string()], "brukeren skal få vite det");

        merge(&mut etter, &aktive(&conn, "notat.md").unwrap());
        assert_eq!(etter[0].correction, None, "rettelsen gjaldt et annet avsnitt");
        assert!(foreldede(&conn, "notat.md", &nå).unwrap().is_empty(), "og bare én gang");
    }

    #[test]
    fn fjernet_linje_kommer_ikke_tilbake_for_samme_tekst() {
        let mut conn = base();
        let doc = "Husk å spørre Kari om fakturaen.\n";
        let ut = les(&mut conn, "notat.md", doc);
        lagre(&conn, &retting(ut[0].id, &ut[0].text, Some(FJERNET), "")).unwrap();

        let mut igjen = les(&mut conn, "notat.md", doc);
        merge(&mut igjen, &aktive(&conn, "notat.md").unwrap());
        assert_eq!(igjen[0].correction.as_ref().unwrap().plass, FJERNET);
    }

    /// Angre er å lagre det som sto der før. Var det ingenting, er det å
    /// fjerne raden — og da er linja tilbake til det systemet leste.
    #[test]
    fn angre_gjenoppretter_både_fjernet_og_endret_linje() {
        let mut conn = base();
        let id = les(&mut conn, "notat.md", "En tanke som står her.\n")[0].id;

        lagre(&conn, &retting(id, "En tanke som står her.", Some(FJERNET), "")).unwrap();
        lagre(&conn, &retting(id, "En tanke som står her.", None, "")).unwrap();
        assert!(aktive(&conn, "notat.md").unwrap().is_empty(), "angre en sletting");

        lagre(&conn, &retting(id, "En tanke som står her.", Some("idé"), "Første")).unwrap();
        lagre(&conn, &retting(id, "En tanke som står her.", Some("uavklart"), "Andre")).unwrap();
        lagre(&conn, &retting(id, "En tanke som står her.", Some("idé"), "Første")).unwrap();
        assert_eq!(
            aktive(&conn, "notat.md").unwrap().get(&id).unwrap().summary,
            "Første",
            "angre en endring"
        );
    }

    /// Poenget med å lagre dem: raden skal kunne leses som treningsdata.
    #[test]
    fn raden_holder_både_teksten_systemets_svar_og_brukerens() {
        let mut conn = base();
        let tekst = "Kanskje vi burde ha depositum.";
        let id = les(&mut conn, "notat.md", tekst)[0].id;
        lagre(&conn, &retting(id, tekst, Some("uavklart"), "Depositum")).unwrap();

        let (tekst_ut, lest, handling, lest_kort, plass, kort, tid): (
            String,
            String,
            String,
            String,
            String,
            String,
            i64,
        ) = conn
            .query_row(
                "select tekst, lest_type, lest_handling, lest_kortform, plass, kortform, tidspunkt \
                 from rettelser",
                [],
                |r| {
                    Ok((
                        r.get(0)?,
                        r.get(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                        r.get(6)?,
                    ))
                },
            )
            .unwrap();
        assert_eq!(tekst_ut, tekst);
        assert_eq!((lest.as_str(), handling.as_str()), ("beslutning", "bygg"));
        assert_eq!(lest_kort, "Systemets kortform");
        assert_eq!((plass.as_str(), kort.as_str()), ("uavklart", "Depositum"));
        assert!(tid > 1_700_000_000, "tidspunktet skal være ekte");
    }
}
