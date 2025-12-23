#!/usr/bin/env python3
"""
Download SyncNet model weights
Downloads sfd_face.pth and syncnet_v2.model from official sources
"""

import os
import sys
import urllib.request
from pathlib import Path

# Create weights directory
weights_dir = Path(__file__).parent / "weights"
weights_dir.mkdir(exist_ok=True)

# Model URLs (these may need to be updated with actual URLs)
# Check https://github.com/joonson/syncnet_python for official links
MODEL_URLS = {
    "sfd_face.pth": "https://github.com/1adrianb/face-alignment/releases/download/v1.1.0/s3fd-619a316812.pth",
    "syncnet_v2.model": None,  # This needs to be found from the syncnet repository
}

def download_file(url: str, filepath: Path, description: str):
    """Download a file with progress"""
    if url is None:
        print(f"⚠️  {description}: URL not available")
        print(f"   Please download manually and place in: {filepath}")
        return False
    
    try:
        print(f"⬇️  Downloading {description}...")
        print(f"   URL: {url}")
        print(f"   Destination: {filepath}")
        
        urllib.request.urlretrieve(url, filepath)
        print(f"✅ {description} downloaded successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to download {description}: {e}")
        print(f"   Please download manually from: {url}")
        return False

def main():
    print("📥 SyncNet Model Weights Downloader")
    print("=" * 50)
    print()
    
    # Download sfd_face.pth
    sfd_path = weights_dir / "sfd_face.pth"
    if sfd_path.exists():
        print(f"✅ sfd_face.pth already exists: {sfd_path}")
    else:
        download_file(
            MODEL_URLS["sfd_face.pth"],
            sfd_path,
            "sfd_face.pth (Face Detection Model)"
        )
    
    print()
    
    # Download syncnet_v2.model
    syncnet_path = weights_dir / "syncnet_v2.model"
    if syncnet_path.exists():
        print(f"✅ syncnet_v2.model already exists: {syncnet_path}")
    else:
        if MODEL_URLS["syncnet_v2.model"]:
            download_file(
                MODEL_URLS["syncnet_v2.model"],
                syncnet_path,
                "syncnet_v2.model (SyncNet Model)"
            )
        else:
            print("⚠️  syncnet_v2.model: URL not configured")
            print("   Please download from:")
            print("   https://github.com/joonson/syncnet_python")
            print(f"   And place in: {syncnet_path}")
    
    print()
    print("=" * 50)
    print("📋 Summary:")
    
    if sfd_path.exists():
        size = sfd_path.stat().st_size / (1024 * 1024)
        print(f"   ✅ sfd_face.pth ({size:.1f} MB)")
    else:
        print(f"   ❌ sfd_face.pth (missing)")
    
    if syncnet_path.exists():
        size = syncnet_path.stat().st_size / (1024 * 1024)
        print(f"   ✅ syncnet_v2.model ({size:.1f} MB)")
    else:
        print(f"   ❌ syncnet_v2.model (missing)")
    
    print()
    print("💡 If any files are missing, download them manually:")
    print("   https://github.com/joonson/syncnet_python")

if __name__ == "__main__":
    main()

