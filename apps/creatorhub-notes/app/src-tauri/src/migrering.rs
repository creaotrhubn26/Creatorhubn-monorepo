//! Fra hash-som-identitet til `avsnitt.id`.
//!
//! Dette er det farligste steget i prosjektet, og grunnen er én tabell:
//! `rettelser` inneholder det eneste i systemet brukeren har skrevet selv og
//! som ikke kan gjenskapes fra markdown-filene. Alt annet — forståelsen,
//! relasjonene, indeksen — kan bygges opp igjen ved å lese notatene på nytt.
//!
//! Fire ting følger av det:
//!
//! 1. **Sikkerhetskopi før noe skjer.** `vacuum into` gir en komplett kopi, og
//!    feiler av seg selv hvis fila finnes, så et navn som er i bruk kan ikke
//!    overskrives.
//! 2. **Alt eller ingenting.** Én transaksjon. Feiler den halvveis, står basen
//!    nøyaktig som før.
//! 3. **Kan kjøres på nytt.** Er skjemaet allerede nytt, gjør den ingenting.
//! 4. **Ingenting slettes stille.** De gamle tabellene blir stående som
//!    `*_gammel`, og rader som ikke lot seg koble telles og skrives til
//!    stderr. Det er sporet tilbake hvis noe likevel ble galt.

use rusqlite::{Connection, Result};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

/// Hva migreringen gjorde. Tallene er til for å kunne si det høyt — en
/// migrering som «gikk bra» uten å si hvor mange rader den flyttet er ikke noe
/// man kan etterprøve.
#[derive(Debug, Default, PartialEq)]
pub struct Rapport {
    pub kjørt: bool,
    pub avsnitt: usize,
    pub forstatt: usize,
    pub rettelser: usize,
    pub relasjoner: usize,
    /// Rader i de gamle tabellene som ikke lot seg koble til et avsnitt. De
    /// blir stående i `*_gammel`.
    pub ukoblede: usize,
    pub sikkerhetskopi: Option<PathBuf>,
}

fn finnes(conn: &Connection, tabell: &str) -> Result<bool> {
    conn.query_row(
        "select count(*) from sqlite_master where type = 'table' and name = ?1",
        [tabell],
        |r| r.get::<_, i64>(0),
    )
    .map(|n| n > 0)
}

fn har_kolonne(conn: &Connection, tabell: &str, kolonne: &str) -> Result<bool> {
    if !finnes(conn, tabell)? {
        return Ok(false);
    }
    let mut q = conn.prepare(&format!("pragma table_info({tabell})"))?;
    let mut rader = q.query_map([], |r| r.get::<_, String>(1))?;
    Ok(rader.any(|n| n.map(|n| n == kolonne).unwrap_or(false)))
}

/// Sant når basen fortsatt har `hash` som nøkkel. En fersk base har ingen av
/// tabellene og trenger ingenting.
pub fn trengs(conn: &Connection) -> Result<bool> {
    Ok(har_kolonne(conn, "forstatt", "hash")? || har_kolonne(conn, "rettelser", "hash")?)
}

/// Et navn som ikke er i bruk. `vacuum into` nekter å skrive over en fil som
/// finnes, og det er riktig — en kopi fra i går er mer verdt enn en kopi fra
/// et sekund siden.
fn ledig_kopinavn(db: &Path) -> PathBuf {
    let grunn = format!("{}.før-avsnitt-migrering", db.display());
    let første = PathBuf::from(&grunn);
    if !første.exists() {
        return første;
    }
    for n in 2..1000 {
        let kandidat = PathBuf::from(format!("{grunn}-{n}"));
        if !kandidat.exists() {
            return kandidat;
        }
    }
    PathBuf::from(format!("{grunn}-{}", crate::rettelser::nå()))
}

/// Kjører migreringen hvis den trengs. `db_sti` er fila basen ligger i; uten
/// den tas ingen sikkerhetskopi, som bare er riktig for en base i minnet.
pub fn kjør(conn: &mut Connection, db_sti: Option<&Path>) -> Result<Rapport> {
    if !trengs(conn)? {
        return Ok(Rapport::default());
    }

    let mut rapport = Rapport { kjørt: true, ..Default::default() };
    if let Some(db) = db_sti {
        let kopi = ledig_kopinavn(db);
        conn.execute("vacuum into ?1", [kopi.to_string_lossy()])?;
        eprintln!("migrering: sikkerhetskopi i {}", kopi.display());
        rapport.sikkerhetskopi = Some(kopi);
    }

    let tx = conn.transaction()?;

    // 1. Avsnittene selv, ett per (sti, hash) som finnes fra før. Rekkefølgen
    //    innen en kilde er radrekkefølgen i den gamle tabellen — den er ikke
    //    riktig, men den er entydig, og første lesning av notatet setter den
    //    riktig uten å bytte id: teksten er uendret, så treffet er eksakt.
    tx.execute_batch(
        "create table avsnitt (
           id           integer primary key autoincrement,
           kilde        text not null,
           rekkefolge   integer not null,
           avsender     text,
           innhold_hash text not null,
           tekst        text not null,
           unique(kilde, rekkefolge)
         );
         create index avsnitt_hash on avsnitt(innhold_hash);
         create index avsnitt_kilde on avsnitt(kilde);",
    )?;

    let mut rader: Vec<(String, String, String)> = Vec::new();
    if finnes(&tx, "forstatt")? {
        rader.extend(les_tre(&tx, "select sti, hash, tekst from forstatt order by rowid")?);
    }
    // Rettelser for avsnitt som ikke lenger står i `forstatt` — en foreldet
    // rettelse, eller en linje klassifiseringen aldri fikk lest. Raden har
    // teksten i seg, så avsnittet kan gjenskapes, og rettelsen overlever.
    if finnes(&tx, "rettelser")? {
        rader.extend(les_tre(&tx, "select sti, hash, tekst from rettelser order by rowid")?);
    }

    let mut neste: HashMap<String, i64> = HashMap::new();
    let mut sett: HashSet<(String, String)> = HashSet::new();
    for (sti, hash, tekst) in rader {
        if !sett.insert((sti.clone(), hash.clone())) {
            continue;
        }
        let n = neste.entry(sti.clone()).or_insert(0);
        tx.execute(
            "insert into avsnitt (kilde, rekkefolge, innhold_hash, tekst) values (?1, ?2, ?3, ?4)",
            rusqlite::params![sti, *n, hash, tekst],
        )?;
        *n += 1;
        rapport.avsnitt += 1;
    }

    // 2. De gamle tabellene legges til side under nytt navn. `forstatt_fts` og
    //    triggerne må vekk først: en ekstern-innhold-FTS5-tabell husker navnet
    //    på innholdstabellen sin, og det navnet følger ikke med i et
    //    `alter table rename`.
    if finnes(&tx, "forstatt")? {
        tx.execute_batch(
            "drop trigger if exists forstatt_ai;
             drop trigger if exists forstatt_ad;
             drop trigger if exists forstatt_au;
             drop table if exists forstatt_fts;
             alter table forstatt rename to forstatt_gammel;",
        )?;
    }
    if finnes(&tx, "rettelser")? {
        tx.execute_batch("alter table rettelser rename to rettelser_gammel;")?;
    }
    if finnes(&tx, "relasjoner")? {
        tx.execute_batch("alter table relasjoner rename to relasjoner_gammel;")?;
    }

    // 3. Det nye skjemaet, ordrett det samme som en fersk base får.
    tx.execute_batch(crate::minne::SKJEMA)?;
    tx.execute_batch(crate::rettelser::SKJEMA)?;

    // 4. Radene over, koblet på den innholdshashen de allerede har.
    if finnes(&tx, "forstatt_gammel")? {
        rapport.forstatt = tx.execute(
            "insert into forstatt \
               (avsnitt_id, tittel, tekst, type, handling, kortform, venter, tidspunkt) \
             select a.id, g.tittel, g.tekst, g.type, g.handling, g.kortform, g.venter, g.tidspunkt \
             from forstatt_gammel g \
             join avsnitt a on a.kilde = g.sti and a.innhold_hash = g.hash",
            [],
        )?;
        rapport.ukoblede += tell(&tx, "forstatt_gammel", "forstatt")?;
    }
    if finnes(&tx, "rettelser_gammel")? {
        rapport.rettelser = tx.execute(
            "insert into rettelser \
               (avsnitt_id, sti, tekst, lest_type, lest_handling, lest_kortform, \
                plass, kortform, tidspunkt, foreldet) \
             select a.id, g.sti, g.tekst, g.lest_type, g.lest_handling, g.lest_kortform, \
                    g.plass, g.kortform, g.tidspunkt, g.foreldet \
             from rettelser_gammel g \
             join avsnitt a on a.kilde = g.sti and a.innhold_hash = g.hash",
            [],
        )?;
        rapport.ukoblede += tell(&tx, "rettelser_gammel", "rettelser")?;
    }
    // Relasjonene hadde ingen sti i nøkkelen, så den samme teksten i to
    // notater var én rad. Den dommen gjaldt begge, og gjelder derfor begge
    // etterpå — raden utvides til hvert par av avsnitt den traff.
    if finnes(&tx, "relasjoner_gammel")? {
        rapport.relasjoner = tx.execute(
            "insert or ignore into relasjoner (avsnitt_id, annen_id, forhold, tidspunkt) \
             select a.id, b.id, g.forhold, g.tidspunkt \
             from relasjoner_gammel g \
             join avsnitt a on a.innhold_hash = g.hash \
             join avsnitt b on b.innhold_hash = g.annen_hash",
            [],
        )?;
        rapport.ukoblede += tx.query_row(
            "select count(*) from relasjoner_gammel g where not exists ( \
               select 1 from avsnitt a join avsnitt b on b.innhold_hash = g.annen_hash \
               where a.innhold_hash = g.hash)",
            [],
            |r| r.get::<_, i64>(0),
        )? as usize;
    }

    tx.commit()?;

    eprintln!(
        "migrering: {} avsnitt, {} forstått, {} rettelser, {} relasjoner",
        rapport.avsnitt, rapport.forstatt, rapport.rettelser, rapport.relasjoner
    );
    if rapport.ukoblede > 0 {
        eprintln!(
            "migrering: {} rader lot seg ikke koble til et avsnitt. De står \
             urørt i forstatt_gammel / rettelser_gammel / relasjoner_gammel.",
            rapport.ukoblede
        );
    }
    Ok(rapport)
}

fn les_tre(conn: &Connection, sql: &str) -> Result<Vec<(String, String, String)>> {
    conn.prepare(sql)?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .collect()
}

/// Rader i den gamle tabellen som ikke fikk en rad i den nye.
fn tell(conn: &Connection, gammel: &str, ny: &str) -> Result<usize> {
    let g: i64 = conn.query_row(&format!("select count(*) from {gammel}"), [], |r| r.get(0))?;
    let n: i64 = conn.query_row(&format!("select count(*) from {ny}"), [], |r| r.get(0))?;
    Ok((g - n).max(0) as usize)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::understand::nøkkel;

    /// Det gamle skjemaet, ordrett slik det sto før avsnittsidentiteten. Det
    /// er poenget med testene her: de skal møte de radene brukeren faktisk har
    /// på disk, ikke en rekonstruksjon av dem.
    const GAMMELT: &str = r#"
create table forstatt (
  sti       text not null,
  hash      text not null,
  tittel    text not null,
  tekst     text not null,
  type      text not null,
  handling  text not null,
  kortform  text not null,
  venter    text not null default '',
  tidspunkt integer not null,
  primary key (sti, hash)
);
create index forstatt_hash on forstatt(hash);

create virtual table forstatt_fts using fts5(
  kortform, tekst, content='forstatt', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 0'
);
create trigger forstatt_ai after insert on forstatt begin
  insert into forstatt_fts(rowid, kortform, tekst) values (new.rowid, new.kortform, new.tekst);
end;
create trigger forstatt_ad after delete on forstatt begin
  insert into forstatt_fts(forstatt_fts, rowid, kortform, tekst)
    values ('delete', old.rowid, old.kortform, old.tekst);
end;
create trigger forstatt_au after update on forstatt begin
  insert into forstatt_fts(forstatt_fts, rowid, kortform, tekst)
    values ('delete', old.rowid, old.kortform, old.tekst);
  insert into forstatt_fts(rowid, kortform, tekst) values (new.rowid, new.kortform, new.tekst);
end;

create table relasjoner (
  hash       text not null,
  annen_hash text not null,
  forhold    text not null,
  tidspunkt  integer not null,
  primary key (hash, annen_hash)
);

create table rettelser (
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

    const A: &str = "Kanskje vi burde ha depositum, men jeg er usikker på terskelen.";
    const B: &str = "Kartet skal ikke være startsiden likevel.";

    fn gammel_base() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(GAMMELT).unwrap();
        for (sti, tekst, kortform) in [
            ("a.md", A, "Depositum"),
            ("a.md", B, "Kartvisning"),
            ("b.md", A, "Depositum i et annet notat"),
        ] {
            conn.execute(
                "insert into forstatt (sti, hash, tittel, tekst, type, handling, kortform, venter, tidspunkt) \
                 values (?1, ?2, 'Låne-app', ?3, 'tvil', 'marker_åpent', ?4, '', 1757000000)",
                rusqlite::params![sti, nøkkel(tekst), tekst, kortform],
            )
            .unwrap();
        }
        // Brukerens egen rettelse — den raden som ikke kan gjenskapes.
        conn.execute(
            "insert into rettelser (sti, hash, tekst, lest_type, lest_handling, lest_kortform, \
                                    plass, kortform, tidspunkt, foreldet) \
             values ('a.md', ?1, ?2, 'tvil', 'marker_åpent', 'Depositum', 'uavklart', \
                     'Depositum, ikke avgjort', 1757000001, 0)",
            rusqlite::params![nøkkel(A), A],
        )
        .unwrap();
        // Og en rettelse for et avsnitt som ikke står i `forstatt` i det hele
        // tatt: den skal også overleve.
        conn.execute(
            "insert into rettelser (sti, hash, tekst, lest_type, lest_handling, lest_kortform, \
                                    plass, kortform, tidspunkt, foreldet) \
             values ('c.md', ?1, 'Noe hun skrev om.', 'beslutning', 'bygg', 'Noe', 'idé', \
                     'Hennes ord', 1757000002, 1)",
            rusqlite::params![nøkkel("Noe hun skrev om.")],
        )
        .unwrap();
        conn.execute(
            "insert into relasjoner (hash, annen_hash, forhold, tidspunkt) values (?1, ?2, 'motsier', 1757000003)",
            rusqlite::params![nøkkel(B), nøkkel(A)],
        )
        .unwrap();
        conn
    }

    fn tall(conn: &Connection, sql: &str) -> i64 {
        conn.query_row(sql, [], |r| r.get(0)).unwrap()
    }

    /// Hele poenget: rettelsen og forståelsen skal finnes igjen etterpå, og de
    /// skal henge på riktig avsnitt — ikke på et avsnitt med samme tekst i et
    /// annet notat.
    #[test]
    fn rettelser_og_forståelse_finnes_igjen_knyttet_til_riktig_avsnitt() {
        let mut conn = gammel_base();
        let rapport = kjør(&mut conn, None).unwrap();
        assert!(rapport.kjørt);
        assert_eq!(rapport.forstatt, 3);
        assert_eq!(rapport.rettelser, 2, "også rettelsen uten rad i forstatt");
        assert_eq!(rapport.ukoblede, 0);

        // Den samme teksten i to notater er nå to avsnitt, ikke ett.
        assert_eq!(tall(&conn, &format!("select count(*) from avsnitt where innhold_hash = '{}'", nøkkel(A))), 2);

        let (sti, kortform): (String, String) = conn
            .query_row(
                "select a.kilde, r.kortform from rettelser r join avsnitt a on a.id = r.avsnitt_id \
                 where r.foreldet = 0",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(sti, "a.md", "rettelsen hørte til notatet hun skrev den i");
        assert_eq!(kortform, "Depositum, ikke avgjort");

        // Forståelsen henger på avsnittene, og ordsøket virker på den nye FTS-en.
        assert_eq!(tall(&conn, "select count(*) from forstatt"), 3);
        assert_eq!(
            tall(&conn, "select count(*) from forstatt_fts where forstatt_fts match 'depositum'"),
            2
        );

        // Relasjonen gjaldt en hash uten sti, og gjelder derfor begge avsnittene
        // som har den teksten — nøyaktig som før migreringen.
        assert_eq!(tall(&conn, "select count(*) from relasjoner"), 2);
        assert_eq!(
            tall(&conn, "select count(*) from relasjoner where forhold = 'motsier'"),
            2
        );
    }

    #[test]
    fn to_kjøringer_gir_det_samme_som_én() {
        let mut conn = gammel_base();
        kjør(&mut conn, None).unwrap();
        let før: Vec<i64> = ["avsnitt", "forstatt", "rettelser", "relasjoner"]
            .iter()
            .map(|t| tall(&conn, &format!("select count(*) from {t}")))
            .collect();

        let igjen = kjør(&mut conn, None).unwrap();
        assert_eq!(igjen, Rapport::default(), "andre kjøring skal ikke gjøre noe");
        let etter: Vec<i64> = ["avsnitt", "forstatt", "rettelser", "relasjoner"]
            .iter()
            .map(|t| tall(&conn, &format!("select count(*) from {t}")))
            .collect();
        assert_eq!(før, etter, "ingenting skal være duplisert");
    }

    /// Feiler den halvveis, skal basen være som før — ikke halvveis migrert.
    /// Feilen som injiseres er ekte: et `rettelser_gammel` som allerede finnes
    /// gjør at `alter table rename` nekter, og det skjer etter at `avsnitt` er
    /// laget og fylt.
    #[test]
    fn en_migrering_som_feiler_halvveis_lar_basen_stå_urørt() {
        let mut conn = gammel_base();
        conn.execute_batch("create table rettelser_gammel (x integer);").unwrap();

        assert!(kjør(&mut conn, None).is_err(), "renamen skal feile");

        assert!(!finnes(&conn, "avsnitt").unwrap(), "avsnitt skal være rullet tilbake");
        assert!(har_kolonne(&conn, "forstatt", "hash").unwrap(), "forstatt skal stå som før");
        assert!(finnes(&conn, "forstatt_fts").unwrap(), "og FTS-en med den");
        assert_eq!(tall(&conn, "select count(*) from rettelser"), 2, "rettelsene er urørt");
        assert_eq!(
            tall(&conn, "select count(*) from forstatt"),
            3,
            "og forståelsen også"
        );
        assert!(trengs(&conn).unwrap(), "basen er fortsatt umigrert");
    }

    /// En fersk base har ingen gamle tabeller, og skal ikke røres.
    #[test]
    fn en_fersk_base_migreres_ikke() {
        let mut conn = Connection::open_in_memory().unwrap();
        assert_eq!(kjør(&mut conn, None).unwrap(), Rapport::default());
        conn.execute_batch(crate::minne::SKJEMA).unwrap();
        conn.execute_batch(crate::rettelser::SKJEMA).unwrap();
        assert_eq!(kjør(&mut conn, None).unwrap(), Rapport::default());
    }

    /// Sikkerhetskopien er det eneste som står mellom en feil her og tapte
    /// rettelser. Den skal tas, og den skal aldri skrive over en som finnes.
    #[test]
    fn sikkerhetskopien_tas_og_overskriver_aldri_en_som_finnes() {
        let tmp = tempfile::tempdir().unwrap();
        let fil = tmp.path().join("notater.db");
        {
            let mut conn = Connection::open(&fil).unwrap();
            conn.execute_batch(GAMMELT).unwrap();
            conn.execute(
                "insert into rettelser (sti, hash, tekst, lest_type, lest_handling, lest_kortform, \
                                        plass, kortform, tidspunkt, foreldet) \
                 values ('a.md', ?1, ?2, 'tvil', 'hold', 'Depositum', 'uavklart', 'Mitt ord', 1, 0)",
                rusqlite::params![nøkkel(A), A],
            )
            .unwrap();
            let rapport = kjør(&mut conn, Some(&fil)).unwrap();
            let kopi = rapport.sikkerhetskopi.unwrap();
            assert!(kopi.exists());
            assert_eq!(kopi.file_name().unwrap(), "notater.db.før-avsnitt-migrering");
            // Kopien er den gamle basen, ikke den nye.
            let gammel = Connection::open(&kopi).unwrap();
            assert!(har_kolonne(&gammel, "rettelser", "hash").unwrap());
            assert_eq!(tall(&gammel, "select count(*) from rettelser"), 1);
        }

        // En base til på den samme stien — en ny maskin, en gjenopprettet fil.
        // Den første kopien skal ikke røres.
        for endelse in ["", "-wal", "-shm"] {
            let _ = std::fs::remove_file(format!("{}{endelse}", fil.display()));
        }
        let mut conn = Connection::open(&fil).unwrap();
        conn.execute_batch(GAMMELT).unwrap();
        let rapport = kjør(&mut conn, Some(&fil)).unwrap();
        assert_eq!(
            rapport.sikkerhetskopi.unwrap().file_name().unwrap(),
            "notater.db.før-avsnitt-migrering-2"
        );
        assert!(
            tmp.path().join("notater.db.før-avsnitt-migrering").exists(),
            "den første kopien står"
        );
    }
}
