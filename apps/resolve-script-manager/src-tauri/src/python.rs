//! Spawns Python scripts and streams their newline-delimited JSON events
//! to the frontend via Tauri events.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Tauri-managed state holding user-configurable env vars that get injected
/// into every Python subprocess (ANTHROPIC_API_KEY, HF_TOKEN, RESOLVE_*).
#[derive(Default)]
pub struct AppSettings(pub Mutex<HashMap<String, String>>);

impl AppSettings {
    pub fn set_all(&self, kv: HashMap<String, String>) {
        if let Ok(mut map) = self.0.lock() {
            *map = kv;
        }
    }
    pub fn snapshot(&self) -> HashMap<String, String> {
        self.0.lock().map(|m| m.clone()).unwrap_or_default()
    }
}

/// Tauri-managed state tracking PIDs of running Python scripts (keyed by run_id).
#[derive(Default)]
pub struct RunningScriptsState(pub Mutex<HashMap<String, u32>>);

impl RunningScriptsState {
    pub fn register(&self, run_id: &str, pid: u32) {
        if let Ok(mut map) = self.0.lock() {
            map.insert(run_id.to_string(), pid);
        }
    }
    pub fn unregister(&self, run_id: &str) {
        if let Ok(mut map) = self.0.lock() {
            map.remove(run_id);
        }
    }
    pub fn take(&self, run_id: &str) -> Option<u32> {
        self.0.lock().ok()?.remove(run_id)
    }
    pub fn list(&self) -> Vec<(String, u32)> {
        self.0
            .lock()
            .map(|m| m.iter().map(|(k, v)| (k.clone(), *v)).collect())
            .unwrap_or_default()
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RunSummary {
    pub run_id: String,
    pub script_id: String,
    pub exit_code: Option<i32>,
    pub succeeded: bool,
    pub events: Vec<Value>,
    pub started_at: String,
    pub finished_at: String,
    pub dry_run: bool,
}

/// Resolve the path that holds bridge.py + scripts/.
///
/// Order:
/// 1. Bundled resources (`<resource_dir>/python/`) — production builds
/// 2. Dev override (`../python/` from CARGO_MANIFEST_DIR) — `tauri dev`
/// 3. Env var `RESOLVE_SCRIPT_MANAGER_PYTHON_DIR` — for power users
pub fn python_root(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(env) = std::env::var("RESOLVE_SCRIPT_MANAGER_PYTHON_DIR") {
        let p = PathBuf::from(env);
        if p.exists() {
            return Ok(p);
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        // Tauri prefixes "../" resources with "_up_/" during bundling, so we check both
        // canonical layouts to handle dev + release builds transparently.
        for sub in ["python", "_up_/python"] {
            let bundled = resource_dir.join(sub);
            if bundled.exists() {
                return Ok(bundled);
            }
        }
    }

    // Dev fallback — relative to src-tauri/
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev = manifest_dir.join("..").join("python");
    if dev.exists() {
        return Ok(dev.canonicalize().unwrap_or(dev));
    }

    Err(format!(
        "Could not locate python/ resources. Looked in resource_dir and {}",
        dev.display()
    ))
}

pub async fn spawn_python(
    app: AppHandle,
    run_id: String,
    script_id: String,
    script_path: PathBuf,
    params: Value,
    dry_run: bool,
) -> Result<RunSummary, String> {
    let started_at = chrono::Utc::now().to_rfc3339();

    let _ = app.emit(
        "script-event",
        serde_json::json!({
            "type": "started",
            "runId": run_id,
            "scriptId": script_id,
            "scriptPath": script_path.display().to_string(),
            "dryRun": dry_run,
            "ts": chrono::Utc::now().timestamp_millis(),
        }),
    );

    let mut cmd = Command::new("python3");
    cmd.arg(&script_path);
    // Inject user-configured env vars (ANTHROPIC_API_KEY, HF_TOKEN, RESOLVE_*)
    if let Some(settings) = app.try_state::<AppSettings>() {
        for (k, v) in settings.snapshot().into_iter() {
            if !v.is_empty() {
                cmd.env(k, v);
            }
        }
    }
    if dry_run {
        cmd.arg("--dry-run");
    }
    if !params.is_null() {
        cmd.arg(format!(
            "--params={}",
            serde_json::to_string(&params).unwrap_or_else(|_| "{}".to_string())
        ));
    }
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn python3: {}. Is Python 3 installed?", e))?;

    // Register PID in the shared state so the frontend can cancel via cancel_script(run_id)
    if let Some(pid) = child.id() {
        if let Some(state) = app.try_state::<RunningScriptsState>() {
            state.register(&run_id, pid);
        }
    }

    let stdout = child.stdout.take().ok_or("Could not capture stdout")?;
    let stderr = child.stderr.take().ok_or("Could not capture stderr")?;

    // stdout: parse JSON events, emit, collect
    let app_stdout = app.clone();
    let run_id_stdout = run_id.clone();
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
                        obj.insert("runId".into(), Value::String(run_id_stdout.clone()));
                    }
                    parsed
                }
                Err(_) => serde_json::json!({
                    "type": "log",
                    "message": line,
                    "runId": run_id_stdout,
                    "raw": true,
                }),
            };
            let _ = app_stdout.emit("script-event", &event);
            events.push(event);
        }
        events
    });

    // stderr: always treat as plain text
    let app_stderr = app.clone();
    let run_id_stderr = run_id.clone();
    let stderr_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let event = serde_json::json!({
                "type": "stderr",
                "message": line,
                "runId": run_id_stderr,
            });
            let _ = app_stderr.emit("script-event", &event);
        }
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("python3 wait failed: {}", e))?;

    // Unregister from the running-scripts state — the process is done
    if let Some(state) = app.try_state::<RunningScriptsState>() {
        state.unregister(&run_id);
    }

    let events = stdout_task.await.map_err(|e| e.to_string())?;
    let _ = stderr_task.await;

    let finished_at = chrono::Utc::now().to_rfc3339();
    let succeeded = status.success();

    let summary = RunSummary {
        run_id: run_id.clone(),
        script_id,
        exit_code: status.code(),
        succeeded,
        events,
        started_at,
        finished_at,
        dry_run,
    };

    let _ = app.emit(
        "script-event",
        serde_json::json!({
            "type": "finished",
            "runId": run_id,
            "succeeded": succeeded,
            "exitCode": status.code(),
            "ts": chrono::Utc::now().timestamp_millis(),
        }),
    );

    Ok(summary)
}
