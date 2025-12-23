#!/usr/bin/env python3
"""
PyTorch Inference Server for Hybrid AI Pipeline
Handles heavy AI processing with PyTorch/Lightning models
"""

import json
import sys
import os
import time
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from PIL import Image
import io
import base64
import argparse
from typing import Dict, Any

class RestormerModel(nn.Module):
    """Simplified Restormer model for denoising"""
    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(3, 64, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, padding=1),
            nn.ReLU(inplace=True),
        )
        self.decoder = nn.Sequential(
            nn.Conv2d(64, 64, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 3, padding=1),
        )
    
    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return torch.clamp(decoded, 0, 1)

class NAFNetModel(nn.Module):
    """Simplified NAFNet model for enhancement"""
    def __init__(self):
        super().__init__()
        self.network = nn.Sequential(
            nn.Conv2d(3, 32, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 32, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 32, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 3, padding=1),
        )
    
    def forward(self, x):
        return torch.clamp(self.network(x), 0, 1)

class PyTorchInferenceServer:
    def __init__(self, device='cpu', precision='fp16'):
        self.device = torch.device(device)
        self.precision = precision
        
        # Load models
        self.models = {
            'restormer': RestormerModel().to(self.device),
            'nafnet': NAFNetModel().to(self.device),
      }
        
        # Set precision
        if precision == 'fp16' and self.device.type == 'cuda':
            for model in self.models.values():
                model.half()
        
        # Set to eval mode
        for model in self.models.values():
            model.eval()
        
        print(f"✅ PyTorch server ready on {device} with {precision} precision")
    
    def preprocess_image(self, image_data: bytes) -> torch.Tensor:
        """Preprocess image for PyTorch"""
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        transform = transforms.Compose([
            transforms.Resize((512, 512)),
            transforms.ToTensor(),
        ])
        return transform(image).unsqueeze(0).to(self.device)
    
    def postprocess_image(self, tensor: torch.Tensor) -> bytes:
        """Convert tensor back to image bytes"""
        # Convert to PIL
        tensor = tensor.squeeze(0).cpu()
        if tensor.dtype == torch.float16:
            tensor = tensor.float()
        
        # Clamp values
        tensor = torch.clamp(tensor, 0, 1)
        
        # Convert to PIL
        transform = transforms.ToPILImage()
        image = transform(tensor)
        
        # Convert to bytes
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=95)
        return buffer.getvalue()
    
    def process_image(self, model_name: str, image_data: bytes) -> Dict[str, Any]:
        """Process image with specified model"""
        start_time = time.time()
        
        try:
            # Preprocess
            input_tensor = self.preprocess_image(image_data)
            
            # Process with model
            with torch.no_grad():
                if self.precision == 'fp16' and self.device.type == 'cuda':
                    input_tensor = input_tensor.half()
                
                output_tensor = self.models[model_name](input_tensor)
                
                if self.precision == 'fp16' and self.device.type == 'cuda':
                    output_tensor = output_tensor.float()
            
            # Postprocess
            output_data = self.postprocess_image(output_tensor)
            
            processing_time = (time.time() - start_time) * 1000  # ms
            memory_usage = torch.cuda.memory_allocated() / 1024 / 1024 if self.device.type == 'cuda' else 0
            
            return {
                'success': True,
                'output_data': base64.b64encode(output_data).decode(),
                'processing_time': processing_time,
                'memory_usage': memory_usage,
                'framework': 'pytorch'
          }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'processing_time': (time.time() - start_time) * 1000,
                'framework': 'pytorch'
          }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--device', default='cpu', choices=['cpu', 'cuda', 'mps'])
    parser.add_argument('--precision', default='fp16', choices=['fp32', 'fp16', 'bf16'])
    args = parser.parse_args()
    
    # Initialize server
    server = PyTorchInferenceServer(args.device, args.precision)
    
    print("🚀 PyTorch inference server started")
    print("📡 Ready to receive requests...")
    
    # Main processing loop
    try:
        while True:
            line = input()
            if not line:
                continue
                
            try:
                request = json.loads(line)
                response = server.process_image(
                    request['model_name'],
                    base64.b64decode(request['image_data'])
                )
                print(json.dumps(response))
                sys.stdout.flush()
            except Exception as e:
                error_response = {
                    'success': False,
                    'error': str(e),
                    'framework': 'pytorch'
              }
                print(json.dumps(error_response))
                sys.stdout.flush()
                
    except KeyboardInterrupt:
        print("🛑 Shutting down PyTorch server...")
    except Exception as e:
        print(f"❌ Server error: {e}")

if __name__ == "__main__":
    main()
