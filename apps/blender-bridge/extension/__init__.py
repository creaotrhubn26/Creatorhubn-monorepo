# Claude Bridge — Blender Extension.
# Starter HTTP-broen (localhost:7717) og viser status i et lite N-panel.

import bpy

from . import server


class CLAUDEBRIDGE_PT_panel(bpy.types.Panel):
    bl_label = "Claude Bridge"
    bl_idname = "CLAUDEBRIDGE_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Claude"

    def draw(self, context):
        layout = self.layout
        layout.label(text=f"Bro: http://{server.HOST}:{server.PORT}")
        layout.label(text="MCP: mcp/blender_mcp_server.py")


def register():
    bpy.utils.register_class(CLAUDEBRIDGE_PT_panel)
    server.start()


def unregister():
    server.stop()
    bpy.utils.unregister_class(CLAUDEBRIDGE_PT_panel)
