"""Generate Voiceover with Resolve AI — Studio AI Speech Generator
(timeline.GenerateSpeech) genererer voiceover-audio fra scene-manus og legger
den på timelinen som audio-MediaPoolItem.

Product Demo Studio sender scenenes narration; vi kaller Resolve 21s
GenerateSpeech per scene → audio på valgt audio-track. Etterpå kan
generate_music_ducking_plan (dukk musikk under VO) + transcribe_with_resolve_ai
(auto-undertekster fra VO) brukes for en ferdig miks.

API (Resolve Scripting README):
  timeline.GenerateSpeech({speechGenerationSettings}, timecode) --> MediaPoolItem
  settings: TextInput, VoiceModel ("Female 1"/"Male 1"/"Custom Voice"),
            CustomVoiceFile, Speed, Variation, Pitch, GenerationID, Filename,
            AddToTimeline (bool), AudioTrack (int)
  Krever Resolve Studio + AI Speech Generator.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge  # noqa: E402


def _texts_from_params(params: dict) -> list:
    scenes = params.get("scenes") or []
    out = []
    for s in scenes:
        if isinstance(s, str):
            t = s.strip()
        elif isinstance(s, dict):
            t = (s.get("narration") or s.get("text") or "").strip()
        else:
            t = ""
        if t:
            out.append(t)
    # Enkel-tekst-fallback
    single = (params.get("text") or "").strip()
    if not out and single:
        out.append(single)
    return out


def run(params: dict, dry_run: bool) -> None:
    texts = _texts_from_params(params)
    voice_model = (params.get("voiceModel") or "Female 1").strip()
    custom_voice = (params.get("customVoiceFile") or "").strip()
    audio_track = int(params.get("audioTrack") or 1)
    speed = int(params.get("speed") or 0)
    pitch = int(params.get("pitch") or 0)
    variation = int(params.get("variation") or 0)
    is_studio = bool(params.get("isStudio", False))

    if not texts:
        bridge.error("Ingen manus å generere voiceover fra (params.scenes/narration tom)")
        sys.exit(1)

    if not is_studio:
        bridge.warn("AI Speech Generator krever Resolve Studio — hopper over")
        bridge.result({
            "skipped": "free_resolve",
            "wouldGenerate": len(texts),
            "voiceModel": voice_model,
            "note": "timeline.GenerateSpeech krever Resolve Studio + AI Speech Generator.",
        })
        return

    if dry_run:
        bridge.result({"dryRun": True, "scenes": len(texts), "voiceModel": voice_model, "audioTrack": audio_track})
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    project = conn.project
    timeline = project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen aktiv timeline — åpne/lag en timeline i Resolve først")
        sys.exit(1)

    try:
        if hasattr(conn.resolve, "OpenPage"):
            conn.resolve.OpenPage("fairlight")
    except Exception:
        pass

    # GenerateSpeech ligger på PROJECT i Resolve 21.0.0.47 (ikke Timeline, tross
    # README). Resolve-proxyer returnerer None for ukjente metoder → sjekk `is None`,
    # ikke hasattr. Fall tilbake til timeline hvis en framtidig build flytter den dit.
    gen = getattr(project, "GenerateSpeech", None)
    gen_owner = "project"
    if gen is None:
        gen = getattr(timeline, "GenerateSpeech", None)
        gen_owner = "timeline"
    if gen is None:
        bridge.error("GenerateSpeech ikke tilgjengelig — krever Resolve 21 Studio med AI Speech Generator-modell installert")
        sys.exit(1)
    bridge.log(f"Bruker {gen_owner}.GenerateSpeech")

    timecode = (params.get("timecode") or "").strip()
    generated = 0
    failed = 0
    for i, text in enumerate(texts):
        settings = {
            "TextInput": text,
            "VoiceModel": "Custom Voice" if custom_voice else voice_model,
            "Speed": speed,
            "Variation": variation,
            "Pitch": pitch,
            "AddToTimeline": True,
            "AudioTrack": audio_track,
            "Filename": f"vo_scene_{i + 1}",
        }
        if custom_voice:
            settings["CustomVoiceFile"] = custom_voice
        try:
            item = gen(settings, timecode) if timecode else gen(settings)
            if item:
                generated += 1
                bridge.log(f"Voiceover scene {i + 1}/{len(texts)} generert")
            else:
                failed += 1
                bridge.warn(f"GenerateSpeech scene {i + 1} returnerte ingen item")
        except Exception as exc:
            failed += 1
            bridge.warn(f"GenerateSpeech scene {i + 1} feilet: {exc}")
        bridge.progress(i + 1, len(texts), f"Voiceover {i + 1}/{len(texts)}")

    bridge.result({
        "generated": generated,
        "failed": failed,
        "total": len(texts),
        "voiceModel": settings.get("VoiceModel"),
        "audioTrack": audio_track,
        "note": "Bruk generate_music_ducking_plan + transcribe_with_resolve_ai for miks + undertekster.",
    })


bridge.main_guard(run)
