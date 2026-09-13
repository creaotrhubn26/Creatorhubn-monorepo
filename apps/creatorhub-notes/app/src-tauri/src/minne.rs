//! Minnet — det appen har forstått før, lagret slik at det overlever omstart
//! og kan slås opp på tvers av notater.
//!
//! Tre ting bor her:
//!
//! 1. **Forståelsen**, ett avsnitt per rad, i den samme basen som indeksen og
//!    rettelsene. Uten den lever klassifiseringen bare mens appen kjører, og
//!    ingenting av resten er mulig.
//! 2. **Tidligere om dette** — ordsøk først, modell bare når ordsøket fant
//!    noe. Ordsøket er gratis; modellkallet er det eneste som koster.
//! 3. **Spørre-søk** — enkle regler som kjenner igjen «hva er uavklart» og
//!    slår det opp i strukturen. Ingen modell i søkefeltet: et søk som venter
//!    på et nettverkskall er ikke et søk.
//!
//! Rettelsene vinner overalt her, som de gjør i panelet: er en linje rettet,
//! er det brukerens kortform som vises, og en linje hun har fjernet dukker
//! ikke opp igjen som et tidligere treff.

use crate::rettelser::nå;
use crate::understand::{Chunk, Label, Memo, Paragraph};
use creatorhub_notes_indexer::identitet::{match_avsnitt, Kjent, Match, Ny};
use rusqlite::{Connection, Result};
use serde::Serialize;
use std::collections::{HashMap, HashSet};

/// Egne tabeller i den samme fila appen allerede bruker. Indeksen kan
/// fortsatt slettes og bygges opp igjen fra notatene uten at dette ryker.
///
/// `forstatt_fts` er bygget som `chunk_fts` i indekseren: ekstern-innhold, så
/// FTS5 lagrer bare tokenindeksen, og triggerne under er det som holder den i
/// takt. `remove_diacritics 0` av samme grunn som der — æøå skal ikke foldes
/// bort.
///
/// **Identiteten er raden, ikke teksten.** `avsnitt.id` er det `forstatt`,
/// `rettelser` og `relasjoner` peker på. `innhold_hash` beholder sin ekte
/// jobb — «har jeg klassifisert denne teksten før» — og er derfor indeksert,
/// ikke nøkkel. `autoincrement` er ikke pynt: uten den gjenbruker SQLite
/// rowid-er, og en rettelse som hang igjen på en slettet id ville plutselig
/// festet seg på et fremmed avsnitt.
pub const SKJEMA: &str = r#"
create table if not exists avsnitt (
  id           integer primary key autoincrement,
  kilde        text not null,
  rekkefolge   integer not null,
  avsender     text,
  innhold_hash text not null,
  tekst        text not null,
  unique(kilde, rekkefolge)
);
create index if not exists avsnitt_hash on avsnitt(innhold_hash);
create index if not exists avsnitt_kilde on avsnitt(kilde);

create table if not exists forstatt (
  avsnitt_id integer primary key,
  tittel     text not null,
  tekst      text not null,
  type       text not null,
  handling   text not null,
  kortform   text not null,
  venter     text not null default '',
  tidspunkt  integer not null,
  lest       integer not null default 0,
  modell     text not null default ''
);

create virtual table if not exists forstatt_fts using fts5(
  kortform,
  tekst,
  content='forstatt',
  content_rowid='avsnitt_id',
  tokenize='unicode61 remove_diacritics 0'
);

create trigger if not exists forstatt_ai after insert on forstatt begin
  insert into forstatt_fts(rowid, kortform, tekst)
    values (new.avsnitt_id, new.kortform, new.tekst);
end;

create trigger if not exists forstatt_ad after delete on forstatt begin
  insert into forstatt_fts(forstatt_fts, rowid, kortform, tekst)
    values ('delete', old.avsnitt_id, old.kortform, old.tekst);
end;

create trigger if not exists forstatt_au after update on forstatt begin
  insert into forstatt_fts(forstatt_fts, rowid, kortform, tekst)
    values ('delete', old.avsnitt_id, old.kortform, old.tekst);
  insert into forstatt_fts(rowid, kortform, tekst)
    values (new.avsnitt_id, new.kortform, new.tekst);
end;

create table if not exists relasjoner (
  avsnitt_id integer not null,
  annen_id   integer not null,
  forhold    text not null,
  tidspunkt  integer not null,
  avvist     integer not null default 0,
  primary key (avsnitt_id, annen_id)
);
"#;

/// Kolonner som kom til etter at skjemaet først ble skrevet. `create table if
/// not exists` rører ikke en tabell som finnes, så en base fra i går har dem
/// ikke. `alter table add column` er den lille veien: den beholder radene, og
/// «duplicate column name» betyr bare at jobben allerede er gjort.
const KOLONNER: [&str; 3] = [
    "alter table forstatt add column lest integer not null default 0",
    "alter table forstatt add column modell text not null default ''",
    "alter table relasjoner add column avvist integer not null default 0",
];

pub fn sørg_for_tabeller(conn: &Connection) -> Result<()> {
    conn.execute_batch(SKJEMA)?;
    for sql in KOLONNER {
        let _ = conn.execute(sql, []);
    }
    Ok(())
}

// ---- avsnittsidentitet --------------------------------------------------

/// Gir kilden sine avsnitt, og svarer med id-en hvert av dem skal ha — i samme
/// rekkefølge som `tekster`.
///
/// Uendret tekst treffer eksakt, en rettet skrivefeil treffer på likhet og
/// beholder id-en, og bare det som ikke ligner på noe fra før får en ny. Det
/// er dette som gjør at brukerens rettelse overlever at hun retter en
/// skrivefeil i avsnittet den hang på.
///
/// Alt skjer i én transaksjon: radene for kilden slettes og settes inn igjen
/// med de samme id-ene. Det er enklere enn å flytte `rekkefolge` rundt uten å
/// bryte `unique(kilde, rekkefolge)` underveis, og `autoincrement` gjør at en
/// id som forsvinner aldri dukker opp igjen på noe annet.
///
/// `avsendere` er parvis med `tekster` når kilden er en samtale, og tom ellers
/// — et vanlig notat har ingen avsender, og kolonnen skal stå tom.
///
/// **Tom tekst synkes aldri.** Slettingen under er det som gjør at en tom
/// lesning utsletter kildens identitet: alle id-ene forsvinner, og kalleren
/// merker samtlige rettelser foreldet fordi ingen av dem finnes lenger.
/// Teksten kan angres fram igjen; rettelsene er det eneste i systemet
/// brukeren har skrevet som ikke kan gjenskapes fra markdown.
///
/// Vakten er tom tekst, ikke et brått fall i antall avsnitt. Grunnen er at et
/// fall også er en helt vanlig ting å gjøre — hun stryker fire av fem avsnitt
/// — og en vakt mot det ville nektet å synke igjen for alltid, siden neste
/// lesning sammenligner mot det samme gamle settet. Den ene kilden til et
/// *utilsiktet* fall, en avkortet fil, er lukket i [`crate::write_note`], som
/// skriver til en midlertidig fil og gir den nytt navn. Et fall som ikke er
/// tomt tar heller ikke rettelsene med seg: [`match_avsnitt`] beholder id-en
/// til avsnittene som står igjen, og bare de som faktisk er borte foreldes.
pub fn synk(
    conn: &mut Connection,
    kilde: &str,
    tekster: &[String],
    avsendere: &[Option<String>],
) -> Result<Vec<i64>> {
    if tekster.is_empty() {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_MISUSE),
            Some(format!("tom lesning av {kilde}: avsnittene beholdes")),
        ));
    }

    let kjente: Vec<(Kjent, String)> = conn
        .prepare(
            "select id, rekkefolge, tekst, coalesce(avsender, '') from avsnitt \
             where kilde = ?1 order by rekkefolge",
        )?
        .query_map([kilde], |r| {
            Ok((
                Kjent {
                    id: r.get(0)?,
                    rekkefolge: r.get::<_, i64>(1)? as usize,
                    tekst: r.get(2)?,
                },
                r.get(3)?,
            ))
        })?
        .collect::<Result<_>>()?;

    let nye: Vec<Ny> = tekster
        .iter()
        .enumerate()
        .map(|(i, t)| Ny { rekkefolge: i, tekst: t.clone() })
        .collect();
    let treff = match_per_avsender(&kjente, &nye, avsendere);

    let beholdt: HashSet<i64> = treff
        .iter()
        .filter_map(|m| match m {
            Match::Samme(id) | Match::Endret(id) => Some(*id),
            Match::Nytt => None,
        })
        .collect();

    let tx = conn.transaction()?;
    tx.execute("delete from avsnitt where kilde = ?1", [kilde])?;

    let mut ut = Vec::with_capacity(nye.len());
    for (i, (ny, m)) in nye.iter().zip(&treff).enumerate() {
        let hash = crate::understand::nøkkel(&ny.tekst);
        let avsender = avsendere.get(i).cloned().flatten();
        let id = match m {
            Match::Samme(id) | Match::Endret(id) => {
                tx.execute(
                    "insert into avsnitt (id, kilde, rekkefolge, avsender, innhold_hash, tekst) \
                     values (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![id, kilde, i as i64, avsender, hash, ny.tekst],
                )?;
                // Er teksten skrevet om, gjelder ikke lesningen av den
                // gamle teksten lenger — verken kortformen, klassen eller
                // dommene om hvordan den henger sammen med andre avsnitt.
                // Raden ble før stående med `tekst` oppdatert og alt annet
                // fra i går, og «Tidligere om dette» siterte da det avsnittet
                // *pleide* å si. Å slette er den trygge retningen: mangler
                // linja, er den bare borte til neste lesning; står den gal,
                // er den en påstand om hva hun har tenkt.
                if matches!(m, Match::Endret(_)) {
                    tx.execute("delete from forstatt where avsnitt_id = ?1", [id])?;
                    tx.execute(
                        "delete from relasjoner where avsnitt_id = ?1 or annen_id = ?1",
                        [id],
                    )?;
                }
                *id
            }
            Match::Nytt => {
                tx.execute(
                    "insert into avsnitt (kilde, rekkefolge, avsender, innhold_hash, tekst) \
                     values (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![kilde, i as i64, avsender, hash, ny.tekst],
                )?;
                tx.last_insert_rowid()
            }
        };
        ut.push(id);
    }

    // Avsnitt som ikke står i kilden lenger: forståelsen og relasjonene deres
    // er utledet og ryddes bort. Rettelsen er brukerens egen og blir stående —
    // `rettelser::foreldede` merker den, og teksten hennes ligger i raden.
    for (k, _) in &kjente {
        if beholdt.contains(&k.id) {
            continue;
        }
        tx.execute("delete from forstatt where avsnitt_id = ?1", [k.id])?;
        tx.execute(
            "delete from relasjoner where avsnitt_id = ?1 or annen_id = ?1",
            [k.id],
        )?;
    }

    crate::rettelser::gjenopplivt(&tx, &ut, tekster)?;
    tx.commit()?;
    Ok(ut)
}

/// [`match_avsnitt`], men aldri på tvers av avsendere.
///
/// I en samtale er «Ja, enig» fra Marius og «Ja, enig» fra Kari to avsnitt som
/// er tegn for tegn like. Uten avgrensningen kunne de bytte identitet ved en
/// reimport, og rettelsen hun gjorde på Marius' linje havne på Karis.
/// `IDENTITET.md` skrev opp nøyaktig dette som uløst da samtaleimport ennå
/// ikke fantes; nå finnes den.
///
/// Et vanlig notat har ingen avsendere, og da er dette ett kall med alt i —
/// altså nøyaktig som før.
fn match_per_avsender(
    kjente: &[(Kjent, String)],
    nye: &[Ny],
    avsendere: &[Option<String>],
) -> Vec<Match> {
    if avsendere.iter().all(|a| a.is_none()) && kjente.iter().all(|(_, a)| a.is_empty()) {
        let bare: Vec<Kjent> = kjente.iter().map(|(k, _)| k.clone()).collect();
        return match_avsnitt(&bare, nye);
    }

    let navn = |i: usize| avsendere.get(i).cloned().flatten().unwrap_or_default();
    let mut ut = vec![Match::Nytt; nye.len()];
    let mut sett: HashSet<String> = HashSet::new();
    for i in 0..nye.len() {
        let hvem = navn(i);
        if !sett.insert(hvem.clone()) {
            continue;
        }
        // Rekkefølgen er den lokale i gruppa. Nærhetsleddet i `match_avsnitt`
        // sammenligner da innlegg fra samme person med hverandre, som er den
        // rekkefølgen som betyr noe her.
        let mine: Vec<Kjent> = kjente
            .iter()
            .filter(|(_, a)| *a == hvem)
            .enumerate()
            .map(|(n, (k, _))| Kjent { rekkefolge: n, ..k.clone() })
            .collect();
        let plasser: Vec<usize> = (0..nye.len()).filter(|j| navn(*j) == hvem).collect();
        let deres: Vec<Ny> = plasser
            .iter()
            .enumerate()
            .map(|(n, j)| Ny { rekkefolge: n, tekst: nye[*j].tekst.clone() })
            .collect();
        for (plass, m) in plasser.iter().zip(match_avsnitt(&mine, &deres)) {
            ut[*plass] = m;
        }
    }
    ut
}

/// Rydder bort avsnitt fra notater som ikke finnes lenger.
///
/// [`synk`] rydder bare innenfor den kilden den kalles med, og den kalles bare
/// når notatet leses. Et slettet notat sto derfor igjen for alltid: «Tidligere
/// om dette» siterte det, klikk på linja feilet, og et omdøpt notat mater
/// begge navn inn i hver eneste prompt.
///
/// Bare det utledede slettes — `forstatt` og `relasjoner` følger med `avsnitt`
/// via løkka under. Rettelsene blir liggende: de er hennes, og
/// [`crate::rettelser::gjenopplivt`] gir dem tilbake til teksten sin om den
/// dukker opp igjen under et nytt navn.
///
/// Tom liste rydder ingenting. En notatmappe som ikke lot seg lese skal ikke
/// se ut som en tom notatmappe.
pub fn rydd(conn: &Connection, stier: &[String]) -> Result<usize> {
    if stier.is_empty() {
        return Ok(0);
    }
    let plasser = vec!["?"; stier.len()].join(",");
    let borte: Vec<i64> = conn
        .prepare(&format!("select id from avsnitt where kilde not in ({plasser})"))?
        .query_map(rusqlite::params_from_iter(stier), |r| r.get(0))?
        .collect::<Result<_>>()?;
    for id in &borte {
        conn.execute("delete from forstatt where avsnitt_id = ?1", [id])?;
        conn.execute(
            "delete from relasjoner where avsnitt_id = ?1 or annen_id = ?1",
            [id],
        )?;
        conn.execute("delete from avsnitt where id = ?1", [id])?;
    }
    Ok(borte.len())
}

// ---- forståelsen som overlever -----------------------------------------

/// Det som er klassifisert før, slått opp på innholdshash. Dette er den ene
/// jobben hashen fortsatt har: «har jeg klassifisert denne teksten før». Det
/// samme avsnittet i to notater er to avsnitt med hver sin id, men bare én
/// klassifisering — nøyaktig som hukommelsen i prosessen.
pub fn kjente(conn: &Connection, hasher: &[String]) -> Result<Memo> {
    if hasher.is_empty() {
        return Ok(Memo::new());
    }
    let plasser = vec!["?"; hasher.len()].join(",");
    let mut q = conn.prepare(&format!(
        "select a.innhold_hash, f.type, f.handling, f.kortform, f.venter, f.lest, f.modell \
         from forstatt f join avsnitt a on a.id = f.avsnitt_id \
         where a.innhold_hash in ({plasser})"
    ))?;
    // Også gamle lesninger hentes inn. De er ikke ferske nok til å slippe en
    // ny runde ([`Label::fersk`]), men de skal stå i panelet mens den runden
    // pågår — og bli stående med alderen sin om den feiler.
    let rader = q.query_map(rusqlite::params_from_iter(hasher), |r| {
        let hash: String = r.get(0)?;
        let venter: String = r.get(4)?;
        Ok((
            hash,
            Label {
                kind: r.get(1)?,
                action: r.get(2)?,
                summary: r.get(3)?,
                dependency: if venter.is_empty() { None } else { Some(venter) },
                lest: r.get(5)?,
                modell: r.get(6)?,
            },
        ))
    })?;

    let mut ut = Memo::new();
    for rad in rader {
        let (hash, label) = rad?;
        if let Ok(nøkkel) = u64::from_str_radix(&hash, 16) {
            ut.insert(nøkkel, label);
        }
    }
    Ok(ut)
}

/// Lagrer det notatets avsnitt er forstått som. Å rydde bort avsnitt som ikke
/// står i notatet lenger er [`synk`] sin jobb — den vet hvilke id-er som ble
/// borte, og denne vet bare hva de som står der betyr.
///
/// `skrevet` er dagen tanken ble skrevet, så godt kilden vet det — datoen i
/// toppfeltet, eller filas endringstidspunkt. `None` når ingen av dem finnes,
/// og da lagres 0: panelet viser heller ingen dato enn en gal.
///
/// Dette sto tidligere som `nå()`, altså dagen klassifiseringen kjørte. En
/// importert tråd eller en gammel fil fikk dermed dagens dato på hver linje,
/// og «Du forkastet dette 10. september» kunne være en usann påstand om
/// brukerens egen historikk — sagt med samme sikre stemme som en sann.
///
/// Ved oppdatering beholdes den *tidligste* kjente datoen. Toppfeltdatoen er
/// stabil, så den vinner over en filtid som flytter seg hver gang notatet
/// lagres; og en rad som allerede står med en gal dato fra før retter seg selv
/// første gang notatet leses med en eldre kilde tilgjengelig.
///
/// Avsnitt uten id hoppes over. Det betyr at basen ikke var tilgjengelig da
/// notatet ble lest, og da er det riktigere å lagre ingenting enn å lagre alt
/// under den samme nullen.
pub fn lagre(
    conn: &Connection,
    tittel: &str,
    avsnitt: &[Paragraph],
    skrevet: Option<i64>,
) -> Result<()> {
    for a in avsnitt.iter().filter(|a| a.id > 0) {
        conn.execute(
            "insert into forstatt \
               (avsnitt_id, tittel, tekst, type, handling, kortform, venter, tidspunkt, \
                lest, modell) \
             values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) \
             on conflict(avsnitt_id) do update set \
               tittel = excluded.tittel, tekst = excluded.tekst, type = excluded.type, \
               handling = excluded.handling, kortform = excluded.kortform, \
               venter = excluded.venter, \
               lest = excluded.lest, modell = excluded.modell, \
               tidspunkt = case \
                 when forstatt.tidspunkt = 0 then excluded.tidspunkt \
                 when excluded.tidspunkt = 0 then forstatt.tidspunkt \
                 else min(forstatt.tidspunkt, excluded.tidspunkt) end",
            rusqlite::params![
                a.id,
                tittel,
                a.text,
                a.kind,
                a.action,
                a.summary,
                a.dependency.clone().unwrap_or_default(),
                skrevet.unwrap_or(0),
                a.lest,
                a.modell.clone(),
            ],
        )?;
    }
    Ok(())
}

// ---- kandidater via ordsøk ---------------------------------------------

/// Ord som står i annethvert avsnitt og derfor ikke sier noe om hva avsnittet
/// handler om. Uten denne lista kobles to tanker fordi begge inneholder
/// «kanskje», og panelet blir støy brukeren lærer å overse.
const VANLIGE: &[&str] = &[
    "ikke", "skal", "også", "dette", "denne", "noen", "noe", "kanskje", "eller", "etter",
    "hvis", "bare", "være", "blir", "kunne", "burde", "skulle", "veldig", "mange", "måtte",
    "gjøre", "ting", "sånn", "slik", "fordi", "siden", "uten", "over", "under", "igjen",
    "alle", "helt", "litt", "mest", "vil", "kan", "man", "jeg", "det", "den", "som", "har",
    "med", "for", "til", "men", "der", "hva", "når", "hvor", "hvorfor", "egentlig",
    "likevel", "altså", "derfor", "sammen", "andre", "første", "siste", "nytt", "nye",
    "gammel", "her", "bør", "vet", "tror", "synes", "mener", "ville", "hadde",
];

/// Ordene i et avsnitt som er verdt å lete med: minst fire tegn, ikke på lista
/// over vanlige ord, og hvert ord bare én gang.
pub fn søkeord(tekst: &str) -> Vec<String> {
    let mut sett = HashSet::new();
    let mut ut = Vec::new();
    for ord in tekst.split(|c: char| !c.is_alphanumeric()) {
        let ord = ord.to_lowercase();
        if ord.chars().count() < 4 || VANLIGE.contains(&ord.as_str()) {
            continue;
        }
        if sett.insert(ord.clone()) {
            ut.push(ord);
        }
    }
    // De tolv lengste, ikke de tolv første. Før brøt løkka på tolv treff i
    // leserekkefølge, og for et langt avsnitt var det åpningssetningen alene
    // som avgjorde hva «Tidligere om dette» kunne finne i det hele tatt.
    //
    // ponytail: ordlengde er et grovt mål på særegenhet. Det riktige målet er
    // hvor sjeldent ordet er i det hun har skrevet, og det ligger allerede i
    // `forstatt_fts` — men det koster et oppslag per ord per avsnitt ved hver
    // lagring, og lengde tar «depositum» framfor «tror» uten å koste noe.
    ut.sort_by_key(|o| std::cmp::Reverse(o.chars().count()));
    ut.truncate(12);
    ut
}

/// Hvert ord sitert for seg og satt sammen med `OR`, som i indekserens
/// tekstsøk: siteringen slår av all FTS5-syntaks, så et avsnitt med `(v2)`
/// eller `"async"?` kan aldri kaste en syntaksfeil.
fn fts_uttrykk(ord: &[String]) -> String {
    ord.iter()
        .map(|o| format!("\"{}\"", o.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" OR ")
}

#[derive(Clone, Debug)]
pub struct Kandidat {
    pub id: i64,
    /// Innholdshashen, som er det som finner avsnittet igjen i notatfila.
    pub hash: String,
    pub sti: String,
    pub tittel: String,
    pub tekst: String,
    pub kortform: String,
    pub tidspunkt: i64,
}

/// Tidligere avsnitt som deler ord med dette. Gratis: ingen modell, ingen
/// nettverk. At ordene overlapper betyr ikke at tankene gjør det — det er
/// modellen som avgjør etterpå.
///
/// ponytail: ingen tidsgrense på «tidligere», bare at det ikke er avsnittet
/// selv. Datoen står på linja, så brukeren ser hva som er hva.
pub fn kandidater(
    conn: &Connection,
    tekst: &str,
    egen_id: i64,
    antall: usize,
) -> Result<Vec<Kandidat>> {
    let ord = søkeord(tekst);
    if ord.is_empty() {
        return Ok(Vec::new());
    }
    let mut q = conn.prepare(
        "select f.avsnitt_id, a.innhold_hash, a.kilde, f.tittel, f.tekst, \
                coalesce(nullif(r.kortform, ''), f.kortform), f.tidspunkt \
         from (select rowid, bm25(forstatt_fts) as rank from forstatt_fts \
               where forstatt_fts match ?1 order by rank limit ?2) k \
         join forstatt f on f.avsnitt_id = k.rowid \
         join avsnitt a on a.id = f.avsnitt_id \
         left join rettelser r on r.avsnitt_id = f.avsnitt_id and r.foreldet = 0 \
         where f.avsnitt_id <> ?3 \
           and (r.plass is null or r.plass not in ('fjernet', 'ferdig')) \
         order by k.rank",
    )?;
    let rader = q.query_map(
        rusqlite::params![fts_uttrykk(&ord), (antall + 6) as i64, egen_id],
        |r| {
            Ok(Kandidat {
                id: r.get(0)?,
                hash: r.get(1)?,
                sti: r.get(2)?,
                tittel: r.get(3)?,
                tekst: r.get(4)?,
                kortform: r.get(5)?,
                tidspunkt: r.get(6)?,
            })
        },
    )?;

    let mut ut = Vec::new();
    let mut sett = HashSet::new();
    for rad in rader {
        let k = rad?;
        if sett.insert(k.id) {
            ut.push(k);
        }
        if ut.len() == antall {
            break;
        }
    }
    Ok(ut)
}

// ---- forholdet mellom to avsnitt ---------------------------------------

pub const FORHOLD: [&str; 4] = ["motsier", "bekrefter", "besvarer", "urelatert"];
pub const URELATERT: &str = "urelatert";

/// Begge lesningene så en kobling, men ikke den samme. Da påstår ikke appen
/// noen retning — den sier bare at hun har skrevet om dette før, og lar henne
/// lese selv.
///
/// Dette er ikke et svar en modell kan gi. Det oppstår bare av at de to
/// lesningene er uenige, og `parse_forhold` tar det imot fordi `slå_sammen`
/// skriver det inn i den samme svarstrengen som modellen svarer med.
///
/// Grunnen står i `klassifiseringstest/RELASJONER.md`: måltallet «falsk
/// kobling» er rent, men etiketten på en *ekte* kobling bommer ofte, og den
/// som bommer er `motsier` — den ene som bærer hele funksjonen. «Du bestemte
/// det samme 3. september» om et avsnitt der hun snudde er verre enn å ikke
/// vise linja i det hele tatt.
pub const NEVNT: &str = "nevnt";

/// Høyst så mange par sendes i ett kall. Grensen holder prompten kort og
/// svartiden nede; resten dømmes ved neste lagring.
const MAKS_PAR: usize = 15;

/// Kandidater per avsnitt. Tre er nok: ordsøket rangerer, og den fjerde
/// treffer sjelden på annet enn nok et felles ord.
const PER_AVSNITT: usize = 3;

const RELASJON: &str = "\
Du får par av avsnitt fra notatene til én person: ett hun skriver nå, og ett hun \
skrev tidligere. For hvert par sier du hva forholdet mellom dem er.

motsier    Hun sier nå noe som strider mot det hun bestemte eller forkastet før.
bekrefter  Samme beslutning igjen, eller en utdyping av den.
besvarer   Det nye avgjør et spørsmål hun tidligere lot stå åpent.
urelatert  Ordene overlapper, men det handler ikke om det samme.

`urelatert` er det vanligste svaret, og skal være det. Parene er funnet ved at \
de deler ord, ikke ved at noen har forstått dem. «Kartverket» i et notat om \
eiendomsdata og «kart» i en app for å låne verktøy er urelatert. Samme fagfelt \
er heller ikke nok: forholdet må gjelde nøyaktig den samme saken.

En falsk kobling er den dyre feilen. Den forteller brukeren at hun har tenkt noe \
hun ikke har tenkt, og en liste med falske koblinger lærer hun seg å overse. Å \
overse en ekte kobling koster ingenting til sammenligning.

Er du i tvil, svar `urelatert`.

Svar med nøyaktig én linje per par, og ingenting annet:
<nummer>|<forhold>";

/// Bygger prompten for en bunke par. Nå-avsnittet står først i hvert par,
/// slik nummereringen i svaret refererer til dem.
///
/// `avviste` er par brukeren selv har sagt ikke hører sammen. De står som
/// eksempler, på samme måte som rettelsene gjør i klassifiseringsprompten:
/// en falsk kobling hun har tatt bort skal ikke komme tilbake i en ny drakt.
pub fn relasjonsprompt_med(par: &[(String, String)], avviste: &[(String, String)]) -> String {
    let kropp = par
        .iter()
        .enumerate()
        .map(|(i, (nytt, gammelt))| format!("{}.\nNå: {nytt}\nTidligere: {gammelt}", i + 1))
        .collect::<Vec<_>>()
        .join("\n\n");
    let lært = if avviste.is_empty() {
        String::new()
    } else {
        let linjer = avviste
            .iter()
            .map(|(a, b)| format!("«{a}»\nmot «{b}»"))
            .collect::<Vec<_>>()
            .join("\n\n");
        format!(
            "\n\nBrukeren har selv sagt at disse parene ikke hører sammen. Ligner et par \
             under på et av dem, svar `urelatert`:\n\n{linjer}"
        )
    };
    format!("{RELASJON}{lært}\n\nParene:\n\n{kropp}")
}

/// Tolker svaret. Tåler det samme ruskete som klassifiseringen gjør:
/// innledning, kodegjerder, punktliste og etterprat. En linje som ikke er et
/// gyldig forhold hoppes over, og et par uten svar blir `urelatert` — den
/// trygge utgangen, siden en kobling som ikke vises ikke kan lyve.
pub fn parse_forhold(svar: &str, antall: usize) -> Vec<Option<String>> {
    let mut ut = vec![None; antall];
    for linje in svar.lines() {
        let linje = linje.trim().trim_start_matches("```").trim();
        let linje = linje
            .strip_prefix("- ")
            .or_else(|| linje.strip_prefix("* "))
            .unwrap_or(linje);
        let mut deler = linje.splitn(2, '|');
        let (Some(n), Some(forhold)) = (deler.next(), deler.next()) else {
            continue;
        };
        let n = n.trim().trim_end_matches(['.', ')']).trim();
        let Ok(n) = n.parse::<usize>() else { continue };
        // Bare første ord: «urelatert (deler bare ordet kart)» er fortsatt et
        // svar, og skal telle som det.
        let forhold = forhold
            .trim()
            .split(|c: char| !c.is_alphabetic())
            .find(|d| !d.is_empty())
            .unwrap_or("")
            .to_lowercase();
        if n == 0 || n > antall || !(FORHOLD.contains(&forhold.as_str()) || forhold == NEVNT) {
            continue;
        }
        ut[n - 1] = Some(forhold);
    }
    ut
}

/// Setter sammen svaret fra to lesninger. `koblet` er plassene den første
/// lesningen koblet, med etiketten den ga dem, i samme rekkefølge som `dom`.
///
/// Retningen krever enighet:
///
/// - begge sier det samme → den formuleringen vises
/// - begge ser en kobling, men ikke den samme → [`NEVNT`], uten retning
/// - én av dem sier `urelatert` → ingenting vises
///
/// At det blir en svarstreng og ikke en ferdig liste er med vilje: da er
/// tolkningen fortsatt ett sted, og `parse_forhold` er det eneste som vet
/// hvordan et svar ser ut.
pub fn slå_sammen(antall: usize, koblet: &[(usize, String)], dom: &[Option<String>]) -> String {
    let mut linjer: Vec<String> =
        (1..=antall).map(|n| format!("{n}|{URELATERT}")).collect();
    for (plass, (i, først)) in koblet.iter().enumerate() {
        // Uten svar er uten kobling: den trygge utgangen, som før.
        let Some(andre) = dom.get(plass).and_then(|f| f.as_ref()) else {
            continue;
        };
        if andre == URELATERT {
            continue;
        }
        let forhold = if andre == først { andre.as_str() } else { NEVNT };
        if let Some(linje) = linjer.get_mut(*i) {
            *linje = format!("{}|{forhold}", i + 1);
        }
    }
    linjer.join("\n")
}

/// Alt som kan avgjøre forholdet mellom avsnitt. Ett kall for hele bunken.
pub trait Dommer {
    fn døm(&self, par: &[(String, String)]) -> std::result::Result<String, String>;
}

/// Én linje i «Tidligere om dette».
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tidligere {
    /// `motsier`, `bekrefter`, `besvarer` eller [`NEVNT`]. `urelatert` kommer
    /// aldri hit.
    pub forhold: String,
    /// Avsnittet i notatet som står åpent.
    pub gjelder: i64,
    pub kortform: String,
    pub sti: String,
    pub tittel: String,
    /// Innholdshashen til det tidligere avsnittet, slik at det kan markeres
    /// når brukeren åpner notatet det står i. Posisjonen finnes ved å lete i
    /// fila etter teksten som gir denne hashen.
    pub hash: String,
    pub tidspunkt: i64,
}

/// Dommen over paret, om noen har felt den.
///
/// Også den motsatte veien. `A→B` og `B→A` er to rader, og var før dømt av to
/// separate kall som kunne lande ulikt: åpnet hun det gamle notatet, kunne det
/// si noe annet om det samme paret enn det nye gjorde. Nå gjenbrukes svaret,
/// oversatt til denne retningen.
///
/// `besvarer` er den ene etiketten som ikke kan snus — «det nye avgjør et
/// spørsmål du lot stå åpent» er ikke sant baklengs. Da faller den til
/// [`NEVNT`], som ikke påstår noen retning.
fn lagret_forhold(conn: &Connection, id: i64, annen: i64) -> Option<String> {
    if let Ok(f) = conn.query_row(
        "select forhold from relasjoner where avsnitt_id = ?1 and annen_id = ?2",
        (id, annen),
        |r| r.get::<_, String>(0),
    ) {
        return Some(f);
    }
    let motsatt: String = conn
        .query_row(
            "select forhold from relasjoner where avsnitt_id = ?1 and annen_id = ?2",
            (annen, id),
            |r| r.get(0),
        )
        .ok()?;
    Some(match motsatt.as_str() {
        "besvarer" => NEVNT.to_string(),
        _ => motsatt,
    })
}

/// Brukerens egen dom: disse to hører ikke sammen.
///
/// Raden skrives som `urelatert`, så alt som allerede slipper `urelatert`
/// gjennom uten å vise det gjelder også her — men `avvist` skiller hennes dom
/// fra modellens, slik at koblingen kan bli et eksempel neste gang det dømmes,
/// og slik at det finnes en vei tilbake.
///
/// Begge retninger skrives. Paret er avvist, ikke retningen.
pub fn avvis(conn: &Connection, gjelder: i64, annen: i64, avvist: bool) -> Result<()> {
    if !avvist {
        // Veien tilbake: raden er borte, paret er udømt, og det dømmes på
        // nytt ved neste lagring. Det koster et kall, og det er riktig pris
        // for at hun ombestemte seg.
        conn.execute(
            "delete from relasjoner \
             where (avsnitt_id = ?1 and annen_id = ?2) or (avsnitt_id = ?2 and annen_id = ?1)",
            (gjelder, annen),
        )?;
        return Ok(());
    }
    for (a, b) in [(gjelder, annen), (annen, gjelder)] {
        conn.execute(
            "insert into relasjoner (avsnitt_id, annen_id, forhold, tidspunkt, avvist) \
             values (?1, ?2, ?3, ?4, 1) \
             on conflict(avsnitt_id, annen_id) do update set \
               forhold = excluded.forhold, avvist = 1",
            rusqlite::params![a, b, URELATERT, nå()],
        )?;
    }
    Ok(())
}

/// Par brukeren har sagt ikke hører sammen, som eksempler til neste dømming.
/// Nyeste først, og bare så mange at prompten fortsatt er kortere enn parene
/// den skal dømme.
pub fn avviste(conn: &Connection, antall: usize) -> Result<Vec<(String, String)>> {
    let mut q = conn.prepare(
        "select n.tekst, g.tekst from relasjoner r \
         join avsnitt n on n.id = r.avsnitt_id \
         join avsnitt g on g.id = r.annen_id \
         where r.avvist = 1 order by r.tidspunkt desc limit ?1",
    )?;
    let rader = q.query_map([antall as i64], |r| Ok((r.get(0)?, r.get(1)?)))?;
    rader.collect()
}

/// Leter i alt som er forstått før, og svarer med det som er verdt å vite.
///
/// Billigst først: ordsøket finner kandidatene uten å koste noe, og modellen
/// spørres bare om par ingen har dømt før. Et notat som står åpent uten at noe
/// endres koster derfor null kall, både første og tiende gang.
pub fn tidligere(
    conn: &Connection,
    avsnitt: &[Paragraph],
    dommer: &dyn Dommer,
) -> Result<Vec<Tidligere>> {
    let tekster: HashMap<i64, &str> =
        avsnitt.iter().map(|a| (a.id, a.text.as_str())).collect();
    let mut dømt: Vec<Tidligere> = Vec::new();
    let mut udømte: Vec<(Tidligere, i64, String)> = Vec::new();

    for a in avsnitt.iter().filter(|a| a.id > 0) {
        for k in kandidater(conn, &a.text, a.id, PER_AVSNITT)? {
            let linje = Tidligere {
                forhold: String::new(),
                gjelder: a.id,
                kortform: k.kortform,
                sti: k.sti,
                tittel: k.tittel,
                hash: k.hash,
                tidspunkt: k.tidspunkt,
            };
            match lagret_forhold(conn, a.id, k.id) {
                Some(forhold) => dømt.push(Tidligere { forhold, ..linje }),
                None if udømte.len() < MAKS_PAR => udømte.push((linje, k.id, k.tekst)),
                None => {}
            }
        }
    }

    if !udømte.is_empty() {
        let par: Vec<(String, String)> = udømte
            .iter()
            .map(|(linje, _, tekst)| {
                let nytt = tekster.get(&linje.gjelder).copied().unwrap_or_default();
                (nytt.to_string(), tekst.clone())
            })
            .collect();

        // Feiler kallet, står linjene vi allerede har. Ingen rad lagres, så
        // parene prøves igjen neste gang — det er bare når vi faktisk fikk et
        // svar at det er noe å huske.
        if let Ok(svar) = dommer.døm(&par) {
            let forhold = parse_forhold(&svar, par.len());
            for ((linje, annen_id, _), f) in udømte.into_iter().zip(forhold) {
                // Et par modellen ikke svarte på er ikke dømt. Det ble før
                // lagret som `urelatert` for alltid — en avkortet svarstreng
                // eller ett hoppet linjenummer kunne gjøre en ekte kobling
                // permanent usynlig, og ingenting prøvde igjen. Nå står paret
                // udømt: ingen linje vises nå, og spørsmålet stilles på nytt
                // neste gang notatet lagres.
                let Some(f) = f else { continue };
                conn.execute(
                    "insert into relasjoner (avsnitt_id, annen_id, forhold, tidspunkt) \
                     values (?1, ?2, ?3, ?4) \
                     on conflict(avsnitt_id, annen_id) do update set forhold = excluded.forhold",
                    rusqlite::params![linje.gjelder, annen_id, f, nå()],
                )?;
                dømt.push(Tidligere { forhold: f, ..linje });
            }
        }
    }

    // `urelatert` vises aldri. Rekkefølgen er hva som er verdt å avbryte
    // skrivingen for: en motsigelse først, så et svar, så en bekreftelse, og
    // sist den linja som ikke påstår noen retning i det hele tatt.
    let rang = |f: &str| match f {
        "motsier" => 0,
        "besvarer" => 1,
        "bekrefter" => 2,
        _ => 3,
    };
    dømt.retain(|l| l.forhold != URELATERT);
    dømt.sort_by_key(|l| (rang(&l.forhold), -l.tidspunkt));
    Ok(dømt)
}

// ---- rettelsene som eksempler ------------------------------------------

/// En rettelse gjort om til et eksempel klassifiseringen kan lære av.
#[derive(Clone, Debug, PartialEq)]
pub struct Eksempel {
    pub tekst: String,
    pub lest: String,
    pub rettet: String,
}

/// Plassene i panelet er brukerens ord. Prompten svarer i vårt vokabular, så
/// rettelsen må oversettes tilbake før den kan stå som et eksempel.
///
/// **Bare når hun faktisk flyttet linja.** Plassene er mange-til-én: både
/// `gjengivelse|hold` og `uenighet|hold` står under «Idé», og både
/// `begrensning|bygg` og `beslutning|bygg` under «Forstått». Rettet hun bare
/// kortformen og lot linja stå der den sto, sa oversettelsen før at hun rettet
/// `gjengivelse` til `tvil` — en rettelse hun aldri gjorde, som så sto i
/// prompten og styrte hver framtidige klassifisering. Nå står lesningens egen
/// type og handling, og bare kortformen er ny: eksempelet gjengir det hun
/// faktisk gjorde.
fn som_svar(plass: &str, kortform: &str, lest_type: &str, lest_handling: &str) -> Option<String> {
    if crate::rettelser::lest_plass(lest_type, lest_handling) == Some(plass) {
        return Some(format!("{lest_type}|{lest_handling}|{kortform}"));
    }
    let (kind, action) = match plass {
        "forstått" => ("beslutning", "bygg"),
        "uavklart" => ("spørsmål", "marker_åpent"),
        "oppgave" => ("oppgave", "ingenting"),
        "idé" => ("tvil", "hold"),
        // Linja hun tok bort hører ikke hjemme i panelet i det hele tatt, og
        // det er nøyaktig det en observasjon gjør.
        "fjernet" => ("observasjon", "ingenting"),
        // «Ferdig» er ikke en lesning av avsnittet, det er en beskjed om at
        // oppgaven er gjort. Den lærer klassifiseringen ingenting.
        _ => return None,
    };
    Some(format!("{kind}|{action}|{kortform}"))
}

/// Seks: nok til at et mønster hun har rettet to-tre ganger slår gjennom, og
/// lite nok til at taksonomien og tvilsregelen fortsatt er det lengste i
/// prompten. Rettelser er sjeldne. Blir de mange, er dette tallet noe som skal
/// måles på nytt, ikke gjettes på.
pub const ANTALL_EKSEMPLER: usize = 6;

/// De siste rettelsene, nyeste først.
///
/// Joiner mot `avsnitt`, slik [`crate::rettelser::aktive`] gjør. Uten joinen
/// kunne en rad panelet aldri viste — en rettelse lagret på `avsnitt_id = 0`
/// mens basen var nede — styre hver framtidige prompt, uten at brukeren hadde
/// noe sted å se den eller ta den bort.
pub fn eksempler(conn: &Connection, antall: usize) -> Result<Vec<Eksempel>> {
    let mut q = conn.prepare(
        "select r.tekst, r.lest_type, r.lest_handling, r.lest_kortform, r.plass, r.kortform \
         from rettelser r join avsnitt a on a.id = r.avsnitt_id \
         where r.foreldet = 0 order by r.tidspunkt desc limit ?1",
    )?;
    // Fire ganger så mange rader som plasser: rettelser som ikke rettet noe,
    // og gjentakelser av det samme mønsteret, kastes under.
    let rader = q.query_map([(antall * 4) as i64], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, String>(3)?,
            r.get::<_, String>(4)?,
            r.get::<_, String>(5)?,
        ))
    })?;

    let mut ut: Vec<Eksempel> = Vec::new();
    let mut sett = HashSet::new();
    for rad in rader {
        let (tekst, lest_type, lest_handling, lest_kortform, plass, kortform) = rad?;
        let kortform = if kortform.is_empty() { lest_kortform.clone() } else { kortform };
        let Some(rettet) = som_svar(&plass, &kortform, &lest_type, &lest_handling) else {
            continue;
        };
        let lest = format!("{lest_type}|{lest_handling}|{lest_kortform}");
        // En rettelse som ikke rettet noe lærer ingenting bort, og spiste før
        // en av seks plasser. Det samme gjør den andre og tredje utgaven av
        // det samme mønsteret: seks plasser skal romme seks mønstre.
        if rettet == lest || !sett.insert((lest.clone(), rettet.clone())) {
            continue;
        }
        ut.push(Eksempel { tekst, lest, rettet });
        if ut.len() == antall {
            break;
        }
    }
    Ok(ut)
}

// ---- spørre-søk ---------------------------------------------------------

/// Spørsmålene søkefeltet kjenner igjen. Rene regler, ikke et modellkall: et
/// søk som venter på nettverk er ikke et søk.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Mønster {
    Uavklart,
    Venter,
    Bestemt,
    Forkastet,
}

impl Mønster {
    pub fn overskrift(self) -> &'static str {
        match self {
            Mønster::Uavklart => "Uavklart",
            Mønster::Venter => "Venter på noe",
            Mønster::Bestemt => "Bestemt",
            Mønster::Forkastet => "Forkastet",
        }
    }
}

/// Ord som bare binder spørsmålet sammen, og som ikke skal brukes til å snevre
/// inn treffene.
const BINDEORD: &[&str] = &[
    "hva", "hvilke", "hvilken", "hvem", "har", "jeg", "vi", "er", "som", "om", "på", "noe",
    "alt", "det", "de", "en", "et", "og", "i", "for", "til", "min", "mine", "står", "ligger",
    "finnes", "ennå", "fortsatt", "igjen", "nå", "hos", "meg",
    // «hva ble bestemt» er den naturlige måten å spørre om en samtale på.
    // Uten disse snevrer «ble» inn treffene til ingenting.
    "ble", "blir", "var", "her", "tråden", "samtalen", "møtet",
];

fn inneholder(q: &str, ord: &[&str]) -> bool {
    ord.iter().any(|o| q.contains(o))
}

/// Kjenner igjen spørsmålet, og gir tilbake ordene som er igjen etterpå — «hva
/// har jeg bestemt om pipelinen» gir `Bestemt` og `["pipelinen"]`.
///
/// `None` betyr at dette er et vanlig søk. Da skjer det ingenting her, og
/// fritekstsøket står alene, som før.
pub fn mønster(q: &str) -> Option<(Mønster, Vec<String>)> {
    let lav = q.to_lowercase();
    let nøkler: &[&str];
    let m = if inneholder(&lav, &["forkast", "droppet", "vraket", "skrinlagt"]) {
        nøkler = &["forkastet", "forkaste", "forkastes", "droppet", "vraket", "skrinlagt"];
        Mønster::Forkastet
    } else if inneholder(
        &lav,
        &["uavklart", "avklart", "åpent", "åpne", "usikker", "tvil", "ubesvart"],
    ) {
        nøkler = &[
            "uavklart", "avklart", "åpent", "åpne", "usikkert", "usikker", "tvil", "spørsmål",
            "spørsmålene", "ubesvart",
        ];
        Mønster::Uavklart
    } else if inneholder(&lav, &["venter", "blokkert", "blokkerer", "avhengig"]) {
        nøkler = &["venter", "vente", "blokkert", "blokkerer", "avhengig", "avhengigheter"];
        Mønster::Venter
    } else if inneholder(&lav, &["bestemt", "besluttet", "beslutning", "bestemte"]) {
        nøkler = &["bestemt", "bestemte", "besluttet", "beslutning", "beslutninger"];
        Mønster::Bestemt
    } else {
        return None;
    };

    let resten = lav
        .split(|c: char| !c.is_alphanumeric())
        .filter(|o| !o.is_empty() && !nøkler.contains(o) && !BINDEORD.contains(o))
        .map(str::to_string)
        .collect();
    Some((m, resten))
}

/// Ett strukturert treff.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Linje {
    pub kortform: String,
    /// Hvem som sa det, når treffet står i en importert samtale. Uten den er
    /// en beslutningslogg bare en haug med løsrevne påstander.
    pub avsender: Option<String>,
    pub sti: String,
    pub tittel: String,
    pub hash: String,
    pub tidspunkt: i64,
    pub venter: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Svar {
    pub overskrift: String,
    pub treff: Vec<Linje>,
}

/// Stammen av et ord, til bruk i prefikssøk: «pipelinen» skal finne
/// «pipeline».
///
/// ponytail: en grov avkorting av bestemt form, ikke en orddeler. Indekserens
/// ordbank er svaret om dette viser seg å bomme, men den koster en nedlasting
/// og en oppslagstabell for det som her er ett ord i et søkefelt.
fn stamme(ord: &str) -> String {
    for endelse in ["ene", "ane", "en", "et", "er", "a"] {
        if ord.chars().count() > endelse.chars().count() + 3 {
            if let Some(rot) = ord.strip_suffix(endelse) {
                return rot.to_string();
            }
        }
    }
    ord.to_string()
}

fn prefiks_uttrykk(ord: &[String]) -> String {
    ord.iter()
        .map(|o| format!("\"{}\"*", stamme(o).replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" OR ")
}

/// Svarer på spørsmålet hvis søket er ett, ellers ingenting.
///
/// Rettelsene vinner her også: har brukeren flyttet en linje til «uavklart»,
/// står den blant de uavklarte selv om lesningen kalte den noe annet, og en
/// linje hun har fjernet er borte.
pub fn spør(conn: &Connection, q: &str) -> Result<Option<Svar>> {
    let Some((m, ord)) = mønster(q) else {
        return Ok(None);
    };

    let vilkår = match m {
        Mønster::Uavklart => {
            "(r.plass = 'uavklart' or (r.plass is null and f.type in ('spørsmål', 'tvil')))"
        }
        Mønster::Venter => {
            "(r.plass = 'oppgave' or (r.plass is null and f.type = 'oppgave')) \
             and coalesce(nullif(r.venter, ''), f.venter) <> ''"
        }
        Mønster::Bestemt => "(r.plass = 'forstått' or (r.plass is null and f.handling = 'bygg'))",
        Mønster::Forkastet => {
            "((r.plass is null and f.type = 'uenighet') \
              or f.avsnitt_id in (select annen_id from relasjoner where forhold = 'motsier'))"
        }
    };

    let filter = if ord.is_empty() {
        String::new()
    } else {
        " and f.avsnitt_id in (select rowid from forstatt_fts where forstatt_fts match ?1)"
            .to_string()
    };

    let sql = format!(
        "select coalesce(nullif(r.kortform, ''), f.kortform), a.kilde, f.tittel, \
                a.innhold_hash, f.tidspunkt, coalesce(nullif(r.venter, ''), f.venter), \
                a.avsender \
         from forstatt f \
         join avsnitt a on a.id = f.avsnitt_id \
         left join rettelser r on r.avsnitt_id = f.avsnitt_id and r.foreldet = 0 \
         where (r.plass is null or r.plass not in ('fjernet', 'ferdig')) \
           and {vilkår}{filter} \
         order by f.tidspunkt desc limit 40"
    );

    let les = |r: &rusqlite::Row| -> Result<Linje> {
        let venter: String = r.get(5)?;
        Ok(Linje {
            kortform: r.get(0)?,
            avsender: r.get(6)?,
            sti: r.get(1)?,
            tittel: r.get(2)?,
            hash: r.get(3)?,
            tidspunkt: r.get(4)?,
            venter: if venter.is_empty() { None } else { Some(venter) },
        })
    };

    let mut spørring = conn.prepare(&sql)?;
    let treff: Vec<Linje> = if ord.is_empty() {
        spørring.query_map([], les)?.collect::<Result<_>>()?
    } else {
        spørring.query_map([prefiks_uttrykk(&ord)], les)?.collect::<Result<_>>()?
    };

    Ok(Some(Svar { overskrift: m.overskrift().to_string(), treff }))
}

/// Hvor et avsnitt står i et notat, slått opp på nøkkelen. Brukes når en linje
/// i «Tidligere om dette» åpner notatet den peker på: uten posisjonen kan ikke
/// brukeren se hvilket avsnitt det var.
pub fn posisjon(doc: &str, hash: &str) -> Option<(usize, usize)> {
    crate::understand::split(doc)
        .into_iter()
        .find(|c: &Chunk| crate::understand::nøkkel(&c.text) == hash)
        .map(|c| (c.start, c.end))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rettelser;
    use crate::understand::{self, Classifier, Memo};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Mutex;

    /// Klassifikator uten nettverk. Teller kallene, slik at «koster null kall»
    /// er noe som måles og ikke antas.
    struct Fake {
        kall: AtomicUsize,
    }
    impl Fake {
        fn new() -> Self {
            Fake { kall: AtomicUsize::new(0) }
        }
    }
    impl Classifier for Fake {
        fn ask(&self, texts: &[String]) -> std::result::Result<String, String> {
            self.kall.fetch_add(1, Ordering::Relaxed);
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

    /// Dommer uten nettverk: svarer det den er bedt om å svare, og husker
    /// hvilke par den fikk se.
    struct FakeDommer {
        svar: String,
        par: Mutex<Vec<(String, String)>>,
        kall: AtomicUsize,
    }
    impl FakeDommer {
        fn new(svar: &str) -> Self {
            FakeDommer {
                svar: svar.to_string(),
                par: Mutex::new(Vec::new()),
                kall: AtomicUsize::new(0),
            }
        }
    }
    impl Dommer for FakeDommer {
        fn døm(&self, par: &[(String, String)]) -> std::result::Result<String, String> {
            self.kall.fetch_add(1, Ordering::Relaxed);
            self.par.lock().unwrap().extend_from_slice(par);
            Ok(self.svar.clone())
        }
    }

    fn base() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        rettelser::sørg_for_tabell(&conn).unwrap();
        sørg_for_tabeller(&conn).unwrap();
        conn
    }

    /// Ett avsnitt slik lesningen lager det — uten id, som den gjør.
    fn p(tekst: &str, kortform: &str) -> Paragraph {
        Paragraph {
            id: 0,
            start: 0,
            end: 0,
            hash: understand::nøkkel(tekst),
            text: tekst.to_string(),
            summary: kortform.to_string(),
            avsender: None,
            kind: "beslutning".into(),
            action: "bygg".into(),
            dependency: None,
            correction: None,
            lest: crate::rettelser::nå(),
            modell: understand::MODEL.to_string(),
        }
    }

    /// Gir avsnittene id-ene kilden gir dem, slik appen gjør ved hver lesning.
    fn med_ider(conn: &mut Connection, sti: &str, mut avsnitt: Vec<Paragraph>) -> Vec<Paragraph> {
        let tekster: Vec<String> = avsnitt.iter().map(|a| a.text.clone()).collect();
        let ider = synk(conn, sti, &tekster, &[]).unwrap();
        for (a, id) in avsnitt.iter_mut().zip(ider) {
            a.id = id;
        }
        avsnitt
    }

    /// Det ene som ikke kan gjenskapes fra markdown. En avkortet fil, eller en
    /// lesning startet på en tom buffer, slettet alle avsnittsradene for
    /// kilden — og da fant `foreldede` ingen av id-ene igjen og merket
    /// samtlige rettelser utdaterte.
    #[test]
    fn tom_lesning_sletter_ikke_avsnitt_og_foreldrer_ingen_rettelser() {
        let mut conn = base();
        let avsnitt = med_ider(
            &mut conn,
            "notat.md",
            vec![
                p("Vi skal ha innlogging.", "Innlogging"),
                p("Kanskje depositum, men jeg er usikker.", "Depositum"),
            ],
        );
        lagre(&conn, "Notat", &avsnitt, Some(1_757_000_000)).unwrap();
        rettelser::lagre(
            &conn,
            &rettelser::Retting {
                avsnitt_id: avsnitt[1].id,
                sti: "notat.md".into(),
                tekst: avsnitt[1].text.clone(),
                lest_type: "beslutning".into(),
                lest_handling: "bygg".into(),
                lest_kortform: "Depositum".into(),
                plass: Some("uavklart".into()),
                kortform: Some("Depositum, ikke avgjort".into()),
            },
        )
        .unwrap();

        assert!(synk(&mut conn, "notat.md", &[], &[]).is_err(), "tom tekst skal avvises");

        assert_eq!(tekster_i(&conn, "notat.md").len(), 2, "avsnittene skal stå");
        assert_eq!(
            rettelser::aktive(&conn, "notat.md").unwrap().len(),
            1,
            "og rettelsen skal fortsatt gjelde"
        );
        assert!(
            rettelser::foreldede(&conn, "notat.md", &tilstede(&conn, "notat.md"))
                .unwrap()
                .is_empty(),
            "ingen skal få beskjed om at rettelsen ble borte"
        );
    }

    fn tilstede(conn: &Connection, sti: &str) -> std::collections::HashSet<i64> {
        conn.prepare("select id from avsnitt where kilde = ?1")
            .unwrap()
            .query_map([sti], |r| r.get(0))
            .unwrap()
            .collect::<Result<_>>()
            .unwrap()
    }

    fn tekster_i(conn: &Connection, sti: &str) -> Vec<String> {
        conn.prepare("select tekst from avsnitt where kilde = ?1 order by rekkefolge")
            .unwrap()
            .query_map([sti], |r| r.get(0))
            .unwrap()
            .collect::<Result<_>>()
            .unwrap()
    }

    /// Legger ett avsnitt til i en kilde, slik appen ville gjort det: id først,
    /// så forståelsen.
    fn legg_inn(conn: &mut Connection, sti: &str, tittel: &str, tekst: &str, kortform: &str) -> i64 {
        let mut tekster = tekster_i(conn, sti);
        tekster.push(tekst.to_string());
        let id = *synk(conn, sti, &tekster, &[]).unwrap().last().unwrap();
        lagre(conn, tittel, &[Paragraph { id, ..p(tekst, kortform) }], Some(1_757_000_000))
            .unwrap();
        id
    }

    /// Det hele hviler på: er forståelsen lagret, koster et gammelt notat null
    /// kall etter omstart.
    #[test]
    fn forståelsen_overlever_omstart_og_koster_null_kall() {
        let mut conn = base();
        let doc = "Vi skal ha innlogging likevel.\n\nDepositum blir for høy terskel.\n";
        let fake = Fake::new();

        let mut memo = Memo::new();
        let avsnitt = understand::les(doc, &fake, &mut memo).unwrap();
        assert_eq!(fake.kall.load(Ordering::Relaxed), 1);
        let avsnitt = med_ider(&mut conn, "notat.md", avsnitt);
        lagre(&conn, "Notat", &avsnitt, Some(1_757_000_000)).unwrap();

        // Omstart: prosessen husker ingenting, bare basen gjør det.
        let mut etter = Memo::new();
        let hasher: Vec<String> = avsnitt.iter().map(|a| a.hash.clone()).collect();
        etter.extend(kjente(&conn, &hasher).unwrap());
        let igjen = understand::les(doc, &fake, &mut etter).unwrap();

        assert_eq!(fake.kall.load(Ordering::Relaxed), 1, "ingen ny runde for et gammelt notat");
        assert_eq!(igjen.len(), 2);
        assert_eq!(igjen[0].summary, avsnitt[0].summary);
        assert_eq!(igjen[1].kind, avsnitt[1].kind);
    }

    #[test]
    fn avsnitt_som_er_skrevet_om_blir_ryddet_bort() {
        let mut conn = base();
        let fake = Fake::new();
        let mut memo = Memo::new();

        let før = understand::les("Depositum blir for dyrt.\n", &fake, &mut memo).unwrap();
        let før = med_ider(&mut conn, "notat.md", før);
        lagre(&conn, "Notat", &før, Some(1_757_000_000)).unwrap();
        let etter =
            understand::les("Depositum tar vi likevel.\n", &fake, &mut memo).unwrap();
        let etter = med_ider(&mut conn, "notat.md", etter);
        lagre(&conn, "Notat", &etter, Some(1_757_000_000)).unwrap();

        assert_ne!(før[0].id, etter[0].id, "en helt annen tanke er et nytt avsnitt");
        let rader: i64 = conn
            .query_row(
                "select count(*) from forstatt f join avsnitt a on a.id = f.avsnitt_id \
                 where a.kilde = 'notat.md'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(rader, 1, "den gamle teksten skal ikke bli stående som en tanke hun har");
    }

    #[test]
    fn ordsøket_finner_samme_emne_og_ikke_bare_et_vanlig_ord() {
        let mut conn = base();
        legg_inn(
            &mut conn,
            "gammelt.md",
            "Låne-app",
            "Kanskje vi burde ha depositum, men jeg er usikker på terskelen.",
            "Depositum",
        );
        legg_inn(
            &mut conn,
            "annet.md",
            "Rendering",
            "Kanskje vi skal kjøre rendringen om natta i stedet.",
            "Nattlig rendring",
        );

        // 0 er ingen rad: avsnittet hun skriver nå er ikke lagret ennå.
        let nytt = "Depositum tar vi likevel, det skremmer ingen.";
        let treff = kandidater(&conn, nytt, 0, 5).unwrap();
        assert_eq!(treff.len(), 1, "«kanskje» alene er ikke et emne");
        assert_eq!(treff[0].kortform, "Depositum");
    }

    #[test]
    fn et_forhold_leses_ut_også_av_et_ruskete_svar() {
        let svar = "Her er vurderingen:\n\
                    ```\n\
                    1. | Motsier\n\
                    - 2|urelatert (deler bare ordet kart)\n\
                    dette er ikke en linje\n\
                    3|besvarer\n\
                    4|finnesikke\n\
                    9|motsier\n\
                    ```\n\
                    Si ifra om du vil ha mer!";
        let ut = parse_forhold(svar, 4);
        assert_eq!(ut[0].as_deref(), Some("motsier"), "store bokstaver skal tåles");
        assert_eq!(ut[1].as_deref(), Some("urelatert"));
        assert_eq!(ut[2].as_deref(), Some("besvarer"));
        assert_eq!(ut[3], None, "et ukjent forhold er ikke et forhold");
    }

    fn koblet(par: &[(usize, &str)]) -> Vec<(usize, String)> {
        par.iter().map(|(i, f)| (*i, f.to_string())).collect()
    }

    /// Annenlesningen: bare det den dyre modellen sto ved blir stående som en
    /// kobling. Alt annet — også det den første lesningen koblet — er
    /// urelatert, og det er den trygge retningen.
    #[test]
    fn andre_lesning_avgjør_hva_som_blir_en_kobling() {
        let dom = vec![Some("motsier".to_string()), Some(URELATERT.to_string()), None];
        let svar = slå_sammen(5, &koblet(&[(0, "motsier"), (2, "bekrefter"), (4, "besvarer")]), &dom);
        let ut = parse_forhold(&svar, 5);
        assert_eq!(ut[0].as_deref(), Some("motsier"), "sto ved koblingen");
        assert_eq!(ut[1].as_deref(), Some(URELATERT), "aldri koblet");
        assert_eq!(ut[2].as_deref(), Some(URELATERT), "trukket tilbake");
        assert_eq!(ut[4].as_deref(), Some(URELATERT), "uten svar er uten kobling");
    }

    /// Retningen er den påstanden som koster noe å ta feil av. Den krever at
    /// begge lesningene sier det samme.
    #[test]
    fn retning_krever_enighet_ellers_står_linja_uten_retning() {
        let først = koblet(&[(0, "motsier"), (1, "bekrefter"), (2, "bekrefter"), (3, "besvarer")]);
        let dom = vec![
            Some("motsier".to_string()),   // enige
            Some("motsier".to_string()),   // uenige om retningen
            Some(URELATERT.to_string()),   // én sier urelatert
            Some("besvarer".to_string()),  // enige
        ];
        let ut = parse_forhold(&slå_sammen(4, &først, &dom), 4);
        assert_eq!(ut[0].as_deref(), Some("motsier"), "enighet gir retningen");
        assert_eq!(
            ut[1].as_deref(),
            Some(NEVNT),
            "uenige om retningen: ingen påstand, bare at hun skrev om det"
        );
        assert_eq!(ut[2].as_deref(), Some(URELATERT), "urelatert fra én gir ingenting");
        assert_eq!(ut[3].as_deref(), Some("besvarer"));
    }

    /// Linja uten retning er fortsatt en linje: den vises, men sist, fordi den
    /// ikke sier noe som er verdt å avbryte skrivingen for.
    #[test]
    fn linja_uten_retning_vises_men_står_nederst() {
        let mut conn = base();
        legg_inn(&mut conn, "a.md", "Låne-app", "Depositum blir for høy terskel.", "Depositum");
        legg_inn(&mut conn, "b.md", "Låne-app", "Skal depositum være valgfritt?", "Valgfritt depositum");

        let nytt = med_ider(
            &mut conn,
            "nytt.md",
            vec![p("Depositum tar vi likevel.", "Depositum")],
        );

        let dommer = FakeDommer::new(&format!("1|{NEVNT}\n2|besvarer"));
        let ut = tidligere(&conn, &nytt, &dommer).unwrap();
        assert_eq!(ut.len(), 2);
        assert_eq!(ut[0].forhold, "besvarer", "en retning står over en linje uten");
        assert_eq!(ut[1].forhold, NEVNT);
    }

    #[test]
    fn urelatert_vises_aldri_og_motsier_står_øverst() {
        let mut conn = base();
        legg_inn(&mut conn, "a.md", "Låne-app", "Depositum blir for høy terskel.", "Depositum");
        legg_inn(&mut conn, "b.md", "Låne-app", "Skal depositum være valgfritt?", "Valgfritt depositum");
        legg_inn(&mut conn, "c.md", "Kart", "Kartverket leverer eiendomsdata.", "Eiendomsdata");

        let nytt = med_ider(
            &mut conn,
            "nytt.md",
            vec![p("Depositum tar vi likevel.", "Depositum")],
        );

        // To kandidater: den første motsies, den andre besvares.
        let dommer = FakeDommer::new("1|motsier\n2|besvarer");
        let ut = tidligere(&conn, &nytt, &dommer).unwrap();
        assert_eq!(ut.len(), 2, "kartnotatet deler ingen ord og skal ikke være med");
        assert_eq!(ut[0].forhold, "motsier", "motsigelsen er den som er verdt å avbryte for");
        assert_eq!(ut[1].forhold, "besvarer");

        // Alt som er dømt urelatert er borte fra svaret, men husket i basen.
        let urelaterte = FakeDommer::new("1|urelatert\n2|urelatert");
        conn.execute("delete from relasjoner", []).unwrap();
        let ut = tidligere(&conn, &nytt, &urelaterte).unwrap();
        assert!(ut.is_empty(), "urelatert skal aldri vises");

        // Og andre gang koster det ingenting: forholdene er allerede dømt.
        let ut = tidligere(&conn, &nytt, &urelaterte).unwrap();
        assert!(ut.is_empty());
        assert_eq!(urelaterte.kall.load(Ordering::Relaxed), 1, "et dømt par spørres ikke igjen");
    }

    #[test]
    fn spørre_søket_finner_uavklarte_og_oppgaver_som_venter() {
        let mut conn = base();
        let avsnitt = vec![
            Paragraph {
                kind: "spørsmål".into(),
                action: "marker_åpent".into(),
                ..p("Trenger vi egentlig innlogging?", "Innlogging")
            },
            Paragraph {
                kind: "oppgave".into(),
                action: "ingenting".into(),
                dependency: Some("låst klipp".into()),
                ..p(
                    "Fargekorrigeringen kan ikke starte før klippet er låst.",
                    "Starte fargekorrigering",
                )
            },
            p("Pipelinen skal kjøre om natta.", "Nattlig pipeline"),
        ];
        let avsnitt = med_ider(&mut conn, "notat.md", avsnitt);
        lagre(&conn, "Notat", &avsnitt, Some(1_757_000_000)).unwrap();

        let uavklart = spør(&conn, "hva er uavklart").unwrap().unwrap();
        assert_eq!(uavklart.overskrift, "Uavklart");
        assert_eq!(uavklart.treff.len(), 1);
        assert_eq!(uavklart.treff[0].kortform, "Innlogging");

        let venter = spør(&conn, "hva venter på noe").unwrap().unwrap();
        assert_eq!(venter.treff.len(), 1);
        assert_eq!(venter.treff[0].venter.as_deref(), Some("låst klipp"));

        let bestemt = spør(&conn, "hva har jeg bestemt om pipelinen").unwrap().unwrap();
        assert_eq!(bestemt.treff.len(), 1, "bestemt form skal finne ordet i notatet");
        assert_eq!(bestemt.treff[0].kortform, "Nattlig pipeline");

        assert!(
            spør(&conn, "forhandler firmware").unwrap().is_none(),
            "et vanlig søk skal fortsatt være et vanlig søk"
        );
    }

    #[test]
    fn rettelsen_vinner_også_i_spørre_søket() {
        let mut conn = base();
        let tekst = "Vi skal ha innlogging.";
        let id = legg_inn(&mut conn, "notat.md", "Notat", tekst, "Innlogging");
        rettelser::lagre(
            &conn,
            &rettelser::Retting {
                avsnitt_id: id,
                sti: "notat.md".into(),
                tekst: tekst.into(),
                lest_type: "beslutning".into(),
                lest_handling: "bygg".into(),
                lest_kortform: "Innlogging".into(),
                plass: Some("uavklart".into()),
                kortform: Some("Innlogging, ikke avgjort".into()),
            },
        )
        .unwrap();

        let uavklart = spør(&conn, "hva er uavklart").unwrap().unwrap();
        assert_eq!(uavklart.treff.len(), 1);
        assert_eq!(uavklart.treff[0].kortform, "Innlogging, ikke avgjort");
        assert!(
            spør(&conn, "hva har jeg bestemt").unwrap().unwrap().treff.is_empty(),
            "en linje hun flyttet er ikke lenger bestemt"
        );
    }

    fn retting(
        id: i64,
        tekst: &str,
        lest: (&str, &str, &str),
        plass: &str,
        kortform: &str,
    ) -> rettelser::Retting {
        rettelser::Retting {
            avsnitt_id: id,
            sti: "notat.md".into(),
            tekst: tekst.into(),
            lest_type: lest.0.into(),
            lest_handling: lest.1.into(),
            lest_kortform: lest.2.into(),
            plass: Some(plass.into()),
            kortform: Some(kortform.into()),
        }
    }

    /// Flyttet hun linja, er det flyttingen som er eksempelet.
    #[test]
    fn en_rettelse_blir_et_eksempel() {
        let mut conn = base();
        let tekst = "Kunden ønsker innlogging på forsiden.";
        let id = legg_inn(&mut conn, "notat.md", "Notat", tekst, "Innlogging på forsiden");
        rettelser::lagre(
            &conn,
            &retting(
                id,
                tekst,
                ("beslutning", "bygg", "Innlogging på forsiden"),
                "idé",
                "Innlogging på forsiden",
            ),
        )
        .unwrap();

        let ut = eksempler(&conn, ANTALL_EKSEMPLER).unwrap();
        assert_eq!(
            ut,
            vec![Eksempel {
                tekst: tekst.into(),
                lest: "beslutning|bygg|Innlogging på forsiden".into(),
                rettet: "tvil|hold|Innlogging på forsiden".into(),
            }]
        );
    }

    /// Funn 7. Plassene i panelet er mange-til-én: `gjengivelse|hold` og
    /// `uenighet|hold` står begge under «Idé». Retter hun bare kortformen og
    /// lar linja stå der den sto, sa oversettelsen før at hun rettet
    /// `gjengivelse` til `tvil` — en rettelse hun aldri gjorde, som deretter
    /// styrte hver framtidige klassifisering.
    #[test]
    fn et_eksempel_gjengir_det_hun_faktisk_gjorde() {
        let mut conn = base();
        let tekst = "Kunden mener kartet må være startsiden.";
        let id = legg_inn(&mut conn, "notat.md", "Notat", tekst, "Kart som startside");
        rettelser::lagre(
            &conn,
            &retting(
                id,
                tekst,
                ("gjengivelse", "hold", "Kart som startside"),
                // Samme plass som lesningen selv ga linja: hun flyttet den ikke.
                "idé",
                "Kundens ønske om kart først",
            ),
        )
        .unwrap();

        let ut = eksempler(&conn, ANTALL_EKSEMPLER).unwrap();
        assert_eq!(ut.len(), 1);
        assert_eq!(
            ut[0].rettet, "gjengivelse|hold|Kundens ønske om kart først",
            "bare kortformen er rettet, og typen skal stå som lesningen leste den"
        );
        assert!(
            !ut[0].rettet.starts_with("tvil"),
            "prompten skal ikke lære at hun rettet gjengivelse til tvil"
        );
    }

    /// Funn 46. En rettelse som ikke rettet noe lærer ingenting bort, og
    /// spiste før en av seks plasser i prompten.
    #[test]
    fn en_rettelse_uten_endring_er_ikke_et_eksempel() {
        let mut conn = base();
        let tekst = "ux og ui må være profesjonell men bestemorvennlig";
        let id = legg_inn(&mut conn, "notat.md", "Notat", tekst, "Bestemorvennlig grensesnitt");
        // Et krav står allerede under «Forstått». Flytter hun det dit det er,
        // er det ikke en rettelse.
        rettelser::lagre(
            &conn,
            &retting(
                id,
                tekst,
                ("begrensning", "hold", "Bestemorvennlig grensesnitt"),
                "forstått",
                "Bestemorvennlig grensesnitt",
            ),
        )
        .unwrap();
        assert!(eksempler(&conn, ANTALL_EKSEMPLER).unwrap().is_empty());
    }

    /// Funn 19. Hennes egen retting ga en dårligere oppgave enn maskinens:
    /// linja ble en oppgave i panelet, men kunne aldri finnes av «hva venter
    /// på noe», fordi avhengigheten ikke ble lagret.
    #[test]
    fn hennes_egen_oppgave_finnes_av_hva_venter_på_noe() {
        let mut conn = base();
        let tekst = "Fargekorrigeringen kan ikke starte før klippet er låst.";
        let id = legg_inn(&mut conn, "notat.md", "Notat", tekst, "Fargekorrigering");
        rettelser::lagre(
            &conn,
            &retting(
                id,
                tekst,
                ("observasjon", "ingenting", "Fargekorrigering"),
                "oppgave",
                "Starte fargekorrigering ← låst klipp",
            ),
        )
        .unwrap();

        let venter = spør(&conn, "hva venter på noe").unwrap().unwrap();
        assert_eq!(venter.treff.len(), 1);
        assert_eq!(venter.treff[0].kortform, "Starte fargekorrigering", "pila hører ikke til i linja");
        assert_eq!(venter.treff[0].venter.as_deref(), Some("låst klipp"));
    }

    /// Funn 41. En oppgave hun har krysset av er gjort, og skal verken stå på
    /// lista over hva som venter eller dukke opp som noe hun har tenkt før.
    #[test]
    fn en_ferdig_oppgave_venter_ikke_lenger_på_noe() {
        let mut conn = base();
        let tekst = "Vi må få prototypen godkjent før produksjonen kan begynne.";
        let id = legg_inn(&mut conn, "notat.md", "Notat", tekst, "Starte produksjon");
        conn.execute("update forstatt set type = 'oppgave', handling = 'ingenting', venter = 'godkjent prototype' where avsnitt_id = ?1", [id]).unwrap();
        assert_eq!(spør(&conn, "hva venter på noe").unwrap().unwrap().treff.len(), 1);

        rettelser::lagre(
            &conn,
            &retting(
                id,
                tekst,
                ("oppgave", "ingenting", "Starte produksjon"),
                rettelser::FERDIG,
                "Starte produksjon",
            ),
        )
        .unwrap();
        assert!(spør(&conn, "hva venter på noe").unwrap().unwrap().treff.is_empty());
        assert!(
            eksempler(&conn, ANTALL_EKSEMPLER).unwrap().is_empty(),
            "«ferdig» er ikke en lesning av avsnittet, og lærer klassifiseringen ingenting"
        );
    }

    /// Funn 3 og 4. Skriver hun om avsnittet, gjelder ikke lesningen av den
    /// gamle teksten lenger. Før sto kortformen, klassen og alle dommene om
    /// hvordan avsnittet hang sammen med andre igjen — og «Tidligere om dette»
    /// siterte det avsnittet *pleide* å si, med teksten det sier nå ved siden
    /// av.
    #[test]
    fn et_omskrevet_avsnitt_bærer_ikke_gammel_forståelse() {
        let mut conn = base();
        let før = "Depositum blir for høy terskel for de fleste som skal låne noe.";
        let etter = "Depositum blir for høy terskel for de fleste som skal låne verktøy.";
        let annen = legg_inn(&mut conn, "annet.md", "Låne-app", "Depositum tar vi likevel.", "Depositum");
        let id = legg_inn(&mut conn, "notat.md", "Notat", før, "For høy terskel");
        conn.execute(
            "insert into relasjoner (avsnitt_id, annen_id, forhold, tidspunkt) values (?1, ?2, 'motsier', 1)",
            (id, annen),
        )
        .unwrap();

        let ider = synk(&mut conn, "notat.md", &[etter.to_string()], &[]).unwrap();
        assert_eq!(ider[0], id, "en omskriving beholder identiteten");

        let rader: i64 = conn
            .query_row("select count(*) from forstatt where avsnitt_id = ?1", [id], |r| r.get(0))
            .unwrap();
        assert_eq!(rader, 0, "den gamle kortformen skal ikke bli stående");
        let dommer: i64 = conn
            .query_row(
                "select count(*) from relasjoner where avsnitt_id = ?1 or annen_id = ?1",
                [id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(dommer, 0, "og heller ikke dommen over et avsnitt som er skrevet om");
    }

    /// Funn 6. `IDENTITET.md` skrev opp dette som uløst da samtaleimport ennå
    /// ikke fantes: «samme setning fra to personer» er to avsnitt, og
    /// matchingen må avgrenses per avsender.
    #[test]
    fn samme_setning_fra_to_personer_bytter_ikke_identitet() {
        let mut conn = base();
        let tekster: Vec<String> = ["Marius: Ja, enig.", "Kari: Ja, enig."]
            .iter()
            .map(|s| s.to_string())
            .collect();
        let avsendere = vec![Some("Marius".to_string()), Some("Kari".to_string())];
        let først = synk(&mut conn, "samtale.md", &tekster, &avsendere).unwrap();

        // Reimport: Marius har rettet en skrivefeil i sitt eget innlegg.
        let igjen: Vec<String> = ["Marius: Ja, helt enig.", "Kari: Ja, enig."]
            .iter()
            .map(|s| s.to_string())
            .collect();
        let etter = synk(&mut conn, "samtale.md", &igjen, &avsendere).unwrap();

        assert_eq!(etter[1], først[1], "Karis innlegg er uendret og beholder sin id");
        assert_ne!(
            etter[0], først[1],
            "Marius' innlegg skal aldri arve Karis id, uansett hvor likt det er"
        );
    }

    /// Funn 12 og 13. Rettelsen er det eneste i systemet brukeren har skrevet
    /// som ikke kan gjenskapes fra markdown. Kommer teksten tilbake — angret
    /// sletting, omdøpt notat — skal rettelsen tilbake med den.
    #[test]
    fn en_rettelse_finner_tilbake_til_teksten_sin() {
        let mut conn = base();
        let tekst = "Kartvisningen skal vise alle prosjekter på et norgeskart.";
        let id = legg_inn(&mut conn, "notat.md", "Notat", tekst, "Kartvisning");
        rettelser::lagre(
            &conn,
            &retting(id, tekst, ("beslutning", "bygg", "Kartvisning"), "uavklart", "Kartvisning?"),
        )
        .unwrap();

        // Hun sletter avsnittet.
        synk(&mut conn, "notat.md", &["Noe helt annet står her nå.".to_string()], &[]).unwrap();
        assert!(
            !rettelser::foreldede(&conn, "notat.md", &tilstede(&conn, "notat.md")).unwrap().is_empty(),
            "hun skal få beskjed én gang om at rettelsen ikke gjelder lenger"
        );
        assert!(rettelser::aktive(&conn, "notat.md").unwrap().is_empty());

        // Og skriver den inn igjen — her under et annet filnavn, som etter en
        // omdøping.
        let nye = synk(&mut conn, "notat-2.md", &[tekst.to_string()], &[]).unwrap();
        let aktive = rettelser::aktive(&conn, "notat-2.md").unwrap();
        assert_eq!(
            aktive.get(&nye[0]).map(|r| r.summary.as_str()),
            Some("Kartvisning?"),
            "rettelsen hennes skal følge teksten"
        );
    }

    /// Funn 13. Et slettet notat sto igjen for alltid, og panelet siterte det.
    #[test]
    fn et_slettet_notat_etterlater_ingen_spøkelser() {
        let mut conn = base();
        legg_inn(&mut conn, "borte.md", "Borte", "Depositum blir for høy terskel.", "Depositum");
        legg_inn(&mut conn, "her.md", "Her", "Depositum tar vi likevel, det skremmer ingen.", "Depositum");

        assert_eq!(rydd(&conn, &[]).unwrap(), 0, "en tom liste skal ikke rydde noe");
        assert_eq!(rydd(&conn, &["her.md".to_string()]).unwrap(), 1);

        let igjen: i64 = conn.query_row("select count(*) from avsnitt", [], |r| r.get(0)).unwrap();
        assert_eq!(igjen, 1);
        let forstått: i64 =
            conn.query_row("select count(*) from forstatt", [], |r| r.get(0)).unwrap();
        assert_eq!(forstått, 1, "forståelsen om et notat som ikke finnes skal være borte");
    }

    /// Funn 38. Det eneste hun kunne gjøre med en falsk kobling var å se på
    /// den.
    #[test]
    fn en_avvist_kobling_kommer_ikke_tilbake_for_det_samme_paret() {
        let mut conn = base();
        let gammel = legg_inn(
            &mut conn,
            "gammelt.md",
            "Låne-app",
            "Depositum blir for høy terskel.",
            "Depositum",
        );
        let nytt = med_ider(
            &mut conn,
            "nytt.md",
            vec![p("Depositum på leiebilen ble trukket i går.", "Depositum på leiebil")],
        );
        lagre(&conn, "Nytt", &nytt, Some(1_757_000_000)).unwrap();

        let dommer = FakeDommer::new("1|motsier");
        assert_eq!(tidligere(&conn, &nytt, &dommer).unwrap().len(), 1);

        avvis(&conn, nytt[0].id, gammel, true).unwrap();
        assert!(
            tidligere(&conn, &nytt, &dommer).unwrap().is_empty(),
            "koblingen hun avviste skal være borte"
        );

        // Også fra det andre notatet. Paret er avvist, ikke retningen.
        let andre_vei = med_ider(
            &mut conn,
            "gammelt.md",
            vec![Paragraph { id: gammel, ..p("Depositum blir for høy terskel.", "Depositum") }],
        );
        assert!(tidligere(&conn, &andre_vei, &dommer).unwrap().is_empty());

        // Og hun har en vei tilbake.
        avvis(&conn, nytt[0].id, gammel, false).unwrap();
        assert_eq!(tidligere(&conn, &nytt, &dommer).unwrap().len(), 1);

        // Avviste par legges ved neste dømming som eksempler.
        avvis(&conn, nytt[0].id, gammel, true).unwrap();
        let eksempler = avviste(&conn, 3).unwrap();
        assert_eq!(eksempler.len(), 2, "begge retninger står som avvist");
        let prompt = relasjonsprompt_med(&[("a".into(), "b".into())], &eksempler);
        assert!(prompt.contains("ikke hører sammen"));
        assert!(prompt.contains("Depositum på leiebilen"));
    }

    /// Funn 17. En avkortet svarstreng eller ett hoppet linjenummer skrev før
    /// en permanent `urelatert`-rad, og ingenting prøvde igjen.
    #[test]
    fn et_par_uten_svar_spørres_om_igjen() {
        let mut conn = base();
        legg_inn(&mut conn, "a.md", "Låne-app", "Depositum blir for høy terskel.", "Depositum");
        let nytt = med_ider(&mut conn, "nytt.md", vec![p("Depositum tar vi likevel.", "Depositum")]);

        // Svaret er avkortet: ingen linje for paret.
        let tomt = FakeDommer::new("her kommer vurderingen:");
        assert!(tidligere(&conn, &nytt, &tomt).unwrap().is_empty(), "ingen kobling vises nå");
        let rader: i64 =
            conn.query_row("select count(*) from relasjoner", [], |r| r.get(0)).unwrap();
        assert_eq!(rader, 0, "og ingen dom er felt");

        let igjen = FakeDommer::new("1|motsier");
        assert_eq!(tidligere(&conn, &nytt, &igjen).unwrap().len(), 1, "paret spørres på nytt");
    }

    /// Funn 48. A→B og B→A var to rader, dømt av to separate kall som kunne
    /// lande ulikt: åpnet hun det gamle notatet, kunne det si noe annet om det
    /// samme paret enn det nye gjorde.
    #[test]
    fn det_samme_paret_dømmes_bare_en_gang() {
        let mut conn = base();
        let gammel =
            legg_inn(&mut conn, "a.md", "Låne-app", "Depositum blir for høy terskel.", "Depositum");
        let nytt = med_ider(&mut conn, "nytt.md", vec![p("Depositum tar vi likevel.", "Depositum")]);
        lagre(&conn, "Nytt", &nytt, Some(1_757_000_000)).unwrap();

        let dommer = FakeDommer::new("1|motsier");
        assert_eq!(tidligere(&conn, &nytt, &dommer).unwrap()[0].forhold, "motsier");
        assert_eq!(dommer.kall.load(Ordering::Relaxed), 1);

        // Det gamle notatet åpnes. Samme par, motsatt vei.
        let andre_vei = med_ider(
            &mut conn,
            "a.md",
            vec![Paragraph { id: gammel, ..p("Depositum blir for høy terskel.", "Depositum") }],
        );
        let ut = tidligere(&conn, &andre_vei, &dommer).unwrap();
        assert_eq!(ut[0].forhold, "motsier", "det samme paret skal si det samme");
        assert_eq!(dommer.kall.load(Ordering::Relaxed), 1, "og det skal ikke koste et kall til");
    }

    /// Funn 47. For et langt avsnitt var det åpningssetningen alene som avgjorde
    /// hva «Tidligere om dette» kunne finne i det hele tatt.
    #[test]
    fn søkeordene_er_de_særegne_ordene_ikke_de_første() {
        let tekst = "Dette blir kanskje mest sånn tanker rundt hvordan alle sammen \
                     stiller seg til dette akkurat nå, men uansett: depositumsordningen \
                     og kartverksintegrasjonen må vurderes.";
        let ord = søkeord(tekst);
        assert!(ord.len() <= 12);
        assert!(ord.contains(&"depositumsordningen".to_string()), "{ord:?}");
        assert!(ord.contains(&"kartverksintegrasjonen".to_string()), "{ord:?}");
    }

    /// Identiteten skal tåle at teksten flytter på seg. Et avsnitt satt inn
    /// over de andre forskyver `rekkefolge`, men ikke id-ene — det er derfor
    /// `(kilde, rekkefolge)` ikke kunne være identitet alene.
    #[test]
    fn et_avsnitt_satt_inn_over_lar_de_andre_beholde_id_ene() {
        let mut conn = base();
        let a = "Kartvisningen skal vise alle prosjekter på et norgeskart, med filter på fylke.";
        let b = "Vi bør bruke Stripe til betaling fordi det er raskest å sette opp.";
        let ny = "Møtet med Marius flyttes til torsdag klokka ni.";

        let før = synk(&mut conn, "notat.md", &[a.to_string(), b.to_string()], &[]).unwrap();
        let etter = synk(
            &mut conn,
            "notat.md",
            &[ny.to_string(), a.to_string(), b.to_string()],
            &[],
        )
        .unwrap();

        assert_eq!(etter[1], før[0], "avsnittet som ble skjøvet ned er det samme");
        assert_eq!(etter[2], før[1]);
        assert!(!før.contains(&etter[0]), "bare det innsatte er nytt");

        // Og rekkefølgen i basen er den nye.
        assert_eq!(tekster_i(&conn, "notat.md")[0], ny);
    }

    /// En id som er brukt skal aldri brukes om igjen. Uten `autoincrement`
    /// ville et nytt avsnitt kunne arve rowid-en til et slettet, og med den
    /// rettelsen som hang på det.
    #[test]
    fn en_id_som_forsvinner_kommer_aldri_tilbake_på_noe_annet() {
        let mut conn = base();
        let første = synk(&mut conn, "a.md", &["Depositum blir for høy terskel.".into()], &[]).unwrap();
        // Notatet skrives om til noe helt annet, to ganger. (Å tømme det er
        // ikke lenger en vei hit: tom tekst synkes ikke.)
        let mellom = synk(&mut conn, "a.md", &["Kartvisning med filter på fylke.".into()], &[])
            .unwrap();
        let senere = synk(&mut conn, "a.md", &["Alle bilder leveres i full oppløsning.".into()], &[])
            .unwrap();
        assert_ne!(senere[0], første[0]);
        assert_ne!(senere[0], mellom[0]);
    }

    #[test]
    fn posisjonen_peker_på_avsnittet_i_det_andre_notatet() {
        let doc = "---\nid: x\n---\n\n# Tittel\n\nFørste tanke her.\n\nAndre tanke her.\n";
        let hash = understand::nøkkel("Andre tanke her.");
        let (from, to) = posisjon(doc, &hash).unwrap();
        let enheter: Vec<u16> = doc.encode_utf16().collect();
        assert_eq!(String::from_utf16(&enheter[from..to]).unwrap(), "Andre tanke her.");
        assert_eq!(posisjon(doc, "finnesikke"), None);
    }

    /// En importert samtale, hele veien: fila på disk deles i innlegg, hvert
    /// innlegg får sin egen id med avsenderen på, og det strukturerte søket
    /// svarer på hva som ble bestemt i tråden og hvem som venter på hva.
    ///
    /// Det er dette som skiller en beslutningslogg fra en haug med løsrevne
    /// påstander: linja sier hvem som sa det.
    #[test]
    fn en_importert_samtale_svarer_på_hva_som_ble_bestemt_og_hvem_som_venter() {
        let mut conn = base();
        let limt = "Marius: Vi går for Stripe.\n\
                    Kari: Vi går for Stripe.\n\
                    Marius: Jeg sender faktura når avtalen er signert.\n\
                    Kari: Trenger vi Vipps også?";
        let innlegg = crate::samtale::del(limt).expect("dette er en samtale");
        let fil = crate::samtale::skriv(&innlegg);

        // Fila deles i ett avsnitt per innlegg, uten at noe vet om samtaler.
        let biter = understand::split(&fil);
        assert_eq!(biter.len(), 4);
        let tekster: Vec<String> = biter.iter().map(|b| b.text.clone()).collect();
        let avsendere: Vec<Option<String>> =
            biter.iter().map(|b| crate::samtale::avsender(&b.text)).collect();
        let ider = synk(&mut conn, "samtale.md", &tekster, &avsendere).unwrap();

        // Samme setning fra to avsendere er to avsnitt, ikke ett.
        assert_ne!(ider[0], ider[1]);
        let lagret: Vec<(String, Option<String>)> = conn
            .prepare("select tekst, avsender from avsnitt where kilde = 'samtale.md' order by rekkefolge")
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<Result<_>>()
            .unwrap();
        assert_eq!(lagret[0].1.as_deref(), Some("Marius"));
        assert_eq!(lagret[1].1.as_deref(), Some("Kari"));

        // Forståelsen, slik lesningen ville lagret den.
        let merker = [
            ("beslutning", "bygg", "Stripe som betalingsløsning", None),
            ("beslutning", "bygg", "Stripe som betalingsløsning", None),
            ("oppgave", "ingenting", "Sende faktura", Some("signert avtale")),
            ("spørsmål", "marker_åpent", "Vipps i tillegg", None),
        ];
        let avsnitt: Vec<Paragraph> = ider
            .iter()
            .zip(merker)
            .zip(&tekster)
            .map(|((id, (kind, action, kortform, venter)), tekst)| Paragraph {
                id: *id,
                kind: kind.into(),
                action: action.into(),
                dependency: venter.map(str::to_string),
                ..p(tekst, kortform)
            })
            .collect();
        lagre(&conn, "Samtale om betaling", &avsnitt, Some(1_757_000_000)).unwrap();

        let bestemt = spør(&conn, "hva ble bestemt").unwrap().unwrap();
        assert_eq!(bestemt.overskrift, "Bestemt");
        assert_eq!(bestemt.treff.len(), 2, "begge sa det, og begge står");
        let sagt_av: HashSet<Option<String>> =
            bestemt.treff.iter().map(|t| t.avsender.clone()).collect();
        assert_eq!(
            sagt_av,
            HashSet::from([Some("Marius".to_string()), Some("Kari".to_string())])
        );

        let venter = spør(&conn, "hva venter på noe").unwrap().unwrap();
        assert_eq!(venter.treff.len(), 1);
        assert_eq!(venter.treff[0].avsender.as_deref(), Some("Marius"));
        assert_eq!(venter.treff[0].kortform, "Sende faktura");
        assert_eq!(venter.treff[0].venter.as_deref(), Some("signert avtale"));

        let uavklart = spør(&conn, "hva er uavklart").unwrap().unwrap();
        assert_eq!(uavklart.treff.len(), 1);
        assert_eq!(uavklart.treff[0].avsender.as_deref(), Some("Kari"));
        assert_eq!(uavklart.treff[0].kortform, "Vipps i tillegg");
    }
}
