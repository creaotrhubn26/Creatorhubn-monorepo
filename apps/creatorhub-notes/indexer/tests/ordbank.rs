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

/// Ordlista ligger i si egen fil ved siden av basen, ikke i den. Det er den
/// ene fila som er hundre megabyte og som kan lastes ned igjen; notatbasen er
/// den ene som ikke kan bygges opp igjen.
#[test]
fn ordlista_i_nabofila_finnes_gjennom_notatbasen() {
    let dir = tempdir().unwrap();
    let base = dir.path().join("notater.db");

    // Før: ingen ordliste, og beskjeden sier hva som mangler uten sjargong.
    let conn = db::open(&base).unwrap();
    assert_eq!(ordbank::status(&conn), ordbank::Status::Mangler);
    assert!(ordbank::former(&conn, "husene").is_empty());
    drop(conn);

    // Lista lastes inn i nabofila, slik `notes-index ordbank` gjør det.
    let fixture = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/fullformsliste-mini.txt");
    let side = rusqlite::Connection::open(dir.path().join("ordbank.db")).unwrap();
    ordbank::load(&side, &fixture).unwrap();
    drop(side);

    // Etter: samme base, samme oppslag, nå med svar.
    let conn = db::open(&base).unwrap();
    assert_eq!(ordbank::status(&conn), ordbank::Status::Lastet(5));
    assert!(ordbank::is_valid_form(&conn, "husene").unwrap());
    assert!(ordbank::former(&conn, "husene").contains(&"hus".to_string()));

    // Og ordlista står ikke i notatbasen. Den fila skal ikke vokse med noe
    // som kan lastes ned igjen.
    let i_notatbasen: i64 = conn
        .query_row(
            "select count(*) from main.sqlite_master where name = 'ordbank_fullform'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(i_notatbasen, 0, "ordlista skal ligge i nabofila, ikke i notatbasen");
}

/// Genitiv finnes ikke i fullformslista. Målt mot den ekte fila:
/// «leverandøren» gir fire former, «leverandørens» gir null. Regelen som
/// dekker det er å prøve uten s-en, og den skal bare slå til når ordet
/// faktisk er ukjent.
#[test]
fn genitiv_faller_tilbake_paa_ordet_uten_s() {
    let dir = tempdir().unwrap();
    let conn = db::open(&dir.path().join("index.db")).unwrap();
    let fixture = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/fullformsliste-mini.txt");
    ordbank::load(&conn, &fixture).unwrap();

    let genitiv = ordbank::former(&conn, "husets");
    assert!(
        genitiv.contains(&"husene".to_string()),
        "«husets» må finne formene av «hus», fikk {genitiv:?}"
    );
    // Et ord som ikke finnes, med eller uten s, gir fortsatt ingenting.
    assert!(ordbank::former(&conn, "kvasars").is_empty());
}
