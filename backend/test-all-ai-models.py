#!/usr/bin/env python3
"""
Test All AI Models - Comprehensive Verification Script
Tests all 7 PyTorch models and audio enhancement dependencies
"""

import sys
import os
import json
import subprocess
from pathlib import Path

def print_header(text):
    print(f"\n{'='*80}")
    print(f"  {text}")
    print(f"{'='*80}\n")

def print_success(text):
    print(f"✅ {text}")

def print_error(text):
    print(f"❌ {text}")

def print_info(text):
    print(f"ℹ️  {text}")

def test_pytorch_installation():
    """Test PyTorch installation and device support"""
    print_header("1. Testing PyTorch Installation")
    
    try:
        import torch
        print_success(f"PyTorch version: {torch.__version__}")
        print_success(f"CUDA available: {torch.cuda.is_available()}")
        print_success(f"MPS available: {torch.backends.mps.is_available()}")
        
        device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
        print_success(f"Device: {device}")
        
        return True
    except Exception as e:
        print_error(f"PyTorch test failed: {e}")
        return False

def test_audio_libraries():
    """Test audio processing libraries"""
    print_header("2. Testing Audio Processing Libraries")
    
    libraries = {
        'librosa': 'Audio analysis',
        'soundfile': 'Audio I/O',
        'essentia': 'Music analysis',
        'numpy': 'Numerical computing',
        'scipy': 'Scientific computing',
    }
    
    all_passed = True
    for lib, description in libraries.items():
        try:
            __import__(lib)
            print_success(f"{lib}: {description}")
        except ImportError:
            print_error(f"{lib}: NOT INSTALLED")
            all_passed = False
    
    return all_passed

def test_pytorch_model(model_dir, model_script):
    """Test a single PyTorch model"""
    model_name = Path(model_dir).name
    print_info(f"Testing {model_name}...")
    
    try:
        result = subprocess.run(
            ['python3', model_script],
            cwd=model_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            print_success(f"{data['name']} - {data['status']}")
            print_info(f"  Device: {data['device']}, Parameters: {data.get('total_parameters', 'N/A')}")
            return True
        else:
            print_error(f"{model_name} failed: {result.stderr}")
            return False
    except Exception as e:
        print_error(f"{model_name} test failed: {e}")
        return False

def test_all_pytorch_models():
    """Test all 7 PyTorch models"""
    print_header("3. Testing All PyTorch Models")
    
    models_dir = Path(__file__).parent / 'models'
    
    models = [
        ('nafnet-enhancer', 'nafnet_load_model.py'),
        ('restormer-denoiser', 'restormer_load_model.py'),
        ('realesrgan-super-resolution', 'realesrgan_load_model.py'),
        ('gfpgan-face-restoration', 'gfpgan_load_model.py'),
        ('codeformer-face-restoration', 'codeformer_load_model.py'),
        ('hdrnet-tone-mapping', 'hdrnet_load_model.py'),
        ('unet-segmentation', 'unet_load_model.py'),
    ]
    
    results = []
    for model_dir, script in models:
        full_path = models_dir / model_dir
        script_path = full_path / script
        
        if full_path.exists() and script_path.exists():
            passed = test_pytorch_model(full_path, script_path)
            results.append((model_dir, passed))
        else:
            print_error(f"{model_dir}: Model directory or script not found")
            results.append((model_dir, False))
    
    return results

def test_backend_dependencies():
    """Test Node.js backend dependencies"""
    print_header("4. Testing Backend Dependencies")
    
    try:
        result = subprocess.run(
            ['npm', 'list', 'sharp', 'express', 'multer', 'formidable'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if 'sharp@' in result.stdout:
            print_success("sharp: Image processing library")
        if 'express@' in result.stdout:
            print_success("express: Web framework")
        if 'multer' in result.stdout or 'formidable@' in result.stdout:
            print_success("multer/formidable: File upload handling")
        
        return True
    except Exception as e:
        print_error(f"Backend dependencies test failed: {e}")
        return False

def main():
    print_header("CreatorHub AI Models - Comprehensive Test Suite")
    
    # Run all tests
    pytorch_ok = test_pytorch_installation()
    audio_ok = test_audio_libraries()
    model_results = test_all_pytorch_models()
    backend_ok = test_backend_dependencies()
    
    # Summary
    print_header("Test Summary")
    
    print(f"PyTorch Installation: {'✅ PASS' if pytorch_ok else '❌ FAIL'}")
    print(f"Audio Libraries: {'✅ PASS' if audio_ok else '❌ FAIL'}")
    print(f"Backend Dependencies: {'✅ PASS' if backend_ok else '❌ FAIL'}")
    
    print("\nPyTorch Models:")
    passed_models = sum(1 for _, passed in model_results if passed)
    total_models = len(model_results)
    
    for model_name, passed in model_results:
        status = '✅ PASS' if passed else '❌ FAIL'
        print(f"  {model_name}: {status}")
    
    print(f"\nTotal: {passed_models}/{total_models} models passed")
    
    # Final verdict
    all_passed = pytorch_ok and audio_ok and backend_ok and passed_models == total_models
    
    if all_passed:
        print_header("🎉 ALL TESTS PASSED! 🎉")
        print("All AI models and dependencies are properly installed and working!")
        return 0
    else:
        print_header("⚠️  SOME TESTS FAILED")
        print("Please review the errors above and install missing dependencies.")
        return 1

if __name__ == '__main__':
    sys.exit(main())

