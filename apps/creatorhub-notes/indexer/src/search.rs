use crate::embed::{Embedder, InputType};
use anyhow::{bail, Result};
use rusqlite::Connection;
use zerocopy::AsBytes;

#[derive(Debug, Clone)]
pub struct Hit {
    pub path: String,
    pub start_line: usize,
    pub end_line: usize,
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
