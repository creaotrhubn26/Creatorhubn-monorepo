#!/usr/bin/env python3
"""
Generate Photorealistic Lighting Modifiers using Hyper3D API
Creates ultra high-quality 3D models with visible screws, bolts, and realistic materials
"""

import os
import time
import requests
import json
from pathlib import Path

# API Configuration
API_KEY = "dWWeys2CJ2eEhnWYvfCLIktXL5GPRoBUYSxiUUOFYI96APODV9iyDXL2ZEx5ldbN"
ENDPOINT = "https://api.hyper3d.com/api/v2/rodin"
STATUS_ENDPOINT = "https://api.hyper3d.com/api/v2/status"
DOWNLOAD_ENDPOINT = "https://api.hyper3d.com/api/v2/download"

# Output directory
BASE_DIR = Path(__file__).parent.parent / "public" / "models" / "modifiers"

# Lighting Modifier Prompts - Ultra detailed for photorealistic results
MODIFIER_PROMPTS = [
    {
        "id": "beauty-dish",
        "name": "Beauty Dish",
        "prompt": "Professional Profoto beauty dish 55cm, silver parabolic reflector with visible center deflector plate, aluminum construction with visible mounting screws around rim, Bowens mount with hex bolts, studio lighting modifier, product photography, white background, ultra detailed, 8K, photorealistic",
        "tier": "Gen-2",  # Latest generation with highest quality
        "dimensions": {"diameter": 0.50, "depth": 0.22},
        "mount_type": "bowens",
        "material": "aluminum",
        "finish": "silver"
    },
    {
        "id": "softbox",
        "name": "Softbox 80x120cm",
        "prompt": "Professional rectangular softbox 80x120cm, white diffusion fabric front panel, black exterior fabric walls, visible aluminum frame rods at corners with metal joints and Phillips head screws, speedring mount with visible bolts, studio lighting equipment, product photography, white background, ultra detailed, 8K, photorealistic",
        "tier": "Gen-2",
        "dimensions": {"width": 0.80, "height": 1.20, "depth": 0.40},
        "mount_type": "bowens",
        "material": "fabric",
        "finish": "white_diffusion"
    },
    {
        "id": "stripbox",
        "name": "Stripbox 30x180cm",
        "prompt": "Professional narrow stripbox 30x180cm, tall rectangular shape, white diffusion panel, black fabric exterior, visible aluminum support rods with metal brackets and screws, speedring mount, studio lighting modifier, product photography, white background, ultra detailed, 8K, photorealistic",
        "tier": "Gen-2",
        "dimensions": {"width": 0.30, "height": 1.80, "depth": 0.30},
        "mount_type": "bowens",
        "material": "fabric",
        "finish": "white_diffusion"
    },
    {
        "id": "octabox",
        "name": "Octabox 120cm",
        "prompt": "Professional octagonal softbox 120cm diameter, eight-sided shape with white interior diffusion, black exterior fabric, visible aluminum frame rods at all 8 corners with metal joints and visible screws, octagonal speedring mount with bolts, studio lighting equipment, product photography, white background, ultra detailed, 8K, photorealistic",
        "tier": "Gen-2",
        "dimensions": {"diameter": 1.20, "depth": 0.40},
        "mount_type": "bowens",
        "material": "fabric",
        "finish": "white_diffusion"
    },
    {
        "id": "reflector",
        "name": "Standard Reflector",
        "prompt": "Professional standard reflector 18cm, small parabolic cone shape, silver aluminum interior, protective honeycomb grid with visible metal rings and radial wires, Bowens mount ring with visible hex bolts and Phillips screws, studio lighting modifier, product photography, white background, ultra detailed, 8K, photorealistic",
        "tier": "Gen-2",
        "dimensions": {"diameter": 0.18, "depth": 0.12},
        "mount_type": "bowens",
        "material": "aluminum",
        "finish": "silver"
    }
]

def generate_3d_model(prompt, tier="Detail", quality="high"):
    """Generate 3D model using Hyper3D API"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "prompt": prompt,
        "tier": tier,  # Standard for high quality
        "quality": quality,
        "geometry_file_format": "glb",
        "material": "PBR"  # Physically Based Rendering materials
    }

    print(f"  📤 Sending request...")

    try:
        response = requests.post(ENDPOINT, headers=headers, json=data)

        if response.status_code != 201 and response.status_code != 200:
            print(f"  ❌ Error: {response.status_code} - {response.text}")
            return None, None

        result = response.json()
        uuid = result.get("uuid")
        sub_key = result.get("jobs", {}).get("subscription_key")
        
        print(f"  ✅ Request accepted (UUID: {uuid[:12]}...)")
        return uuid, sub_key
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        return None, None

def check_status(subscription_key):
    """Check generation status

    Returns: dict with structure:
    {
        "error": "OK" or error code,
        "jobs": [
            {"uuid": "...", "status": "Waiting|Generating|Done|Failed"}
        ]
    }
    """
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "subscription_key": subscription_key
    }

    try:
        response = requests.post(STATUS_ENDPOINT, headers=headers, json=data)

        if response.status_code != 200 and response.status_code != 201:
            return None

        return response.json()
    except Exception as e:
        print(f"  ⚠️  Status check error: {e}")
        return None

def download_result(uuid, subscription_key, output_path):
    """Download generated 3D model"""
    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }
    
    params = {
        "uuid": uuid,
        "subscription_key": subscription_key
    }
    
    response = requests.get(DOWNLOAD_ENDPOINT, headers=headers, params=params)
    
    if response.status_code != 200:
        print(f"  ❌ Download failed: {response.status_code}")
        return False
    
    # Save the GLB file
    with open(output_path, 'wb') as f:
        f.write(response.content)
    
    print(f"  ✅ Downloaded: {output_path.name}")
    return True

def main():
    print("\n" + "="*70)
    print("🎨 HYPER3D PHOTOREALISTIC MODIFIER GENERATOR")
    print("="*70)
    print(f"API Endpoint: {ENDPOINT}")
    print(f"Output Directory: {BASE_DIR}")
    print(f"Quality Tier: Gen-2 (Latest Generation - Highest Quality)")
    print(f"Total Modifiers: {len(MODIFIER_PROMPTS)}")
    print("="*70 + "\n")
    
    results = []
    
    for i, modifier in enumerate(MODIFIER_PROMPTS, 1):
        print(f"[{i}/{len(MODIFIER_PROMPTS)}] 🔨 {modifier['name']}")
        print(f"  📝 Prompt: {modifier['prompt'][:80]}...")
        
        # Create output directory
        output_dir = BASE_DIR / modifier['id']
        output_dir.mkdir(parents=True, exist_ok=True)

        # Generate 3D model
        uuid, sub_key = generate_3d_model(modifier['prompt'], tier=modifier['tier'])

        if not uuid:
            print(f"  ❌ Failed to generate\n")
            results.append({"name": modifier['name'], "status": "failed"})
            continue

        # Wait for completion
        print(f"  ⏳ Generating (this may take 60-120 seconds for Gen-2 tier)...")
        max_wait = 600  # 10 minutes max for Detail tier (increased from 5)
        waited = 0
        last_status = None

        while waited < max_wait:
            time.sleep(10)  # Check every 10 seconds
            waited += 10

            status_response = check_status(sub_key)
            if not status_response:
                continue

            # Check for API errors
            error = status_response.get("error")
            if error and error != "OK":
                print(f"  ❌ API Error: {error}")
                results.append({"name": modifier['name'], "status": "api_error", "error": error})
                break

            # Get job status from jobs array
            jobs = status_response.get("jobs", [])
            if not jobs:
                continue

            # Find our job by UUID
            job = None
            for j in jobs:
                if j.get("uuid") == uuid:
                    job = j
                    break

            if not job:
                continue

            state = job.get("status")  # "Waiting", "Generating", "Done", "Failed"

            # Only print if status changed
            if state != last_status:
                print(f"  ⏳ Status: {state} ({waited}s elapsed)")
                last_status = state

            if state == "Done":
                # Download GLB file
                glb_path = output_dir / f"{modifier['id']}.glb"

                if download_result(uuid, sub_key, glb_path):
                    print(f"  🎉 Complete! Saved to {modifier['id']}/")
                    results.append({
                        "name": modifier['name'],
                        "status": "success",
                        "file": str(glb_path.relative_to(BASE_DIR.parent.parent))
                    })
                else:
                    results.append({"name": modifier['name'], "status": "download_failed"})
                break
            elif state == "Failed":
                print(f"  ❌ Generation failed")
                results.append({"name": modifier['name'], "status": "generation_failed"})
                break
        else:
            print(f"  ⏰ Timeout after {max_wait}s")
            results.append({"name": modifier['name'], "status": "timeout"})

        print()

    # Summary
    print("="*70)
    print("📊 GENERATION SUMMARY")
    print("="*70)

    successful = [r for r in results if r['status'] == 'success']
    failed = [r for r in results if r['status'] != 'success']

    print(f"\n✅ Successful: {len(successful)}/{len(MODIFIER_PROMPTS)}")
    for r in successful:
        print(f"   • {r['name']}")

    if failed:
        print(f"\n❌ Failed: {len(failed)}/{len(MODIFIER_PROMPTS)}")
        for r in failed:
            print(f"   • {r['name']} ({r['status']})")

    print("\n" + "="*70)
    print("🎉 GENERATION COMPLETE!")
    print("="*70)
    print(f"\n📁 Output: {BASE_DIR}")
    print("\n💡 Next steps:")
    print("   1. Check the generated GLB files in public/models/modifiers/")
    print("   2. Load them in the Virtual Studio to verify quality")
    print("   3. Generate thumbnails and icons if needed")
    print()

if __name__ == "__main__":
    main()


