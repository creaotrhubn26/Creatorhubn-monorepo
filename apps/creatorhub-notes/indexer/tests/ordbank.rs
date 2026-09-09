use creatorhub_notes_indexer::{db, ordbank};
use tempfile::tempdir;

#[test]
fn loads_forms_and_answers_lookups() {
    let dir = tempdir().unwrap();
    let conn = db::open(&dir.path().join("index.db")).unwrap();

    let fixture = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/fullformsliste-mini.txt");
    let count = ordbank::load(&conn, &fixture).unwrap();
    assert_eq!(count, 5, "header row must not be counted");

    assert!(ordbank::is_valid_form(&conn, "husene").unwrap());
    assert!(ordbank::is_valid_form(&conn, "Husene").unwrap(), "oppslag skal være case-insensitivt");
    assert!(!ordbank::is_valid_form(&conn, "husan").unwrap());

    let tags = ordbank::tags(&conn, "skriver").unwrap();
    assert_eq!(tags, vec!["verb pres".to_string()]);

    // Loading twice must not duplicate rows.
    let again = ordbank::load(&conn, &fixture).unwrap();
    assert_eq!(again, 5);
    let rows: i64 = conn
        .query_row("select count(*) from ordbank_fullform", [], |r| r.get(0))
        .unwrap();
    assert_eq!(rows, 5);
}
