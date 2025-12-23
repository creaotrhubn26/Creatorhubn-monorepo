#!/usr/bin/env python3
"""
Start Python ML Service and wait for it to be ready
Then run portrait enhancement
"""
import subprocess
import time
import sys
import requests
from pathlib import Path

def start_service():
    """Start the Python ML service"""
    print("🚀 Starting Python ML Service...")
    
    service_dir = Path("/Users/usmanqazi/creatorhub-backend/python_ml_service")
    log_file = Path("/tmp/python_ml_service.log")
    
    # Start service in background
    with open(log_file, "w") as log:
        process = subprocess.Popen(
            ["python", "main.py"],
            cwd=str(service_dir),
            stdout=log,
            stderr=subprocess.STDOUT
        )
    
    # Save PID
    pid_file = Path("/tmp/python_ml_service.pid")
    pid_file.write_text(str(process.pid))
    print(f"✅ Service started (PID: {process.pid})")
    
    # Wait for service to be ready
    print("⏳ Waiting for service to initialize...")
    for i in range(30):  # Wait up to 30 seconds
        time.sleep(1)
        try:
            response = requests.get("http://localhost:8000/health", timeout=2)
            if response.status_code == 200:
                print("✅ Service is ready!")
                return True
        except:
            pass
        if i % 5 == 0:
            print(f"   Still waiting... ({i+1}/30)")
    
    print("⚠️ Service may not be fully ready, but continuing...")
    return False

def check_eye_bag_service():
    """Check if eye bag removal service is available"""
    try:
        response = requests.get("http://localhost:8000/api/eye-bag-removal/health", timeout=2)
        if response.status_code == 200:
            health = response.json()
            print("✅ Eye Bag Removal Service Health:")
            print(f"   - Status: {health.get('status')}")
            print(f"   - Models: {health.get('models', {})}")
            return True
    except Exception as e:
        print(f"⚠️ Eye bag service not ready: {e}")
        print("   Will use GLSL fallback")
    return False

def run_portrait_enhancement():
    """Run the portrait enhancement script"""
    print("\n🎨 Running portrait enhancement with eye bag removal...\n")
    
    script_dir = Path("/Users/usmanqazi/creatorhub-backend")
    script_path = script_dir / "scripts" / "enhance-portrait.ts"
    
    # Run the TypeScript script
    result = subprocess.run(
        ["npx", "tsx", str(script_path)],
        cwd=str(script_dir),
        capture_output=False
    )
    
    return result.returncode == 0

if __name__ == "__main__":
    try:
        # Start service
        start_service()
        
        # Check eye bag service
        print()
        check_eye_bag_service()
        
        # Run enhancement
        print()
        success = run_portrait_enhancement()
        
        if success:
            print("\n✅ Complete!")
            print("📁 Enhanced portrait saved to:")
            print("   /Users/usmanqazi/creatorhub-frontend/client/src/assets/daniel-qazi_enhanced.jpg")
        else:
            print("\n⚠️ Enhancement completed with warnings")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

