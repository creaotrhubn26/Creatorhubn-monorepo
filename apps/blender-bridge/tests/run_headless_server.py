# run_headless_server.py — kjør HTTP-broen i headless Blender (E2E-test/CI):
#   blender --background --python apps/blender-bridge/tests/run_headless_server.py
#
# I --background finnes ingen event-loop for bpy.app.timers, så vi drenerer
# kommando-køen manuelt fra script-tråden (som ER main thread her).

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from extension import server  # noqa: E402


server.start()
print(f"BRIDGE READY http://{server.HOST}:{server.PORT}", flush=True)
try:
    while True:
        server._drain_commands()
        time.sleep(0.05)
except KeyboardInterrupt:
    server.stop()
