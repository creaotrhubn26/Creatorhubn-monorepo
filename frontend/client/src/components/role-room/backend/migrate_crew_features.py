"""
Migration script to add crew availability, notifications, and conflict detection features
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.getenv('DATABASE_URL', '')

def run_migration():
    """Add crew availability and notification tables"""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            create_availability_sql = """
            CREATE TABLE IF NOT EXISTS crew_availability (
                id VARCHAR(50) PRIMARY KEY,
                crew_id VARCHAR(50) NOT NULL,
                project_id VARCHAR(50),
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status VARCHAR(50) DEFAULT 'available',
                is_recurring BOOLEAN DEFAULT FALSE,
                recurrence_pattern VARCHAR(50),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
            cur.execute(create_availability_sql)
            
            create_notifications_sql = """
            CREATE TABLE IF NOT EXISTS crew_notifications (
                id VARCHAR(50) PRIMARY KEY,
                crew_id VARCHAR(50) NOT NULL,
                project_id VARCHAR(50),
                event_id VARCHAR(50),
                notification_type VARCHAR(50) NOT NULL,
                channel VARCHAR(50) DEFAULT 'in_app',
                title VARCHAR(255) NOT NULL,
                message TEXT,
                payload JSONB DEFAULT '{}',
                status VARCHAR(50) DEFAULT 'pending',
                read_at TIMESTAMP,
                sent_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
            cur.execute(create_notifications_sql)
            
            alter_calendar_events_sql = """
            ALTER TABLE casting_calendar_events 
            ADD COLUMN IF NOT EXISTS assignment_status VARCHAR(50) DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS notification_status VARCHAR(50) DEFAULT 'not_sent',
            ADD COLUMN IF NOT EXISTS conflict_flags JSONB DEFAULT '[]';
            """
            cur.execute(alter_calendar_events_sql)
            
            create_availability_index = """
            CREATE INDEX IF NOT EXISTS idx_crew_availability_crew_id 
            ON crew_availability(crew_id);
            """
            cur.execute(create_availability_index)
            
            create_availability_date_index = """
            CREATE INDEX IF NOT EXISTS idx_crew_availability_dates 
            ON crew_availability(start_date, end_date);
            """
            cur.execute(create_availability_date_index)
            
            create_notifications_crew_index = """
            CREATE INDEX IF NOT EXISTS idx_crew_notifications_crew_id 
            ON crew_notifications(crew_id);
            """
            cur.execute(create_notifications_crew_index)
            
            create_notifications_status_index = """
            CREATE INDEX IF NOT EXISTS idx_crew_notifications_status 
            ON crew_notifications(status);
            """
            cur.execute(create_notifications_status_index)
            
            conn.commit()
            print("Crew features migration completed successfully!")
            print("- Created crew_availability table")
            print("- Created crew_notifications table")
            print("- Added conflict detection columns to casting_calendar_events")
            print("- Created indexes for performance")
            
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        import traceback
        print(traceback.format_exc())
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
