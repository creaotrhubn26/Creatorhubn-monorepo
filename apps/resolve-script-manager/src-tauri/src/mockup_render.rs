//! Mockup Video-broen: tar en MockupConfig + klipp + output fra frontend,
//! skriver en jobb-config-fil, og spawner tsx-pipelinen
//! (scripts/mockup-polish-pro.mts), og streamer dens newline-delimited JSON
//! ({type:'progress'|'log'|'result'|'error'}) til frontend via "script-event".
//!
//! Speiler python::spawn_python-mønsteret, men spawner node/tsx i stedet for
//! python3. Gjenbruker RunningScriptsState så frontend kan kansellere.

use std::path::PathBuf;
use std::process::Stdio;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use uuid::Uuid;

use crate::python::{RunSummary, RunningScriptsState};

/// Finn monorepo-roten som inneholder scripts/mockup-polish-pro.mts.
/// Order: env-override → dev (CARGO_MANIFEST_DIR/../../..) → resource_dir.
fn repo_root(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(env) = std::env::var("MOCKUP_VIDEO_REPO_ROOT") {
        let p = PathBuf::from(env);
        if p.join("scripts/mockup-polish-pro.mts").exists() {
            return Ok(p);
        }
    }
    // Dev: src-tauri/ → apps/resolve-script-manager/ → apps/ → <repo root>
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev = manifest.join("..").join("..").join("..");
    if dev.join("scripts/mockup-polish-pro.mts").exists() {
        return Ok(dev.canonicalize().unwrap_or(dev));
    }
    if let Ok(res) = app.path().resource_dir() {
        if res.join("scripts/mockup-polish-pro.mts").exists() {
            return Ok(res);
        }
    }
    Err("Fant ikke scripts/mockup-polish-pro.mts (sett MOCKUP_VIDEO_REPO_ROOT)".into())
}

/// Lokaliser tsx-runneren (node_modules/.bin/tsx) under repo-roten.
fn tsx_bin(root: &PathBuf) -> Result<PathBuf, String> {
    let candidate = root.join("node_modules/.bin/tsx");
    if candidate.exists() {
        return Ok(candidate);
    }
    Err(format!(
        "Fant ikke tsx på {}. Kjør npm install i repo-roten.",
        candidate.display()
    ))
}

/// Render en mockup-video fra config. Returnerer RunSummary når ferdig;
/// fremdrift streames som "script-event" underveis.
#[tauri::command]
pub async fn mockup_render_video(
    app: AppHandle,
    config: Value,        // MockupConfig (visual/audio/music/export)
    clips: Vec<String>,   // absolutte stier til kilde-klipp, i rekkefølge
    output_path: String,  // hvor sluttfila skal skrives (.mp4 / .mov)
    music_path: Option<String>,
) -> Result<RunSummary, String> {
    let run_id = Uuid::new_v4().to_string();
    let started_at = chrono::Utc::now().to_rfc3339();
    let root = repo_root(&app)?;
    let tsx = tsx_bin(&root)?;
    let script = root.join("scripts/mockup-polish-pro.mts");

    if clips.is_empty() {
        return Err("Ingen klipp oppgitt".into());
    }

    // Skriv jobb-config til en temp-fil (pipelinen leser --config <fil>).
    let job = json!({
        "clips": clips,
        "output": output_path,
        "config": config,
        "music": music_path,
    });
    let job_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    let _ = std::fs::create_dir_all(&job_dir);
    let job_file = job_dir.join(format!("mockup-job-{}.json", run_id));
    std::fs::write(&job_file, serde_json::to_vec_pretty(&job).unwrap_or_default())
        .map_err(|e| format!("Kunne ikke skrive jobb-config: {}", e))?;

    let _ = app.emit(
        "script-event",
        json!({
            "type": "started",
            "runId": run_id,
            "scriptId": "mockup_render_video",
            "ts": chrono::Utc::now().timestamp_millis(),
        }),
    );

    let mut cmd = Command::new(&tsx);
    cmd.arg(&script)
        .arg("--config")
        .arg(&job_file)
        .current_dir(&root);
    // ffmpeg-sti hvis appen har en bundlet/konfigurert en.
    if let Ok(ff) = std::env::var("RESOLVE_SCRIPT_MANAGER_FFMPEG") {
        cmd.env("RESOLVE_SCRIPT_MANAGER_FFMPEG", ff);
    }
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Kunne ikke starte tsx: {}. Er node installert?", e))?;

    if let Some(pid) = child.id() {
        if let Some(state) = app.try_state::<RunningScriptsState>() {
            state.register(&run_id, pid);
        }
    }

    let stdout = child.stdout.take().ok_or("Kunne ikke fange stdout")?;
    let stderr = child.stderr.take().ok_or("Kunne ikke fange stderr")?;

    let app_out = app.clone();
    let rid_out = run_id.clone();
    let stdout_task = tokio::spawn(async move {
        let mut events: Vec<Value> = Vec::new();
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let event: Value = match serde_json::from_str::<Value>(trimmed) {
                Ok(mut parsed) => {
                    if let Some(obj) = parsed.as_object_mut() {
                        obj.insert("runId".into(), Value::String(rid_out.clone()));
                    }
                    parsed
                }
                Err(_) => json!({ "type": "log", "message": line, "runId": rid_out, "raw": true }),
            };
            let _ = app_out.emit("script-event", &event);
            events.push(event);
        }
        events
    });

    let app_err = app.clone();
    let rid_err = run_id.clone();
    let stderr_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_err.emit(
                "script-event",
                json!({ "type": "stderr", "message": line, "runId": rid_err }),
            );
        }
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("tsx-prosess feilet: {}", e))?;

    if let Some(state) = app.try_state::<RunningScriptsState>() {
        state.unregister(&run_id);
    }
    let _ = std::fs::remove_file(&job_file);

    let events = stdout_task.await.map_err(|e| e.to_string())?;
    let _ = stderr_task.await;
    let succeeded = status.success();

    let _ = app.emit(
        "script-event",
        json!({
            "type": "finished",
            "runId": run_id,
            "succeeded": succeeded,
            "exitCode": status.code(),
            "ts": chrono::Utc::now().timestamp_millis(),
        }),
    );

    Ok(RunSummary {
        run_id,
        script_id: "mockup_render_video".to_string(),
        exit_code: status.code(),
        succeeded,
        events,
        started_at,
        finished_at: chrono::Utc::now().to_rfc3339(),
        dry_run: false,
    })
}
