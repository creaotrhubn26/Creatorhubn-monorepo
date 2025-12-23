#!/usr/bin/env python3
"""
Generate all Virtual Studio assets using Hyper3D API
This script generates equipment thumbnails and pose previews
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

# Output directories
BASE_DIR = Path(__file__).parent.parent.parent.parent.parent / "public"
THUMBNAILS_DIR = BASE_DIR / "thumbnails"
EQUIPMENT_DIR = THUMBNAILS_DIR / "equipment"
POSES_DIR = THUMBNAILS_DIR / "poses"

# Create directories
EQUIPMENT_DIR.mkdir(parents=True, exist_ok=True)
POSES_DIR.mkdir(parents=True, exist_ok=True)

# Equipment prompts (text-to-3D)
EQUIPMENT_PROMPTS = [
    # Studio Lights (10)
    {
        "name": "profoto_d2_500",
        "prompt": "Professional Profoto D2 500 studio strobe flash light, blue housing, product photography, white background, 4K",
        "category": "lights"
    },
    {
        "name": "godox_ad600",
        "prompt": "Godox AD600 Pro portable studio flash, orange accents, professional photography equipment, white background, 4K",
        "category": "lights"
    },
    {
        "name": "aputure_300d",
        "prompt": "Aputure 300D II LED continuous light, red housing, professional video lighting, white background, 4K",
        "category": "lights"
    },
    {
        "name": "profoto_b10",
        "prompt": "Profoto B10 Plus compact flash head, blue and black, professional studio light, white background, 4K",
        "category": "lights"
    },
    {
        "name": "godox_sl60",
        "prompt": "Godox SL-60W LED video light, black housing with orange accents, continuous lighting, white background, 4K",
        "category": "lights"
    },
    {
        "name": "broncolor_siros",
        "prompt": "Broncolor Siros 800 L studio flash, silver and black, professional strobe light, white background, 4K",
        "category": "lights"
    },
    {
        "name": "elinchrom_elc500",
        "prompt": "Elinchrom ELC 500 studio flash, black housing, professional photography light, white background, 4K",
        "category": "lights"
    },
    {
        "name": "nanlite_forza_300",
        "prompt": "Nanlite Forza 300 LED spotlight, black and orange, professional video light, white background, 4K",
        "category": "lights"
    },
    {
        "name": "profoto_a1x",
        "prompt": "Profoto A1X on-camera flash, blue housing, round head, professional speedlight, white background, 4K",
        "category": "lights"
    },
    {
        "name": "godox_v1",
        "prompt": "Godox V1 round head flash, black and orange, professional speedlight, white background, 4K",
        "category": "lights"
    },
    
    # Light Modifiers (8)
    {
        "name": "softbox_60x90",
        "prompt": "Professional rectangular softbox 60x90cm, white diffusion fabric, black exterior, studio lighting modifier, white background, 4K",
        "category": "modifiers"
    },
    {
        "name": "octabox_120",
        "prompt": "Octagonal softbox 120cm, white interior, black exterior, professional photography modifier, white background, 4K",
        "category": "modifiers"
    },
    {
        "name": "beauty_dish_55",
        "prompt": "Beauty dish 55cm, silver interior, professional portrait lighting modifier, white background, 4K",
        "category": "modifiers"
    },
    {
        "name": "umbrella_white_105",
        "prompt": "White translucent photography umbrella 105cm, shoot-through diffuser, studio lighting, white background, 4K",
        "category": "modifiers"
    },
    {
        "name": "umbrella_silver_85",
        "prompt": "Silver reflective photography umbrella 85cm, studio lighting modifier, white background, 4K",
        "category": "modifiers"
    },
    {
        "name": "stripbox_30x120",
        "prompt": "Strip softbox 30x120cm, narrow rectangular light modifier, professional studio equipment, white background, 4K",
        "category": "modifiers"
    },
    {
        "name": "snoot_conical",
        "prompt": "Conical snoot light modifier, black metal, focused beam attachment, studio lighting, white background, 4K",
        "category": "modifiers"
    },
    {
        "name": "grid_honeycomb",
        "prompt": "Honeycomb grid light modifier, black metal grid pattern, directional lighting control, white background, 4K",
        "category": "modifiers"
    },
    
    # Cameras (5)
    {
        "name": "canon_eos_r5",
        "prompt": "Canon EOS R5 mirrorless camera body, black professional camera, product photography, white background, 4K",
        "category": "cameras"
    },
    {
        "name": "sony_a7r_v",
        "prompt": "Sony Alpha 7R V mirrorless camera, black professional camera body, product photography, white background, 4K",
        "category": "cameras"
    },
    {
        "name": "nikon_z9",
        "prompt": "Nikon Z9 flagship mirrorless camera, black professional camera body, product photography, white background, 4K",
        "category": "cameras"
    },
    {
        "name": "fujifilm_gfx100",
        "prompt": "Fujifilm GFX 100 medium format camera, black professional camera body, product photography, white background, 4K",
        "category": "cameras"
    },
    {
        "name": "hasselblad_x2d",
        "prompt": "Hasselblad X2D 100C medium format camera, silver and black, professional camera body, white background, 4K",
        "category": "cameras"
    },
    
    # Lenses (5)
    {
        "name": "canon_rf_24_70",
        "prompt": "Canon RF 24-70mm f/2.8 L IS USM lens, black professional zoom lens, product photography, white background, 4K",
        "category": "lenses"
    },
    {
        "name": "sony_fe_85",
        "prompt": "Sony FE 85mm f/1.4 GM lens, black professional prime lens, product photography, white background, 4K",
        "category": "lenses"
    },
    {
        "name": "nikon_z_50",
        "prompt": "Nikon NIKKOR Z 50mm f/1.2 S lens, black professional prime lens, product photography, white background, 4K",
        "category": "lenses"
    },
    {
        "name": "sigma_art_35",
        "prompt": "Sigma 35mm f/1.4 DG HSM Art lens, black professional prime lens, product photography, white background, 4K",
        "category": "lenses"
    },
    {
        "name": "tamron_70_200",
        "prompt": "Tamron 70-200mm f/2.8 Di III VXD lens, black professional telephoto zoom lens, white background, 4K",
        "category": "lenses"
    },
]

# Pose prompts (text-to-3D with character)
POSE_PROMPTS = [
    {
        "name": "portrait_neutral",
        "prompt": "3D character model in neutral standing pose, arms at sides, professional portrait photography pose, gray background, 4K",
        "category": "poses"
    },
    {
        "name": "portrait_confident",
        "prompt": "3D character model in confident pose, hands on hips, professional portrait photography, gray background, 4K",
        "category": "poses"
    },
    {
        "name": "portrait_casual",
        "prompt": "3D character model in casual leaning pose, one hand in pocket, professional portrait, gray background, 4K",
        "category": "poses"
    },
    {
        "name": "portrait_sitting",
        "prompt": "3D character model sitting on stool, professional portrait photography pose, gray background, 4K",
        "category": "poses"
    },
]

def generate_3d_model(prompt, tier="Sketch", quality="medium"):
    """Generate 3D model using Hyper3D API"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "prompt": prompt,
        "tier": tier,  # Sketch is fastest (~20 seconds)
        "quality": quality,
        "geometry_file_format": "glb",
        "material": "PBR"
    }

    print(f"  Generating: {prompt[:60]}...")

    try:
        response = requests.post(ENDPOINT, headers=headers, json=data)

        if response.status_code != 201 and response.status_code != 200:
            print(f"  ❌ Error: {response.status_code} - {response.text}")
            return None, None

        result = response.json()
        print(f"  📝 Response: {json.dumps(result, indent=2)}")
        return result.get("uuid"), result.get("jobs", {}).get("subscription_key")
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        return None, None

def check_status(uuid, subscription_key):
    """Check generation status"""
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
            print(f"  ⚠️  Status check failed: {response.status_code} - {response.text}")
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
    
    # Save the file
    with open(output_path, 'wb') as f:
        f.write(response.content)
    
    print(f"  ✅ Downloaded: {output_path}")
    return True

def main():
    print("🎨 Virtual Studio Asset Generator")
    print("=" * 60)
    print(f"API Key: {API_KEY[:20]}...")
    print(f"Output: {THUMBNAILS_DIR}")
    print("=" * 60)
    
    all_prompts = EQUIPMENT_PROMPTS + POSE_PROMPTS
    total = len(all_prompts)
    
    print(f"\n📦 Generating {total} assets...")
    print(f"  - Equipment: {len(EQUIPMENT_PROMPTS)}")
    print(f"  - Poses: {len(POSE_PROMPTS)}")
    print()
    
    for i, item in enumerate(all_prompts, 1):
        print(f"[{i}/{total}] {item['name']}")
        
        # Generate 3D model
        uuid, sub_key = generate_3d_model(item['prompt'])
        
        if not uuid:
            print(f"  ❌ Failed to generate")
            continue
        
        # Wait for completion
        print(f"  ⏳ Waiting for generation (UUID: {uuid[:8]}...)...")
        max_wait = 120  # 2 minutes max
        waited = 0
        
        while waited < max_wait:
            time.sleep(5)
            waited += 5
            
            status = check_status(uuid, sub_key)
            if not status:
                continue
            
            state = status.get("status")
            progress = status.get("progress", 0)
            
            print(f"  ⏳ Status: {state} ({progress}%)")
            
            if state == "completed":
                # Download result
                output_dir = EQUIPMENT_DIR if item['category'] != 'poses' else POSES_DIR
                output_path = output_dir / f"{item['name']}.glb"
                
                if download_result(uuid, sub_key, output_path):
                    print(f"  ✅ Complete!")
                break
            elif state == "failed":
                print(f"  ❌ Generation failed")
                break
        
        print()
    
    print("=" * 60)
    print("✅ Asset generation complete!")
    print(f"📁 Equipment: {EQUIPMENT_DIR}")
    print(f"📁 Poses: {POSES_DIR}")

if __name__ == "__main__":
    main()

