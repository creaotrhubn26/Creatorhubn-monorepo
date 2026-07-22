//! playwright_render — Fase 4: kjør det genererte Playwright-skriptet (.mjs)
//! lokalt og ta opp deterministisk video (recordVideo i contexten), uten
//! getDisplayMedia (som ikke finnes i WKWebView).
//!
//! Speiler mockup_render-mønsteret (tokio Command + RunningScriptsState +
//! "script-event"-streaming). Playwright + Chromium installeres ÉN gang i en
//! delt runtime-mappe (app_data_dir/playwright-runtime); selve demo-skriptet
//! kjøres derfra slik at `import 'playwright'` resolver.

use std::path::PathBuf;
use std::process::Stdio;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use uuid::Uuid;

use crate::python::{RunSummary, RunningScriptsState};

/// Finn en kjørbar (node/npm) — GUI-apper arver ofte ikke homebrew-PATH, så vi
/// prøver vanlige stier + `which` før vi faller tilbake til navnet (PATH).
fn find_bin(name: &str) -> String {
    let candidates = [
        format!("/opt/homebrew/bin/{name}"),
        format!("/usr/local/bin/{name}"),
        format!("/usr/bin/{name}"),
    ];
    for c in candidates.iter() {
        if PathBuf::from(c).exists() {
            return c.clone();
        }
    }
    if let Ok(o) = std::process::Command::new("/usr/bin/which").arg(name).output() {
        if o.status.success() {
            let p = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !p.is_empty() {
                return p;
            }
        }
    }
    name.to_string()
}

/// Delt runtime-mappe der Playwright + Chromium installeres én gang.
fn runtime_dir(app: &AppHandle) -> PathBuf {
    let base = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    let dir = base.join("playwright-runtime");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

/// Er system-Chrome installert? Da slipper vi å laste ned Chromium (~150 MB) —
/// det genererte skriptet bruker channel:'chrome'.
fn system_chrome_present() -> bool {
    [
        "/Applications/Google Chrome.app",
        "/Applications/Chromium.app",
        "/Applications/Google Chrome Canary.app",
    ]
    .iter()
    .any(|p| PathBuf::from(p).exists())
}

/// Status: er node tilgjengelig + er Playwright installert i runtime-mappa?
#[tauri::command]
pub fn playwright_status(app: AppHandle) -> Value {
    let node = find_bin("node");
    let node_ok = PathBuf::from(&node).exists()
        || std::process::Command::new(&node).arg("--version").output().map(|o| o.status.success()).unwrap_or(false);
    let dir = runtime_dir(&app);
    let installed = dir.join("node_modules/playwright").exists();
    json!({
        "nodePath": node,
        "nodeOk": node_ok,
        "playwrightInstalled": installed,
        "chromeAvailable": system_chrome_present(),
        "runtimeDir": dir.to_string_lossy(),
    })
}

/// Strøm en barneprosess' stdout/stderr som "script-event" og vent på exit.
async fn stream_child(
    app: &AppHandle,
    mut cmd: Command,
    run_id: &str,
    script_id: &str,
) -> Result<i32, String> {
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Kunne ikke starte prosess: {e}"))?;
    if let Some(pid) = child.id() {
        if let Some(state) = app.try_state::<RunningScriptsState>() {
            state.register(run_id, pid);
        }
    }
    let stdout = child.stdout.take().ok_or("Kunne ikke fange stdout")?;
    let stderr = child.stderr.take().ok_or("Kunne ikke fange stderr")?;

    let app_out = app.clone();
    let rid_out = run_id.to_string();
    let sid_out = script_id.to_string();
    let out_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_out.emit(
                "script-event",
                json!({ "type": "log", "message": line, "runId": rid_out, "scriptId": sid_out }),
            );
        }
    });
    let app_err = app.clone();
    let rid_err = run_id.to_string();
    let err_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_err.emit(
                "script-event",
                json!({ "type": "stderr", "message": line, "runId": rid_err }),
            );
        }
    });

    let status = child.wait().await.map_err(|e| format!("prosess feilet: {e}"))?;
    if let Some(state) = app.try_state::<RunningScriptsState>() {
        state.unregister(run_id);
    }
    let _ = out_task.await;
    let _ = err_task.await;
    Ok(status.code().unwrap_or(-1))
}

/// Installer Playwright + Chromium i runtime-mappa (én gang). Streamer
/// npm/playwright-output som "script-event". Stor nedlasting (~150–300 MB) +
/// krever node/npm + nett.
#[tauri::command]
pub async fn setup_playwright(app: AppHandle) -> Result<RunSummary, String> {
    let run_id = Uuid::new_v4().to_string();
    let started_at = chrono::Utc::now().to_rfc3339();
    let dir = runtime_dir(&app);
    let npm = find_bin("npm");

    // Minimal package.json så npm install ikke klager.
    let pkg = dir.join("package.json");
    if !pkg.exists() {
        let _ = std::fs::write(
            &pkg,
            r#"{ "name": "post-agent-playwright-runtime", "private": true, "type": "module", "dependencies": { "playwright": "^1.49.0" } }"#,
        );
    }

    let _ = app.emit("script-event", json!({ "type": "started", "runId": run_id, "scriptId": "setup_playwright" }));
    let _ = app.emit("script-event", json!({ "type": "log", "message": "Installerer Playwright… (kan ta et par minutter)", "runId": run_id }));

    let mut install = Command::new(&npm);
    install.arg("install").arg("playwright").current_dir(&dir);
    let code1 = stream_child(&app, install, &run_id, "setup_playwright").await?;
    if code1 != 0 {
        return Err(format!("npm install playwright feilet (exit {code1}). Er node/npm installert?"));
    }

    // Har brukeren Chrome? Da bruker skriptet channel:'chrome' → vi slipper
    // den store Chromium-nedlastingen helt.
    let mut code2 = 0;
    if system_chrome_present() {
        let _ = app.emit("script-event", json!({ "type": "log", "message": "System-Chrome funnet — hopper over Chromium-nedlasting.", "runId": run_id }));
    } else {
        let _ = app.emit("script-event", json!({ "type": "log", "message": "Laster ned Chromium… (~150 MB)", "runId": run_id }));
        let npx = find_bin("npx");
        let mut browsers = Command::new(&npx);
        browsers.arg("playwright").arg("install").arg("chromium").current_dir(&dir);
        code2 = stream_child(&app, browsers, &run_id, "setup_playwright").await?;
    }

    let succeeded = code2 == 0;
    let _ = app.emit("script-event", json!({ "type": "finished", "runId": run_id, "succeeded": succeeded }));
    Ok(RunSummary {
        run_id, script_id: "setup_playwright".into(), exit_code: Some(code2),
        succeeded, events: vec![], started_at, finished_at: chrono::Utc::now().to_rfc3339(), dry_run: false,
    })
}

/// Kjør et generert Playwright-skript: skriver demo.mjs i runtime-mappa, kjører
/// `node demo.mjs`, og emitter video-stien når den finnes. recordVideo i
/// skriptet skriver .webm til runtime/demo-video/.
#[tauri::command]
pub async fn run_playwright_demo(app: AppHandle, script_code: String) -> Result<RunSummary, String> {
    let run_id = Uuid::new_v4().to_string();
    let started_at = chrono::Utc::now().to_rfc3339();
    let dir = runtime_dir(&app);

    if !dir.join("node_modules/playwright").exists() {
        return Err("Playwright er ikke installert. Kjør «Sett opp Playwright» først.".into());
    }

    // Rydd gammel video så vi finner den nye etterpå.
    let video_dir = dir.join("demo-video");
    let _ = std::fs::remove_dir_all(&video_dir);

    let script = dir.join("demo.mjs");
    std::fs::write(&script, script_code).map_err(|e| format!("Kunne ikke skrive demo.mjs: {e}"))?;

    let node = find_bin("node");
    let _ = app.emit("script-event", json!({ "type": "started", "runId": run_id, "scriptId": "run_playwright_demo" }));

    let mut cmd = Command::new(&node);
    cmd.arg(&script).current_dir(&dir);
    let code = stream_child(&app, cmd, &run_id, "run_playwright_demo").await?;
    let succeeded = code == 0;

    // Finn nyeste .webm i demo-video/.
    let mut video_path: Option<String> = None;
    if let Ok(entries) = std::fs::read_dir(&video_dir) {
        let mut newest: Option<(std::time::SystemTime, PathBuf)> = None;
        for e in entries.flatten() {
            let p = e.path();
            if p.extension().map(|x| x == "webm").unwrap_or(false) {
                if let Ok(meta) = e.metadata() {
                    if let Ok(modt) = meta.modified() {
                        if newest.as_ref().map(|(t, _)| modt > *t).unwrap_or(true) {
                            newest = Some((modt, p.clone()));
                        }
                    }
                }
            }
        }
        if let Some((_, p)) = newest {
            video_path = Some(p.to_string_lossy().to_string());
        }
    }

    if let Some(ref vp) = video_path {
        let _ = app.emit("script-event", json!({ "type": "video", "path": vp, "runId": run_id }));
    }
    let _ = app.emit("script-event", json!({ "type": "finished", "runId": run_id, "succeeded": succeeded, "videoPath": video_path }));

    Ok(RunSummary {
        run_id, script_id: "run_playwright_demo".into(), exit_code: Some(code),
        succeeded, events: vec![], started_at, finished_at: chrono::Utc::now().to_rfc3339(), dry_run: false,
    })
}

// #2: Playwright-screenshots (ekte Chromium/Chrome) for preview — bedre enn
// html2canvas. Fanger viewport-bilder ved scroll-bånd + fjerner cookie-banner.
const SHOTS_MJS: &str = r#"import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const url = process.argv[2];
let browser; try { browser = await chromium.launch({ headless: true, channel: 'chrome' }); } catch { browser = await chromium.launch({ headless: true }); }
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2000);
for (const t of ['Godta alle','Godta','Aksepter alle','Aksepter','Tillat alle','Jeg forstår','Greit','OK','Accept all','Accept','Allow all','I agree','Got it']) {
  try { const b = page.getByRole('button', { name: t, exact: false }).first(); if ((await b.count()) && (await b.isVisible().catch(() => false))) { await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); break; } } catch {}
}
const ih = 800, max = await page.evaluate(() => Math.max(0, document.body.scrollHeight - innerHeight));
const bands = Math.max(1, Math.min(6, Math.ceil((max + ih) / ih)));
const shots = [];
for (let i = 0; i < bands; i++) {
  const y = bands === 1 ? 0 : Math.round(max * i / (bands - 1));
  const pct = max > 0 ? y / max : 0;
  await page.evaluate(yy => window.scrollTo(0, yy), y);
  await page.waitForTimeout(500);
  const buf = await page.screenshot({ type: 'jpeg', quality: 72 });
  shots.push({ scrollPct: pct, dataUrl: 'data:image/jpeg;base64,' + buf.toString('base64') });
}
writeFileSync('shots.json', JSON.stringify({ shots }));
await browser.close();
"#;

/// Fang preview-screenshots av en URL via Playwright (system-Chrome/Chromium).
/// Returnerer { shots: [{ scrollPct, dataUrl }] } — settes som project.scanShots
/// for skarp, ekte-rendret preview (i stedet for html2canvas).
#[tauri::command]
pub async fn playwright_capture_shots(app: AppHandle, url: String) -> Result<Value, String> {
    let dir = runtime_dir(&app);
    if !dir.join("node_modules/playwright").exists() {
        return Err("Playwright ikke installert. Kjør «Sett opp Playwright» først.".into());
    }
    let script = dir.join("shots.mjs");
    std::fs::write(&script, SHOTS_MJS).map_err(|e| format!("Kunne ikke skrive shots.mjs: {e}"))?;
    let out_file = dir.join("shots.json");
    let _ = std::fs::remove_file(&out_file);
    let node = find_bin("node");
    let run_id = Uuid::new_v4().to_string();
    let mut cmd = Command::new(&node);
    cmd.arg(&script).arg(&url).current_dir(&dir);
    let code = stream_child(&app, cmd, &run_id, "playwright_capture_shots").await?;
    if code != 0 {
        return Err(format!("shots-skript feilet (exit {code})"));
    }
    let txt = std::fs::read_to_string(&out_file).map_err(|e| format!("Kunne ikke lese shots.json: {e}"))?;
    serde_json::from_str::<Value>(&txt).map_err(|e| format!("Kunne ikke parse shots.json: {e}"))
}

// ── Infographic Studio: render HTML-mal → transparent PNG-sekvens → ProRes 4444
//    (alfa). Den genererte .mov-en legges på Resolve-timelinen av place_overlay.
// scale (arg6) = deviceScaleFactor → oppløsning (2≈1080p, 4≈4K for brede maler).
// arg7 (frame) = 'WxH' → komponer #wrap inn i et fast sosialt lerret (eksakte
// utpiksler, deviceScaleFactor 1) | 'native' → malens naturlige størrelse × scale.
const IG_CAPTURE_MJS: &str = r#"
import { chromium } from 'playwright';
const htmlPath = process.argv[2], outDir = process.argv[3];
const N = parseInt(process.argv[4]||'48'), useChrome = process.argv[5]==='1';
const scale = parseFloat(process.argv[6]||'2') || 2;
const frame = process.argv[7]||'native';
const easing = process.argv[8]||'outcubic';
function ease(p){var x=Math.max(0,Math.min(1,p));switch(easing){case 'linear':return x;case 'out':return 1-(1-x)*(1-x);case 'inout':return x<0.5?2*x*x:1-Math.pow(-2*x+2,2)/2;default:return 1-Math.pow(1-x,3);}}
let fit=false, FW=0, FH=0, vpW=1760, vpH=560, dsf=scale;
const fm = /^(\d+)x(\d+)$/.exec(frame);
if(fm){ FW=parseInt(fm[1],10); FH=parseInt(fm[2],10); fit=true; vpW=FW; vpH=FH; dsf=1; }
const b = await chromium.launch(useChrome ? { headless:true, channel:'chrome' } : { headless:true });
const p = await b.newPage({ viewport:{ width:vpW, height:vpH }, deviceScaleFactor:dsf });
await p.goto('file://'+htmlPath, { waitUntil:'networkidle', timeout:30000 }).catch(()=>{});
await p.waitForTimeout(1200);
let el = await p.$('#wrap'); if(!el) el = await p.$('body');
if(fit){
  await p.evaluate((d)=>{
    const w=document.querySelector('#wrap')||document.body;
    document.documentElement.style.background='transparent';
    document.body.style.cssText='margin:0;background:transparent;overflow:hidden;width:'+d.FW+'px;height:'+d.FH+'px;display:grid;place-items:center';
    w.style.transformOrigin='center center'; w.style.transform='none';
    const bw=Math.max(1,w.scrollWidth||w.offsetWidth||1), bh=Math.max(1,w.scrollHeight||w.offsetHeight||1);
    const k=Math.min((d.FW*0.92)/bw,(d.FH*0.92)/bh);
    w.style.transform='scale('+k.toFixed(4)+')';
  }, {FW,FH});
} else {
  // Native: lås #wrap til sin FULL-progresjon-størrelse (bredest/høyest) FØR
  // capture-løkka. #wrap er width:max-content, så count-up-tall som endrer
  // sifferbredde (0 → 1 234) gir ellers frames med ulik px-størrelse, og ffmpeg
  // avviser sekvensen («Input picture width/height do not match the first
  // frame») → hele renderen feiler. Å fryse boksen holder alle f###.png like store.
  await p.evaluate((v)=>window.setProgress && window.setProgress(v), 1);
  await p.waitForTimeout(80);
  await p.evaluate(()=>{
    const w=document.querySelector('#wrap'); if(!w) return;
    const r=w.getBoundingClientRect();
    w.style.boxSizing='border-box';
    w.style.width=Math.ceil(r.width)+'px'; w.style.minWidth=Math.ceil(r.width)+'px';
    w.style.height=Math.ceil(r.height)+'px'; w.style.minHeight=Math.ceil(r.height)+'px';
  });
}
for (let i=0;i<N;i++){
  const prog = ease(N>1 ? i/(N-1) : 1);
  await p.evaluate((v)=>window.setProgress && window.setProgress(v), prog);
  if(fit) await p.screenshot({ path: `${outDir}/f${String(i).padStart(3,'0')}.png`, omitBackground:true, clip:{x:0,y:0,width:FW,height:FH} });
  else await el.screenshot({ path: `${outDir}/f${String(i).padStart(3,'0')}.png`, omitBackground:true });
}
console.log('IG_DONE '+N);
await b.close();
"#;

/// Sanitér et navn til et trygt filnavn.
fn ig_safe_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

/// Delt frame-capture: skriv HTML + capture-skript, fang `frames` transparente
/// PNG-er ved `scale` deviceScaleFactor. Returnerer (arbeidsmappe, safe-navn).
async fn ig_capture_frames(
    app: &AppHandle,
    html: &str,
    name: &str,
    frames: i64,
    scale: f64,
    frame: &str,
    easing: &str,
    label: &str,
) -> Result<(std::path::PathBuf, String), String> {
    let dir = runtime_dir(app);
    if !dir.join("node_modules/playwright").exists() {
        return Err("Playwright ikke installert. Kjør «Sett opp Playwright» først.".into());
    }
    let node = find_bin("node");
    let safe = ig_safe_name(name);
    let work = dir.join("ig").join(&safe);
    let _ = std::fs::remove_dir_all(&work);
    std::fs::create_dir_all(&work).map_err(|e| format!("kunne ikke lage arbeidsmappe: {e}"))?;
    let html_file = work.join("template.html");
    std::fs::write(&html_file, html).map_err(|e| format!("kunne ikke skrive HTML: {e}"))?;
    let script = dir.join("ig_capture.mjs");
    std::fs::write(&script, IG_CAPTURE_MJS).map_err(|e| format!("kunne ikke skrive capture-skript: {e}"))?;

    let use_chrome = if system_chrome_present() { "1" } else { "0" };
    let run_id = Uuid::new_v4().to_string();
    let mut cmd = Command::new(&node);
    cmd.arg(&script)
        .arg(html_file.to_string_lossy().to_string())
        .arg(work.to_string_lossy().to_string())
        .arg(frames.to_string())
        .arg(use_chrome)
        .arg(format!("{}", scale.clamp(1.0, 6.0)))
        .arg(if frame.is_empty() { "native" } else { frame })
        .arg(if easing.is_empty() { "outcubic" } else { easing })
        .current_dir(&dir);
    let code = stream_child(app, cmd, &run_id, label).await?;
    if code != 0 {
        return Err(format!("frame-capture feilet (exit {code})"));
    }
    Ok((work, safe))
}

/// Bygg en exit-fade-filterstreng (fade ut de siste `exit_sec` sekundene).
/// `alpha` = true for formater med alfa (fader gjennomsiktig), false for mp4
/// (fader til svart). Returnerer None hvis ingen fade er ønsket.
fn ig_fade_vf(exit_sec: f64, duration_sec: f64, alpha: bool) -> Option<String> {
    if exit_sec <= 0.0 { return None; }
    let d = exit_sec.min(duration_sec).max(0.05);
    let st = (duration_sec - d).max(0.0);
    Some(if alpha {
        format!("fade=t=out:st={st:.3}:d={d:.3}:alpha=1")
    } else {
        format!("fade=t=out:st={st:.3}:d={d:.3}")
    })
}

/// Sekunder inngangs-fade tar (speiler ENTRANCE_DUR i frontenden).
const IG_ENTRANCE_DUR: f64 = 0.5;

/// Fade-INN de første sekundene når scenen har en inngang (ikke 'none').
fn ig_fade_in_vf(entrance: &str, alpha: bool) -> Option<String> {
    if entrance.is_empty() || entrance == "none" { return None; }
    let d = IG_ENTRANCE_DUR;
    Some(if alpha { format!("fade=t=in:st=0:d={d:.3}:alpha=1") } else { format!("fade=t=in:st=0:d={d:.3}") })
}

/// Kombiner fade-inn + fade-ut til én -vf-streng (komma-separert).
fn ig_combine_vf(fin: Option<String>, fout: Option<String>) -> Option<String> {
    match (fin, fout) {
        (Some(a), Some(b)) => Some(format!("{a},{b}")),
        (Some(a), None) => Some(a),
        (None, b) => b,
    }
}

/// Deterministisk innholds-hash for render-caching (ikke krypto — kun cache-
/// nøkkel). Samme HTML + parametre → samme .mov, så uendrede scener slipper
/// å re-rendres ved gjentatt «Send to Resolve».
#[allow(clippy::too_many_arguments)]
fn ig_cache_key(html: &str, fps: f64, scale: f64, exit_sec: f64, duration_sec: f64, frame: &str, easing: &str, entrance: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    html.hash(&mut h);
    // f64 er ikke Hash — bruk bit-representasjonen.
    fps.to_bits().hash(&mut h);
    scale.to_bits().hash(&mut h);
    exit_sec.to_bits().hash(&mut h);
    duration_sec.to_bits().hash(&mut h);
    frame.hash(&mut h);
    easing.hash(&mut h);
    entrance.hash(&mut h);
    format!("{:016x}", h.finish())
}

fn ig_out_dir(app: &AppHandle) -> std::path::PathBuf {
    let d = app
        .path()
        .home_dir()
        .map(|h| h.join("Movies").join("Post Agent Infographics"))
        .unwrap_or_else(|_| std::env::temp_dir());
    let _ = std::fs::create_dir_all(&d);
    d
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn render_infographic(
    app: AppHandle,
    html: String,
    duration_sec: f64,
    name: String,
    fps: Option<f64>,
    scale: Option<f64>,
    exit_sec: Option<f64>,
    frame: Option<String>,
    easing: Option<String>,
    entrance: Option<String>,
) -> Result<String, String> {
    let fps = fps.unwrap_or(30.0).clamp(12.0, 60.0);
    let scale = scale.unwrap_or(2.0);
    let exit = exit_sec.unwrap_or(0.0);
    let frame = frame.unwrap_or_else(|| "native".into());
    let easing = easing.unwrap_or_else(|| "outcubic".into());
    let entrance = entrance.unwrap_or_else(|| "none".into());

    // Render-caching: identisk innhold+parametre → gjenbruk ferdig .mov.
    let cache_dir = ig_out_dir(&app).join(".cache");
    let _ = std::fs::create_dir_all(&cache_dir);
    let cached = cache_dir.join(format!("{}.mov", ig_cache_key(&html, fps, scale, exit, duration_sec, &frame, &easing, &entrance)));
    if cached.exists() {
        return Ok(cached.to_string_lossy().to_string());
    }

    let frames = ((duration_sec.max(1.0)) * fps).round().clamp(8.0, 3600.0) as i64;
    // Reell klipp-lengde etter clamp — fade-timing MÅ bruke denne, ikke det
    // ukappede duration_sec (ellers havner fade-ut feil for korte/lange klipp).
    let real_dur = frames as f64 / fps;
    let (work, _safe) = ig_capture_frames(&app, &html, &name, frames, scale, &frame, &easing, "render_infographic").await?;

    // ProRes 4444 m/alfa → cache-mappe (gjenbrukbar). Skriv FØRST til en .part-fil
    // og gi den cache-navnet kun ved suksess — en avbrutt/feilet ffmpeg skal ALDRI
    // legge igjen en korrupt .mov på cache-stien som senere gjenbrukes som gyldig.
    let ffmpeg = find_bin("ffmpeg");
    let out_file = cached;
    let tmp_file = out_file.with_extension("part.mov");
    let mut args: Vec<String> = vec!["-y".into(), "-framerate".into(), format!("{fps}"),
        "-i".into(), format!("{}/f%03d.png", work.to_string_lossy())];
    if let Some(vf) = ig_combine_vf(ig_fade_in_vf(&entrance, true), ig_fade_vf(exit_sec.unwrap_or(0.0), real_dur, true)) { args.push("-vf".into()); args.push(vf); }
    args.extend(["-c:v".into(), "prores_ks".into(), "-profile:v".into(), "4444".into(),
        "-pix_fmt".into(), "yuva444p10le".into(), tmp_file.to_string_lossy().to_string()]);
    let status = Command::new(&ffmpeg).args(&args).status().await
        .map_err(|e| format!("ffmpeg-start feilet: {e}"))?;
    if !status.success() {
        let _ = std::fs::remove_file(&tmp_file);
        return Err("ffmpeg klarte ikke å lage ProRes-fil".into());
    }
    std::fs::rename(&tmp_file, &out_file).map_err(|e| { let _ = std::fs::remove_file(&tmp_file); format!("kunne ikke ferdigstille cache-fil: {e}") })?;
    Ok(out_file.to_string_lossy().to_string())
}

/// Eksporter én infographic til en frittstående fil (utenfor Resolve):
/// format = "prores" (.mov, alfa) | "mp4" (flat på svart) | "gif" (transparent)
/// | "apng" (animert PNG, alfa) | "png" (stillbilde ved full progresjon, alfa).
/// Verifiserte ffmpeg-oppskrifter. Returnerer utfil-sti.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn export_infographic(
    app: AppHandle,
    html: String,
    duration_sec: f64,
    name: String,
    format: String,
    fps: Option<f64>,
    scale: Option<f64>,
    exit_sec: Option<f64>,
    frame: Option<String>,
    easing: Option<String>,
    entrance: Option<String>,
    metadata: Option<String>,
) -> Result<String, String> {
    let fps = fps.unwrap_or(30.0).clamp(12.0, 60.0);
    let scale = scale.unwrap_or(2.0);
    let frame = frame.unwrap_or_else(|| "native".into());
    let easing = easing.unwrap_or_else(|| "outcubic".into());
    let entrance = entrance.unwrap_or_else(|| "none".into());
    let metadata = metadata.unwrap_or_default();
    let is_still = format == "png";
    let frames = if is_still { 1 } else { ((duration_sec.max(1.0)) * fps).round().clamp(8.0, 3600.0) as i64 };
    // Reell klipp-lengde etter clamp — fade-timing bruker denne (ikke duration_sec).
    let real_dur = frames as f64 / fps;
    let (work, safe) = ig_capture_frames(&app, &html, &name, frames, scale, &frame, &easing, "export_infographic").await?;
    let ffmpeg = find_bin("ffmpeg");
    let out_dir = ig_out_dir(&app);
    let frames_glob = format!("{}/f%03d.png", work.to_string_lossy());
    let fr = format!("{fps}");
    let ex = exit_sec.unwrap_or(0.0);
    // Inngangs-fade-inn + exit-fade-ut, kombinert. Alfa for alfa-formater, svart for mp4.
    let fade_alpha = ig_combine_vf(ig_fade_in_vf(&entrance, true), ig_fade_vf(ex, real_dur, true));
    let fade_black = ig_combine_vf(ig_fade_in_vf(&entrance, false), ig_fade_vf(ex, real_dur, false));

    let (out_file, args): (std::path::PathBuf, Vec<String>) = match format.as_str() {
        "png" => {
            // Stillbilde ved full progresjon (frame 000, N=1) — bare kopier.
            let out = out_dir.join(format!("{safe}.png"));
            std::fs::copy(work.join("f000.png"), &out).map_err(|e| format!("kunne ikke lagre PNG: {e}"))?;
            return Ok(out.to_string_lossy().to_string());
        }
        "mp4" => {
            let out = out_dir.join(format!("{safe}.mp4"));
            let vf = match &fade_black { Some(f) => format!("{f},format=yuv420p"), None => "format=yuv420p".into() };
            (out.clone(), vec!["-y".into(), "-framerate".into(), fr.clone(), "-i".into(), frames_glob.clone(),
                "-vf".into(), vf, "-c:v".into(), "libx264".into(), "-crf".into(), "18".into(),
                "-movflags".into(), "+faststart".into(), out.to_string_lossy().to_string()])
        }
        "gif" => {
            let out = out_dir.join(format!("{safe}.gif"));
            let pre = match &fade_alpha { Some(f) => format!("{f},"), None => "".into() };
            (out.clone(), vec!["-y".into(), "-framerate".into(), fr.clone(), "-i".into(), frames_glob.clone(),
                "-vf".into(), format!("{pre}split[s0][s1];[s0]palettegen=reserve_transparent=1[p];[s1][p]paletteuse=alpha_threshold=128"),
                out.to_string_lossy().to_string()])
        }
        "apng" => {
            let out = out_dir.join(format!("{safe}.apng.png"));
            let mut a = vec!["-y".into(), "-framerate".into(), fr.clone(), "-i".into(), frames_glob.clone()];
            if let Some(f) = &fade_alpha { a.push("-vf".into()); a.push(f.clone()); }
            a.extend(["-f".into(), "apng".into(), "-plays".into(), "0".into(), out.to_string_lossy().to_string()]);
            (out.clone(), a)
        }
        _ => {
            // prores (default) — .mov m/alfa
            let out = out_dir.join(format!("{safe}.mov"));
            let mut a = vec!["-y".into(), "-framerate".into(), fr.clone(), "-i".into(), frames_glob.clone()];
            if let Some(f) = &fade_alpha { a.push("-vf".into()); a.push(f.clone()); }
            a.extend(["-c:v".into(), "prores_ks".into(), "-profile:v".into(), "4444".into(), "-pix_fmt".into(), "yuva444p10le".into(),
                out.to_string_lossy().to_string()]);
            (out.clone(), a)
        }
    };
    // «Include Metadata»: bygg tittel + verktøy inn i container-en (ffmpeg
    // -metadata). Settes inn foran utfil-stien (siste arg). Gjelder mp4/mov/gif/
    // apng — png (stillbilde) returnerte allerede tidligere.
    let mut args = args;
    if !metadata.is_empty() {
        if let Some(out) = args.pop() {
            args.push("-metadata".into()); args.push(format!("title={metadata}"));
            args.push("-metadata".into()); args.push("comment=Laget med Post Agent Infographic Studio".into());
            args.push(out);
        }
    }
    let status = Command::new(&ffmpeg).args(&args).status().await
        .map_err(|e| format!("ffmpeg-start feilet: {e}"))?;
    if !status.success() {
        return Err(format!("ffmpeg klarte ikke å lage {format}-fil"));
    }
    Ok(out_file.to_string_lossy().to_string())
}
