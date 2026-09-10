use std::path::PathBuf;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::AppHandle;

use crate::api_client;
use crate::config;
use crate::ptsl;
use crate::state::{emit_activity, snapshot, SharedConfig};

#[derive(Debug, Clone, Serialize)]
pub struct CommandDrainResult {
    pub processed: usize,
    pub succeeded: usize,
    pub failed: usize,
}

fn safe_name(value: &str) -> String {
    let candidate: String = value
        .chars()
        .take(160)
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let trimmed = candidate.trim().trim_matches('.');
    if trimmed.is_empty() {
        "Sound Room Reference.wav".into()
    } else {
        trimmed.into()
    }
}

async fn stage_artifact(
    api_base: &str,
    token: &str,
    session_id: &str,
    artifact_id: &str,
    file_name: &str,
) -> Result<PathBuf, String> {
    let directory = config::config_dir()
        .join("imports")
        .join(safe_name(artifact_id));
    tokio::fs::create_dir_all(&directory)
        .await
        .map_err(|e| format!("Opprett importmappe: {}", e))?;
    let path = directory.join(safe_name(file_name));
    let temporary = directory.join(format!(".{}.tmp", safe_name(file_name)));
    api_client::download_artifact_to(api_base, token, session_id, artifact_id, &temporary).await?;
    tokio::fs::rename(&temporary, &path)
        .await
        .map_err(|e| format!("Aktiver referanse: {}", e))?;
    Ok(path)
}

async fn execute_one(
    api_base: &str,
    token: &str,
    session_id: &str,
    kind: &str,
    mut payload: Value,
) -> Result<Value, String> {
    if kind == "import_audio" {
        let artifact_id = payload
            .get("artifactId")
            .and_then(Value::as_str)
            .ok_or("artifactId mangler")?;
        let file_name = payload
            .get("fileName")
            .and_then(Value::as_str)
            .unwrap_or("Sound Room Reference.wav");
        let path = stage_artifact(api_base, token, session_id, artifact_id, file_name).await?;
        payload["localPath"] = Value::String(path.to_string_lossy().into_owned());
        if !ptsl::probe().helper_installed {
            return Ok(json!({ "execution": "staged", "localPath": path, "imported": false }));
        }
    }
    ptsl::execute(kind, payload).await
}

pub async fn drain(cfg: &SharedConfig, app: &AppHandle) -> Result<CommandDrainResult, String> {
    let snap = snapshot(cfg);
    let token = snap.token.as_deref().ok_or("Ikke paret")?;
    let session_id = snap.session_id.as_deref().ok_or("Sesjon mangler")?;
    let response = api_client::get_commands(&snap.api_base, token, session_id).await?;
    let commands = response
        .get("commands")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut result = CommandDrainResult {
        processed: commands.len(),
        succeeded: 0,
        failed: 0,
    };
    for command in commands {
        let Some(id) = command.get("id").and_then(Value::as_str) else {
            continue;
        };
        let Some(kind) = command.get("command_kind").and_then(Value::as_str) else {
            continue;
        };
        let mut payload = command.get("payload").cloned().unwrap_or_else(|| json!({}));
        if kind == "export_review" && payload.get("outputDirectory").is_none() {
            if let Some(directory) = snap.bounce_dir.as_deref() {
                payload["outputDirectory"] = Value::String(directory.to_string());
            }
        }
        match execute_one(&snap.api_base, token, session_id, kind, payload).await {
            Ok(command_result) => {
                api_client::complete_command(
                    &snap.api_base,
                    token,
                    session_id,
                    id,
                    "completed",
                    Some(command_result.clone()),
                    None,
                )
                .await?;
                result.succeeded += 1;
                let message = if command_result.get("execution").and_then(Value::as_str)
                    == Some("staged")
                {
                    format!("Referanse hentet til Companion; PTSL-broen mangler, så dra filen inn i Pro Tools: {}",
                        command_result.get("localPath").and_then(Value::as_str).unwrap_or("imports"))
                } else {
                    format!("Pro Tools-handling utført: {}", kind)
                };
                emit_activity(
                    app,
                    if kind == "import_audio" {
                        "bounce"
                    } else {
                        "marker"
                    },
                    &message,
                );
            }
            Err(error) => {
                api_client::complete_command(
                    &snap.api_base,
                    token,
                    session_id,
                    id,
                    "failed",
                    None,
                    Some(&error),
                )
                .await?;
                result.failed += 1;
                emit_activity(
                    app,
                    "error",
                    &format!("Pro Tools-handling «{}» feilet: {}", kind, error),
                );
            }
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn import_file_names_cannot_escape_the_staging_directory() {
        assert_eq!(safe_name("../../Keeper?.wav"), "_.._Keeper_.wav");
        assert!(!Path::new(&safe_name("../../Keeper?.wav")).is_absolute());
    }
}
