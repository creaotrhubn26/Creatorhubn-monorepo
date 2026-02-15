#!/usr/bin/env python3
"""
Create mock data for Shot Planner scenes
Generates diverse scene setups for testing the 2D shot planner
"""

import sys
import os
import json
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from casting_service import get_db_connection

# =============================================================================
# Visualization Enhancement Helper
# =============================================================================

def enhance_scene_with_visualizations(scene):
    """
    Add visualization feature properties to existing scene data.
    This is ADDITIVE - won't break existing scenes without these properties.
    
    Features added:
    - Camera frustum visualization (FOV cones)
    - Motion path visualization (camera movement)
    - 180-degree safety line
    - Depth of field visualization
    - Measurement lines
    - Director and technical notes
    """
    
    # Scene-level visualization toggles (defaults to off for backward compatibility)
    scene.setdefault('showFrustums', True)      # Enable by default - looks cool!
    scene.setdefault('showMotionPaths', True)   # Show camera movement
    scene.setdefault('showMeasurements', False) # Off until user adds measurements
    scene.setdefault('show180Line', True)       # Show 180° safety line
    
    # Enhance cameras with focus/motion properties
    for camera in scene.get('cameras', []):
        # Calculate optimal focus distance based on focal length
        # Using real cinematography guidelines for subject distance
        focal_length = camera.get('focalLength', 50)
        
        if focal_length <= 14:
            # Ultra-wide (14mm and below)
            # Used for: Establishing shots, dramatic perspectives
            default_focus = 5.0
            default_dof = 8.0
        elif focal_length <= 24:
            # Wide angle (15-24mm)
            # Used for: Wide shots, group scenes, coverage
            default_focus = 4.0
            default_dof = 5.0
        elif focal_length <= 35:
            # Standard wide (25-35mm)
            # Used for: Medium wide shots, walk & talks
            default_focus = 3.5
            default_dof = 3.0
        elif focal_length <= 50:
            # Standard (36-50mm)
            # Used for: Medium shots, natural perspective
            default_focus = 2.5
            default_dof = 1.8
        elif focal_length <= 85:
            # Portrait (51-85mm)
            # Used for: Close-ups, flattering portraits
            default_focus = 1.8
            default_dof = 0.8
        elif focal_length <= 135:
            # Telephoto (86-135mm)
            # Used for: Tight close-ups, compression
            default_focus = 1.2
            default_dof = 0.4
        else:
            # Long telephoto (135mm+)
            # Used for: Extreme close-ups, distant subjects
            default_focus = 0.8
            default_dof = 0.2
        
        camera.setdefault('focusDistance', default_focus)
        camera.setdefault('depthOfField', default_dof)
        camera.setdefault('bladeCount', 8)
        camera.setdefault('motionPath', [])
    
    # Enhance shots with notes and measurements
    for shot in scene.get('shots', []):
        shot.setdefault('directorNotes', '')
        shot.setdefault('technicalNotes', '')
        shot.setdefault('measurementLines', [])
    
    return scene

# =============================================================================
# Mock Scenes
# =============================================================================

MOCK_SCENES = [
    {
        "id": "scene-safehouse-interior",
        "name": "Scene 12: The Safehouse",
        "location": "Abandoned warehouse - Interior",
        "width": 20,
        "height": 15,
        "pixelsPerMeter": 40,
        "showGrid": True,
        "gridSize": 1,
        "cameras": [
            {
                "id": "cam-1",
                "name": "Wide establishing",
                "x": 10,
                "y": 2,
                "rotation": 90,
                "focalLength": 24,
                "sensorSize": "Full Frame",
                "aspectRatio": "2.39:1",
                "color": "#4CAF50"
            },
            {
                "id": "cam-2",
                "name": "Close-up on hero",
                "x": 8,
                "y": 8,
                "rotation": 45,
                "focalLength": 85,
                "sensorSize": "Full Frame",
                "aspectRatio": "2.39:1",
                "color": "#2196F3"
            },
            {
                "id": "cam-3",
                "name": "Over shoulder",
                "x": 12,
                "y": 9,
                "rotation": 225,
                "focalLength": 50,
                "sensorSize": "Full Frame",
                "aspectRatio": "1.85:1",
                "color": "#FF9800"
            }
        ],
        "actors": [
            {
                "id": "actor-1",
                "name": "Hero (John)",
                "x": 10,
                "y": 8,
                "rotation": 90,
                "color": "#E91E63"
            },
            {
                "id": "actor-2",
                "name": "Villain (Marcus)",
                "x": 14,
                "y": 8.5,
                "rotation": 270,
                "color": "#9C27B0"
            },
            {
                "id": "actor-3",
                "name": "Sidekick (Sarah)",
                "x": 9,
                "y": 6,
                "rotation": 45,
                "color": "#00BCD4"
            }
        ],
        "props": [
            {
                "id": "prop-1",
                "name": "Table",
                "x": 11,
                "y": 8,
                "width": 2,
                "height": 1,
                "rotation": 0,
                "color": "#795548"
            },
            {
                "id": "prop-2",
                "name": "Chair 1",
                "x": 10,
                "y": 7,
                "width": 0.5,
                "height": 0.5,
                "rotation": 0,
                "color": "#607D8B"
            },
            {
                "id": "prop-3",
                "name": "Chair 2",
                "x": 13,
                "y": 7.5,
                "width": 0.5,
                "height": 0.5,
                "rotation": 180,
                "color": "#607D8B"
            },
            {
                "id": "prop-4",
                "name": "Weapon cache",
                "x": 16,
                "y": 3,
                "width": 1.5,
                "height": 1,
                "rotation": 0,
                "color": "#FF5722"
            }
        ],
        "shots": []
    },
    {
        "id": "scene-car-chase",
        "name": "Scene 23: Highway Chase",
        "location": "Highway - Exterior Day",
        "width": 40,
        "height": 12,
        "pixelsPerMeter": 30,
        "showGrid": True,
        "gridSize": 2,
        "cameras": [
            {
                "id": "cam-chase-1",
                "name": "Drone overhead",
                "x": 20,
                "y": 2,
                "rotation": 90,
                "focalLength": 18,
                "sensorSize": "Super 35",
                "aspectRatio": "2.39:1",
                "color": "#4CAF50"
            },
            {
                "id": "cam-chase-2",
                "name": "Car mount - hero vehicle",
                "x": 15,
                "y": 6,
                "rotation": 0,
                "focalLength": 35,
                "sensorSize": "Full Frame",
                "aspectRatio": "1.85:1",
                "color": "#2196F3"
            },
            {
                "id": "cam-chase-3",
                "name": "Pursuit angle",
                "x": 25,
                "y": 8,
                "rotation": 270,
                "focalLength": 70,
                "sensorSize": "Full Frame",
                "aspectRatio": "2.39:1",
                "color": "#FF9800"
            }
        ],
        "actors": [
            {
                "id": "actor-chase-1",
                "name": "Driver",
                "x": 15,
                "y": 6,
                "rotation": 0,
                "color": "#E91E63"
            }
        ],
        "props": [
            {
                "id": "prop-chase-1",
                "name": "Hero car",
                "x": 15,
                "y": 6,
                "width": 4.5,
                "height": 2,
                "rotation": 0,
                "color": "#000000"
            },
            {
                "id": "prop-chase-2",
                "name": "Pursuit vehicle 1",
                "x": 25,
                "y": 6.5,
                "width": 4.5,
                "height": 2,
                "rotation": 0,
                "color": "#424242"
            },
            {
                "id": "prop-chase-3",
                "name": "Pursuit vehicle 2",
                "x": 30,
                "y": 5.5,
                "width": 4.5,
                "height": 2,
                "rotation": 0,
                "color": "#616161"
            },
            {
                "id": "prop-chase-4",
                "name": "Roadblock",
                "x": 5,
                "y": 6,
                "width": 3,
                "height": 1.5,
                "rotation": 45,
                "color": "#FF5722"
            }
        ],
        "shots": []
    },
    {
        "id": "scene-bar-confrontation",
        "name": "Scene 8: Bar Confrontation",
        "location": "Dive Bar - Interior Night",
        "width": 18,
        "height": 12,
        "pixelsPerMeter": 50,
        "showGrid": True,
        "gridSize": 1,
        "cameras": [
            {
                "id": "cam-bar-1",
                "name": "Wide 2-shot",
                "x": 9,
                "y": 2,
                "rotation": 90,
                "focalLength": 35,
                "sensorSize": "Full Frame",
                "aspectRatio": "1.85:1",
                "color": "#4CAF50"
            },
            {
                "id": "cam-bar-2",
                "name": "Singles - Character A",
                "x": 6,
                "y": 7,
                "rotation": 45,
                "focalLength": 50,
                "sensorSize": "Full Frame",
                "aspectRatio": "1.85:1",
                "color": "#2196F3"
            },
            {
                "id": "cam-bar-3",
                "name": "Singles - Character B",
                "x": 11,
                "y": 6.5,
                "rotation": 225,
                "focalLength": 50,
                "sensorSize": "Full Frame",
                "aspectRatio": "1.85:1",
                "color": "#FF9800"
            },
            {
                "id": "cam-bar-4",
                "name": "Steadicam follow",
                "x": 14,
                "y": 8,
                "rotation": 180,
                "focalLength": 28,
                "sensorSize": "Full Frame",
                "aspectRatio": "2.39:1",
                "color": "#9C27B0"
            }
        ],
        "actors": [
            {
                "id": "actor-bar-1",
                "name": "Detective",
                "x": 7,
                "y": 7,
                "rotation": 90,
                "color": "#E91E63"
            },
            {
                "id": "actor-bar-2",
                "name": "Informant",
                "x": 10,
                "y": 7,
                "rotation": 270,
                "color": "#9C27B0"
            },
            {
                "id": "actor-bar-3",
                "name": "Bartender",
                "x": 9,
                "y": 10,
                "rotation": 180,
                "color": "#00BCD4"
            },
            {
                "id": "actor-bar-4",
                "name": "Background patron 1",
                "x": 3,
                "y": 4,
                "rotation": 45,
                "color": "#757575"
            },
            {
                "id": "actor-bar-5",
                "name": "Background patron 2",
                "x": 15,
                "y": 5,
                "rotation": 135,
                "color": "#757575"
            }
        ],
        "props": [
            {
                "id": "prop-bar-1",
                "name": "Bar counter",
                "x": 9,
                "y": 10,
                "width": 8,
                "height": 1,
                "rotation": 0,
                "color": "#795548"
            },
            {
                "id": "prop-bar-2",
                "name": "Table (detective)",
                "x": 8.5,
                "y": 7,
                "width": 1.2,
                "height": 0.8,
                "rotation": 0,
                "color": "#5D4037"
            },
            {
                "id": "prop-bar-3",
                "name": "Pool table",
                "x": 4,
                "y": 4,
                "width": 2.5,
                "height": 1.4,
                "rotation": 0,
                "color": "#1B5E20"
            },
            {
                "id": "prop-bar-4",
                "name": "Jukebox",
                "x": 16,
                "y": 3,
                "width": 1,
                "height": 0.6,
                "rotation": 0,
                "color": "#D32F2F"
            },
            {
                "id": "prop-bar-5",
                "name": "Booth seating",
                "x": 2,
                "y": 8,
                "width": 2,
                "height": 1.5,
                "rotation": 0,
                "color": "#4E342E"
            }
        ],
        "shots": []
    },
    {
        "id": "scene-rooftop-final",
        "name": "Scene 45: Rooftop Finale",
        "location": "Downtown Rooftop - Exterior Night",
        "width": 25,
        "height": 20,
        "pixelsPerMeter": 35,
        "showGrid": True,
        "gridSize": 2,
        "cameras": [
            {
                "id": "cam-roof-1",
                "name": "Crane up reveal",
                "x": 12.5,
                "y": 2,
                "rotation": 90,
                "focalLength": 32,
                "sensorSize": "Full Frame",
                "aspectRatio": "2.39:1",
                "color": "#4CAF50"
            },
            {
                "id": "cam-roof-2",
                "name": "Hero close-up",
                "x": 10,
                "y": 12,
                "rotation": 60,
                "focalLength": 85,
                "sensorSize": "Full Frame",
                "aspectRatio": "2.39:1",
                "color": "#2196F3"
            },
            {
                "id": "cam-roof-3",
                "name": "Villain POV",
                "x": 15,
                "y": 12,
                "rotation": 240,
                "focalLength": 40,
                "sensorSize": "Full Frame",
                "aspectRatio": "2.39:1",
                "color": "#FF9800"
            },
            {
                "id": "cam-roof-4",
                "name": "Helicopter aerial",
                "x": 8,
                "y": 8,
                "rotation": 135,
                "focalLength": 24,
                "sensorSize": "Super 35",
                "aspectRatio": "2.39:1",
                "color": "#9C27B0"
            }
        ],
        "actors": [
            {
                "id": "actor-roof-1",
                "name": "Hero",
                "x": 11,
                "y": 11,
                "rotation": 45,
                "color": "#E91E63"
            },
            {
                "id": "actor-roof-2",
                "name": "Main Villain",
                "x": 14,
                "y": 11.5,
                "rotation": 225,
                "color": "#9C27B0"
            },
            {
                "id": "actor-roof-3",
                "name": "Backup - team member 1",
                "x": 8,
                "y": 15,
                "rotation": 90,
                "color": "#00BCD4"
            },
            {
                "id": "actor-roof-4",
                "name": "Backup - team member 2",
                "x": 6,
                "y": 13,
                "rotation": 60,
                "color": "#00BCD4"
            }
        ],
        "props": [
            {
                "id": "prop-roof-1",
                "name": "HVAC unit 1",
                "x": 5,
                "y": 5,
                "width": 3,
                "height": 2.5,
                "rotation": 0,
                "color": "#607D8B"
            },
            {
                "id": "prop-roof-2",
                "name": "HVAC unit 2",
                "x": 18,
                "y": 7,
                "width": 2.5,
                "height": 2,
                "rotation": 0,
                "color": "#607D8B"
            },
            {
                "id": "prop-roof-3",
                "name": "Helicopter landing pad",
                "x": 12.5,
                "y": 16,
                "width": 6,
                "height": 6,
                "rotation": 0,
                "color": "#FFD54F"
            },
            {
                "id": "prop-roof-4",
                "name": "Access door",
                "x": 2,
                "y": 18,
                "width": 1.2,
                "height": 0.8,
                "rotation": 0,
                "color": "#D32F2F"
            },
            {
                "id": "prop-roof-5",
                "name": "Water tower",
                "x": 20,
                "y": 15,
                "width": 2,
                "height": 2,
                "rotation": 0,
                "color": "#5D4037"
            }
        ],
        "shots": []
    },
    {
        "id": "scene-office-heist",
        "name": "Scene 17: Corporate Office Heist",
        "location": "Executive Office - Interior Night",
        "width": 16,
        "height": 14,
        "pixelsPerMeter": 45,
        "showGrid": True,
        "gridSize": 1,
        "cameras": [
            {
                "id": "cam-office-1",
                "name": "Security cam POV",
                "x": 2,
                "y": 2,
                "rotation": 135,
                "focalLength": 16,
                "sensorSize": "Super 35",
                "aspectRatio": "16:9",
                "color": "#4CAF50"
            },
            {
                "id": "cam-office-2",
                "name": "Team leader medium",
                "x": 10,
                "y": 8,
                "rotation": 90,
                "focalLength": 50,
                "sensorSize": "Full Frame",
                "aspectRatio": "2.39:1",
                "color": "#2196F3"
            },
            {
                "id": "cam-office-3",
                "name": "Safe close-up",
                "x": 4,
                "y": 11,
                "rotation": 0,
                "focalLength": 100,
                "sensorSize": "Full Frame",
                "aspectRatio": "2.39:1",
                "color": "#FF9800"
            }
        ],
        "actors": [
            {
                "id": "actor-office-1",
                "name": "Team Leader",
                "x": 8,
                "y": 9,
                "rotation": 270,
                "color": "#E91E63"
            },
            {
                "id": "actor-office-2",
                "name": "Safe Cracker",
                "x": 3,
                "y": 11,
                "rotation": 90,
                "color": "#9C27B0"
            },
            {
                "id": "actor-office-3",
                "name": "Tech Specialist",
                "x": 12,
                "y": 4,
                "rotation": 180,
                "color": "#00BCD4"
            },
            {
                "id": "actor-office-4",
                "name": "Lookout",
                "x": 14,
                "y": 12,
                "rotation": 180,
                "color": "#FFC107"
            }
        ],
        "props": [
            {
                "id": "prop-office-1",
                "name": "Executive desk",
                "x": 8,
                "y": 10,
                "width": 2.5,
                "height": 1.2,
                "rotation": 0,
                "color": "#3E2723"
            },
            {
                "id": "prop-office-2",
                "name": "Wall safe",
                "x": 2,
                "y": 11,
                "width": 0.8,
                "height": 0.8,
                "rotation": 0,
                "color": "#37474F"
            },
            {
                "id": "prop-office-3",
                "name": "Computer terminal",
                "x": 12,
                "y": 4,
                "width": 1,
                "height": 0.6,
                "rotation": 0,
                "color": "#263238"
            },
            {
                "id": "prop-office-4",
                "name": "Conference table",
                "x": 8,
                "y": 5,
                "width": 4,
                "height": 2,
                "rotation": 0,
                "color": "#4E342E"
            },
            {
                "id": "prop-office-5",
                "name": "Bookshelf",
                "x": 15,
                "y": 10,
                "width": 0.5,
                "height": 3,
                "rotation": 0,
                "color": "#5D4037"
            }
        ],
        "shots": []
    }
]

# =============================================================================
# Apply Visualization Enhancements
# =============================================================================

# Enhance all scenes with visualization features
MOCK_SCENES = [enhance_scene_with_visualizations(scene) for scene in MOCK_SCENES]

# Add specific motion paths and measurements to make demos more interesting

# Safehouse: Add dolly push to cam-2
MOCK_SCENES[0]['cameras'][1]['motionPath'] = [
    {"x": 8, "y": 8},
    {"x": 9, "y": 8.5},
    {"x": 9.5, "y": 9}
]
MOCK_SCENES[0]['cameras'][1]['name'] = "Dolly push to hero"

# Safehouse: Add measurement between actors
MOCK_SCENES[0]['shots'] = [
    {
        "id": "shot-safehouse-1",
        "name": "Opening wide",
        "cameraId": "cam-1",
        "directorNotes": "Hold for 4 seconds - establish tension",
        "technicalNotes": "Soft key from stage right at 40%",
        "measurementLines": [
            {
                "id": "measure-1",
                "start": {"x": 10, "y": 8},
                "end": {"x": 14, "y": 8.5},
                "label": "4.5m"
            }
        ]
    }
]

# Chase: Add tracking camera motion
MOCK_SCENES[1]['cameras'][1]['motionPath'] = [
    {"x": 5, "y": 6},
    {"x": 10, "y": 6},
    {"x": 15, "y": 6},
    {"x": 20, "y": 7},
    {"x": 25, "y": 7}
]
MOCK_SCENES[1]['cameras'][1]['name'] = "Tracking shot following car"

# Bar: Add director notes
MOCK_SCENES[2]['shots'] = [
    {
        "id": "shot-bar-1",
        "name": "Wide 2-shot",
        "cameraId": "cam-bar-1",
        "directorNotes": "Hold until informant reaches for drink",
        "technicalNotes": "Practical neon signs at 60%, smoky atmosphere",
        "measurementLines": []
    }
]

# Rooftop: Add crane movement
MOCK_SCENES[3]['cameras'][0]['motionPath'] = [
    {"x": 12.5, "y": 2},
    {"x": 12.5, "y": 5},
    {"x": 12.5, "y": 8}
]
MOCK_SCENES[3]['cameras'][0]['name'] = "Crane up reveal"

# Office: Add measurements for heist planning
MOCK_SCENES[4]['shots'] = [
    {
        "id": "shot-office-1",
        "name": "Security POV",
        "cameraId": "cam-office-1",
        "directorNotes": "Static - shows security camera feed aesthetic",
        "technicalNotes": "Desaturated look, grain overlay, timecode visible",
        "measurementLines": [
            {
                "id": "measure-safe-distance",
                "start": {"x": 3, "y": 11},
                "end": {"x": 3, "y": 11.5},
                "label": "0.5m clearance"
            }
        ]
    }
]

# =============================================================================
# Database Insertion
# =============================================================================

def insert_mock_scenes():
    """Insert mock scenes into the database"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Clear existing mock data
        print("Clearing existing scenes...")
        cursor.execute("DELETE FROM shot_planner_scenes")
        
        # Insert mock scenes
        print(f"\nInserting {len(MOCK_SCENES)} mock scenes...")
        
        for scene in MOCK_SCENES:
            # Prepare scene data
            scene_data = {
                "width": scene["width"],
                "height": scene["height"],
                "pixelsPerMeter": scene["pixelsPerMeter"],
                "showGrid": scene["showGrid"],
                "gridSize": scene["gridSize"]
            }
            
            cursor.execute("""
                INSERT INTO shot_planner_scenes (
                    id, name, location, width, height, pixels_per_meter,
                    show_grid, grid_size, cameras, actors, props, shots,
                    scene_data, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
            """, (
                scene["id"],
                scene["name"],
                scene["location"],
                scene["width"],
                scene["height"],
                scene["pixelsPerMeter"],
                scene["showGrid"],
                scene["gridSize"],
                json.dumps(scene["cameras"]),
                json.dumps(scene["actors"]),
                json.dumps(scene["props"]),
                json.dumps(scene["shots"]),
                json.dumps(scene_data),
                datetime.now(),
                datetime.now()
            ))
            
            print(f"  ✓ {scene['name']}")
            print(f"    Location: {scene['location']}")
            print(f"    Cameras: {len(scene['cameras'])}, Actors: {len(scene['actors'])}, Props: {len(scene['props'])}")
        
        conn.commit()
        print(f"\n✅ Successfully created {len(MOCK_SCENES)} mock scenes!")
        print("\nScene IDs:")
        for scene in MOCK_SCENES:
            print(f"  - {scene['id']}: {scene['name']}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Shot Planner Mock Data Creator")
    print("=" * 60)
    insert_mock_scenes()
    print("\n" + "=" * 60)
    print("Mock data creation complete!")
    print("Open the shot planner to see the demo scenes.")
    print("=" * 60)
