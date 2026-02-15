#!/usr/bin/env python3
"""
Test script for casting database integration
Tests all CRUD operations and verifies data persistence
"""

import sys
import os
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from datetime import datetime
import json

DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://neondb_owner:npg_vgy4STuQ8Mja@ep-soft-pond-ag9vm5a4-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
)


def get_db_connection():
    """Get database connection"""
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True  # Enable autocommit for Neon
    return conn


def test_connection():
    """Test database connection"""
    print("1. Testing database connection...")
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            print(f"   ✓ Connected to: {version.split(',')[0]}")
        conn.close()
        return True
    except Exception as e:
        print(f"   ✗ Connection failed: {e}")
        return False


def test_create_project():
    """Test creating a project"""
    print("\n2. Testing project creation...")
    conn = None
    try:
        conn = get_db_connection()
        test_project = {
            'id': f'test-project-{int(datetime.now().timestamp())}',
            'name': 'Test Project',
            'description': 'This is a test project',
            'roles': [],
            'candidates': [],
            'schedules': [],
            'crew': [],
            'locations': [],
            'props': [],
            'productionDays': [],
            'shotLists': [],
            'userRoles': [],
            'createdAt': datetime.now().isoformat(),
            'updatedAt': datetime.now().isoformat(),
        }
        
        with conn.cursor() as cur:
            project_id = test_project['id']
            name = test_project['name']
            description = test_project['description']
            data_fields = {k: v for k, v in test_project.items() 
                          if k not in ['id', 'name', 'description']}
            
            # Ensure we're using public schema
            cur.execute("SET search_path TO public;")
            cur.execute("""
                INSERT INTO public.casting_projects (id, name, description, data)
                VALUES (%s, %s, %s, %s)
            """, (project_id, name, description, Json(data_fields)))
            
            print(f"   ✓ Created test project: {project_id}")
            return project_id
    except Exception as e:
        print(f"   ✗ Create failed: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        if conn:
            conn.close()


def test_read_project(project_id: str):
    """Test reading a project"""
    print(f"\n3. Testing project read (ID: {project_id})...")
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, name, description, data
                FROM casting_projects
                WHERE id = %s
            """, (project_id,))
            row = cur.fetchone()
            
            if row:
                project = dict(row)
                if project.get('data'):
                    project.update(project['data'])
                project.pop('data', None)
                print(f"   ✓ Read project: {project.get('name')}")
                print(f"     - ID: {project.get('id')}")
                print(f"     - Description: {project.get('description')}")
                return True
            else:
                print(f"   ✗ Project not found")
                return False
    except Exception as e:
        print(f"   ✗ Read failed: {e}")
        return False
    finally:
        if conn:
            conn.close()


def test_update_project(project_id: str):
    """Test updating a project"""
    print(f"\n4. Testing project update (ID: {project_id})...")
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE casting_projects
                SET name = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, ('Updated Test Project', project_id))
            
            conn.commit()
            print(f"   ✓ Updated project name")
            return True
    except Exception as e:
        print(f"   ✗ Update failed: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def test_list_projects():
    """Test listing all projects"""
    print("\n5. Testing list all projects...")
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, name, created_at, updated_at
                FROM casting_projects
                ORDER BY updated_at DESC
                LIMIT 10
            """)
            rows = cur.fetchall()
            print(f"   ✓ Found {len(rows)} project(s)")
            for row in rows:
                print(f"     - {row['name']} ({row['id']})")
            return True
    except Exception as e:
        print(f"   ✗ List failed: {e}")
        return False
    finally:
        if conn:
            conn.close()


def test_delete_project(project_id: str):
    """Test deleting a project"""
    print(f"\n6. Testing project delete (ID: {project_id})...")
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM casting_projects WHERE id = %s", (project_id,))
            conn.commit()
            if cur.rowcount > 0:
                print(f"   ✓ Deleted test project")
                return True
            else:
                print(f"   ✗ Project not found for deletion")
                return False
    except Exception as e:
        print(f"   ✗ Delete failed: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def main():
    """Run all tests"""
    print("=" * 60)
    print("Casting Database Integration Tests")
    print("=" * 60)
    
    # Test connection
    if not test_connection():
        print("\n❌ Database connection failed. Aborting tests.")
        sys.exit(1)
    
    # Test CRUD operations
    project_id = test_create_project()
    if not project_id:
        print("\n❌ Project creation failed. Aborting remaining tests.")
        sys.exit(1)
    
    test_read_project(project_id)
    test_update_project(project_id)
    test_list_projects()
    test_delete_project(project_id)
    
    print("\n" + "=" * 60)
    print("✅ All tests completed!")
    print("=" * 60)


if __name__ == '__main__':
    main()

