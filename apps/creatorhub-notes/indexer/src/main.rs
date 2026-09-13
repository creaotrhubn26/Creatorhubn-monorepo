use anyhow::Result;
use clap::{Parser, Subcommand};
use creatorhub_notes_indexer::{db, embed::VoyageEmbedder, index, ordbank, search, sti};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "notes-index", about = "Semantisk indeks over CreatorHub-monorepoet")]
struct Cli {
    /// Sti til indeksdatabasen
    #[arg(long)]
    db: Option<PathBuf>,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Indekser et repo. Kjør på nytt for inkrementell oppdatering.
    Index {
        #[arg(default_value = ".")]
        repo: PathBuf,
        /// Tell filer, biter, tokener og kostnad uten å embedde noe.
        /// Krever ingen API-nøkkel og gjør ingen nettverkskall.
        #[arg(long)]
        dry_run: bool,
        /// Indekser tekst og fulltekstsøk uten embedder. Krever ingen
        /// VOYAGE_API_KEY og gjør ingen nettverkskall. Kjør uten flagget
        /// senere for å legge til vektorer på de samme bitene.
        #[arg(long)]
        no_embed: bool,
    },
    /// Søk i indeksen
    Search {
        query: String,
        #[arg(long, default_value_t = 5)]
        limit: usize,
        /// Fulltekstsøk (FTS5/bm25) i stedet for semantisk søk. Krever ingen
        /// VOYAGE_API_KEY og gjør ingen nettverkskall.
        #[arg(long)]
        text: bool,
    },
    /// Last inn Norsk Ordbank, eller si hva som er lastet inn.
    ///
    /// Ordlista er det som gjør at «utstyret» finner «utstyr». Den ligger
    /// ikke i repoet — den lastes ned fra Språkbanken (CC-BY) og pekes på her:
    /// `fullformsliste.txt` fra `norsk_ordbank_nob_2005`. Uten argument
    /// skrives status.
    Ordbank {
        /// Sti til `fullformsliste.txt`. Utelates for å se status.
        fil: Option<PathBuf>,
    },
    /// Kjør gullsettet og rapporter recall
    Eval {
        #[arg(long, default_value = "gullsett.toml")]
        file: PathBuf,
        #[arg(long, default_value_t = 5)]
        k: usize,
    },
}

fn main() -> Result<()> {
    let args = Cli::parse();

    // --dry-run rører verken databasen eller Voyage, så begge bygges først når
    // en gren faktisk trenger dem.
    if let Command::Index { repo, dry_run: true, .. } = &args.command {
        print!("{}", index::dry_run(repo)?.render());
        return Ok(());
    }

    // Ordlista får si egen fil ved siden av basen den skal tjene: den er
    // hundre megabyte nedlastet ordliste, og notatbasen er den ene fila som
    // ikke kan bygges opp igjen. `db::open` kobler den på når den ligger der.
    //
    // Standardbasen her er notatbasen og ikke kodeindeksen som ellers — det
    // er notatsøket ordlista finnes for. Stien skrives ut, så det aldri er
    // tvil om hvor lista havnet.
    if let Command::Ordbank { fil } = &args.command {
        let base = args.db.clone().unwrap_or_else(|| sti::standard_db(sti::Lager::Notater));
        let sti = base.with_file_name(sti::Lager::Ordbank.filnavn());
        if let Some(fil) = fil {
            if let Some(mappe) = sti.parent() {
                std::fs::create_dir_all(mappe)?;
            }
            let conn = rusqlite::Connection::open(&sti)?;
            let n = ordbank::load(&conn, fil)?;
            println!("{n} ordformer lest fra {}", fil.display());
        }
        // Åpnes gjennom basen ordlista skal tjene, ikke direkte: da er det
        // det appen kommer til å se som blir rapportert, ikke fila i seg selv.
        println!("{}\n{}", sti.display(), ordbank::status(&db::open(&base)?));
        return Ok(());
    }
    let db_path = args
        .db
        .unwrap_or_else(|| sti::standard_db(sti::Lager::Kodeindeks));

    // --no-embed og --text er de andre nøkkelfrie stiene: begge åpner
    // databasen, men ingen av dem må komme i nærheten av
    // VoyageEmbedder::from_env(), som feiler uten VOYAGE_API_KEY.
    if let Command::Index { repo, no_embed: true, .. } = &args.command {
        let conn = db::open(&db_path)?;
        let report = index::run_no_embed(&conn, repo)?;
        println!(
            "{} filer indeksert, {} biter, {} slettet, {} uendret",
            report.files, report.chunks, report.deleted, report.skipped
        );
        return Ok(());
    }
    if let Command::Search { query, limit, text: true } = &args.command {
        let conn = db::open(&db_path)?;
        // bm25-tallet betyr ingenting for en leser (og alle treff ser like ut
        // avrundet); utdraget med treffordene markert er det som forklarer
        // hvorfor notatet traff.
        for hit in search::text(&conn, query, *limit)? {
            println!(
                "{}:{}-{}\n  {}",
                hit.path,
                hit.start_line,
                hit.end_line,
                hit.text.replace('\n', " ")
            );
        }
        return Ok(());
    }

    let conn = db::open(&db_path)?;
    let embedder = VoyageEmbedder::from_env()?;

    match args.command {
        Command::Index { repo, .. } => {
            let report = index::run(&conn, &repo, &embedder)?;
            println!(
                "{} filer indeksert, {} biter, {} slettet, {} uendret",
                report.files, report.chunks, report.deleted, report.skipped
            );
            println!(
                "{} tokener, omtrent ${:.2}",
                report.tokens,
                report.tokens as f64 / 1_000_000.0 * index::USD_PER_MILLION_TOKENS
            );
        }
        Command::Search { query, limit, .. } => {
            for hit in search::query(&conn, &embedder, &query, limit)? {
                println!(
                    "{:.4}  {}:{}-{}",
                    hit.distance, hit.path, hit.start_line, hit.end_line
                );
            }
        }
        Command::Ordbank { .. } => unreachable!("håndtert over"),
        Command::Eval { file, k } => {
            let report = creatorhub_notes_indexer::eval::run(&conn, &embedder, &file, k)?;
            println!("{}", report.render());
            if !report.passed() {
                std::process::exit(1);
            }
        }
    }
    Ok(())
}
