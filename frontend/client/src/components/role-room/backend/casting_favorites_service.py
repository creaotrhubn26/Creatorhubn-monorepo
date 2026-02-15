"""
Casting Planner Favorites Database Service
Handles CRUD operations for user favorites in Casting Planner
"""

import os
import json
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL_RAW = os.getenv(
    'DATABASE_URL',
    'postgresql://neondb_owner:npg_vgy4STuQ8Mja@ep-soft-pond-ag9vm5a4-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
)
DATABASE_URL = DATABASE_URL_RAW.strip()
if DATABASE_URL.startswith('psql '):
    DATABASE_URL = DATABASE_URL[5:].strip()
if DATABASE_URL.startswith("'") and DATABASE_URL.endswith("'"):
    DATABASE_URL = DATABASE_URL[1:-1]
elif DATABASE_URL.startswith('"') and DATABASE_URL.endswith('"'):
    DATABASE_URL = DATABASE_URL[1:-1]

def get_db_connection():
    if not DATABASE_URL:
        raise Exception("DATABASE_URL not set")
    return psycopg2.connect(DATABASE_URL)

def init_casting_favorites_tables():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS casting_favorites (
                    id VARCHAR(100) PRIMARY KEY,
                    user_id VARCHAR(255),
                    project_id VARCHAR(100) NOT NULL,
                    favorite_type VARCHAR(50) NOT NULL,
                    item_id VARCHAR(100) NOT NULL,
                    item_data JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, project_id, favorite_type, item_id)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS casting_projects (
                    id VARCHAR(100) PRIMARY KEY,
                    user_id VARCHAR(255),
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    project_data JSONB NOT NULL DEFAULT '{}',
                    status VARCHAR(50) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS casting_candidates (
                    id VARCHAR(100) PRIMARY KEY,
                    project_id VARCHAR(100) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    role_id VARCHAR(100),
                    candidate_data JSONB NOT NULL DEFAULT '{}',
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS casting_roles (
                    id VARCHAR(100) PRIMARY KEY,
                    project_id VARCHAR(100) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    role_data JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS casting_crew (
                    id VARCHAR(100) PRIMARY KEY,
                    project_id VARCHAR(100) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    role VARCHAR(100),
                    department VARCHAR(100),
                    crew_data JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS casting_locations (
                    id VARCHAR(100) PRIMARY KEY,
                    project_id VARCHAR(100) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    address TEXT,
                    location_data JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS casting_props (
                    id VARCHAR(100) PRIMARY KEY,
                    project_id VARCHAR(100) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    category VARCHAR(100),
                    prop_data JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS casting_schedules (
                    id VARCHAR(100) PRIMARY KEY,
                    project_id VARCHAR(100) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    start_time TIMESTAMP,
                    end_time TIMESTAMP,
                    schedule_data JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS casting_candidate_pool (
                    id VARCHAR(100) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    contact_info JSONB DEFAULT '{}',
                    photos JSONB DEFAULT '[]',
                    videos JSONB DEFAULT '[]',
                    model_url TEXT,
                    personality TEXT,
                    notes TEXT,
                    tags JSONB DEFAULT '[]',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS casting_role_pool (
                    id VARCHAR(100) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    role_type VARCHAR(100),
                    requirements JSONB DEFAULT '{}',
                    tags JSONB DEFAULT '[]',
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS casting_audition_pool (
                    id VARCHAR(100) PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    audition_type VARCHAR(100),
                    duration_minutes INTEGER DEFAULT 30,
                    location TEXT,
                    requirements JSONB DEFAULT '{}',
                    tags JSONB DEFAULT '[]',
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_casting_favorites_project ON casting_favorites(project_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_casting_favorites_type ON casting_favorites(favorite_type)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_casting_candidates_project ON casting_candidates(project_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_casting_roles_project ON casting_roles(project_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_casting_crew_project ON casting_crew(project_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_casting_locations_project ON casting_locations(project_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_casting_props_project ON casting_props(project_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_casting_schedules_project ON casting_schedules(project_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_casting_role_pool_name ON casting_role_pool(name)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_casting_audition_pool_title ON casting_audition_pool(title)")
            conn.commit()
            print("Casting Planner tables initialized")
    finally:
        conn.close()

def _format_row(row: dict) -> dict:
    result = dict(row)
    for key, value in result.items():
        if isinstance(value, Decimal):
            result[key] = float(value)
        elif key in ['created_at', 'updated_at', 'start_time', 'end_time'] and value:
            result[key] = value.isoformat()
    return result

def get_favorites(project_id: str, favorite_type: str, user_id: Optional[str] = None) -> List[str]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if user_id:
                cur.execute(
                    "SELECT item_id FROM casting_favorites WHERE project_id = %s AND favorite_type = %s AND user_id = %s",
                    (project_id, favorite_type, user_id)
                )
            else:
                cur.execute(
                    "SELECT item_id FROM casting_favorites WHERE project_id = %s AND favorite_type = %s",
                    (project_id, favorite_type)
                )
            return [row['item_id'] for row in cur.fetchall()]
    finally:
        conn.close()

def add_favorite(project_id: str, favorite_type: str, item_id: str, user_id: Optional[str] = None) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            fav_id = f"fav_{project_id}_{favorite_type}_{item_id}"
            cur.execute("""
                INSERT INTO casting_favorites (id, user_id, project_id, favorite_type, item_id)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id, project_id, favorite_type, item_id) DO NOTHING
            """, (fav_id, user_id, project_id, favorite_type, item_id))
            conn.commit()
            return True
    finally:
        conn.close()

def remove_favorite(project_id: str, favorite_type: str, item_id: str, user_id: Optional[str] = None) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if user_id:
                cur.execute(
                    "DELETE FROM casting_favorites WHERE project_id = %s AND favorite_type = %s AND item_id = %s AND user_id = %s",
                    (project_id, favorite_type, item_id, user_id)
                )
            else:
                cur.execute(
                    "DELETE FROM casting_favorites WHERE project_id = %s AND favorite_type = %s AND item_id = %s",
                    (project_id, favorite_type, item_id)
                )
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()

def set_favorites(project_id: str, favorite_type: str, item_ids: List[str], user_id: Optional[str] = None) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if user_id:
                cur.execute(
                    "DELETE FROM casting_favorites WHERE project_id = %s AND favorite_type = %s AND user_id = %s",
                    (project_id, favorite_type, user_id)
                )
            else:
                cur.execute(
                    "DELETE FROM casting_favorites WHERE project_id = %s AND favorite_type = %s",
                    (project_id, favorite_type)
                )
            for item_id in item_ids:
                fav_id = f"fav_{project_id}_{favorite_type}_{item_id}"
                cur.execute("""
                    INSERT INTO casting_favorites (id, user_id, project_id, favorite_type, item_id)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (fav_id, user_id, project_id, favorite_type, item_id))
            conn.commit()
            return True
    finally:
        conn.close()

def save_project(project: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            project_id = project.get('id', f"project_{datetime.now().strftime('%Y%m%d%H%M%S')}")
            cur.execute("""
                INSERT INTO casting_projects (id, user_id, name, description, project_data, status)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    project_data = EXCLUDED.project_data,
                    status = EXCLUDED.status,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            """, (
                project_id,
                user_id,
                project.get('name', 'Untitled Project'),
                project.get('description', ''),
                json.dumps(project.get('projectData', project.get('data', {}))),
                project.get('status', 'active')
            ))
            conn.commit()
            return _format_row(cur.fetchone())
    finally:
        conn.close()

def get_projects(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if user_id:
                cur.execute("SELECT * FROM casting_projects WHERE user_id = %s ORDER BY updated_at DESC", (user_id,))
            else:
                cur.execute("SELECT * FROM casting_projects ORDER BY updated_at DESC")
            return [_format_row(row) for row in cur.fetchall()]
    finally:
        conn.close()

def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM casting_projects WHERE id = %s", (project_id,))
            row = cur.fetchone()
            return _format_row(row) if row else None
    finally:
        conn.close()

def delete_project(project_id: str) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_projects WHERE id = %s", (project_id,))
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()

def save_candidate(candidate: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            candidate_id = candidate.get('id', f"candidate_{datetime.now().strftime('%Y%m%d%H%M%S')}")
            cur.execute("""
                INSERT INTO casting_candidates (id, project_id, name, role_id, candidate_data, status)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    role_id = EXCLUDED.role_id,
                    candidate_data = EXCLUDED.candidate_data,
                    status = EXCLUDED.status,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            """, (
                candidate_id,
                candidate.get('projectId', candidate.get('project_id')),
                candidate.get('name', 'Unnamed'),
                candidate.get('roleId', candidate.get('role_id')),
                json.dumps(candidate.get('data', {})),
                candidate.get('status', 'pending')
            ))
            conn.commit()
            return _format_row(cur.fetchone())
    finally:
        conn.close()

def get_candidates(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM casting_candidates WHERE project_id = %s ORDER BY name", (project_id,))
            return [_format_row(row) for row in cur.fetchall()]
    finally:
        conn.close()

def delete_candidate(candidate_id: str) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_candidates WHERE id = %s", (candidate_id,))
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()

def save_role(role: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            role_id = role.get('id', f"role_{datetime.now().strftime('%Y%m%d%H%M%S')}")
            cur.execute("""
                INSERT INTO casting_roles (id, project_id, name, description, role_data)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    role_data = EXCLUDED.role_data,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            """, (
                role_id,
                role.get('projectId', role.get('project_id')),
                role.get('name', 'Unnamed Role'),
                role.get('description', ''),
                json.dumps(role.get('data', {}))
            ))
            conn.commit()
            return _format_row(cur.fetchone())
    finally:
        conn.close()

def get_roles(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM casting_roles WHERE project_id = %s ORDER BY name", (project_id,))
            return [_format_row(row) for row in cur.fetchall()]
    finally:
        conn.close()

def delete_role(role_id: str) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_roles WHERE id = %s", (role_id,))
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()

def save_crew_member(crew: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            crew_id = crew.get('id', f"crew_{datetime.now().strftime('%Y%m%d%H%M%S')}")
            cur.execute("""
                INSERT INTO casting_crew (id, project_id, name, role, department, crew_data)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    role = EXCLUDED.role,
                    department = EXCLUDED.department,
                    crew_data = EXCLUDED.crew_data,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            """, (
                crew_id,
                crew.get('projectId', crew.get('project_id')),
                crew.get('name', 'Unnamed'),
                crew.get('role'),
                crew.get('department'),
                json.dumps(crew.get('data', {}))
            ))
            conn.commit()
            return _format_row(cur.fetchone())
    finally:
        conn.close()

def get_crew(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM casting_crew WHERE project_id = %s ORDER BY name", (project_id,))
            return [_format_row(row) for row in cur.fetchall()]
    finally:
        conn.close()

def delete_crew_member(crew_id: str) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_crew WHERE id = %s", (crew_id,))
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()

def save_location(location: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            location_id = location.get('id', f"location_{datetime.now().strftime('%Y%m%d%H%M%S')}")
            cur.execute("""
                INSERT INTO casting_locations (id, project_id, name, address, location_data)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    address = EXCLUDED.address,
                    location_data = EXCLUDED.location_data,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            """, (
                location_id,
                location.get('projectId', location.get('project_id')),
                location.get('name', 'Unnamed Location'),
                location.get('address', ''),
                json.dumps(location.get('data', {}))
            ))
            conn.commit()
            return _format_row(cur.fetchone())
    finally:
        conn.close()

def get_locations(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM casting_locations WHERE project_id = %s ORDER BY name", (project_id,))
            return [_format_row(row) for row in cur.fetchall()]
    finally:
        conn.close()

def delete_location(location_id: str) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_locations WHERE id = %s", (location_id,))
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()

def save_prop(prop: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            prop_id = prop.get('id', f"prop_{datetime.now().strftime('%Y%m%d%H%M%S')}")
            cur.execute("""
                INSERT INTO casting_props (id, project_id, name, category, prop_data)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    prop_data = EXCLUDED.prop_data,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            """, (
                prop_id,
                prop.get('projectId', prop.get('project_id')),
                prop.get('name', 'Unnamed Prop'),
                prop.get('category'),
                json.dumps(prop.get('data', {}))
            ))
            conn.commit()
            return _format_row(cur.fetchone())
    finally:
        conn.close()

def get_props(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM casting_props WHERE project_id = %s ORDER BY name", (project_id,))
            return [_format_row(row) for row in cur.fetchall()]
    finally:
        conn.close()

def delete_prop(prop_id: str) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_props WHERE id = %s", (prop_id,))
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()

def save_schedule(schedule: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            schedule_id = schedule.get('id', f"schedule_{datetime.now().strftime('%Y%m%d%H%M%S')}")
            cur.execute("""
                INSERT INTO casting_schedules (id, project_id, title, start_time, end_time, schedule_data)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    start_time = EXCLUDED.start_time,
                    end_time = EXCLUDED.end_time,
                    schedule_data = EXCLUDED.schedule_data,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            """, (
                schedule_id,
                schedule.get('projectId', schedule.get('project_id')),
                schedule.get('title', 'Untitled'),
                schedule.get('startTime', schedule.get('start_time')),
                schedule.get('endTime', schedule.get('end_time')),
                json.dumps(schedule.get('data', {}))
            ))
            conn.commit()
            return _format_row(cur.fetchone())
    finally:
        conn.close()

def get_schedules(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM casting_schedules WHERE project_id = %s ORDER BY start_time", (project_id,))
            return [_format_row(row) for row in cur.fetchall()]
    finally:
        conn.close()

def delete_schedule(schedule_id: str) -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_schedules WHERE id = %s", (schedule_id,))
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()
