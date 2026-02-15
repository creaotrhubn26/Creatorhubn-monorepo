"""
Word Bank Service - Database operations for Script Word Bank
Handles persistence of word vocabulary to Neon PostgreSQL database
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from typing import Optional, List, Dict, Any
from datetime import datetime

# Database connection string from environment
DATABASE_URL_RAW = os.getenv(
    'DATABASE_URL',
    'postgresql://neondb_owner:npg_vgy4STuQ8Mja@ep-soft-pond-ag9vm5a4-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
)
# Clean up DATABASE_URL
DATABASE_URL = DATABASE_URL_RAW.strip()
if DATABASE_URL.startswith('psql '):
    DATABASE_URL = DATABASE_URL[5:].strip()
if DATABASE_URL.startswith("'") and DATABASE_URL.endswith("'"):
    DATABASE_URL = DATABASE_URL[1:-1]
elif DATABASE_URL.startswith('"') and DATABASE_URL.endswith('"'):
    DATABASE_URL = DATABASE_URL[1:-1]


def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(DATABASE_URL)


def init_wordbank_tables():
    """Initialize word bank tables if they don't exist"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Main word bank table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS wordbank_words (
                    id SERIAL PRIMARY KEY,
                    word VARCHAR(100) NOT NULL,
                    category VARCHAR(50) NOT NULL,
                    language VARCHAR(10) DEFAULT 'both',
                    weight DECIMAL(3,2) DEFAULT 0.7,
                    is_builtin BOOLEAN DEFAULT false,
                    is_approved BOOLEAN DEFAULT true,
                    created_by UUID,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    usage_count INTEGER DEFAULT 0,
                    UNIQUE(word, category)
                )
            """)
            
            # Word suggestions table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS wordbank_suggestions (
                    id SERIAL PRIMARY KEY,
                    word VARCHAR(100) NOT NULL,
                    category VARCHAR(50) NOT NULL,
                    language VARCHAR(10) DEFAULT 'both',
                    suggested_weight DECIMAL(3,2) DEFAULT 0.7,
                    reason TEXT,
                    suggested_by UUID,
                    suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    status VARCHAR(20) DEFAULT 'pending',
                    reviewed_by UUID,
                    reviewed_at TIMESTAMP WITH TIME ZONE
                )
            """)
            
            # Feedback table for learning
            cur.execute("""
                CREATE TABLE IF NOT EXISTS wordbank_feedback (
                    id SERIAL PRIMARY KEY,
                    project_id UUID,
                    user_id UUID,
                    scene_text TEXT,
                    detected_purpose VARCHAR(50),
                    correct_purpose VARCHAR(50),
                    learned_words JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            
            # Usage tracking table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS wordbank_usage (
                    id SERIAL PRIMARY KEY,
                    word_id INTEGER REFERENCES wordbank_words(id),
                    project_id UUID,
                    user_id UUID,
                    scene_context TEXT,
                    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            
            # Create indexes
            cur.execute("CREATE INDEX IF NOT EXISTS idx_wordbank_category ON wordbank_words(category)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_wordbank_approved ON wordbank_words(is_approved)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_suggestions_status ON wordbank_suggestions(status)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_feedback_purposes ON wordbank_feedback(detected_purpose, correct_purpose)")
            
            conn.commit()
            print("Word bank tables initialized successfully")
            return True
    except Exception as e:
        print(f"Error initializing word bank tables: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()


def health_check() -> Dict[str, Any]:
    """Check if word bank database is available"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM wordbank_words")
            count = cur.fetchone()[0]
            return {"available": True, "word_count": count}
    except Exception as e:
        print(f"Word bank health check failed: {e}")
        return {"available": False, "error": str(e)}
    finally:
        if conn:
            conn.close()


def get_words_by_category(category: str) -> List[Dict[str, Any]]:
    """Get all approved words for a category"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, word, category, language, weight, 
                       is_builtin, is_approved, created_by, 
                       created_at, usage_count
                FROM wordbank_words
                WHERE category = %s AND is_approved = true
                ORDER BY weight DESC
            """, (category,))
            rows = cur.fetchall()
            
            words = []
            for row in rows:
                word = dict(row)
                if word.get('created_at'):
                    word['created_at'] = word['created_at'].isoformat()
                if word.get('weight'):
                    word['weight'] = float(word['weight'])
                words.append(word)
            
            return words
    except Exception as e:
        print(f"Error getting words for category {category}: {e}")
        return []
    finally:
        if conn:
            conn.close()


def add_word(
    word: str,
    category: str,
    language: str = 'both',
    weight: float = 0.7,
    user_id: Optional[str] = None,
    is_builtin: bool = False
) -> Dict[str, Any]:
    """Add a word to the word bank"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Check if word already exists
            cur.execute("""
                SELECT id FROM wordbank_words 
                WHERE word = %s AND category = %s
            """, (word.lower().strip(), category))
            
            existing = cur.fetchone()
            if existing:
                return {
                    "success": False,
                    "message": "Word already exists in this category",
                    "word_id": existing[0]
                }
            
            # Insert new word
            cur.execute("""
                INSERT INTO wordbank_words 
                (word, category, language, weight, is_builtin, is_approved, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (word.lower().strip(), category, language, weight, is_builtin, True, user_id))
            
            word_id = cur.fetchone()[0]
            conn.commit()
            
            return {
                "success": True,
                "word_id": word_id,
                "message": "Word added successfully"
            }
    except Exception as e:
        print(f"Error adding word: {e}")
        if conn:
            conn.rollback()
        return {"success": False, "message": str(e)}
    finally:
        if conn:
            conn.close()


def suggest_word(
    word: str,
    category: str,
    language: str = 'both',
    suggested_weight: float = 0.7,
    reason: Optional[str] = None,
    suggested_by: Optional[str] = None
) -> Dict[str, Any]:
    """Submit a word suggestion for admin review"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO wordbank_suggestions
                (word, category, language, suggested_weight, reason, suggested_by, status)
                VALUES (%s, %s, %s, %s, %s, %s, 'pending')
                RETURNING id
            """, (word.lower().strip(), category, language, suggested_weight, reason, suggested_by))
            
            suggestion_id = cur.fetchone()[0]
            conn.commit()
            
            return {"success": True, "suggestion_id": suggestion_id}
    except Exception as e:
        print(f"Error suggesting word: {e}")
        if conn:
            conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        if conn:
            conn.close()


def record_feedback(
    scene_text: str,
    detected_purpose: str,
    correct_purpose: str,
    learned_words: List[str],
    project_id: Optional[str] = None,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """Record feedback when user corrects a scene purpose"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO wordbank_feedback
                (project_id, user_id, scene_text, detected_purpose, correct_purpose, learned_words)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (project_id, user_id, scene_text[:2000], detected_purpose, correct_purpose, Json(learned_words)))
            
            feedback_id = cur.fetchone()[0]
            conn.commit()
            
            return {"success": True, "feedback_id": feedback_id}
    except Exception as e:
        print(f"Error recording feedback: {e}")
        if conn:
            conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        if conn:
            conn.close()


def track_usage(
    word: str,
    category: str,
    project_id: Optional[str] = None,
    user_id: Optional[str] = None,
    scene_context: Optional[str] = None
) -> Dict[str, Any]:
    """Track word usage"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Increment usage count on word
            cur.execute("""
                UPDATE wordbank_words 
                SET usage_count = usage_count + 1
                WHERE word = %s AND category = %s
                RETURNING id
            """, (word.lower(), category))
            
            result = cur.fetchone()
            if result and (project_id or scene_context):
                word_id = result[0]
                cur.execute("""
                    INSERT INTO wordbank_usage
                    (word_id, project_id, user_id, scene_context)
                    VALUES (%s, %s, %s, %s)
                """, (word_id, project_id, user_id, scene_context[:200] if scene_context else None))
            
            conn.commit()
            return {"success": True}
    except Exception as e:
        print(f"Error tracking usage: {e}")
        if conn:
            conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        if conn:
            conn.close()


def get_stats() -> Dict[str, Any]:
    """Get word bank statistics"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Total and builtin counts
            cur.execute("""
                SELECT 
                    COUNT(*) as total_words,
                    COUNT(*) FILTER (WHERE is_builtin = true) as builtin_words,
                    COUNT(*) FILTER (WHERE is_builtin = false) as learned_words
                FROM wordbank_words
            """)
            word_stats = cur.fetchone()
            
            # Pending suggestions
            cur.execute("""
                SELECT COUNT(*) as count FROM wordbank_suggestions WHERE status = 'pending'
            """)
            pending = cur.fetchone()['count']
            
            # Total feedback
            cur.execute("""
                SELECT COUNT(*) as count FROM wordbank_feedback
            """)
            feedback = cur.fetchone()['count']
            
            # Top categories
            cur.execute("""
                SELECT category, COUNT(*) as count
                FROM wordbank_words
                GROUP BY category
                ORDER BY count DESC
                LIMIT 5
            """)
            top_categories = [dict(row) for row in cur.fetchall()]
            
            return {
                "totalWords": word_stats['total_words'] or 0,
                "builtinWords": word_stats['builtin_words'] or 0,
                "learnedWords": word_stats['learned_words'] or 0,
                "pendingSuggestions": pending or 0,
                "totalFeedback": feedback or 0,
                "topCategories": top_categories
            }
    except Exception as e:
        print(f"Error getting stats: {e}")
        return {
            "totalWords": 0,
            "builtinWords": 0,
            "learnedWords": 0,
            "pendingSuggestions": 0,
            "totalFeedback": 0,
            "topCategories": []
        }
    finally:
        if conn:
            conn.close()


def get_pending_suggestions() -> List[Dict[str, Any]]:
    """Get pending word suggestions for admin review"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM wordbank_suggestions
                WHERE status = 'pending'
                ORDER BY suggested_at DESC
            """)
            rows = cur.fetchall()
            
            suggestions = []
            for row in rows:
                suggestion = dict(row)
                if suggestion.get('suggested_at'):
                    suggestion['suggested_at'] = suggestion['suggested_at'].isoformat()
                if suggestion.get('reviewed_at'):
                    suggestion['reviewed_at'] = suggestion['reviewed_at'].isoformat()
                if suggestion.get('suggested_weight'):
                    suggestion['suggested_weight'] = float(suggestion['suggested_weight'])
                suggestions.append(suggestion)
            
            return suggestions
    except Exception as e:
        print(f"Error getting pending suggestions: {e}")
        return []
    finally:
        if conn:
            conn.close()


def approve_suggestion(suggestion_id: int, reviewer_id: str) -> Dict[str, Any]:
    """Approve a word suggestion"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get suggestion
            cur.execute("""
                SELECT * FROM wordbank_suggestions WHERE id = %s
            """, (suggestion_id,))
            suggestion = cur.fetchone()
            
            if not suggestion:
                return {"success": False, "error": "Suggestion not found"}
            
            # Add to main word bank
            cur.execute("""
                INSERT INTO wordbank_words 
                (word, category, language, weight, is_builtin, is_approved, created_by)
                VALUES (%s, %s, %s, %s, false, true, %s)
                ON CONFLICT (word, category) DO NOTHING
                RETURNING id
            """, (
                suggestion['word'],
                suggestion['category'],
                suggestion['language'],
                suggestion['suggested_weight'],
                suggestion['suggested_by']
            ))
            
            # Update suggestion status
            cur.execute("""
                UPDATE wordbank_suggestions
                SET status = 'approved', reviewed_by = %s, reviewed_at = NOW()
                WHERE id = %s
            """, (reviewer_id, suggestion_id))
            
            conn.commit()
            return {"success": True}
    except Exception as e:
        print(f"Error approving suggestion: {e}")
        if conn:
            conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        if conn:
            conn.close()


def reject_suggestion(suggestion_id: int, reviewer_id: str) -> Dict[str, Any]:
    """Reject a word suggestion"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE wordbank_suggestions
                SET status = 'rejected', reviewed_by = %s, reviewed_at = NOW()
                WHERE id = %s
            """, (reviewer_id, suggestion_id))
            
            conn.commit()
            return {"success": True}
    except Exception as e:
        print(f"Error rejecting suggestion: {e}")
        if conn:
            conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        if conn:
            conn.close()


def seed_builtin_words(words: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Seed database with built-in words"""
    conn = None
    added = 0
    skipped = 0
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            for word_entry in words:
                try:
                    cur.execute("""
                        INSERT INTO wordbank_words 
                        (word, category, language, weight, is_builtin, is_approved)
                        VALUES (%s, %s, %s, %s, true, true)
                        ON CONFLICT (word, category) DO NOTHING
                    """, (
                        word_entry['word'].lower(),
                        word_entry['category'],
                        word_entry.get('language', 'both'),
                        word_entry.get('weight', 0.7)
                    ))
                    
                    if cur.rowcount > 0:
                        added += 1
                    else:
                        skipped += 1
                except Exception:
                    skipped += 1
            
            conn.commit()
            return {"added": added, "skipped": skipped}
    except Exception as e:
        print(f"Error seeding words: {e}")
        if conn:
            conn.rollback()
        return {"added": 0, "skipped": 0, "error": str(e)}
    finally:
        if conn:
            conn.close()


def get_misclassification_patterns() -> List[Dict[str, Any]]:
    """Get patterns of misclassified scene purposes"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    detected_purpose as "from",
                    correct_purpose as "to",
                    COUNT(*) as count
                FROM wordbank_feedback
                WHERE detected_purpose != correct_purpose
                GROUP BY detected_purpose, correct_purpose
                ORDER BY count DESC
            """)
            
            patterns = [dict(row) for row in cur.fetchall()]
            return patterns
    except Exception as e:
        print(f"Error getting misclassification patterns: {e}")
        return []
    finally:
        if conn:
            conn.close()


# Initialize tables on module load
init_wordbank_tables()
