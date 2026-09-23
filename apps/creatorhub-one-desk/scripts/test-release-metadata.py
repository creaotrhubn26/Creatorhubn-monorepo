#!/usr/bin/env python3

import importlib.util
import json
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("release-metadata.py")
SPEC = importlib.util.spec_from_file_location("release_metadata", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ReleaseMetadataTests(unittest.TestCase):
    def test_current_release_is_valid_and_renders_all_sections(self):
        release = MODULE.load_release("0.1.12")
        markdown = MODULE.render_markdown(release)
        self.assertIn("# Oppdateringer du kan stole på", markdown)
        self.assertIn("## Nytt", markdown)
        self.assertIn("## Forbedret", markdown)
        self.assertIn("## Rettet", markdown)

    def test_manifest_notes_are_machine_readable_release_json(self):
        release = MODULE.load_release("0.1.12")
        encoded = json.dumps(release, ensure_ascii=False, separators=(",", ":"))
        decoded = json.loads(encoded)
        self.assertEqual(decoded["version"], "0.1.12")
        self.assertIs(decoded["critical"], False)

    def test_unknown_version_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "nøyaktig én release"):
            MODULE.load_release("99.99.99")


if __name__ == "__main__":
    unittest.main()
