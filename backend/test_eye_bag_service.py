#!/usr/bin/env python3
"""Test script to check eye bag removal service"""
import sys
import requests
import json

def test_health():
    """Test health endpoint"""
    try:
        response = requests.get('http://localhost:8000/api/eye-bag-removal/health', timeout=5)
        print(f"✅ Health check: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        print("❌ Service not running on port 8000")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_main_health():
    """Test main service health"""
    try:
        response = requests.get('http://localhost:8000/health', timeout=5)
        print(f"✅ Main service: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        print("❌ Main service not running")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == '__main__':
    print("🔍 Testing Eye Bag Removal Service...\n")
    
    print("1. Testing main service health...")
    main_ok = test_main_health()
    print()
    
    print("2. Testing eye bag removal service health...")
    eye_bag_ok = test_health()
    print()
    
    if main_ok and eye_bag_ok:
        print("✅ All services are running!")
    else:
        print("❌ Some services are not available")
        sys.exit(1)

