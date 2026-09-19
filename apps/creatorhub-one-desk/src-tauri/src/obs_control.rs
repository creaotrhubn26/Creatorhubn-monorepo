//! OBS WebSocket 5.x control adapter.
//!
//! This is intentionally a control-only integration. The Bridge never exposes
//! OBS WebSocket as a video source; program/preview video must use a separate
//! UVC, NDI or encoded local-preview transport.

use std::time::Duration;

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async, tungstenite::Message};

use crate::local_endpoint::parse_local_endpoint;

type ObsSocket = WebSocketStream<MaybeTlsStream<TcpStream>>;
const IO_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, Serialize)]
pub struct ObsProbe {
    pub obs_studio_version: Option<String>,
    pub obs_websocket_version: Option<String>,
    pub recording: Option<bool>,
    pub current_program_scene: Option<String>,
    pub scenes: Vec<String>,
    pub available_requests: Vec<String>,
}

#[derive(Debug, Clone, Copy)]
pub enum ObsAction {
    StartRecord,
    StopRecord,
    SetCurrentProgramScene,
}

impl ObsAction {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "start_record" => Ok(Self::StartRecord),
            "stop_record" => Ok(Self::StopRecord),
            "set_current_program_scene" => Ok(Self::SetCurrentProgramScene),
            _ => Err("Ukjent OBS-handling".into()),
        }
    }

    fn request_type(self) -> &'static str {
        match self {
            Self::StartRecord => "StartRecord",
            Self::StopRecord => "StopRecord",
            Self::SetCurrentProgramScene => "SetCurrentProgramScene",
        }
    }
}

pub async fn probe(endpoint: &str, password: Option<&str>) -> Result<ObsProbe, String> {
    let mut session = ObsSession::connect(endpoint, password).await?;
    let version = session.request("GetVersion", None).await?;
    let available_requests = version
        .get("availableRequests")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let record = if available_requests
        .iter()
        .any(|item| item == "GetRecordStatus")
    {
        Some(session.request("GetRecordStatus", None).await?)
    } else {
        None
    };
    let scene_list = if available_requests.iter().any(|item| item == "GetSceneList") {
        Some(session.request("GetSceneList", None).await?)
    } else {
        None
    };
    let scenes = scene_list
        .as_ref()
        .and_then(|value| value.get("scenes"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("sceneName").and_then(Value::as_str))
                .map(str::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(ObsProbe {
        obs_studio_version: version
            .get("obsVersion")
            .and_then(Value::as_str)
            .map(str::to_owned),
        obs_websocket_version: version
            .get("obsWebSocketVersion")
            .and_then(Value::as_str)
            .map(str::to_owned),
        recording: record
            .as_ref()
            .and_then(|value| value.get("outputActive"))
            .and_then(Value::as_bool),
        current_program_scene: scene_list
            .as_ref()
            .and_then(|value| value.get("currentProgramSceneName"))
            .and_then(Value::as_str)
            .map(str::to_owned),
        scenes,
        available_requests,
    })
}

pub async fn run_action(
    endpoint: &str,
    password: Option<&str>,
    action: ObsAction,
    scene_name: Option<&str>,
) -> Result<Value, String> {
    let mut session = ObsSession::connect(endpoint, password).await?;
    let version = session.request("GetVersion", None).await?;
    let request_type = action.request_type();
    let available = version
        .get("availableRequests")
        .and_then(Value::as_array)
        .is_some_and(|items| items.iter().any(|item| item.as_str() == Some(request_type)));
    if !available {
        return Err(format!("OBS-instansen støtter ikke {request_type}"));
    }

    let request_data = match action {
        ObsAction::SetCurrentProgramScene => {
            let name = scene_name
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| "Scenenavn mangler".to_string())?;
            if name.chars().count() > 256 {
                return Err("Scenenavn kan ikke være lengre enn 256 tegn".into());
            }
            Some(json!({ "sceneName": name }))
        }
        _ => None,
    };
    session.request(request_type, request_data).await
}

struct ObsSession {
    socket: ObsSocket,
}

impl ObsSession {
    async fn connect(endpoint: &str, password: Option<&str>) -> Result<Self, String> {
        let endpoint = parse_local_endpoint(endpoint, &["ws", "wss"])?;
        let (mut socket, _) = timeout(IO_TIMEOUT, connect_async(endpoint.as_str()))
            .await
            .map_err(|_| "OBS-tilkoblingen brukte for lang tid".to_string())?
            .map_err(|error| format!("Kunne ikke koble til OBS: {error}"))?;
        let hello = receive_json(&mut socket).await?;
        if hello.get("op").and_then(Value::as_u64) != Some(0) {
            return Err("OBS sendte ikke forventet Hello (op 0)".into());
        }
        let data = hello
            .get("d")
            .and_then(Value::as_object)
            .ok_or_else(|| "OBS Hello mangler data".to_string())?;
        let rpc_version = data.get("rpcVersion").and_then(Value::as_u64).unwrap_or(1);
        let mut identify = Map::new();
        identify.insert("rpcVersion".into(), Value::from(rpc_version.min(1)));
        identify.insert("eventSubscriptions".into(), Value::from(0));
        if let Some(authentication) = data.get("authentication").and_then(Value::as_object) {
            let password = password.filter(|value| !value.is_empty()).ok_or_else(|| {
                "OBS krever passord. Oppgi passordet fra Tools → WebSocket Server Settings."
                    .to_string()
            })?;
            let salt = authentication
                .get("salt")
                .and_then(Value::as_str)
                .ok_or_else(|| "OBS authentication mangler salt".to_string())?;
            let challenge = authentication
                .get("challenge")
                .and_then(Value::as_str)
                .ok_or_else(|| "OBS authentication mangler challenge".to_string())?;
            identify.insert(
                "authentication".into(),
                Value::String(authentication_response(password, salt, challenge)),
            );
        }
        send_json(&mut socket, &json!({ "op": 1, "d": identify })).await?;
        let identified = receive_json(&mut socket).await?;
        if identified.get("op").and_then(Value::as_u64) != Some(2) {
            return Err("OBS avviste identifisering eller autentisering".into());
        }
        Ok(Self { socket })
    }

    async fn request(
        &mut self,
        request_type: &str,
        request_data: Option<Value>,
    ) -> Result<Value, String> {
        let request_id = uuid::Uuid::new_v4().to_string();
        let mut data = Map::new();
        data.insert("requestType".into(), Value::String(request_type.into()));
        data.insert("requestId".into(), Value::String(request_id.clone()));
        if let Some(request_data) = request_data {
            data.insert("requestData".into(), request_data);
        }
        send_json(&mut self.socket, &json!({ "op": 6, "d": data })).await?;
        loop {
            let response = receive_json(&mut self.socket).await?;
            if response.get("op").and_then(Value::as_u64) != Some(7) {
                continue;
            }
            let response_data = response
                .get("d")
                .and_then(Value::as_object)
                .ok_or_else(|| "OBS-respons mangler data".to_string())?;
            if response_data.get("requestId").and_then(Value::as_str) != Some(&request_id) {
                continue;
            }
            let status = response_data
                .get("requestStatus")
                .and_then(Value::as_object)
                .ok_or_else(|| "OBS-respons mangler requestStatus".to_string())?;
            if status.get("result").and_then(Value::as_bool) != Some(true) {
                let code = status.get("code").and_then(Value::as_i64).unwrap_or(-1);
                let comment = status
                    .get("comment")
                    .and_then(Value::as_str)
                    .unwrap_or("ukjent feil");
                return Err(format!("OBS avviste {request_type} ({code}): {comment}"));
            }
            return Ok(response_data
                .get("responseData")
                .cloned()
                .unwrap_or_else(|| json!({})));
        }
    }
}

fn authentication_response(password: &str, salt: &str, challenge: &str) -> String {
    let secret = BASE64.encode(Sha256::digest(format!("{password}{salt}").as_bytes()));
    BASE64.encode(Sha256::digest(format!("{secret}{challenge}").as_bytes()))
}

async fn send_json<S>(socket: &mut WebSocketStream<S>, value: &Value) -> Result<(), String>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let text = serde_json::to_string(value).map_err(|error| format!("OBS JSON-feil: {error}"))?;
    timeout(IO_TIMEOUT, socket.send(Message::Text(text.into())))
        .await
        .map_err(|_| "OBS-skriving brukte for lang tid".to_string())?
        .map_err(|error| format!("OBS-skriving feilet: {error}"))
}

async fn receive_json<S>(socket: &mut WebSocketStream<S>) -> Result<Value, String>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    loop {
        let message = timeout(IO_TIMEOUT, socket.next())
            .await
            .map_err(|_| "OBS svarte ikke innen tidsfristen".to_string())?
            .ok_or_else(|| "OBS lukket tilkoblingen".to_string())?
            .map_err(|error| format!("OBS-lesing feilet: {error}"))?;
        match message {
            Message::Text(text) => {
                return serde_json::from_str(text.as_ref())
                    .map_err(|error| format!("Ugyldig JSON fra OBS: {error}"));
            }
            Message::Close(_) => return Err("OBS lukket tilkoblingen".into()),
            Message::Binary(_) | Message::Ping(_) | Message::Pong(_) | Message::Frame(_) => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;
    use tokio_tungstenite::accept_async;

    #[test]
    fn computes_official_obs_authentication_example() {
        let result = authentication_response(
            "supersecretpassword",
            "lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI=",
            "+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY=",
        );
        assert_eq!(result, "1Ct943GAT+6YQUUX47Ia/ncufilbe6+oD6lY+5kaCu4=");
    }

    #[test]
    fn refuses_non_local_obs_endpoints() {
        assert!(ObsAction::parse("start_record").is_ok());
        assert!(parse_local_endpoint("wss://example.com", &["ws", "wss"]).is_err());
    }

    #[tokio::test]
    async fn probes_real_obs_websocket_message_flow() {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("listener");
        let address = listener.local_addr().expect("address");
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.expect("accept");
            let mut socket = accept_async(stream).await.expect("websocket");
            send_json(
                &mut socket,
                &json!({
                    "op": 0,
                    "d": {
                        "obsStudioVersion": "31.0.0",
                        "obsWebSocketVersion": "5.6.0",
                        "rpcVersion": 1
                    }
                }),
            )
            .await
            .expect("hello");
            let identify = receive_json(&mut socket).await.expect("identify");
            assert_eq!(identify.get("op").and_then(Value::as_u64), Some(1));
            send_json(
                &mut socket,
                &json!({ "op": 2, "d": { "negotiatedRpcVersion": 1 } }),
            )
            .await
            .expect("identified");

            for expected in ["GetVersion", "GetRecordStatus", "GetSceneList"] {
                let request = receive_json(&mut socket).await.expect("request");
                let data = request.get("d").and_then(Value::as_object).expect("data");
                assert_eq!(
                    data.get("requestType").and_then(Value::as_str),
                    Some(expected)
                );
                let request_id = data.get("requestId").and_then(Value::as_str).expect("id");
                let response_data = match expected {
                    "GetVersion" => json!({
                        "obsVersion": "31.0.0",
                        "obsWebSocketVersion": "5.6.0",
                        "availableRequests": ["GetVersion", "GetRecordStatus", "GetSceneList"]
                    }),
                    "GetRecordStatus" => json!({ "outputActive": true }),
                    _ => json!({
                        "currentProgramSceneName": "Camera A",
                        "scenes": [{ "sceneName": "Camera A" }, { "sceneName": "Camera B" }]
                    }),
                };
                send_json(
                    &mut socket,
                    &json!({
                        "op": 7,
                        "d": {
                            "requestType": expected,
                            "requestId": request_id,
                            "requestStatus": { "result": true, "code": 100 },
                            "responseData": response_data
                        }
                    }),
                )
                .await
                .expect("response");
            }
        });

        let result = probe(&format!("ws://{address}"), None)
            .await
            .expect("probe");
        assert_eq!(result.obs_studio_version.as_deref(), Some("31.0.0"));
        assert_eq!(result.current_program_scene.as_deref(), Some("Camera A"));
        assert_eq!(result.scenes, vec!["Camera A", "Camera B"]);
        assert_eq!(result.recording, Some(true));
        server.await.expect("server task");
    }
}
