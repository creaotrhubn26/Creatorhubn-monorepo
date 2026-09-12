use creatorhub_notes_indexer::register_vec_extension;
use rusqlite::Connection;
use zerocopy::AsBytes;

#[test]
fn vec0_table_answers_knn_query() {
    register_vec_extension();
    let db = Connection::open_in_memory().unwrap();

    let version: String = db
        .query_row("select vec_version()", [], |r| r.get(0))
        .unwrap();
    assert!(!version.is_empty(), "sqlite-vec extension did not load");

    db.execute(
        "CREATE VIRTUAL TABLE vec_items USING vec0(embedding float[4])",
        [],
    )
    .unwrap();

    let items: Vec<(i64, Vec<f32>)> = vec![
        (1, vec![0.1, 0.1, 0.1, 0.1]),
        (2, vec![0.2, 0.2, 0.2, 0.2]),
        (3, vec![0.9, 0.9, 0.9, 0.9]),
    ];
    let mut stmt = db
        .prepare("INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)")
        .unwrap();
    for (id, v) in &items {
        stmt.execute(rusqlite::params![id, v.as_bytes()]).unwrap();
    }

    let query: Vec<f32> = vec![0.9, 0.9, 0.9, 0.9];
    let hits: Vec<(i64, f64)> = db
        .prepare(
            "SELECT rowid, distance FROM vec_items \
             WHERE embedding MATCH ?1 ORDER BY distance LIMIT 1",
        )
        .unwrap()
        .query_map([query.as_bytes()], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].0, 3, "nearest neighbour should be rowid 3");
}
