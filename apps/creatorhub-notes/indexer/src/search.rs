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

/// Ett ledd i det brukeren skrev.
#[derive(Debug, PartialEq)]
enum Ledd {
    /// Et ord eller en frase som skal med.
    Med(String),
    /// Et ord eller en frase som skal holdes utenfor: `-ord`.
    Uten(String),
    /// `AND` mellom to ledd. `OR` er standard og trenger ikke noe ledd.
    Og,
}

/// Deler spørringen i ledd. Sitater holder sammen en frase, `-` foran gjør
/// leddet til en negasjon, og `AND` (med store bokstaver, uten sitater) binder
/// to ledd sammen. Alt annet er ett ord.
fn ledd(q: &str) -> Vec<Ledd> {
    let tegn: Vec<char> = q.chars().collect();
    let mut ut = Vec::new();
    let mut i = 0;
    while i < tegn.len() {
        if tegn[i].is_whitespace() {
            i += 1;
            continue;
        }
        // `-` teller bare som negasjon når det står noe rett etter. En
        // bindestrek midt i et ord, eller alene, er bare et tegn.
        let uten = tegn[i] == '-' && i + 1 < tegn.len() && !tegn[i + 1].is_whitespace();
        if uten {
            i += 1;
        }
        let mut ord = String::new();
        if tegn[i] == '"' {
            i += 1;
            while i < tegn.len() && tegn[i] != '"' {
                ord.push(tegn[i]);
                i += 1;
            }
            i += 1; // det avsluttende sitatet, om det står der
        } else {
            while i < tegn.len() && !tegn[i].is_whitespace() {
                ord.push(tegn[i]);
                i += 1;
            }
            if !uten {
                // Bare et nakent ord kan være en operator. `"AND"` og `-AND`
                // er ordet, ikke operatoren.
                match ord.as_str() {
                    "AND" => {
                        ut.push(Ledd::Og);
                        continue;
                    }
                    "OR" => continue, // standard uansett
                    _ => {}
                }
            }
        }
        // Et ledd uten et eneste bokstav- eller talltegn kan ikke bli en
        // FTS5-frase som betyr noe, og en tom frase er en syntaksfeil.
        if !ord.chars().any(char::is_alphanumeric) {
            continue;
        }
        ut.push(if uten { Ledd::Uten(ord) } else { Ledd::Med(ord) });
    }
    ut
}

/// Ett ledd som en sitert FTS5-frase. Siteringen slår av all FTS5-syntaks
/// inni leddet, så `(v2)` og `"async"?` kan aldri kaste en syntaksfeil.
fn sitert(ord: &str) -> String {
    format!("\"{}\"", ord.replace('"', "\"\""))
}

/// Bygger en FTS5-spørring av det brukeren skrev.
///
/// | Skriver hun | Betyr |
/// |---|---|
/// | `forhandler firmware` | ett av ordene, og notater med begge rangeres først |
/// | `forhandler AND firmware` | begge ordene må stå i notatet |
/// | `"bestemorvennlig kart"` | ordene ved siden av hverandre, i den rekkefølgen |
/// | `kart -kø` | med `kart`, uten `kø` |
///
/// `OR` er standard fordi det er slik et notatsøk brukes: man husker et par
/// ord fra notatet, ikke en frase. Én sitert frase for hele spørringen tvang
/// eksakt ordrekkefølge, og et notat som nevnte «forhandler» og «firmware»
/// et stykke fra hverandre ga null treff.
///
/// Forrige runde løste det ved å sitere *hver* term og binde dem med `OR`.
/// Det spiste operatorene: `-kø` ble til `OR "kø"`, altså det motsatte av det
/// hun ba om, og det fantes verken frase eller AND.
///
/// `None` når det ikke er noe å søke etter, eller når spørringen bare er
/// negasjoner: FTS5 kan ikke svare på «alt unntatt», og et notatsøk som
/// returnerer hele arkivet er ikke et svar.
///
/// Presedensen i FTS5 er `NOT` foran `AND` foran `OR`. Derfor står `AND`
/// og `OR` fritt mellom leddene, mens negasjonene samles i én parentes til
/// slutt — ellers ville `a OR b NOT c` blitt lest som `a OR (b NOT c)`.
fn quote_fts_query(q: &str) -> Option<String> {
    let mut med: Vec<String> = Vec::new();
    let mut uten: Vec<String> = Vec::new();
    let mut og_neste = false;

    for l in ledd(q) {
        match l {
            Ledd::Og => og_neste = !med.is_empty(),
            Ledd::Uten(ord) => uten.push(sitert(&ord)),
            Ledd::Med(ord) => {
                if med.is_empty() {
                    med.push(sitert(&ord));
                } else {
                    med.push(format!("{} {}", if og_neste { "AND" } else { "OR" }, sitert(&ord)));
                }
                og_neste = false;
            }
        }
    }

    if med.is_empty() {
        return None;
    }
    let positivt = med.join(" ");
    Some(if uten.is_empty() {
        positivt
    } else {
        format!("({positivt}) NOT ({})", uten.join(" OR "))
    })
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

    let Some(quoted) = quote_fts_query(q) else {
        // Ingenting å søke etter, eller bare negasjoner. FTS5 kan ikke svare
        // på «alt unntatt», og et søk som gir hele arkivet er ikke et svar.
        return Ok(Vec::new());
    };
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

#[cfg(test)]
mod tests {
    use super::*;

    fn u(q: &str) -> Option<String> {
        quote_fts_query(q)
    }

    #[test]
    fn flere_ord_er_fortsatt_eller() {
        assert_eq!(u("forhandler firmware").as_deref(), Some(r#""forhandler" OR "firmware""#));
    }

    #[test]
    fn negasjon_betyr_uten() {
        assert_eq!(u("kart -kø").as_deref(), Some(r#"("kart") NOT ("kø")"#));
        assert_eq!(
            u("kart -kø -bane").as_deref(),
            Some(r#"("kart") NOT ("kø" OR "bane")"#)
        );
    }

    #[test]
    fn sitater_gir_en_frase() {
        assert_eq!(
            u("\"bestemorvennlig kart\"").as_deref(),
            Some(r#""bestemorvennlig kart""#)
        );
        assert_eq!(
            u("kart -\"lang kø\"").as_deref(),
            Some(r#"("kart") NOT ("lang kø")"#)
        );
    }

    #[test]
    fn og_binder_to_ledd() {
        assert_eq!(u("kart AND kø").as_deref(), Some(r#""kart" AND "kø""#));
        // Presedens i FTS5: AND foran OR, så dette er (a AND b) OR c.
        assert_eq!(
            u("kart AND kø bane").as_deref(),
            Some(r#""kart" AND "kø" OR "bane""#)
        );
        assert_eq!(u("kart OR kø").as_deref(), Some(r#""kart" OR "kø""#));
    }

    #[test]
    fn en_bindestrek_midt_i_et_ord_er_ikke_negasjon() {
        assert_eq!(u("e-post").as_deref(), Some(r#""e-post""#));
    }

    #[test]
    fn ingenting_aa_soeke_etter() {
        assert_eq!(u(""), None);
        assert_eq!(u("   "), None);
        assert_eq!(u("-kø"), None, "FTS5 kan ikke svare på «alt unntatt»");
        assert_eq!(u("AND OR"), None);
    }

    #[test]
    fn syntakstegn_kan_aldri_bli_syntaks() {
        // Et sitat inni et ord avslutter frasen og begynner den neste; begge
        // blir siterte ledd, og ingen av dem er FTS5-syntaks.
        assert_eq!(u("\"as\"\"ync\"").as_deref(), Some(r#""as" OR "ync""#));
        assert_eq!(u("(v2)").as_deref(), Some(r#""(v2)""#));
        assert_eq!(u("foo*").as_deref(), Some(r#""foo*""#));
    }
}
