"""
Shot Planner Service
Database operations for 2D shot planning scenes
"""

import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from psycopg2.extras import RealDictCursor, Json as PgJson
from casting_service import get_db_connection


def get_all_scenes() -> List[Dict[str, Any]]:
    """Get all shot planner scenes from database"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM shot_planner_scenes
                ORDER BY updated_at DESC
            """)
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    finally:
        conn.close()


def get_scene_by_id(scene_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific shot planner scene by ID"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM shot_planner_scenes
                WHERE id = %s
            """, (scene_id,))
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def save_scene(scene_data: Dict[str, Any]) -> bool:
    """Save or update a shot planner scene"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if scene exists
            cur.execute(
                "SELECT id FROM shot_planner_scenes WHERE id = %s",
                (scene_data['id'],)
            )
            exists = cur.fetchone()
            
            if exists:
                # Update existing scene
                cur.execute("""
                    UPDATE shot_planner_scenes
                    SET 
                        name = %s,
                        description = %s,
                        location = %s,
                        floor_plan = %s,
                        cameras = %s,
                        actors = %s,
                        props = %s,
                        shots = %s,
                        active_shot_id = %s,
                        annotations = %s,
                        viewport = %s,
                        show_grid = %s,
                        show_rulers = %s,
                        show_line_of_action = %s,
                        show_180_line = %s,
                        show_frustums = %s,
                        show_motion_paths = %s,
                        show_measurements = %s,
                        snap_to_grid = %s,
                        grid_size = %s,
                        measurement_unit = %s,
                        pixels_per_meter = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (
                    scene_data.get('name'),
                    scene_data.get('description'),
                    scene_data.get('location'),
                    PgJson(scene_data.get('floorPlan', {})),
                    PgJson(scene_data.get('cameras', [])),
                    PgJson(scene_data.get('actors', [])),
                    PgJson(scene_data.get('props', [])),
                    PgJson(scene_data.get('shots', [])),
                    scene_data.get('activeShotId'),
                    PgJson(scene_data.get('annotations', [])),
                    PgJson(scene_data.get('viewport', {})),
                    scene_data.get('showGrid', True),
                    scene_data.get('showRulers', True),
                    scene_data.get('showLineOfAction', True),
                    scene_data.get('show180Line', True),
                    scene_data.get('showFrustums', False),
                    scene_data.get('showMotionPaths', False),
                    scene_data.get('showMeasurements', False),
                    scene_data.get('snapToGrid', True),
                    scene_data.get('gridSize', 50),
                    scene_data.get('measurementUnit', 'meters'),
                    scene_data.get('pixelsPerMeter', 50),
                    scene_data['id']
                ))
            else:
                # Insert new scene
                cur.execute("""
                    INSERT INTO shot_planner_scenes (
                        id, name, description, location,
                        floor_plan, cameras, actors, props, shots,
                        active_shot_id, annotations, viewport,
                        show_grid, show_rulers, show_line_of_action, show_180_line,
                        show_frustums, show_motion_paths, show_measurements,
                        snap_to_grid, grid_size, measurement_unit, pixels_per_meter,
                        created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                """, (
                    scene_data['id'],
                    scene_data.get('name'),
                    scene_data.get('description'),
                    scene_data.get('location'),
                    PgJson(scene_data.get('floorPlan', {})),
                    PgJson(scene_data.get('cameras', [])),
                    PgJson(scene_data.get('actors', [])),
                    PgJson(scene_data.get('props', [])),
                    PgJson(scene_data.get('shots', [])),
                    scene_data.get('activeShotId'),
                    PgJson(scene_data.get('annotations', [])),
                    PgJson(scene_data.get('viewport', {})),
                    scene_data.get('showGrid', True),
                    scene_data.get('showRulers', True),
                    scene_data.get('showLineOfAction', True),
                    scene_data.get('show180Line', True),
                    scene_data.get('showFrustums', False),
                    scene_data.get('showMotionPaths', False),
                    scene_data.get('showMeasurements', False),
                    scene_data.get('snapToGrid', True),
                    scene_data.get('gridSize', 50),
                    scene_data.get('measurementUnit', 'meters'),
                    scene_data.get('pixelsPerMeter', 50)
                ))
            
            conn.commit()
            return True
    except Exception as e:
        conn.rollback()
        print(f"Error saving shot planner scene: {e}")
        return False
    finally:
        conn.close()


def delete_scene(scene_id: str) -> bool:
    """Delete a shot planner scene"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM shot_planner_scenes WHERE id = %s",
                (scene_id,)
            )
            conn.commit()
            return True
    except Exception as e:
        conn.rollback()
        print(f"Error deleting shot planner scene: {e}")
        return False
    finally:
        conn.close()


def get_scenes_by_manuscript(manuscript_id: str) -> List[Dict[str, Any]]:
    """Get shot planner scenes linked to a manuscript scene"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM shot_planner_scenes
                WHERE manuscript_scene_id = %s
                ORDER BY updated_at DESC
            """, (manuscript_id,))
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    finally:
        conn.close()


def link_to_manuscript_scene(scene_id: str, manuscript_scene_id: str) -> bool:
    """Link a shot planner scene to a manuscript scene"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE shot_planner_scenes
                SET manuscript_scene_id = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (manuscript_scene_id, scene_id))
            conn.commit()
            return True
    except Exception as e:
        conn.rollback()
        print(f"Error linking scene to manuscript: {e}")
        return False
    finally:
        conn.close()
