use creatorhub_notes_indexer::db;
use tempfile::tempdir;

#[test]
fn open_creates_schema_and_is_idempotent() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("index.db");

    {
        let conn = db::open(&path).unwrap();
        let count: i64 = conn
            .query_row(
                "select count(*) from sqlite_master where name in \
                 ('chunks','entities','anchors','edges','notes','meta')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 6, "all six base tables should exist");

        db::set_meta(&conn, "last_sha", "abc123").unwrap();
        assert_eq!(
            db::get_meta(&conn, "last_sha").unwrap(),
            Some("abc123".to_string())
        );
        assert_eq!(db::get_meta(&conn, "missing").unwrap(), None);
    }

    // Opening again must not fail and must preserve data.
    let conn = db::open(&path).unwrap();
    assert_eq!(
        db::get_meta(&conn, "last_sha").unwrap(),
        Some("abc123".to_string())
    );

    // The vector table accepts a 1024-dimension embedding.
    conn.execute(
        "insert into chunks(id, source, path, start_line, end_line, text) \
         values (1, 'code', 'a.ts', 1, 10, 'hei')",
        [],
    )
    .unwrap();
    let v: Vec<f32> = vec![0.01; 1024];
    use zerocopy::AsBytes;
    conn.execute(
        "insert into chunk_vec(rowid, embedding) values (?, ?)",
        rusqlite::params![1i64, v.as_bytes()],
    )
    .unwrap();
}
