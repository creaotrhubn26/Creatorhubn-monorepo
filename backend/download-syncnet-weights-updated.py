#!/usr/bin/env python3
"""
Download SyncNet model weights
Downloads sfd_face.pth and syncnet_v2.model from official sources
"""

import os
import sys
import urllib.request
from pathlib import Path
import ssl

# Create weights directory
weights_dir = Path(__file__).parent / "weights"
weights_dir.mkdir(exist_ok=True)

# Model URLs - Updated with actual download links from official SyncNet repository
MODEL_URLS = {
    "sfd_face.pth": "https://www.robots.ox.ac.uk/~vgg/software/lipsync/data/sfd_face.pth",
    "syncnet_v2.model": "https://www.robots.ox.ac.uk/~vgg/software/lipsync/data/syncnet_v2.model",
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
        
        # Create SSL context for HTTPS
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        # Download with progress
        def show_progress(block_num, block_size, total_size):
            downloaded = block_num * block_size
            percent = min(100, (downloaded / total_size) * 100) if total_size > 0 else 0
            print(f"\r   Progress: {percent:.1f}% ({downloaded / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB)", end='', flush=True)
        
        urllib.request.urlretrieve(url, filepath, reporthook=show_progress)
        print()  # New line after progress
        print(f"✅ {description} downloaded successfully")
        return True
    except Exception as e:
        print(f"\n❌ Failed to download {description}: {e}")
        print(f"   Please download manually from: {url}")
        return False

def main():
    print("📥 SyncNet Model Weights Downloader")
    print("=" * 50)
    print()
    
    # Download sfd_face.pth
    sfd_path = weights_dir / "sfd_face.pth"
    if sfd_path.exists():
        size = sfd_path.stat().st_size / (1024 * 1024)
        print(f"✅ sfd_face.pth already exists: {sfd_path} ({size:.1f} MB)")
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
        size = syncnet_path.stat().st_size / (1024 * 1024)
        print(f"✅ syncnet_v2.model already exists: {syncnet_path} ({size:.1f} MB)")
    else:
        download_file(
            MODEL_URLS["syncnet_v2.model"],
            syncnet_path,
            "syncnet_v2.model (SyncNet Model)"
        )
    
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
    
    if sfd_path.exists() and syncnet_path.exists():
        print("✅ All SyncNet model weights downloaded successfully!")
        print()
        print("💡 Next steps:")
        print("   1. Test SyncNet import:")
        print("      python3 -c \"from syncnet_python import SyncNetInstance; print('SyncNet available!')\"")
        print("   2. Update video-sync-worker.py to use the weights")
    else:
        print("⚠️  Some model weights are missing.")
        print("   Please download manually if automatic download failed:")
        print("   - sfd_face.pth: https://github.com/1adrianb/face-alignment/releases/download/v1.1.0/s3fd-619a316812.pth")
        print("   - syncnet_v2.model: https://www.robots.ox.ac.uk/~vgg/software/lipsync/data/syncnet_v2.model")

if __name__ == "__main__":
    main()

