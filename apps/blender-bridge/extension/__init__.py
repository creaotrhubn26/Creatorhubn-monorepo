# Claude Bridge — Blender Extension.
# HTTP-bro (localhost:7717) + N-panel med godkjenninger og operasjonslogg.

import bpy

from . import permissions, server


class CLAUDEBRIDGE_OT_approve(bpy.types.Operator):
    bl_idname = "claudebridge.approve"
    bl_label = "Godkjenn"
    approval_id: bpy.props.StringProperty()

    def execute(self, context):
        permissions.set_status(self.approval_id, "approved")
        return {"FINISHED"}


class CLAUDEBRIDGE_OT_deny(bpy.types.Operator):
    bl_idname = "claudebridge.deny"
    bl_label = "Avvis"
    approval_id: bpy.props.StringProperty()

    def execute(self, context):
        permissions.set_status(self.approval_id, "denied", error="avvist av bruker")
        return {"FINISHED"}


class CLAUDEBRIDGE_OT_toggle_auto(bpy.types.Operator):
    bl_idname = "claudebridge.toggle_auto"
    bl_label = "Auto-godkjenn endringer av/på"

    def execute(self, context):
        permissions.auto_modify = not permissions.auto_modify
        return {"FINISHED"}


class CLAUDEBRIDGE_OT_undo_task(bpy.types.Operator):
    bl_idname = "claudebridge.undo_task"
    bl_label = "Angre AI-oppgave"

    def execute(self, context):
        from . import core
        result = core.undo_task()
        self.report({"INFO"}, f"Angret {result['undone']} steg")
        return {"FINISHED"}


class CLAUDEBRIDGE_PT_panel(bpy.types.Panel):
    bl_label = "Claude Bridge"
    bl_idname = "CLAUDEBRIDGE_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Claude"

    def draw(self, context):
        layout = self.layout
        layout.label(text=f"Bro: http://{server.HOST}:{server.PORT}")
        row = layout.row()
        row.operator("claudebridge.toggle_auto",
                     text=f"Auto-godkjenn endringer: {'PÅ' if permissions.auto_modify else 'AV'}",
                     icon="CHECKMARK" if permissions.auto_modify else "CANCEL")

        pending = permissions.pending_list()
        if pending:
            box = layout.box()
            box.label(text="Claude ber om godkjenning:", icon="QUESTION")
            for entry in pending:
                col = box.column(align=True)
                col.label(text=f"{entry['tool']} ({entry['id']})")
                args_text = str(entry["args"])[:60]
                if args_text:
                    col.label(text=args_text)
                row = col.row(align=True)
                op = row.operator("claudebridge.approve", text="Godkjenn", icon="CHECKMARK")
                op.approval_id = entry["id"]
                op = row.operator("claudebridge.deny", text="Avvis", icon="CANCEL")
                op.approval_id = entry["id"]

        from . import core
        task = core.task_status()
        if task["task"]:
            box = layout.box()
            box.label(text=f"AI-oppgave: {task['task']} ({task['ops']} steg)", icon="TOOL_SETTINGS")
            box.operator("claudebridge.undo_task", icon="LOOP_BACK")

        recent = permissions.log_tail(5)
        if recent:
            box = layout.box()
            box.label(text="Siste operasjoner:")
            for item in reversed(recent):
                icon = "CHECKMARK" if item["ok"] else "ERROR"
                box.label(text=item["tool"], icon=icon)


_CLASSES = (
    CLAUDEBRIDGE_OT_approve,
    CLAUDEBRIDGE_OT_deny,
    CLAUDEBRIDGE_OT_toggle_auto,
    CLAUDEBRIDGE_OT_undo_task,
    CLAUDEBRIDGE_PT_panel,
)


def register():
    for cls in _CLASSES:
        bpy.utils.register_class(cls)
    server.start()


def unregister():
    server.stop()
    for cls in reversed(_CLASSES):
        bpy.utils.unregister_class(cls)
