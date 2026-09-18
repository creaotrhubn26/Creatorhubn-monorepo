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

import bridge
from scripts.audio import setup_fairlight_audio
from scripts.timeline import create_native_multicam


class FakeItem:
    def __init__(self, name: str, file_path: str = "", unique_id: str = "item-1") -> None:
        self.name = name
        self.file_path = file_path
        self.unique_id = unique_id
        self.smart_switch_settings = None

    def GetName(self):
        return self.name

    def GetUniqueId(self):
        return self.unique_id

    def GetClipProperty(self, key=None):
        props = {"File Path": self.file_path}
        return props.get(key, "") if key else props

    def PerformMulticamSmartSwitch(self, settings):
        self.smart_switch_settings = settings
        return True


class FakeFolder:
    def __init__(self, clips=None, children=None) -> None:
        self.clips = clips or []
        self.children = children or []

    def GetClipList(self):
        return self.clips

    def GetSubFolderList(self):
        return self.children


class FakeTimeline:
    def __init__(self) -> None:
        self.duplicates = []

    def GetName(self):
        return "Wedding Master"

    def DuplicateTimeline(self, name):
        self.duplicates.append(name)
        return object()

    def AutoAlignClips(self, _items, _options=None):
        return True

    def NormalizeAudioLevel(self, _items, _options=None):
        return True


class FakeProject:
    def __init__(self, timeline) -> None:
        self.timeline = timeline
        self.restored = False

    def GetCurrentTimeline(self):
        return self.timeline

    def SetCurrentTimeline(self, timeline):
        self.restored = timeline is self.timeline
        return self.restored

    def GetProjectSettingsPresetList(self):
        return []

    def UpdateRenderPreset(self, _name):
        return True


class FakeMediaStorage:
    def StartCloneMedia(self, _source, _targets):
        return True


class FakeResolve:
    def GetVersionString(self):
        return "21.1.0"

    def GetMediaStorage(self):
        return FakeMediaStorage()

    def ValidateDCTL(self, _source):
        return None

    def GetKeyboardPresetList(self):
        return []

    def __getattr__(self, name):
        if name.startswith(("MULTICAM_", "SMART_SWITCH_")):
            return name
        raise AttributeError(name)


class FakeMediaPool:
    def __init__(self, root) -> None:
        self.root = root
        self.import_calls = []
        self.create_calls = []
        self.append_calls = []
        self.appended_item = FakeItem("Timeline multicam", unique_id="timeline-item")

    def GetRootFolder(self):
        return self.root

    def ImportMedia(self, clip_infos):
        self.import_calls.append(clip_infos)
        return [
            FakeItem(Path(info["FilePath"]).name, info["FilePath"], f"import-{index}")
            for index, info in enumerate(clip_infos)
        ]

    def CreateMulticamClip(self, items, options):
        self.create_calls.append((items, options))
        return [FakeItem(options["name"], unique_id="multicam-1")]

    def AppendToTimeline(self, clip_infos):
        self.append_calls.append(clip_infos)
        return [self.appended_item]


class FakeConnection:
    def __init__(self, media_pool) -> None:
        self.resolve = FakeResolve()
        self.project = FakeProject(FakeTimeline())
        self.media_pool = media_pool

    def connect(self):
        return True

    def require_project(self):
        return True


class ResolveCapabilityTests(unittest.TestCase):
    def test_version_and_runtime_capabilities(self):
        connection = FakeConnection(FakeMediaPool(FakeFolder()))
        capabilities = bridge.inspect_resolve_capabilities(connection)

        self.assertEqual(capabilities["resolveVersion"], "21.1.0")
        self.assertEqual(capabilities["versionParts"], [21, 1, 0])
        self.assertTrue(capabilities["supportsResolve21_1"])
        self.assertTrue(capabilities["features"]["nativeMulticam"])
        self.assertTrue(capabilities["features"]["audioNormalization"])
        self.assertTrue(capabilities["features"]["mediaClone"])

    def test_version_parser_handles_vendor_text(self):
        class TextVersionResolve:
            def GetVersionString(self):
                return "DaVinci Resolve Studio 21.1.2 build 7"

        self.assertEqual(bridge.resolve_version_tuple(TextVersionResolve()), (21, 1, 2))


class ResolveAudioPropertyTests(unittest.TestCase):
    def test_linear_direction_values_convert_to_resolve_db(self):
        self.assertEqual(setup_fairlight_audio._linear_to_db(1.0), 0.0)
        self.assertAlmostEqual(setup_fairlight_audio._linear_to_db(0.5), -6.0206, places=3)
        self.assertEqual(setup_fairlight_audio._linear_to_db(0.0), -100.0)


class NativeMulticamTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        root = Path(self.temp_dir.name)
        self.paths = [root / "cam-a.mov", root / "cam-b.mov"]
        for path in self.paths:
            path.write_bytes(b"fixture")

    def _run(self, media_pool, *, dry_run, **overrides):
        connection = FakeConnection(media_pool)
        results = []
        params = {
            "clipPaths": [str(path) for path in self.paths],
            "name": "Ceremony",
            "syncMode": "audio",
            "splitAtGaps": True,
            "appendToTimeline": True,
            "backupTimeline": True,
            "smartSwitch": True,
            **overrides,
        }
        with (
            patch.object(create_native_multicam.bridge, "ResolveConnection", return_value=connection),
            patch.object(create_native_multicam.bridge, "result", side_effect=results.append),
            patch.object(create_native_multicam.bridge, "log"),
            patch.object(create_native_multicam.bridge, "progress"),
            patch.object(create_native_multicam.bridge, "error"),
        ):
            create_native_multicam.run(params, dry_run=dry_run)
        return connection, results[-1]

    def test_dry_run_is_read_only_and_uses_21_1_options(self):
        media_pool = FakeMediaPool(FakeFolder())
        _connection, result = self._run(media_pool, dry_run=True)

        self.assertEqual(result["wouldCreate"], "Ceremony")
        self.assertEqual(len(result["wouldImport"]), 2)
        self.assertEqual(result["options"]["angleSyncMode"], "MULTICAM_ANGLE_SYNC_AUDIO")
        self.assertTrue(result["options"]["splitAtGaps"])
        self.assertEqual(media_pool.import_calls, [])
        self.assertEqual(media_pool.create_calls, [])
        self.assertEqual(media_pool.append_calls, [])

    def test_create_imports_missing_with_dict_signature_and_backs_up(self):
        existing = FakeItem("cam-a.mov", str(self.paths[0]), "source-a")
        media_pool = FakeMediaPool(FakeFolder([existing]))
        connection, result = self._run(media_pool, dry_run=False)

        expected_import_path = create_native_multicam._normalise_path(str(self.paths[1]))
        self.assertEqual(media_pool.import_calls, [[{"FilePath": expected_import_path}]])
        self.assertEqual(len(media_pool.create_calls[0][0]), 2)
        self.assertEqual(media_pool.create_calls[0][1]["name"], "Ceremony")
        self.assertEqual(len(connection.project.timeline.duplicates), 1)
        self.assertTrue(connection.project.restored)
        self.assertTrue(result["appendedToTimeline"])
        self.assertTrue(result["smartSwitchApplied"])
        self.assertEqual(result["created"]["uniqueId"], "multicam-1")

    def test_existing_name_gets_non_destructive_suffix(self):
        media_pool = FakeMediaPool(FakeFolder([
            FakeItem("Ceremony", str(self.paths[0]), "source-a"),
            FakeItem("Ceremony (2)", str(self.paths[1]), "source-b"),
        ]))
        _connection, result = self._run(
            media_pool,
            dry_run=True,
            appendToTimeline=False,
            smartSwitch=False,
        )

        self.assertEqual(result["wouldCreate"], "Ceremony (3)")
        self.assertEqual(result["wouldImport"], [])

    def test_registry_keeps_native_multicam_allowlisted(self):
        registry = json.loads((PYTHON_ROOT / "registry.json").read_text())
        entry = next(script for script in registry["scripts"] if script["id"] == "create_native_multicam")

        self.assertEqual(entry["scriptPath"], "scripts/timeline/create_native_multicam.py")
        self.assertEqual(entry["riskLevel"], "medium")
        self.assertTrue(entry["dryRunSupported"])


if __name__ == "__main__":
    unittest.main()
