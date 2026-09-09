use rusqlite::ffi::sqlite3_auto_extension;
use sqlite_vec::sqlite3_vec_init;
use std::sync::Once;

static INIT: Once = Once::new();

/// Registrerer sqlite-vec som auto-extension. Trygg å kalle flere ganger.
pub fn register_vec_extension() {
    INIT.call_once(|| unsafe {
        sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite3_vec_init as *const (),
        )));
    });
}

pub mod chunk;
pub mod db;
pub mod embed;
pub mod eval;
pub mod gitsrc;
pub mod index;
pub mod search;
