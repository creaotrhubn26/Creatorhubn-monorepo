#!/usr/bin/env python3
"""
Audio Quality Comparison Tool
Compares original vs processed audio and shows metrics
"""

import sys
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from pathlib import Path

def analyze_audio(file_path: str) -> dict:
    """Analyze audio file and return metrics"""
    
    # Load audio
    data, rate = sf.read(file_path)
    
    # Create loudness meter
    meter = pyln.Meter(rate)
    
    # Measure loudness
    loudness = meter.integrated_loudness(data)
    
    # Measure peak
    peak = np.max(np.abs(data))
    peak_db = 20 * np.log10(peak) if peak > 0 else -np.inf
    
    # Measure RMS
    rms = np.sqrt(np.mean(data**2))
    rms_db = 20 * np.log10(rms) if rms > 0 else -np.inf
    
    # Measure dynamic range
    loudness_range = meter.integrated_loudness(data)
    
    # File info
    duration = len(data) / rate
    
    return {
        "file": Path(file_path).name,
        "duration": duration,
        "sample_rate": rate,
        "channels": 1 if data.ndim == 1 else data.shape[1],
        "loudness_lufs": loudness,
        "peak_db": peak_db,
        "rms_db": rms_db,
        "dynamic_range": loudness_range,
    }

def compare_files(original: str, processed: str):
    """Compare original and processed audio files"""
    
    print("🎵 Audio Quality Comparison")
    print("=" * 60)
    print()
    
    # Analyze both files
    print("📊 Analyzing original audio...")
    original_metrics = analyze_audio(original)
    
    print("📊 Analyzing processed audio...")
    processed_metrics = analyze_audio(processed)
    
    print()
    print("=" * 60)
    print("COMPARISON RESULTS")
    print("=" * 60)
    print()
    
    # Original
    print("📁 ORIGINAL:")
    print(f"  File: {original_metrics['file']}")
    print(f"  Duration: {original_metrics['duration']:.2f}s")
    print(f"  Sample Rate: {original_metrics['sample_rate']} Hz")
    print(f"  Channels: {original_metrics['channels']}")
    print(f"  Loudness: {original_metrics['loudness_lufs']:.1f} LUFS")
    print(f"  Peak: {original_metrics['peak_db']:.1f} dB")
    print(f"  RMS: {original_metrics['rms_db']:.1f} dB")
    print()
    
    # Processed
    print("✨ PROCESSED:")
    print(f"  File: {processed_metrics['file']}")
    print(f"  Duration: {processed_metrics['duration']:.2f}s")
    print(f"  Sample Rate: {processed_metrics['sample_rate']} Hz")
    print(f"  Channels: {processed_metrics['channels']}")
    print(f"  Loudness: {processed_metrics['loudness_lufs']:.1f} LUFS")
    print(f"  Peak: {processed_metrics['peak_db']:.1f} dB")
    print(f"  RMS: {processed_metrics['rms_db']:.1f} dB")
    print()
    
    # Changes
    print("📈 CHANGES:")
    loudness_change = processed_metrics['loudness_lufs'] - original_metrics['loudness_lufs']
    peak_change = processed_metrics['peak_db'] - original_metrics['peak_db']
    rms_change = processed_metrics['rms_db'] - original_metrics['rms_db']
    
    print(f"  Loudness: {loudness_change:+.1f} LUFS")
    print(f"  Peak: {peak_change:+.1f} dB")
    print(f"  RMS: {rms_change:+.1f} dB")
    print()
    
    # Broadcast compliance check
    print("=" * 60)
    print("BROADCAST COMPLIANCE CHECK")
    print("=" * 60)
    print()
    
    standards = {
        "Podcast (Apple/Spotify)": -16.0,
        "YouTube/TikTok": -14.0,
        "Broadcast TV (EBU R128)": -23.0,
        "Netflix": -27.0,
        "Audible/ACX": -18.0,
    }
    
    for standard, target in standards.items():
        diff = abs(processed_metrics['loudness_lufs'] - target)
        if diff < 0.5:
            status = "✅ COMPLIANT"
        elif diff < 1.0:
            status = "⚠️  CLOSE"
        else:
            status = "❌ NOT COMPLIANT"
        
        print(f"  {standard:30s} ({target:+.1f} LUFS): {status} (diff: {diff:.1f} LUFS)")
    
    print()
    print("=" * 60)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 compare-audio-quality.py <original.wav> <processed.wav>")
        sys.exit(1)
    
    original = sys.argv[1]
    processed = sys.argv[2]
    
    if not Path(original).exists():
        print(f"❌ Original file not found: {original}")
        sys.exit(1)
    
    if not Path(processed).exists():
        print(f"❌ Processed file not found: {processed}")
        sys.exit(1)
    
    compare_files(original, processed)

