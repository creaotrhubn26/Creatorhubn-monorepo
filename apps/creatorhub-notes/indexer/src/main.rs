use anyhow::Result;
use clap::{Parser, Subcommand};
use creatorhub_notes_indexer::{cli, db, embed::VoyageEmbedder, index, search};
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
    },
    /// Søk semantisk i indeksen
    Search {
        query: String,
        #[arg(long, default_value_t = 5)]
        limit: usize,
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
    let db_path = args.db.unwrap_or_else(cli::default_db_path);
    let conn = db::open(&db_path)?;
    let embedder = VoyageEmbedder::from_env()?;

    match args.command {
        Command::Index { repo } => {
            let report = index::run(&conn, &repo, &embedder)?;
            println!(
                "{} filer, {} biter, {}",
                report.files,
                report.chunks,
                if report.incremental { "inkrementell" } else { "full" }
            );
        }
        Command::Search { query, limit } => {
            for hit in search::query(&conn, &embedder, &query, limit)? {
                println!(
                    "{:.4}  {}:{}-{}",
                    hit.distance, hit.path, hit.start_line, hit.end_line
                );
            }
        }
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
