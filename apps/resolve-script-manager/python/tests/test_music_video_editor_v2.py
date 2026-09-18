from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

PYTHON_ROOT = Path(__file__).resolve().parents[1]
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from scripts.color import apply_music_video_look
from scripts.timeline import assign_clips_to_beats, place_clips_on_beat_grid, rollback_music_video_build


class FakeGraph:
    def __init__(self, nodes=1, lut="") -> None:
        self.nodes = nodes
        self.lut = lut
        self.set_calls = []

    def GetNumNodes(self):
        return self.nodes

    def GetLUT(self, _index):
        return self.lut

    def SetLUT(self, index, path):
        self.set_calls.append((index, path))
        return True


class FakeTimelineItem:
    def __init__(self, name, *, graph=None, start=0, end=50) -> None:
        self.name = name
        self.graph = graph
        self.start = start
        self.end = end
        self.speed_calls = []
        self.transition_calls = []

    def GetName(self):
        return self.name

    def GetNodeGraph(self):
        return self.graph

    def GetStart(self):
        return self.start

    def GetEnd(self):
        return self.end

    def SetSpeed(self, options):
        self.speed_calls.append(options)
        return True

    def AddTransition(self, options):
        self.transition_calls.append(options)
        return object()


class FakeTimeline:
    def __init__(self, name, unique_id, items=None) -> None:
        self.name = name
        self.unique_id = unique_id
        self.items = items or []
        self.settings_calls = []

    def GetName(self):
        return self.name

    def GetUniqueId(self):
        return self.unique_id

    def GetTrackCount(self, track_type):
        return 1 if track_type in ("video", "audio") else 0

    def GetItemListInTrack(self, track_type, _index):
        return self.items if track_type == "video" else []

    def GetSetting(self, key):
        return {"timelineFrameRate": "25", "timelineDropFrameTimecode": "0"}.get(key, "")

    def SetSettings(self, settings):
        self.settings_calls.append(settings)
        return True

    def GetStartFrame(self):
        return 90000

    def GetStartTimecode(self):
        return "01:00:00:00"


class FakeMediaItem:
    def __init__(self, name, path, frames=500) -> None:
        self.name = name
        self.path = path
        self.frames = frames

    def GetName(self):
        return self.name

    def GetClipProperty(self, key=None):
        props = {"File Path": self.path, "Frames": str(self.frames)}
        return props.get(key, "") if key else props


class FakeFolder:
    def __init__(self, items=None) -> None:
        self.items = items or []

    def GetClipList(self):
        return self.items

    def GetSubFolderList(self):
        return []


class FakeProject:
    def __init__(self, timelines, project_id="project-1") -> None:
        self.timelines = timelines
        self.project_id = project_id
        self.current = timelines[0] if timelines else None

    def GetUniqueId(self):
        return self.project_id

    def GetName(self):
        return "Music Project"

    def GetTimelineCount(self):
        return len(self.timelines)

    def GetTimelineByIndex(self, index):
        return self.timelines[index - 1]

    def GetCurrentTimeline(self):
        return self.current

    def SetCurrentTimeline(self, timeline):
        self.current = timeline
        return True

    def GetSetting(self, key):
        return "25" if key == "timelineFrameRate" else ""


class FakeMediaPool:
    def __init__(self, project, root=None) -> None:
        self.project = project
        self.root = root or FakeFolder()
        self.deleted = []
        self.created = []

    def GetRootFolder(self):
        return self.root

    def CreateEmptyTimeline(self, name):
        timeline = FakeTimeline(name, f"timeline-{len(self.project.timelines) + 1}")
        self.project.timelines.append(timeline)
        self.created.append(timeline)
        return timeline

    def AppendToTimeline(self, specs):
        items = [FakeTimelineItem(spec["mediaPoolItem"].GetName(), start=spec.get("recordFrame", 0), end=spec.get("recordFrame", 0) + 50) for spec in specs]
        if self.project.current:
            self.project.current.items.extend(items)
        return items

    def ImportMedia(self, _specs):
        return []

    def DeleteTimelines(self, timelines):
        self.deleted.extend(timelines)
        self.project.timelines = [timeline for timeline in self.project.timelines if timeline not in timelines]
        return True


class FakeConnection:
    def __init__(self, project, media_pool) -> None:
        self.project = project
        self.media_pool = media_pool

    def connect(self):
        return True

    def require_project(self):
        return True


class MusicVideoPlacementTests(unittest.TestCase):
    def test_dry_run_exposes_social_music_trim(self):
        results = []
        with patch.object(place_clips_on_beat_grid.bridge, "result", side_effect=results.append):
            place_clips_on_beat_grid.run({
                "segments": [{"clipPath": "/take.mov", "durationSec": 1}],
                "musicPath": "/song.wav",
                "musicSourceStartSec": 48.5,
                "musicDurationSec": 30,
            }, dry_run=True)

        self.assertEqual(results[-1]["musicSourceStartSec"], 48.5)
        self.assertEqual(results[-1]["musicDurationSec"], 30)

    def test_section_pacing_normalizes_labels_and_accelerates_chorus(self):
        beats = [index * 0.5 for index in range(17)]
        segments = assign_clips_to_beats._build_segments_with_sections(
            beats,
            [0, 2, 4, 6, 8],
            True,
            [
                {"startSec": 0, "endSec": 4, "label": "Intro"},
                {"startSec": 4, "endSec": 8.5, "label": "Pre-Chorus"},
            ],
        )

        self.assertEqual(segments[0], (0, 4.0, "intro"))
        self.assertEqual(segments[1], (4.0, 5.0, "pre_chorus"))

    def test_preferred_source_offset_is_frame_accurate_and_clamped(self):
        item = FakeMediaItem("take.mov", "/take.mov", frames=100)
        self.assertEqual(
            place_clips_on_beat_grid._seconds_to_clip_frames(
                item, 2, 25, preferred_start_sec=1,
            ),
            (25, 74),
        )
        self.assertEqual(
            place_clips_on_beat_grid._seconds_to_clip_frames(
                item, 2, 25, preferred_start_sec=4,
            ),
            (50, 99),
        )

    def test_native_speed_transition_vertical_settings_and_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            clip_path = Path(directory) / "take.mov"
            clip_path.write_bytes(b"fixture")
            media_item = FakeMediaItem("take.mov", str(clip_path))
            project = FakeProject([])
            media_pool = FakeMediaPool(project, FakeFolder([media_item]))
            connection = FakeConnection(project, media_pool)
            results = []
            segments = [
                {
                    "segmentIndex": 0, "startSec": 0, "endSec": 2, "durationSec": 2,
                    "clipPath": str(clip_path), "sourceStartSec": 1, "speedPct": 125,
                },
                {
                    "segmentIndex": 1, "startSec": 2, "endSec": 4, "durationSec": 2,
                    "clipPath": str(clip_path), "transition": "cross_dissolve", "speedPct": 100,
                },
            ]
            with (
                patch.object(place_clips_on_beat_grid, "APP_DATA_DIR", directory),
                patch.object(place_clips_on_beat_grid, "_probe_audio_track_count", return_value=1),
                patch.object(place_clips_on_beat_grid.bridge, "ResolveConnection", return_value=connection),
                patch.object(place_clips_on_beat_grid.bridge, "result", side_effect=results.append),
                patch.object(place_clips_on_beat_grid.bridge, "log"),
                patch.object(place_clips_on_beat_grid.bridge, "warn"),
                patch.object(place_clips_on_beat_grid.bridge, "error"),
                patch.object(place_clips_on_beat_grid.bridge, "progress"),
            ):
                place_clips_on_beat_grid.run({
                    "segments": segments,
                    "timelineName": "MV v2 — Social",
                    "projectId": "project-1",
                    "operationId": "operation-1",
                    "variantId": "social",
                    "aspect": "9:16",
                }, dry_run=False)

            result = results[-1]
            timeline = media_pool.created[0]
            self.assertEqual(result["timelineUniqueId"], "timeline-1")
            self.assertEqual(result["speedChangesApplied"], 1)
            self.assertEqual(result["transitionsAdded"], 1)
            self.assertEqual(timeline.settings_calls[0]["timelineResolutionHeight"], "1920")
            self.assertEqual(timeline.items[0].speed_calls[0]["Percentage"], 125.0)
            self.assertEqual(timeline.items[1].transition_calls[0]["type"], "Cross Dissolve")
            manifest = json.loads((Path(directory) / "last_music_video_build.json").read_text())
            self.assertEqual(manifest["operationId"], "operation-1")
            self.assertEqual(manifest["timelines"][0]["uniqueId"], "timeline-1")


class MusicVideoLookTests(unittest.TestCase):
    def test_look_refuses_write_without_exact_ids(self):
        errors = []
        with (
            patch.object(apply_music_video_look, "_find_lut", return_value="/safe/look.cube"),
            patch.object(apply_music_video_look.bridge, "ResolveConnection") as connection,
            patch.object(apply_music_video_look.bridge, "error", side_effect=errors.append),
        ):
            apply_music_video_look.run({"lookPack": "cinematic-film"}, dry_run=False)

        connection.assert_not_called()
        self.assertIn("eksakt prosjekt-ID", errors[-1])

    def test_look_applies_only_to_unmodified_single_node_items(self):
        clean = FakeGraph(1, "")
        existing = FakeGraph(2, "")
        timeline = FakeTimeline("Narrative", "timeline-n", [
            FakeTimelineItem("clean", graph=clean),
            FakeTimelineItem("existing", graph=existing),
        ])
        project = FakeProject([timeline])
        connection = FakeConnection(project, FakeMediaPool(project))
        results = []
        with (
            patch.object(apply_music_video_look, "_find_lut", return_value="/safe/look.cube"),
            patch.object(apply_music_video_look.bridge, "ResolveConnection", return_value=connection),
            patch.object(apply_music_video_look.bridge, "result", side_effect=results.append),
            patch.object(apply_music_video_look.bridge, "error"),
        ):
            apply_music_video_look.run({
                "lookPack": "cinematic-film",
                "timelineUniqueId": "timeline-n",
                "timelineName": "Narrative",
                "projectId": "project-1",
                "respectExistingWork": True,
            }, dry_run=False)

        self.assertEqual(clean.set_calls, [(1, "/safe/look.cube")])
        self.assertEqual(existing.set_calls, [])
        self.assertEqual(results[-1]["clipsProcessed"], 1)
        self.assertEqual(results[-1]["skippedExisting"], 1)


class MusicVideoRollbackTests(unittest.TestCase):
    def _manifest(self, path: Path):
        path.write_text(json.dumps({
            "operationId": "operation-1",
            "projectId": "project-1",
            "timelines": [{"uniqueId": "timeline-new", "name": "MV New"}],
        }))

    def test_rollback_deletes_only_exact_manifest_timeline(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest_path = Path(directory) / "manifest.json"
            self._manifest(manifest_path)
            old = FakeTimeline("Existing Master", "timeline-old")
            new = FakeTimeline("MV New", "timeline-new")
            project = FakeProject([old, new])
            project.current = new
            media_pool = FakeMediaPool(project)
            connection = FakeConnection(project, media_pool)
            results = []
            with (
                patch.object(rollback_music_video_build, "MANIFEST_PATH", str(manifest_path)),
                patch.object(rollback_music_video_build.bridge, "ResolveConnection", return_value=connection),
                patch.object(rollback_music_video_build.bridge, "result", side_effect=results.append),
                patch.object(rollback_music_video_build.bridge, "error"),
                patch.object(rollback_music_video_build.bridge, "warn"),
            ):
                rollback_music_video_build.run({
                    "operationId": "operation-1",
                    "projectId": "project-1",
                    "timelines": [{"uniqueId": "timeline-new", "name": "MV New"}],
                }, dry_run=False)

            self.assertEqual(media_pool.deleted, [new])
            self.assertIs(project.current, old)
            self.assertEqual(results[-1]["deletedCount"], 1)

    def test_rollback_rejects_timeline_not_in_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest_path = Path(directory) / "manifest.json"
            self._manifest(manifest_path)
            old = FakeTimeline("Existing Master", "timeline-old")
            project = FakeProject([old])
            media_pool = FakeMediaPool(project)
            errors = []
            with (
                patch.object(rollback_music_video_build, "MANIFEST_PATH", str(manifest_path)),
                patch.object(rollback_music_video_build.bridge, "ResolveConnection") as connection,
                patch.object(rollback_music_video_build.bridge, "error", side_effect=errors.append),
            ):
                rollback_music_video_build.run({
                    "operationId": "operation-1",
                    "projectId": "project-1",
                    "timelines": [{"uniqueId": "timeline-old", "name": "Existing Master"}],
                }, dry_run=False)

            connection.assert_not_called()
            self.assertIn("samsvarer ikke", errors[-1])
            self.assertEqual(media_pool.deleted, [])

    def test_registry_exposes_v2_actions_with_expected_risk(self):
        registry = json.loads((PYTHON_ROOT / "registry.json").read_text())
        entries = {entry["id"]: entry for entry in registry["scripts"]}
        self.assertEqual(entries["apply_music_video_look"]["riskLevel"], "medium")
        self.assertEqual(entries["rollback_music_video_build"]["riskLevel"], "high")


if __name__ == "__main__":
    unittest.main()
