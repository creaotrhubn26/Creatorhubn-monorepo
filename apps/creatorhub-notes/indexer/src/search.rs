use crate::embed::{Embedder, InputType};
use anyhow::{bail, Result};
use rusqlite::Connection;
use zerocopy::AsBytes;

#[derive(Debug, Clone)]
pub struct Hit {
    pub path: String,
    pub start_line: usize,
    pub end_line: usize,
    /// L2-avstand, ikke cosinuslikhet, når treffet kommer fra `query`/
    /// `query_paths`. `chunk_vec` er en `vec0`-tabell, og standardmetrikken
    /// der er L2. Voyage returnerer enhetsnormaliserte vektorer, så
    /// rangeringen er identisk med cosinus — men tallet er det ikke.
    /// Læringsfasen i speccen rangerer på cosinuslikhet: regn om
    /// (`cos = 1 - d^2 / 2`) i stedet for å lese dette feltet som likhet.
    ///
    /// Fra `text` bærer feltet i stedet SQLites `bm25()`-score: negativ, og
    /// mest relevant er mest negativt. «Nærmest først»-kontrakten holder
    /// fortsatt (stigende sortering), men tallet er verken L2 eller
    /// cosinuslikhet — en tredje betydning av samme felt, avhengig av hvilken
    /// funksjon som produserte treffet.
    pub distance: f64,
    pub text: String,
}

pub fn query(
    conn: &Connection,
    embedder: &dyn Embedder,
    q: &str,
    limit: usize,
) -> Result<Vec<Hit>> {
    let total: i64 = conn.query_row("select count(*) from chunks", [], |r| r.get(0))?;
    if total == 0 {
        return Ok(Vec::new());
    }

    let vectors = embedder.embed(&[q.to_string()], InputType::Query)?;
    let Some(vector) = vectors.into_iter().next() else {
        bail!("embedder returnerte ingen vektor for spørringen");
    };

    let hits = conn
        .prepare(
            "select c.path, c.start_line, c.end_line, k.distance, c.text \
             from (select rowid, distance from chunk_vec \
                   where embedding match ?1 and k = ?2) k \
             join chunks c on c.id = k.rowid \
             order by k.distance",
        )?
        .query_map(
            rusqlite::params![vector.as_bytes(), limit as i64],
            |r| {
                Ok(Hit {
                    path: r.get(0)?,
                    start_line: r.get::<_, i64>(1)? as usize,
                    end_line: r.get::<_, i64>(2)? as usize,
                    distance: r.get(3)?,
                    text: r.get(4)?,
                })
            },
        )?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hits)
}

/// Bygger en FTS5-spørring av en brukers frase: hver whitespace-adskilte term
/// blir sitert for seg (doble anførselstegn doblet inni, som slår av all
/// FTS5-syntaks i den termen — `(v2)` og `"async"?` kan aldri kaste en
/// syntaksfeil), og termene settes sammen med `OR`.
///
/// Bevisst ikke én sitert frase for hele spørringen: det tvang eksakt
/// ordrekkefølge, så et notat som nevner «forhandler» og «firmware» et stykke
/// fra hverandre ga null treff selv om begge ordene fantes. Med OR gir bm25
/// notater som treffer flere av termene bedre rangering, som er nøyaktig det
/// et notatsøk («jeg husker et par ord fra notatet») trenger.
fn quote_fts_query(q: &str) -> String {
    q.split_whitespace()
        .map(|term| format!("\"{}\"", term.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" OR ")
}

/// Nøkkelordsøk over `chunk_fts`. Krever ingen embedder og gjør ingen
/// nettverkskall — dette er søkestien for notater uten Voyage.
///
/// Rangert med SQLites innebygde `bm25()` (se `Hit::distance`). `Hit.text`
/// bærer her ikke hele biten, men et `snippet()`-utdrag med treffordene
/// markert med `**...**` — det er utdraget en leser trenger for å se
/// *hvorfor* notatet traff, ikke bm25-tallet.
pub fn text(conn: &Connection, q: &str, limit: usize) -> Result<Vec<Hit>> {
    let total: i64 = conn.query_row("select count(*) from chunks", [], |r| r.get(0))?;
    if total == 0 || q.trim().is_empty() {
        return Ok(Vec::new());
    }

    let quoted = quote_fts_query(q);
    let hits = conn
        .prepare(
            "select c.path, c.start_line, c.end_line, k.rank, k.snippet \
             from (select rowid, bm25(chunk_fts) as rank, \
                          snippet(chunk_fts, 0, '**', '**', ' … ', 12) as snippet \
                   from chunk_fts \
                   where chunk_fts match ?1 order by rank limit ?2) k \
             join chunks c on c.id = k.rowid \
             order by k.rank",
        )?
        .query_map(rusqlite::params![quoted, limit as i64], |r| {
            Ok(Hit {
                path: r.get(0)?,
                start_line: r.get::<_, i64>(1)? as usize,
                end_line: r.get::<_, i64>(2)? as usize,
                distance: r.get(3)?,
                text: r.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hits)
}

/// Som `query`, men høyst ett treff per fil: overhenter biter og beholder den
/// best rangerte biten per sti. Recall måles på fil, ikke på bit, og en tett
/// fil med femti nesten like biter skal ikke kunne fylle hele topp-k.
pub fn query_paths(
    conn: &Connection,
    embedder: &dyn Embedder,
    q: &str,
    limit: usize,
) -> Result<Vec<Hit>> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::with_capacity(limit);
    for hit in query(conn, embedder, q, limit.saturating_mul(5))? {
        if out.len() == limit {
            break;
        }
        if seen.insert(hit.path.clone()) {
            out.push(hit);
        }
    }
    Ok(out)
}
