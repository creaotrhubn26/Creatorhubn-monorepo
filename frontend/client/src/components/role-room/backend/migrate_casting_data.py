"""
Migration script to move casting project data from JSONB to normalized tables
This script reads existing data from casting_projects.data JSONB and migrates it
to the normalized tables: casting_roles, casting_candidates, casting_crew, 
casting_locations, and casting_shot_lists.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from typing import List, Dict, Any
import json
from datetime import datetime, date

# Import functions from casting_service
from casting_service import (
    get_db_connection,
    save_roles_to_db,
    save_candidates_to_db,
    save_crew_to_db,
    save_locations_to_db,
    save_shot_lists_to_db
)


def migrate_project_data(project_id: str, dry_run: bool = True) -> Dict[str, Any]:
    """
    Migrate a single project's data from JSONB to normalized tables
    
    Args:
        project_id: The project ID to migrate
        dry_run: If True, only report what would be migrated without actually doing it
    
    Returns:
        Dictionary with migration results
    """
    conn = None
    results = {
        'project_id': project_id,
        'dry_run': dry_run,
        'roles_migrated': 0,
        'candidates_migrated': 0,
        'crew_migrated': 0,
        'locations_migrated': 0,
        'shot_lists_migrated': 0,
        'errors': []
    }
    
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get project with data from JSONB
            cur.execute("""
                SELECT id, name, data
                FROM casting_projects
                WHERE id = %s
            """, (project_id,))
            
            row = cur.fetchone()
            if not row:
                results['errors'].append(f"Project {project_id} not found")
                return results
            
            project = dict(row)
            data = project.get('data', {})
            
            if not data:
                results['errors'].append(f"No data field found for project {project_id}")
                return results
            
            print(f"\n{'[DRY RUN] ' if dry_run else ''}Migrating project: {project.get('name')} ({project_id})")
            
            # Migrate roles
            roles = data.get('roles', [])
            if roles:
                print(f"  Found {len(roles)} roles to migrate")
                results['roles_migrated'] = len(roles)
                if not dry_run:
                    save_roles_to_db(project_id, roles, cur)
                    print(f"  ✓ Migrated {len(roles)} roles")
            
            # Migrate candidates
            candidates = data.get('candidates', [])
            if candidates:
                print(f"  Found {len(candidates)} candidates to migrate")
                results['candidates_migrated'] = len(candidates)
                if not dry_run:
                    save_candidates_to_db(project_id, candidates, cur)
                    print(f"  ✓ Migrated {len(candidates)} candidates")
            
            # Migrate crew
            crew = data.get('crew', [])
            if crew:
                print(f"  Found {len(crew)} crew members to migrate")
                results['crew_migrated'] = len(crew)
                if not dry_run:
                    save_crew_to_db(project_id, crew, cur)
                    print(f"  ✓ Migrated {len(crew)} crew members")
            
            # Migrate locations
            locations = data.get('locations', [])
            if locations:
                print(f"  Found {len(locations)} locations to migrate")
                results['locations_migrated'] = len(locations)
                if not dry_run:
                    save_locations_to_db(project_id, locations, cur)
                    print(f"  ✓ Migrated {len(locations)} locations")
            
            # Migrate shot lists
            shot_lists = data.get('shotLists', [])
            if shot_lists:
                print(f"  Found {len(shot_lists)} shot lists to migrate")
                results['shot_lists_migrated'] = len(shot_lists)
                if not dry_run:
                    save_shot_lists_to_db(project_id, shot_lists, cur)
                    print(f"  ✓ Migrated {len(shot_lists)} shot lists")
            
            if not dry_run:
                conn.commit()
                print(f"  ✓ Successfully migrated project {project_id}")
            else:
                print(f"  [DRY RUN] Would migrate project {project_id}")
            
            return results
            
    except Exception as e:
        error_msg = f"Error migrating project {project_id}: {str(e)}"
        print(f"  ✗ {error_msg}")
        results['errors'].append(error_msg)
        if conn:
            conn.rollback()
        return results
    finally:
        if conn:
            conn.close()


def migrate_all_projects(dry_run: bool = True) -> Dict[str, Any]:
    """
    Migrate all projects from JSONB to normalized tables
    
    Args:
        dry_run: If True, only report what would be migrated without actually doing it
    
    Returns:
        Dictionary with overall migration results
    """
    conn = None
    overall_results = {
        'dry_run': dry_run,
        'total_projects': 0,
        'projects_migrated': 0,
        'total_roles': 0,
        'total_candidates': 0,
        'total_crew': 0,
        'total_locations': 0,
        'total_shot_lists': 0,
        'errors': []
    }
    
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get all project IDs
            cur.execute("SELECT id FROM casting_projects ORDER BY created_at")
            projects = cur.fetchall()
            
            overall_results['total_projects'] = len(projects)
            
            print(f"\n{'=' * 60}")
            print(f"{'DRY RUN: ' if dry_run else ''}Migrating {len(projects)} projects")
            print(f"{'=' * 60}")
            
            for project_row in projects:
                project_id = project_row['id']
                results = migrate_project_data(project_id, dry_run=dry_run)
                
                if not results['errors']:
                    overall_results['projects_migrated'] += 1
                    overall_results['total_roles'] += results['roles_migrated']
                    overall_results['total_candidates'] += results['candidates_migrated']
                    overall_results['total_crew'] += results['crew_migrated']
                    overall_results['total_locations'] += results['locations_migrated']
                    overall_results['total_shot_lists'] += results['shot_lists_migrated']
                else:
                    overall_results['errors'].extend(results['errors'])
            
            print(f"\n{'=' * 60}")
            print(f"Migration Summary:")
            print(f"  Projects processed: {overall_results['total_projects']}")
            print(f"  Projects migrated: {overall_results['projects_migrated']}")
            print(f"  Total roles: {overall_results['total_roles']}")
            print(f"  Total candidates: {overall_results['total_candidates']}")
            print(f"  Total crew: {overall_results['total_crew']}")
            print(f"  Total locations: {overall_results['total_locations']}")
            print(f"  Total shot lists: {overall_results['total_shot_lists']}")
            if overall_results['errors']:
                print(f"  Errors: {len(overall_results['errors'])}")
            print(f"{'=' * 60}\n")
            
            return overall_results
            
    except Exception as e:
        error_msg = f"Error in migration: {str(e)}"
        print(f"✗ {error_msg}")
        overall_results['errors'].append(error_msg)
        return overall_results
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    import sys
    
    # Check for command line arguments
    dry_run = True
    project_id = None
    
    if len(sys.argv) > 1:
        if '--execute' in sys.argv or '-e' in sys.argv:
            dry_run = False
        if '--project' in sys.argv:
            idx = sys.argv.index('--project')
            if idx + 1 < len(sys.argv):
                project_id = sys.argv[idx + 1]
    
    if project_id:
        # Migrate single project
        print(f"\nMigrating single project: {project_id}")
        results = migrate_project_data(project_id, dry_run=dry_run)
        print(f"\nResults: {json.dumps(results, indent=2)}")
    else:
        # Migrate all projects
        print(f"\nMigrating all projects...")
        if dry_run:
            print("NOTE: This is a DRY RUN. Use --execute to actually migrate data.")
        results = migrate_all_projects(dry_run=dry_run)
        print(f"\nOverall Results: {json.dumps(results, indent=2)}")

