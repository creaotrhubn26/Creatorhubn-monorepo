"""
Casting Service - Database operations for Casting Planner
Handles persistence of casting projects to PostgreSQL database
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from typing import Optional, List, Dict, Any
import json
from datetime import datetime, date
from decimal import Decimal

def convert_decimal(obj):
    """Recursively convert Decimal values to float in a dict or list"""
    if isinstance(obj, dict):
        return {k: convert_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimal(item) for item in obj]
    elif isinstance(obj, Decimal):
        return float(obj)
    else:
        return obj

# Database connection string from environment or default
DATABASE_URL_RAW = os.getenv(
    'DATABASE_URL',
    'postgresql://neondb_owner:npg_vgy4STuQ8Mja@ep-soft-pond-ag9vm5a4-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
)
# Clean up DATABASE_URL - remove 'psql ' prefix and strip quotes if present
DATABASE_URL = DATABASE_URL_RAW.strip()
if DATABASE_URL.startswith('psql '):
    DATABASE_URL = DATABASE_URL[5:].strip()
# Remove surrounding quotes if present
if DATABASE_URL.startswith("'") and DATABASE_URL.endswith("'"):
    DATABASE_URL = DATABASE_URL[1:-1]
elif DATABASE_URL.startswith('"') and DATABASE_URL.endswith('"'):
    DATABASE_URL = DATABASE_URL[1:-1]


def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(DATABASE_URL)


def get_projects() -> List[Dict[str, Any]]:
    """Get all casting projects from database with basic data from normalized tables"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    id, name, description, production_plan_id,
                    created_at, updated_at, data
                FROM casting_projects
                ORDER BY updated_at DESC
            """)
            rows = cur.fetchall()
            
            projects = []
            for row in rows:
                project = dict(row)
                project_id = project['id']
                
                # Convert datetime objects to ISO format strings
                if project.get('created_at'):
                    project['created_at'] = project['created_at'].isoformat() if hasattr(project['created_at'], 'isoformat') else str(project['created_at'])
                if project.get('updated_at'):
                    project['updated_at'] = project['updated_at'].isoformat() if hasattr(project['updated_at'], 'isoformat') else str(project['updated_at'])
                
                # Get counts from normalized tables for quick overview
                cur.execute("SELECT COUNT(*) as count FROM casting_roles WHERE project_id = %s", (project_id,))
                project['rolesCount'] = cur.fetchone()['count'] or 0
                
                cur.execute("SELECT COUNT(*) as count FROM casting_candidates WHERE project_id = %s", (project_id,))
                project['candidatesCount'] = cur.fetchone()['count'] or 0
                
                cur.execute("SELECT COUNT(*) as count FROM casting_crew WHERE project_id = %s", (project_id,))
                project['crewCount'] = cur.fetchone()['count'] or 0
                
                cur.execute("SELECT COUNT(*) as count FROM casting_locations WHERE project_id = %s", (project_id,))
                project['locationsCount'] = cur.fetchone()['count'] or 0
                
                # Initialize empty arrays (full data will be loaded when project is selected)
                project['roles'] = []
                project['candidates'] = []
                project['crew'] = []
                project['locations'] = []
                project['shotLists'] = []
                
                # Merge remaining data from JSONB field
                if project.get('data'):
                    data = project['data']
                    project.update(data)
                
                # Remove the data field
                project.pop('data', None)
                projects.append(convert_decimal(project))
            
            return projects
    except Exception as e:
        print(f"Error getting projects: {e}")
        import traceback
        print(traceback.format_exc())
        return []
    finally:
        if conn:
            conn.close()


def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    """Get a single casting project by ID with all related data from normalized tables"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get main project record
            cur.execute("""
                SELECT 
                    id, name, description, production_plan_id,
                    created_at, updated_at, data
                FROM casting_projects
                WHERE id = %s
            """, (project_id,))
            row = cur.fetchone()
            
            if not row:
                return None
            
            project = dict(row)
            
            # Convert datetime objects to ISO format strings
            if project.get('created_at'):
                project['created_at'] = project['created_at'].isoformat() if hasattr(project['created_at'], 'isoformat') else str(project['created_at'])
            if project.get('updated_at'):
                project['updated_at'] = project['updated_at'].isoformat() if hasattr(project['updated_at'], 'isoformat') else str(project['updated_at'])
            
            # Get roles from normalized table
            cur.execute("""
                SELECT id, name, description, requirements, status, scene_ids,
                       created_at, updated_at
                FROM casting_roles
                WHERE project_id = %s
                ORDER BY created_at
            """, (project_id,))
            roles = []
            for role_row in cur.fetchall():
                role = dict(role_row)
                # Convert datetime
                if role.get('created_at'):
                    role['createdAt'] = role['created_at'].isoformat() if hasattr(role['created_at'], 'isoformat') else str(role['created_at'])
                if role.get('updated_at'):
                    role['updatedAt'] = role['updated_at'].isoformat() if hasattr(role['updated_at'], 'isoformat') else str(role['updated_at'])
                # Map field names
                role['sceneIds'] = role.pop('scene_ids', [])
                role.pop('created_at', None)
                role.pop('updated_at', None)
                roles.append(role)
            project['roles'] = roles
            
            # Get candidates from normalized table
            cur.execute("""
                SELECT id, name, contact_info, photos, videos, model_url, personality,
                       audition_notes, status, assigned_roles, emergency_contact,
                       created_at, updated_at
                FROM casting_candidates
                WHERE project_id = %s
                ORDER BY created_at
            """, (project_id,))
            candidates = []
            for cand_row in cur.fetchall():
                cand = dict(cand_row)
                # Convert datetime
                if cand.get('created_at'):
                    cand['createdAt'] = cand['created_at'].isoformat() if hasattr(cand['created_at'], 'isoformat') else str(cand['created_at'])
                if cand.get('updated_at'):
                    cand['updatedAt'] = cand['updated_at'].isoformat() if hasattr(cand['updated_at'], 'isoformat') else str(cand['updated_at'])
                # Map field names
                cand['contactInfo'] = cand.pop('contact_info', {})
                cand['modelUrl'] = cand.pop('model_url')
                cand['auditionNotes'] = cand.pop('audition_notes')
                cand['assignedRoles'] = cand.pop('assigned_roles', [])
                cand['emergencyContact'] = cand.pop('emergency_contact', {})
                cand.pop('created_at', None)
                cand.pop('updated_at', None)
                candidates.append(cand)
            project['candidates'] = candidates
            
            # Get crew from normalized table
            cur.execute("""
                SELECT id, name, role, contact_info, availability, assigned_scenes,
                       rate, notes, travel_costs, created_at, updated_at
                FROM casting_crew
                WHERE project_id = %s
                ORDER BY created_at
            """, (project_id,))
            crew = []
            for crew_row in cur.fetchall():
                crew_member = dict(crew_row)
                # Convert datetime
                if crew_member.get('created_at'):
                    crew_member['createdAt'] = crew_member['created_at'].isoformat() if hasattr(crew_member['created_at'], 'isoformat') else str(crew_member['created_at'])
                if crew_member.get('updated_at'):
                    crew_member['updatedAt'] = crew_member['updated_at'].isoformat() if hasattr(crew_member['updated_at'], 'isoformat') else str(crew_member['updated_at'])
                # Map field names
                crew_member['contactInfo'] = crew_member.pop('contact_info', {})
                crew_member['assignedScenes'] = crew_member.pop('assigned_scenes', [])
                crew_member['travelCosts'] = crew_member.pop('travel_costs', {})
                crew_member.pop('created_at', None)
                crew_member.pop('updated_at', None)
                crew.append(crew_member)
            project['crew'] = crew
            
            # Get locations from normalized table
            cur.execute("""
                SELECT id, name, address, type, capacity, facilities, availability,
                       assigned_scenes, contact_info, coordinates, notes,
                       created_at, updated_at
                FROM casting_locations
                WHERE project_id = %s
                ORDER BY created_at
            """, (project_id,))
            locations = []
            for loc_row in cur.fetchall():
                loc = dict(loc_row)
                # Convert datetime
                if loc.get('created_at'):
                    loc['createdAt'] = loc['created_at'].isoformat() if hasattr(loc['created_at'], 'isoformat') else str(loc['created_at'])
                if loc.get('updated_at'):
                    loc['updatedAt'] = loc['updated_at'].isoformat() if hasattr(loc['updated_at'], 'isoformat') else str(loc['updated_at'])
                # Map field names
                loc['assignedScenes'] = loc.pop('assigned_scenes', [])
                loc['contactInfo'] = loc.pop('contact_info', {})
                loc.pop('created_at', None)
                loc.pop('updated_at', None)
                locations.append(loc)
            project['locations'] = locations
            
            # Get shot lists from normalized table
            cur.execute("""
                SELECT id, scene_id, shots, camera_settings, equipment, notes,
                       created_at, updated_at
                FROM casting_shot_lists
                WHERE project_id = %s
                ORDER BY created_at
            """, (project_id,))
            shot_lists = []
            for sl_row in cur.fetchall():
                sl = dict(sl_row)
                # Convert datetime
                if sl.get('created_at'):
                    sl['createdAt'] = sl['created_at'].isoformat() if hasattr(sl['created_at'], 'isoformat') else str(sl['created_at'])
                if sl.get('updated_at'):
                    sl['updatedAt'] = sl['updated_at'].isoformat() if hasattr(sl['updated_at'], 'isoformat') else str(sl['updated_at'])
                # Map field names
                sl['sceneId'] = sl.pop('scene_id', '')
                sl['cameraSettings'] = sl.pop('camera_settings', {})
                sl.pop('created_at', None)
                sl.pop('updated_at', None)
                shot_lists.append(sl)
            project['shotLists'] = shot_lists
            
            # Merge remaining data from JSONB field
            if project.get('data'):
                data = project['data']
                project.update(data)
            
            # Remove the data field
            project.pop('data', None)
            
            return convert_decimal(project)
    except Exception as e:
        print(f"Error getting project: {e}")
        import traceback
        print(traceback.format_exc())
        return None
    finally:
        if conn:
            conn.close()


def save_roles_to_db(project_id: str, roles: List[Dict[str, Any]], cur) -> None:
    """Save roles to normalized casting_roles table"""
    if not roles:
        return
    
    for role in roles:
        role_id = role.get('id')
        if not role_id:
            continue
        
        # Check if role exists
        cur.execute("SELECT id FROM casting_roles WHERE id = %s", (role_id,))
        exists = cur.fetchone() is not None
        
        name = role.get('name', '')
        description = role.get('description')
        requirements = role.get('requirements', {})
        status = role.get('status', 'draft')
        scene_ids = role.get('sceneIds', [])
        
        if exists:
            cur.execute("""
                UPDATE casting_roles
                SET name = %s, description = %s, requirements = %s, 
                    status = %s, scene_ids = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND project_id = %s
            """, (name, description, Json(requirements), status, Json(scene_ids), role_id, project_id))
        else:
            cur.execute("""
                INSERT INTO casting_roles (id, project_id, name, description, requirements, status, scene_ids)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (role_id, project_id, name, description, Json(requirements), status, Json(scene_ids)))


def save_candidates_to_db(project_id: str, candidates: List[Dict[str, Any]], cur) -> None:
    """Save candidates to normalized casting_candidates table"""
    if not candidates:
        return
    
    for candidate in candidates:
        candidate_id = candidate.get('id')
        if not candidate_id:
            continue
        
        # Check if candidate exists
        cur.execute("SELECT id FROM casting_candidates WHERE id = %s", (candidate_id,))
        exists = cur.fetchone() is not None
        
        name = candidate.get('name', '')
        contact_info = candidate.get('contactInfo', {})
        photos = candidate.get('photos', [])
        videos = candidate.get('videos', [])
        model_url = candidate.get('modelUrl')
        personality = candidate.get('personality')
        audition_notes = candidate.get('auditionNotes')
        status = candidate.get('status', 'pending')
        assigned_roles = candidate.get('assignedRoles', [])
        emergency_contact = candidate.get('emergencyContact', {})
        
        if exists:
            cur.execute("""
                UPDATE casting_candidates
                SET name = %s, contact_info = %s, photos = %s, videos = %s,
                    model_url = %s, personality = %s, audition_notes = %s,
                    status = %s, assigned_roles = %s, emergency_contact = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND project_id = %s
            """, (name, Json(contact_info), Json(photos), Json(videos), model_url, personality,
                  audition_notes, status, Json(assigned_roles), Json(emergency_contact),
                  candidate_id, project_id))
        else:
            cur.execute("""
                INSERT INTO casting_candidates 
                (id, project_id, name, contact_info, photos, videos, model_url, 
                 personality, audition_notes, status, assigned_roles, emergency_contact)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (candidate_id, project_id, name, Json(contact_info), Json(photos), Json(videos),
                  model_url, personality, audition_notes, status, Json(assigned_roles),
                  Json(emergency_contact)))


def save_crew_to_db(project_id: str, crew: List[Dict[str, Any]], cur) -> None:
    """Save crew members to normalized casting_crew table"""
    if not crew:
        return
    
    for crew_member in crew:
        crew_id = crew_member.get('id')
        if not crew_id:
            continue
        
        # Check if crew member exists
        cur.execute("SELECT id FROM casting_crew WHERE id = %s", (crew_id,))
        exists = cur.fetchone() is not None
        
        name = crew_member.get('name', '')
        role = crew_member.get('role', '')
        contact_info = crew_member.get('contactInfo', {})
        availability = crew_member.get('availability', {})
        assigned_scenes = crew_member.get('assignedScenes', [])
        rate = crew_member.get('rate')
        notes = crew_member.get('notes')
        travel_costs = crew_member.get('travelCosts', {})
        
        # Convert datetime objects in nested dicts
        if isinstance(contact_info, dict):
            for k, v in contact_info.items():
                if isinstance(v, (datetime, date)):
                    contact_info[k] = v.isoformat()
        if isinstance(availability, dict):
            for k, v in availability.items():
                if isinstance(v, (datetime, date)):
                    availability[k] = v.isoformat()
        
        if exists:
            cur.execute("""
                UPDATE casting_crew
                SET name = %s, role = %s, contact_info = %s, availability = %s,
                    assigned_scenes = %s, rate = %s, notes = %s, travel_costs = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND project_id = %s
            """, (name, role, Json(contact_info), Json(availability), Json(assigned_scenes),
                  rate, notes, Json(travel_costs), crew_id, project_id))
        else:
            cur.execute("""
                INSERT INTO casting_crew 
                (id, project_id, name, role, contact_info, availability, assigned_scenes, 
                 rate, notes, travel_costs)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (crew_id, project_id, name, role, Json(contact_info), Json(availability),
                  Json(assigned_scenes), rate, notes, Json(travel_costs)))


def save_locations_to_db(project_id: str, locations: List[Dict[str, Any]], cur) -> None:
    """Save locations to normalized casting_locations table"""
    if not locations:
        return
    
    for location in locations:
        location_id = location.get('id')
        if not location_id:
            continue
        
        # Check if location exists
        cur.execute("SELECT id FROM casting_locations WHERE id = %s", (location_id,))
        exists = cur.fetchone() is not None
        
        name = location.get('name', '')
        address = location.get('address')
        location_type = location.get('type')
        capacity = location.get('capacity')
        facilities = location.get('facilities', [])
        availability = location.get('availability', {})
        assigned_scenes = location.get('assignedScenes', [])
        contact_info = location.get('contactInfo', {})
        coordinates = location.get('coordinates', {})
        notes = location.get('notes')
        
        if exists:
            cur.execute("""
                UPDATE casting_locations
                SET name = %s, address = %s, type = %s, capacity = %s, facilities = %s,
                    availability = %s, assigned_scenes = %s, contact_info = %s,
                    coordinates = %s, notes = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND project_id = %s
            """, (name, address, location_type, capacity, Json(facilities), Json(availability),
                  Json(assigned_scenes), Json(contact_info), Json(coordinates), notes,
                  location_id, project_id))
        else:
            cur.execute("""
                INSERT INTO casting_locations 
                (id, project_id, name, address, type, capacity, facilities, availability,
                 assigned_scenes, contact_info, coordinates, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (location_id, project_id, name, address, location_type, capacity,
                  Json(facilities), Json(availability), Json(assigned_scenes),
                  Json(contact_info), Json(coordinates), notes))


def save_shot_lists_to_db(project_id: str, shot_lists: List[Dict[str, Any]], cur) -> None:
    """Save shot lists to normalized casting_shot_lists table"""
    if not shot_lists:
        return
    
    for shot_list in shot_lists:
        shot_list_id = shot_list.get('id')
        if not shot_list_id:
            continue
        
        # Check if shot list exists
        cur.execute("SELECT id FROM casting_shot_lists WHERE id = %s", (shot_list_id,))
        exists = cur.fetchone() is not None
        
        scene_id = shot_list.get('sceneId', '')
        shots = shot_list.get('shots', [])
        camera_settings = shot_list.get('cameraSettings', {})
        equipment = shot_list.get('equipment', [])
        notes = shot_list.get('notes')
        
        if exists:
            cur.execute("""
                UPDATE casting_shot_lists
                SET scene_id = %s, shots = %s, camera_settings = %s,
                    equipment = %s, notes = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND project_id = %s
            """, (scene_id, Json(shots), Json(camera_settings), Json(equipment), notes,
                  shot_list_id, project_id))
        else:
            cur.execute("""
                INSERT INTO casting_shot_lists 
                (id, project_id, scene_id, shots, camera_settings, equipment, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (shot_list_id, project_id, scene_id, Json(shots), Json(camera_settings),
                  Json(equipment), notes))


def save_project(project: Dict[str, Any]) -> bool:
    """Save or update a casting project and all related data to normalized tables"""
    conn = None
    try:
        # Validate required fields
        if not project.get('id'):
            print("ERROR: Project ID is required")
            return False
        
        project_id = project.get('id')
        name = project.get('name', '')
        
        if not name or not name.strip():
            print(f"ERROR: Project name is required for project {project_id}")
            return False
        
        print(f"Attempting to save project: id={project_id}, name={name}")
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            description = project.get('description')
            production_plan_id = project.get('productionPlanId')
            
            # Check if project exists
            cur.execute("SELECT id FROM casting_projects WHERE id = %s", (project_id,))
            exists = cur.fetchone() is not None
            
            print(f"Project exists: {exists}, preparing to {'update' if exists else 'insert'}")
            
            # Save main project record
            if exists:
                cur.execute("""
                    UPDATE casting_projects
                    SET 
                        name = %s,
                        description = %s,
                        production_plan_id = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (name, description, production_plan_id, project_id))
                print(f"Updated project {project_id}")
            else:
                cur.execute("""
                    INSERT INTO casting_projects (id, name, description, production_plan_id)
                    VALUES (%s, %s, %s, %s)
                """, (project_id, name, description, production_plan_id))
                print(f"Inserted new project {project_id}")
            
            # Save roles to normalized table
            roles = project.get('roles', [])
            if roles:
                print(f"Saving {len(roles)} roles to casting_roles table")
                save_roles_to_db(project_id, roles, cur)
            
            # Save candidates to normalized table
            candidates = project.get('candidates', [])
            if candidates:
                print(f"Saving {len(candidates)} candidates to casting_candidates table")
                save_candidates_to_db(project_id, candidates, cur)
            
            # Save crew to normalized table
            crew = project.get('crew', [])
            if crew:
                print(f"Saving {len(crew)} crew members to casting_crew table")
                save_crew_to_db(project_id, crew, cur)
            
            # Save locations to normalized table
            locations = project.get('locations', [])
            if locations:
                print(f"Saving {len(locations)} locations to casting_locations table")
                save_locations_to_db(project_id, locations, cur)
            
            # Save shot lists to normalized table
            shot_lists = project.get('shotLists', [])
            if shot_lists:
                print(f"Saving {len(shot_lists)} shot lists to casting_shot_lists table")
                save_shot_lists_to_db(project_id, shot_lists, cur)
            
            # Extract other fields that should go into data JSONB (schedules, props, productionDays, etc.)
            data_fields = {}
            for k, v in project.items():
                if k not in ['id', 'name', 'description', 'productionPlanId', 'roles', 'candidates', 'crew', 'locations', 'shotLists']:
                    if v is None:
                        data_fields[k] = None
                    elif isinstance(v, (str, int, float, bool)):
                        data_fields[k] = v
                    elif isinstance(v, (list, dict)):
                        try:
                            json.dumps(v)
                            data_fields[k] = v
                        except (TypeError, ValueError) as e:
                            print(f"WARNING: Could not serialize {k}: {e}, converting to string")
                            data_fields[k] = str(v)
                    elif isinstance(v, (datetime, date)):
                        data_fields[k] = v.isoformat()
                    else:
                        print(f"WARNING: Converting {k} (type: {type(v)}) to string")
                        data_fields[k] = str(v)
            
            # Update data JSONB field with remaining fields
            if data_fields:
                cur.execute("""
                    UPDATE casting_projects
                    SET data = %s
                    WHERE id = %s
                """, (Json(data_fields), project_id))
            
            conn.commit()
            print(f"Successfully saved project {project_id} with normalized data")
            return True
    except psycopg2.Error as e:
        import traceback
        error_msg = f"Database error saving project: {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        import traceback
        error_msg = f"Error saving project: {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def delete_project(project_id: str) -> bool:
    """Delete a casting project"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_projects WHERE id = %s", (project_id,))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        print(f"Error deleting project: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def health_check() -> bool:
    """Check if database is accessible"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            return True
    except Exception as e:
        print(f"Database health check failed: {e}")
        return False
    finally:
        if conn:
            conn.close()


# ============================================================================
# MANUSCRIPT API FUNCTIONS
# ============================================================================

def get_manuscripts(project_id: str) -> List[Dict[str, Any]]:
    """Get all manuscripts for a project"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    id, project_id, title, subtitle, author, version, format,
                    content, page_count, word_count, estimated_runtime,
                    status, notes, metadata, created_at, updated_at
                FROM casting_manuscripts
                WHERE project_id = %s
                ORDER BY updated_at DESC
            """, (project_id,))
            rows = cur.fetchall()
            
            manuscripts = []
            for row in rows:
                manuscript = dict(row)
                # Convert datetime to ISO format
                if manuscript.get('created_at'):
                    manuscript['created_at'] = manuscript['created_at'].isoformat()
                if manuscript.get('updated_at'):
                    manuscript['updated_at'] = manuscript['updated_at'].isoformat()
                manuscripts.append(convert_decimal(manuscript))
            
            return manuscripts
    except Exception as e:
        print(f"Error fetching manuscripts: {e}")
        return []
    finally:
        if conn:
            conn.close()


def get_manuscript(manuscript_id: str) -> Optional[Dict[str, Any]]:
    """Get a single manuscript by ID"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    id, project_id, title, subtitle, author, version, format,
                    content, page_count, word_count, estimated_runtime,
                    status, notes, metadata, created_at, updated_at
                FROM casting_manuscripts
                WHERE id = %s
            """, (manuscript_id,))
            row = cur.fetchone()
            
            if row:
                manuscript = dict(row)
                if manuscript.get('created_at'):
                    manuscript['created_at'] = manuscript['created_at'].isoformat()
                if manuscript.get('updated_at'):
                    manuscript['updated_at'] = manuscript['updated_at'].isoformat()
                return convert_decimal(manuscript)
            return None
    except Exception as e:
        print(f"Error fetching manuscript: {e}")
        return None
    finally:
        if conn:
            conn.close()


def create_manuscript(manuscript: Dict[str, Any]) -> bool:
    """Create a new manuscript"""
    conn = None
    try:
        # Generate ID if not provided
        import uuid
        manuscript_id = manuscript.get('id') or f"manuscript-{uuid.uuid4()}"
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO casting_manuscripts (
                    id, project_id, title, subtitle, author, version, format,
                    content, page_count, word_count, estimated_runtime,
                    status, notes, metadata, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
            """, (
                manuscript_id,
                manuscript.get('projectId') or manuscript.get('project_id'),
                manuscript.get('title'),
                manuscript.get('subtitle'),
                manuscript.get('author'),
                manuscript.get('version', '1.0'),
                manuscript.get('format', 'fountain'),
                manuscript.get('content', ''),
                manuscript.get('pageCount', 0),
                manuscript.get('wordCount', 0),
                manuscript.get('estimatedRuntime'),
                manuscript.get('status', 'draft'),
                manuscript.get('notes'),
                Json(manuscript.get('metadata', {})),
                manuscript.get('createdAt', datetime.now().isoformat()),
                manuscript.get('updatedAt', datetime.now().isoformat())
            ))
            conn.commit()
            return True
    except Exception as e:
        print(f"Error creating manuscript: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def update_manuscript(manuscript_id: str, manuscript: Dict[str, Any]) -> bool:
    """Update a manuscript"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE casting_manuscripts SET
                    title = %s,
                    subtitle = %s,
                    author = %s,
                    version = %s,
                    format = %s,
                    content = %s,
                    page_count = %s,
                    word_count = %s,
                    estimated_runtime = %s,
                    status = %s,
                    notes = %s,
                    metadata = %s,
                    updated_at = %s
                WHERE id = %s
            """, (
                manuscript.get('title'),
                manuscript.get('subtitle'),
                manuscript.get('author'),
                manuscript.get('version'),
                manuscript.get('format'),
                manuscript.get('content'),
                manuscript.get('pageCount'),
                manuscript.get('wordCount'),
                manuscript.get('estimatedRuntime'),
                manuscript.get('status'),
                manuscript.get('notes'),
                Json(manuscript.get('metadata', {})),
                datetime.now().isoformat(),
                manuscript_id
            ))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        print(f"Error updating manuscript: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def delete_manuscript(manuscript_id: str) -> bool:
    """Delete a manuscript"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_manuscripts WHERE id = %s", (manuscript_id,))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        print(f"Error deleting manuscript: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def get_scenes(manuscript_id: str) -> List[Dict[str, Any]]:
    """Get all scenes for a manuscript"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT *
                FROM casting_scenes
                WHERE manuscript_id = %s
                ORDER BY scene_number
            """, (manuscript_id,))
            rows = cur.fetchall()
            
            scenes = []
            for row in rows:
                scene = dict(row)
                # Convert datetime to ISO format
                if scene.get('created_at'):
                    scene['created_at'] = scene['created_at'].isoformat()
                if scene.get('updated_at'):
                    scene['updated_at'] = scene['updated_at'].isoformat()
                if scene.get('shooting_date') and hasattr(scene['shooting_date'], 'isoformat'):
                    scene['shooting_date'] = scene['shooting_date'].isoformat()
                scenes.append(convert_decimal(scene))
            
            return scenes
    except Exception as e:
        print(f"Error fetching scenes: {e}")
        return []
    finally:
        if conn:
            conn.close()


def save_scene(scene: Dict[str, Any]) -> bool:
    """Create or update a scene"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Check if scene exists
            cur.execute("SELECT id FROM casting_scenes WHERE id = %s", (scene.get('id'),))
            exists = cur.fetchone() is not None
            
            if exists:
                # Update existing scene
                cur.execute("""
                    UPDATE casting_scenes SET
                        act_id = %s,
                        scene_number = %s,
                        scene_heading = %s,
                        int_ext = %s,
                        location_name = %s,
                        time_of_day = %s,
                        page_length = %s,
                        estimated_screen_time = %s,
                        description = %s,
                        dramatic_day = %s,
                        sequence = %s,
                        characters = %s,
                        extras_count = %s,
                        props_needed = %s,
                        wardrobe_notes = %s,
                        makeup_notes = %s,
                        special_effects = %s,
                        stunts_notes = %s,
                        vehicles = %s,
                        animals = %s,
                        sound_notes = %s,
                        music_notes = %s,
                        location_id = %s,
                        shooting_date = %s,
                        call_time = %s,
                        estimated_duration = %s,
                        priority = %s,
                        status = %s,
                        notes = %s,
                        metadata = %s,
                        updated_at = %s
                    WHERE id = %s
                """, (
                    scene.get('actId') or scene.get('act_id'),
                    scene.get('sceneNumber') or scene.get('scene_number'),
                    scene.get('sceneHeading') or scene.get('scene_heading'),
                    scene.get('intExt') or scene.get('int_ext'),
                    scene.get('locationName') or scene.get('location_name'),
                    scene.get('timeOfDay') or scene.get('time_of_day'),
                    scene.get('pageLength') or scene.get('page_length'),
                    scene.get('estimatedScreenTime') or scene.get('estimated_screen_time'),
                    scene.get('description'),
                    scene.get('dramaticDay') or scene.get('dramatic_day'),
                    scene.get('sequence'),
                    Json(scene.get('characters', [])),
                    scene.get('extrasCount') or scene.get('extras_count'),
                    Json(scene.get('propsNeeded') or scene.get('props_needed') or []),
                    scene.get('wardrobeNotes') or scene.get('wardrobe_notes'),
                    scene.get('makeupNotes') or scene.get('makeup_notes'),
                    scene.get('specialEffects') or scene.get('special_effects'),
                    scene.get('stuntsNotes') or scene.get('stunts_notes'),
                    Json(scene.get('vehicles', [])),
                    Json(scene.get('animals', [])),
                    scene.get('soundNotes') or scene.get('sound_notes'),
                    scene.get('musicNotes') or scene.get('music_notes'),
                    scene.get('locationId') or scene.get('location_id'),
                    scene.get('shootingDate') or scene.get('shooting_date'),
                    scene.get('callTime') or scene.get('call_time'),
                    scene.get('estimatedDuration') or scene.get('estimated_duration'),
                    scene.get('priority'),
                    scene.get('status', 'not-scheduled'),
                    scene.get('notes'),
                    Json(scene.get('metadata', {})),
                    datetime.now().isoformat(),
                    scene.get('id')
                ))
            else:
                # Insert new scene
                cur.execute("""
                    INSERT INTO casting_scenes (
                        id, manuscript_id, project_id, act_id, scene_number, scene_heading,
                        int_ext, location_name, time_of_day, page_length,
                        estimated_screen_time, description, dramatic_day, sequence,
                        characters, extras_count, props_needed, wardrobe_notes,
                        makeup_notes, special_effects, stunts_notes, vehicles,
                        animals, sound_notes, music_notes, location_id,
                        shooting_date, call_time, estimated_duration, priority,
                        status, notes, metadata, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s
                    )
                """, (
                    scene.get('id'),
                    scene.get('manuscriptId') or scene.get('manuscript_id'),
                    scene.get('projectId') or scene.get('project_id'),
                    scene.get('actId') or scene.get('act_id'),
                    scene.get('sceneNumber') or scene.get('scene_number'),
                    scene.get('sceneHeading') or scene.get('scene_heading'),
                    scene.get('intExt') or scene.get('int_ext'),
                    scene.get('locationName') or scene.get('location_name'),
                    scene.get('timeOfDay') or scene.get('time_of_day'),
                    scene.get('pageLength') or scene.get('page_length'),
                    scene.get('estimatedScreenTime') or scene.get('estimated_screen_time'),
                    scene.get('description'),
                    scene.get('dramaticDay') or scene.get('dramatic_day'),
                    scene.get('sequence'),
                    Json(scene.get('characters', [])),
                    scene.get('extrasCount') or scene.get('extras_count'),
                    Json(scene.get('propsNeeded') or scene.get('props_needed') or []),
                    scene.get('wardrobeNotes') or scene.get('wardrobe_notes'),
                    scene.get('makeupNotes') or scene.get('makeup_notes'),
                    scene.get('specialEffects') or scene.get('special_effects'),
                    scene.get('stuntsNotes') or scene.get('stunts_notes'),
                    Json(scene.get('vehicles', [])),
                    Json(scene.get('animals', [])),
                    scene.get('soundNotes') or scene.get('sound_notes'),
                    scene.get('musicNotes') or scene.get('music_notes'),
                    scene.get('locationId') or scene.get('location_id'),
                    scene.get('shootingDate') or scene.get('shooting_date'),
                    scene.get('callTime') or scene.get('call_time'),
                    scene.get('estimatedDuration') or scene.get('estimated_duration'),
                    scene.get('priority'),
                    scene.get('status', 'not-scheduled'),
                    scene.get('notes'),
                    Json(scene.get('metadata', {})),
                    datetime.now().isoformat(),
                    datetime.now().isoformat()
                ))
            
            conn.commit()
            return True
    except Exception as e:
        print(f"Error saving scene: {e}")
        import traceback
        print(traceback.format_exc())
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def get_dialogue(manuscript_id: str) -> List[Dict[str, Any]]:
    """Get all dialogue lines for a manuscript"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT *
                FROM casting_dialogue
                WHERE manuscript_id = %s
                ORDER BY scene_id, line_number
            """, (manuscript_id,))
            rows = cur.fetchall()
            
            dialogue = []
            for row in rows:
                line = dict(row)
                if line.get('created_at'):
                    line['created_at'] = line['created_at'].isoformat()
                if line.get('updated_at'):
                    line['updated_at'] = line['updated_at'].isoformat()
                dialogue.append(convert_decimal(line))
            
            return dialogue
    except Exception as e:
        print(f"Error fetching dialogue: {e}")
        return []
    finally:
        if conn:
            conn.close()


def save_dialogue(dialogue: Dict[str, Any]) -> bool:
    """Create or update a dialogue line"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Check if dialogue exists
            cur.execute("SELECT id FROM casting_dialogue WHERE id = %s", (dialogue.get('id'),))
            exists = cur.fetchone() is not None
            
            if exists:
                # Update existing dialogue
                cur.execute("""
                    UPDATE casting_dialogue SET
                        scene_id = %s,
                        manuscript_id = %s,
                        character_name = %s,
                        role_id = %s,
                        dialogue_text = %s,
                        parenthetical = %s,
                        line_number = %s,
                        dialogue_type = %s,
                        emotion_tag = %s,
                        updated_at = %s
                    WHERE id = %s
                """, (
                    dialogue.get('sceneId'),
                    dialogue.get('manuscriptId'),
                    dialogue.get('characterName'),
                    dialogue.get('roleId'),
                    dialogue.get('dialogueText'),
                    dialogue.get('parenthetical'),
                    dialogue.get('lineNumber'),
                    dialogue.get('dialogueType', 'dialogue'),
                    dialogue.get('emotionTag'),
                    datetime.now().isoformat(),
                    dialogue.get('id')
                ))
            else:
                # Insert new dialogue
                cur.execute("""
                    INSERT INTO casting_dialogue (
                        id, scene_id, manuscript_id, character_name, role_id,
                        dialogue_text, parenthetical, line_number, dialogue_type,
                        emotion_tag, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                """, (
                    dialogue.get('id'),
                    dialogue.get('sceneId'),
                    dialogue.get('manuscriptId'),
                    dialogue.get('characterName'),
                    dialogue.get('roleId'),
                    dialogue.get('dialogueText'),
                    dialogue.get('parenthetical'),
                    dialogue.get('lineNumber'),
                    dialogue.get('dialogueType', 'dialogue'),
                    dialogue.get('emotionTag'),
                    datetime.now().isoformat(),
                    datetime.now().isoformat()
                ))
            
            conn.commit()
            return True
    except Exception as e:
        print(f"Error saving dialogue: {e}")
        import traceback
        print(traceback.format_exc())
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def delete_dialogue(dialogue_id: str) -> bool:
    """Delete a dialogue line"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_dialogue WHERE id = %s", (dialogue_id,))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        print(f"Error deleting dialogue: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def get_revisions(manuscript_id: str) -> List[Dict[str, Any]]:
    """Get all revisions for a manuscript"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT *
                FROM casting_script_revisions
                WHERE manuscript_id = %s
                ORDER BY created_at DESC
            """, (manuscript_id,))
            rows = cur.fetchall()
            
            revisions = []
            for row in rows:
                revision = dict(row)
                if revision.get('created_at'):
                    revision['created_at'] = revision['created_at'].isoformat()
                revisions.append(convert_decimal(revision))
            
            return revisions
    except Exception as e:
        print(f"Error fetching revisions: {e}")
        return []
    finally:
        if conn:
            conn.close()


def create_revision(revision: Dict[str, Any]) -> bool:
    """Create a new script revision"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO casting_script_revisions (
                    id, manuscript_id, version, content, changes_summary,
                    changed_by, color_code, revision_notes, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                revision.get('id'),
                revision.get('manuscriptId'),
                revision.get('version'),
                revision.get('content'),
                revision.get('changesSummary'),
                revision.get('changedBy'),
                revision.get('colorCode'),
                revision.get('revisionNotes'),
                revision.get('createdAt', datetime.now().isoformat())
            ))
            conn.commit()
            return True
    except Exception as e:
        print(f"Error creating revision: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


# ==================== Acts Functions ====================

def get_acts(manuscript_id: str) -> List[Dict[str, Any]]:
    """Get all acts for a manuscript"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return []
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM casting_acts
                WHERE manuscript_id = %s
                ORDER BY act_number
            """, (manuscript_id,))
            acts = []
            for row in cur.fetchall():
                act = dict(row)
                # Convert datetime to string for JSON serialization
                if act.get('created_at'):
                    act['created_at'] = act['created_at'].isoformat()
                if act.get('updated_at'):
                    act['updated_at'] = act['updated_at'].isoformat()
                acts.append(convert_decimal(act))
            return acts
    except Exception as e:
        print(f"Error fetching acts: {e}")
        return []
    finally:
        if conn:
            conn.close()


def get_act(act_id: str) -> Optional[Dict[str, Any]]:
    """Get a single act by ID"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return None
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM casting_acts
                WHERE id = %s
            """, (act_id,))
            row = cur.fetchone()
            if row:
                act = dict(row)
                # Convert datetime to string for JSON serialization
                if act.get('created_at'):
                    act['created_at'] = act['created_at'].isoformat()
                if act.get('updated_at'):
                    act['updated_at'] = act['updated_at'].isoformat()
                return convert_decimal(act)
            return None
    except Exception as e:
        print(f"Error fetching act: {e}")
        return None
    finally:
        if conn:
            conn.close()


def create_act(act: Dict[str, Any]) -> bool:
    """Create a new act"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return False
        
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO casting_acts (
                    id, manuscript_id, project_id, act_number, title, description,
                    page_start, page_end, estimated_runtime, color_code, sort_order, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                act.get('id'),
                act.get('manuscriptId'),
                act.get('projectId', ''),
                act.get('actNumber'),
                act.get('title'),
                act.get('description'),
                act.get('pageStart'),
                act.get('pageEnd'),
                act.get('estimatedRuntime'),
                act.get('colorCode'),
                act.get('sortOrder', 0),
                act.get('createdAt', datetime.now().isoformat()),
                act.get('updatedAt', datetime.now().isoformat())
            ))
            conn.commit()
            return True
    except Exception as e:
        print(f"Error creating act: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def update_act(act_id: str, act: Dict[str, Any]) -> bool:
    """Update an existing act"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return False
        
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE casting_acts SET
                    act_number = %s,
                    title = %s,
                    description = %s,
                    page_start = %s,
                    page_end = %s,
                    estimated_runtime = %s,
                    color_code = %s,
                    sort_order = %s,
                    updated_at = %s
                WHERE id = %s
            """, (
                act.get('actNumber'),
                act.get('title'),
                act.get('description'),
                act.get('pageStart'),
                act.get('pageEnd'),
                act.get('estimatedRuntime'),
                act.get('colorCode'),
                act.get('sortOrder'),
                datetime.now().isoformat(),
                act_id
            ))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        print(f"Error updating act: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def delete_act(act_id: str) -> bool:
    """Delete an act"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            return False
        
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_acts WHERE id = %s", (act_id,))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        print(f"Error deleting act: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()
