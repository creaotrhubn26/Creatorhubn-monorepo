#!/usr/bin/env python3
"""
Migration script to move casting projects from localStorage to PostgreSQL database
This script reads from localStorage backup (JSON file) and migrates to database
"""

import json
import sys
import os
import psycopg2
from psycopg2.extras import Json
from typing import List, Dict, Any

# Database connection
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://neondb_owner:npg_vgy4STuQ8Mja@ep-soft-pond-ag9vm5a4-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
)


def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(DATABASE_URL)


def load_projects_from_json(file_path: str) -> List[Dict[str, Any]]:
    """Load projects from JSON file (localStorage backup)"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Handle both array and object formats
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and 'projects' in data:
                return data['projects']
            else:
                print(f"Warning: Unexpected JSON format in {file_path}")
                return []
    except FileNotFoundError:
        print(f"Error: File {file_path} not found")
        return []
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {file_path}: {e}")
        return []


def migrate_project_to_db(project: Dict[str, Any], conn) -> bool:
    """Migrate a single project to database"""
    try:
        with conn.cursor() as cur:
            project_id = project.get('id')
            if not project_id:
                print("Warning: Project missing ID, skipping")
                return False
            
            name = project.get('name', 'Unnamed Project')
            description = project.get('description')
            production_plan_id = project.get('productionPlanId')
            
            # Extract fields that should be in main table
            # Everything else goes into data JSONB
            data_fields = {k: v for k, v in project.items() 
                          if k not in ['id', 'name', 'description', 'productionPlanId']}
            
            # Check if project already exists (use public schema explicitly)
            cur.execute("SELECT id FROM public.casting_projects WHERE id = %s", (project_id,))
            exists = cur.fetchone() is not None
            
            if exists:
                print(f"  Project {project_id} already exists, skipping...")
                return False
            
            # Insert new project (use public schema explicitly)
            cur.execute("""
                INSERT INTO public.casting_projects (id, name, description, production_plan_id, data)
                VALUES (%s, %s, %s, %s, %s)
            """, (project_id, name, description, production_plan_id, Json(data_fields)))
            
            conn.commit()
            print(f"  ✓ Migrated project: {name} ({project_id})")
            return True
    except Exception as e:
        print(f"  ✗ Error migrating project {project.get('id', 'unknown')}: {e}")
        conn.rollback()
        return False


def migrate_from_localstorage_backup(json_file: str, dry_run: bool = False):
    """Migrate projects from localStorage backup JSON file"""
    print(f"Loading projects from {json_file}...")
    projects = load_projects_from_json(json_file)
    
    if not projects:
        print("No projects found to migrate")
        return
    
    print(f"Found {len(projects)} project(s) to migrate")
    
    if dry_run:
        print("\n=== DRY RUN MODE - No changes will be made ===\n")
        for project in projects:
            print(f"Would migrate: {project.get('name', 'Unnamed')} ({project.get('id', 'no-id')})")
        return
    
    # Connect to database
    try:
        conn = get_db_connection()
        print("Connected to database\n")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return
    
    try:
        migrated = 0
        skipped = 0
        errors = 0
        
        for project in projects:
            if migrate_project_to_db(project, conn):
                migrated += 1
            else:
                skipped += 1
        
        print(f"\n=== Migration Complete ===")
        print(f"Migrated: {migrated}")
        print(f"Skipped: {skipped}")
        print(f"Errors: {errors}")
        
    finally:
        conn.close()


def export_localstorage_to_json():
    """Helper function to export localStorage data (for manual use)"""
    print("""
To export localStorage data from browser:
1. Open browser console (F12)
2. Run: JSON.stringify(localStorage.getItem('virtualStudio_castingProjects'))
3. Copy the output
4. Save to a file (e.g., casting_projects_backup.json)
5. Run this script with: python3 migrate_casting_to_db.py casting_projects_backup.json
    """)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 migrate_casting_to_db.py <json_file> [--dry-run]")
        print("\nExample:")
        print("  python3 migrate_casting_to_db.py casting_projects_backup.json")
        print("  python3 migrate_casting_to_db.py casting_projects_backup.json --dry-run")
        export_localstorage_to_json()
        sys.exit(1)
    
    json_file = sys.argv[1]
    dry_run = '--dry-run' in sys.argv
    
    if not os.path.exists(json_file):
        print(f"Error: File {json_file} not found")
        sys.exit(1)
    
    migrate_from_localstorage_backup(json_file, dry_run)

