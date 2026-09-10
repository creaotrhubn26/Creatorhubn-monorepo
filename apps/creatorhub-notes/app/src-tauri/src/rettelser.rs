//! Rettelser — det brukeren selv sier at linja skulle vært.
//!
//! En rettelse er fasit skrevet av den som vet: hun så at systemet leste henne
//! feil, og skrev om linja i det øyeblikket hun oppdaget det. Derfor lagres
//! ikke bare svaret hennes, men også hva systemet svarte og hvilken tekst det
//! gjaldt — det er det som gjør raden til noe man kan lære av senere.
//!
//! Nøkkelen er avsnittsteksten, ikke plasseringen. Skriver hun om avsnittet,
//! gjelder ikke rettelsen lenger; den blir stående i basen som historikk, men
//! merkes foreldet og fortelles én gang til brukeren.

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
    pub sti: String,
    pub hash: String,
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
const SKJEMA: &str = r#"
create table if not exists rettelser (
  sti           text not null,
  hash          text not null,
  tekst         text not null,
  lest_type     text not null,
  lest_handling text not null,
  lest_kortform text not null,
  plass         text not null,
  kortform      text not null,
  tidspunkt     integer not null,
  foreldet      integer not null default 0,
  primary key (sti, hash)
);
"#;

pub fn sørg_for_tabell(conn: &Connection) -> Result<()> {
    conn.execute_batch(SKJEMA)
}

fn nå() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Rettelsene som fortsatt gjelder for ett notat, slått opp på avsnittsnøkkel.
pub fn aktive(conn: &Connection, sti: &str) -> Result<HashMap<String, Rettelse>> {
    let mut q =
        conn.prepare("select hash, plass, kortform from rettelser where sti = ?1 and foreldet = 0")?;
    let rader = q.query_map([sti], |r| {
        Ok((
            r.get::<_, String>(0)?,
            Rettelse { plass: r.get(1)?, summary: r.get(2)? },
        ))
    })?;
    rader.collect()
}

/// Lagrer rettelsen, eller fjerner den om `plass` er `None`.
pub fn lagre(conn: &Connection, r: &Retting) -> Result<()> {
    let Some(plass) = r.plass.as_deref() else {
        conn.execute("delete from rettelser where sti = ?1 and hash = ?2", (&r.sti, &r.hash))?;
        return Ok(());
    };
    conn.execute(
        "insert into rettelser \
           (sti, hash, tekst, lest_type, lest_handling, lest_kortform, plass, kortform, tidspunkt, foreldet) \
         values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0) \
         on conflict(sti, hash) do update set \
           plass = excluded.plass, kortform = excluded.kortform, \
           lest_type = excluded.lest_type, lest_handling = excluded.lest_handling, \
           lest_kortform = excluded.lest_kortform, \
           tidspunkt = excluded.tidspunkt, foreldet = 0",
        rusqlite::params![
            r.sti,
            r.hash,
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
pub fn foreldede(conn: &Connection, sti: &str, nåværende: &HashSet<String>) -> Result<Vec<String>> {
    let mut q = conn
        .prepare("select hash, kortform, lest_kortform from rettelser where sti = ?1 and foreldet = 0")?;
    let rader: Vec<(String, String, String)> = q
        .query_map([sti], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .collect::<Result<_>>()?;

    let mut ut = Vec::new();
    for (hash, kortform, lest_kortform) in rader {
        if nåværende.contains(&hash) {
            continue;
        }
        conn.execute("update rettelser set foreldet = 1 where sti = ?1 and hash = ?2", (sti, &hash))?;
        // En fjernet linje har ingen kortform brukeren skrev. Da er systemets
        // egen det eneste hun kan kjenne igjen linja på.
        ut.push(if kortform.is_empty() { lest_kortform } else { kortform });
    }
    Ok(ut)
}

/// Henger rettelsene på avsnittene. Rettelsen vinner: den er skrevet av den
/// som faktisk vet hva avsnittet betyr.
pub fn merge(avsnitt: &mut [crate::understand::Paragraph], rettelser: &HashMap<String, Rettelse>) {
    for a in avsnitt.iter_mut() {
        a.correction = rettelser.get(&a.hash).cloned();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::understand::{self, Memo};

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
        conn
    }

    fn retting(hash: &str, tekst: &str, plass: Option<&str>, kortform: &str) -> Retting {
        Retting {
            sti: "notat.md".into(),
            hash: hash.into(),
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
        let conn = base();
        let doc = "Kanskje vi burde ha depositum.\n";
        let mut memo = Memo::new();

        let første = understand::understand(doc, &Fast, &mut memo).unwrap();
        let hash = første[0].hash.clone();
        lagre(&conn, &retting(&hash, &første[0].text, Some("uavklart"), "Depositum")).unwrap();

        // Ny lesning, samme tekst — hukommelsen tømt, alt klassifisert på nytt.
        let mut memo = Memo::new();
        let mut igjen = understand::understand(doc, &Fast, &mut memo).unwrap();
        assert_eq!(igjen[0].summary, "Systemets kortform");
        merge(&mut igjen, &aktive(&conn, "notat.md").unwrap());
        assert_eq!(
            igjen[0].correction,
            Some(Rettelse { plass: "uavklart".into(), summary: "Depositum".into() }),
            "rettelsen skal vinne over klassifiseringen"
        );
    }

    #[test]
    fn endret_avsnittstekst_gjør_rettelsen_ugyldig_og_sier_ifra() {
        let conn = base();
        let mut memo = Memo::new();
        let før =
            understand::understand("Kanskje vi burde ha depositum.\n", &Fast, &mut memo).unwrap();
        lagre(&conn, &retting(&før[0].hash, &før[0].text, Some("uavklart"), "Depositum")).unwrap();

        let mut etter =
            understand::understand("Vi dropper depositum likevel.\n", &Fast, &mut memo).unwrap();
        let nåværende: HashSet<String> = etter.iter().map(|a| a.hash.clone()).collect();

        let sagt = foreldede(&conn, "notat.md", &nåværende).unwrap();
        assert_eq!(sagt, vec!["Depositum".to_string()], "brukeren skal få vite det");

        merge(&mut etter, &aktive(&conn, "notat.md").unwrap());
        assert_eq!(etter[0].correction, None, "rettelsen gjaldt en annen tekst");
        assert!(foreldede(&conn, "notat.md", &nåværende).unwrap().is_empty(), "og bare én gang");
    }

    #[test]
    fn fjernet_linje_kommer_ikke_tilbake_for_samme_tekst() {
        let conn = base();
        let doc = "Husk å spørre Kari om fakturaen.\n";
        let mut memo = Memo::new();
        let ut = understand::understand(doc, &Fast, &mut memo).unwrap();
        lagre(&conn, &retting(&ut[0].hash, &ut[0].text, Some(FJERNET), "")).unwrap();

        let mut memo = Memo::new();
        let mut igjen = understand::understand(doc, &Fast, &mut memo).unwrap();
        merge(&mut igjen, &aktive(&conn, "notat.md").unwrap());
        assert_eq!(igjen[0].correction.as_ref().unwrap().plass, FJERNET);
    }

    /// Angre er å lagre det som sto der før. Var det ingenting, er det å
    /// fjerne raden — og da er linja tilbake til det systemet leste.
    #[test]
    fn angre_gjenoppretter_både_fjernet_og_endret_linje() {
        let conn = base();
        let hash = understand::nøkkel("En tanke.");

        lagre(&conn, &retting(&hash, "En tanke.", Some(FJERNET), "")).unwrap();
        lagre(&conn, &retting(&hash, "En tanke.", None, "")).unwrap();
        assert!(aktive(&conn, "notat.md").unwrap().is_empty(), "angre en sletting");

        lagre(&conn, &retting(&hash, "En tanke.", Some("idé"), "Første")).unwrap();
        lagre(&conn, &retting(&hash, "En tanke.", Some("uavklart"), "Andre")).unwrap();
        lagre(&conn, &retting(&hash, "En tanke.", Some("idé"), "Første")).unwrap();
        assert_eq!(
            aktive(&conn, "notat.md").unwrap().get(&hash).unwrap().summary,
            "Første",
            "angre en endring"
        );
    }

    /// Poenget med å lagre dem: raden skal kunne leses som treningsdata.
    #[test]
    fn raden_holder_både_teksten_systemets_svar_og_brukerens() {
        let conn = base();
        let hash = understand::nøkkel("Kanskje vi burde ha depositum.");
        lagre(
            &conn,
            &retting(&hash, "Kanskje vi burde ha depositum.", Some("uavklart"), "Depositum"),
        )
        .unwrap();

        let (tekst, lest, handling, lest_kort, plass, kort, tid): (
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
        assert_eq!(tekst, "Kanskje vi burde ha depositum.");
        assert_eq!((lest.as_str(), handling.as_str()), ("beslutning", "bygg"));
        assert_eq!(lest_kort, "Systemets kortform");
        assert_eq!((plass.as_str(), kort.as_str()), ("uavklart", "Depositum"));
        assert!(tid > 1_700_000_000, "tidspunktet skal være ekte");
    }
}
