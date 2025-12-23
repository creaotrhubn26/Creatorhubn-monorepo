#!/usr/bin/env python3
"""
Test Fine-Tuning System
Comprehensive test suite for the fine-tuning system
"""

import os
import sys
import json
from datetime import datetime

# Add parent directory to path
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

def test_database_connection():
    """Test database connection"""
    print("\n" + "="*60)
    print("TEST 1: Database Connection")
    print("="*60)
    
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        db_url = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL')
        if not db_url:
            print("❌ DATABASE_URL or POSTGRES_URL not set")
            return False
        
        conn = psycopg2.connect(db_url)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) as count FROM sync_training_data")
            result = cur.fetchone()
            print(f"✅ Database connected")
            print(f"   Training data samples: {result['count']}")
        
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def test_training_data_schema():
    """Test training data schema exists"""
    print("\n" + "="*60)
    print("TEST 2: Training Data Schema")
    print("="*60)
    
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        db_url = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL')
        conn = psycopg2.connect(db_url)
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if tables exist
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('sync_training_data', 'sync_model_versions', 'sync_training_data_usage')
            """)
            tables = [row['table_name'] for row in cur.fetchall()]
            
            expected = ['sync_training_data', 'sync_model_versions', 'sync_training_data_usage']
            missing = [t for t in expected if t not in tables]
            
            if missing:
                print(f"❌ Missing tables: {missing}")
                print(f"   Run migration: psql $DATABASE_URL -f migrations/078_add_sync_training_data.sql")
                return False
            
            print(f"✅ All tables exist: {', '.join(tables)}")
        
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Schema test failed: {e}")
        return False

def test_fine_tuner_import():
    """Test fine-tuning module import"""
    print("\n" + "="*60)
    print("TEST 3: Fine-Tuning Module Import")
    print("="*60)
    
    try:
        # Import using importlib to handle hyphenated filename
        import importlib.util
        fine_tune_path = os.path.join(script_dir, 'server', 'workers', 'fine-tune-sync-models.py')
        spec = importlib.util.spec_from_file_location("fine_tune_sync_models", fine_tune_path)
        fine_tune_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(fine_tune_module)
        
        SyncModelFineTuner = fine_tune_module.SyncModelFineTuner
        print("✅ Fine-tuning module imported successfully")
        
        # Test initialization
        tuner = SyncModelFineTuner(model_type='synchformer')
        print(f"✅ Fine-tuner initialized: {tuner.model_type}")
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_model_loader_import():
    """Test model loader import"""
    print("\n" + "="*60)
    print("TEST 4: Model Loader Import")
    print("="*60)
    
    try:
        from server.workers.load_fine_tuned_model import load_fine_tuned_model, get_latest_model_version
        print("✅ Model loader imported successfully")
        
        # Test getting latest model (may not exist yet)
        model_version = get_latest_model_version('synchformer')
        if model_version:
            print(f"✅ Latest model version found: v{model_version['version_number']}")
        else:
            print("ℹ️  No fine-tuned models yet (this is expected)")
        
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_create_sample_training_data():
    """Create sample training data for testing"""
    print("\n" + "="*60)
    print("TEST 5: Create Sample Training Data")
    print("="*60)
    
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        db_url = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL')
        conn = psycopg2.connect(db_url)
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check existing count
            cur.execute("SELECT COUNT(*) as count FROM sync_training_data")
            before_count = cur.fetchone()['count']
            
            # Get an existing story_arc_id (use first available)
            cur.execute("SELECT id FROM story_arc_projects LIMIT 1")
            story_arc = cur.fetchone()
            
            if story_arc:
                story_arc_id = story_arc['id']
                print(f"   Using existing story arc: {story_arc_id[:8]}...")
            else:
                # If no story arcs exist, use NULL (if allowed) or skip foreign key
                story_arc_id = None
                print("   ⚠️  No story arcs found, using NULL (testing only)")
            
            # Create sample data
            sample_data = {
                'story_arc_id': story_arc_id,
                'user_id': 'test-user-001',
                'clip_ids': ['clip-001', 'clip-002', 'clip-003'],
                'reference_clip_id': 'clip-001',
                'auto_offset_seconds': json.dumps({'clip-002': 0.5, 'clip-003': -0.3}),
                'auto_confidence': json.dumps({'clip-002': 0.85, 'clip-003': 0.72}),
                'manual_offset_seconds': json.dumps({'clip-002': 0.52, 'clip-003': -0.28}),
                'manual_adjustment_applied': True,
                'sync_method': 'synchformer',
                'camera_setup': json.dumps({
                    'clip-002': {'camera': 'Camera A', 'syncGroup': 'group-1'},
                    'clip-003': {'camera': 'Camera B', 'syncGroup': 'group-1'}
                }),
                'video_metadata': json.dumps({
                    'clip-002': {'duration': 60.0, 'trackId': 'track-1'},
                    'clip-003': {'duration': 60.0, 'trackId': 'track-1'}
                }),
                'original_avg_confidence': 0.785,
                'adjustment_magnitude': 0.02
            }
            
            cur.execute("""
                INSERT INTO sync_training_data (
                    story_arc_id, user_id, clip_ids, reference_clip_id,
                    auto_offset_seconds, auto_confidence, manual_offset_seconds,
                    manual_adjustment_applied, sync_method, camera_setup,
                    video_metadata, original_avg_confidence, adjustment_magnitude
                ) VALUES (
                    %(story_arc_id)s, %(user_id)s, %(clip_ids)s, %(reference_clip_id)s,
                    %(auto_offset_seconds)s::jsonb, %(auto_confidence)s::jsonb, %(manual_offset_seconds)s::jsonb,
                    %(manual_adjustment_applied)s, %(sync_method)s, %(camera_setup)s::jsonb,
                    %(video_metadata)s::jsonb, %(original_avg_confidence)s, %(adjustment_magnitude)s
                )
            """, sample_data)
            
            conn.commit()
            
            # Check new count
            cur.execute("SELECT COUNT(*) as count FROM sync_training_data")
            after_count = cur.fetchone()['count']
            
            print(f"✅ Sample training data created")
            print(f"   Before: {before_count} samples")
            print(f"   After: {after_count} samples")
            print(f"   Added: {after_count - before_count} sample(s)")
        
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Failed to create sample data: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_fine_tuning_with_minimal_data():
    """Test fine-tuning with minimal data (for testing)"""
    print("\n" + "="*60)
    print("TEST 6: Fine-Tuning (Minimal Data)")
    print("="*60)
    
    try:
        # Import using importlib to handle hyphenated filename
        import importlib.util
        fine_tune_path = os.path.join(script_dir, 'server', 'workers', 'fine-tune-sync-models.py')
        spec = importlib.util.spec_from_file_location("fine_tune_sync_models", fine_tune_path)
        fine_tune_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(fine_tune_module)
        SyncModelFineTuner = fine_tune_module.SyncModelFineTuner
        
        print("⚠️  This test requires at least 5 training samples")
        print("   Creating additional samples if needed...")
        
        # Create more samples if needed
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        db_url = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL')
        conn = psycopg2.connect(db_url)
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get an existing story_arc_id
            cur.execute("SELECT id FROM story_arc_projects LIMIT 1")
            story_arc = cur.fetchone()
            
            if story_arc:
                story_arc_id = story_arc['id']
            else:
                story_arc_id = None
                print("   ⚠️  No story arcs found, using NULL (testing only)")
            
            cur.execute("SELECT COUNT(*) as count FROM sync_training_data WHERE manual_adjustment_applied = true")
            count = cur.fetchone()['count']
            
            if count < 5:
                print(f"   Creating {5 - count} more samples...")
                for i in range(5 - count):
                    sample = {
                        'story_arc_id': story_arc_id,
                        'user_id': 'test-user-001',
                        'clip_ids': [f'clip-{i:03d}-a', f'clip-{i:03d}-b'],
                        'reference_clip_id': f'clip-{i:03d}-a',
                        'auto_offset_seconds': json.dumps({f'clip-{i:03d}-b': 0.1 * i}),
                        'auto_confidence': json.dumps({f'clip-{i:03d}-b': 0.8}),
                        'manual_offset_seconds': json.dumps({f'clip-{i:03d}-b': 0.1 * i + 0.01}),
                        'manual_adjustment_applied': True,
                        'sync_method': 'synchformer',
                        'camera_setup': json.dumps({}),
                        'video_metadata': json.dumps({}),
                        'original_avg_confidence': 0.8,
                        'adjustment_magnitude': 0.01
                    }
                    
                    cur.execute("""
                        INSERT INTO sync_training_data (
                            story_arc_id, user_id, clip_ids, reference_clip_id,
                            auto_offset_seconds, auto_confidence, manual_offset_seconds,
                            manual_adjustment_applied, sync_method, camera_setup,
                            video_metadata, original_avg_confidence, adjustment_magnitude
                        ) VALUES (
                            %(story_arc_id)s, %(user_id)s, %(clip_ids)s, %(reference_clip_id)s,
                            %(auto_offset_seconds)s::jsonb, %(auto_confidence)s::jsonb, %(manual_offset_seconds)s::jsonb,
                            %(manual_adjustment_applied)s, %(sync_method)s, %(camera_setup)s::jsonb,
                            %(video_metadata)s::jsonb, %(original_avg_confidence)s, %(adjustment_magnitude)s
                        )
                    """, sample)
                
                conn.commit()
                print(f"   ✅ Created {5 - count} additional samples")
        
        conn.close()
        
        # Now test fine-tuning with minimal requirements
        print("\n   Running fine-tuning with min_samples=5, epochs=2...")
        # Import using importlib
        import importlib.util
        fine_tune_path = os.path.join(script_dir, 'server', 'workers', 'fine-tune-sync-models.py')
        spec = importlib.util.spec_from_file_location("fine_tune_sync_models", fine_tune_path)
        fine_tune_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(fine_tune_module)
        SyncModelFineTuner = fine_tune_module.SyncModelFineTuner
        
        tuner = SyncModelFineTuner(model_type='synchformer')
        success = tuner.run_fine_tuning(min_samples=5, epochs=2)
        
        if success:
            print("✅ Fine-tuning completed successfully!")
            return True
        else:
            print("⚠️  Fine-tuning failed (may need more data)")
            return False
            
    except Exception as e:
        print(f"❌ Fine-tuning test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_r2_configuration():
    """Test R2 configuration (optional)"""
    print("\n" + "="*60)
    print("TEST 7: R2 Configuration (Optional)")
    print("="*60)
    
    account_id = os.getenv('CLOUDFLARE_R2_ACCOUNT_ID')
    access_key_id = os.getenv('CLOUDFLARE_R2_ACCESS_KEY_ID')
    secret_access_key = os.getenv('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
    bucket_name = os.getenv('CLOUDFLARE_R2_MODELS_BUCKET', 'ml-models')
    
    if all([account_id, access_key_id, secret_access_key]):
        print("✅ R2 credentials configured")
        print(f"   Account ID: {account_id[:10]}...")
        print(f"   Bucket: {bucket_name}")
        
        # Test boto3 import
        try:
            import boto3
            print("✅ boto3 available")
            return True
        except ImportError:
            print("⚠️  boto3 not installed (R2 upload will be skipped)")
            return False
    else:
        print("ℹ️  R2 not configured (optional - models will be saved locally)")
        print("   Set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY")
        return True  # Not a failure, just optional

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("FINE-TUNING SYSTEM TEST SUITE")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = []
    
    # Run tests
    results.append(("Database Connection", test_database_connection()))
    results.append(("Training Data Schema", test_training_data_schema()))
    results.append(("Fine-Tuning Module Import", test_fine_tuner_import()))
    results.append(("Model Loader Import", test_model_loader_import()))
    results.append(("Create Sample Data", test_create_sample_training_data()))
    results.append(("R2 Configuration", test_r2_configuration()))
    
    # Optional: Test fine-tuning (requires data)
    print("\n" + "="*60)
    print("OPTIONAL TEST: Fine-Tuning")
    print("="*60)
    response = input("Run fine-tuning test? (requires 5+ samples) [y/N]: ").strip().lower()
    if response == 'y':
        results.append(("Fine-Tuning", test_fine_tuning_with_minimal_data()))
    else:
        print("⏭️  Skipping fine-tuning test")
        results.append(("Fine-Tuning", None))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = 0
    failed = 0
    skipped = 0
    
    for name, result in results:
        if result is None:
            status = "⏭️  SKIPPED"
            skipped += 1
        elif result:
            status = "✅ PASSED"
            passed += 1
        else:
            status = "❌ FAILED"
            failed += 1
        
        print(f"{status}: {name}")
    
    print("\n" + "-"*60)
    print(f"Total: {len(results)} tests")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⏭️  Skipped: {skipped}")
    print("="*60)
    
    if failed == 0:
        print("\n🎉 All tests passed! Fine-tuning system is ready.")
        return 0
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please fix issues before using fine-tuning.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

