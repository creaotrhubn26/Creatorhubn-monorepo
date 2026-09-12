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

/// Rettelsen slik panelet får den.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Rettelse {
    pub plass: String,
    pub summary: String,
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
  foreldet      integer not null default 0
);
create index if not exists rettelser_sti on rettelser(sti);
"#;

pub fn sørg_for_tabell(conn: &Connection) -> Result<()> {
    conn.execute_batch(SKJEMA)
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
        "select r.avsnitt_id, r.plass, r.kortform from rettelser r \
         join avsnitt a on a.id = r.avsnitt_id \
         where a.kilde = ?1 and r.foreldet = 0",
    )?;
    let rader = q.query_map([sti], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            Rettelse { plass: r.get(1)?, summary: r.get(2)? },
        ))
    })?;
    rader.collect()
}

/// Lagrer rettelsen, eller fjerner den om `plass` er `None`.
pub fn lagre(conn: &Connection, r: &Retting) -> Result<()> {
    let Some(plass) = r.plass.as_deref() else {
        conn.execute("delete from rettelser where avsnitt_id = ?1", [r.avsnitt_id])?;
        return Ok(());
    };
    conn.execute(
        "insert into rettelser \
           (avsnitt_id, sti, tekst, lest_type, lest_handling, lest_kortform, plass, kortform, tidspunkt, foreldet) \
         values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0) \
         on conflict(avsnitt_id) do update set \
           sti = excluded.sti, tekst = excluded.tekst, \
           plass = excluded.plass, kortform = excluded.kortform, \
           lest_type = excluded.lest_type, lest_handling = excluded.lest_handling, \
           lest_kortform = excluded.lest_kortform, \
           tidspunkt = excluded.tidspunkt, foreldet = 0",
        rusqlite::params![
            r.avsnitt_id,
            r.sti,
            r.tekst,
            r.lest_type,
            r.lest_handling,
            r.lest_kortform,
            plass,
            r.kortform.clone().unwrap_or_default(),
            nå(),
        ],
    )?;
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
            Some(Rettelse { plass: "uavklart".into(), summary: "Depositum".into() }),
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
                summary: "Kartvisning, ikke avgjort".into()
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
