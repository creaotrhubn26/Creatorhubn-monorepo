/**
 * Test script for Face Detection Worker
 * 
 * Run this to test face detection on a specific video file
 * Usage: Import and call testFaceDetectionOnVideo(videoPath)
 */

import { faceDetectionWorker, type FaceDetectionResult } from './face-detection-worker';
import { faceXFormerService } from '../components/creatorhubvirtualstudio/src/services/FaceXFormerService';

/**
 * Test face detection on a single video file
 */
export async function testFaceDetectionOnVideo(
  videoPath: string,
  options: {
    onProgress?: (message: string) => void;
    sampleTimestamps?: number[]; // Custom timestamps to sample
  } = {}
): Promise<FaceDetectionResult> {
  const { onProgress, sampleTimestamps } = options;
  
  onProgress?.('🎬 Starting face detection test...');
  
  // Create a test clip object
  const testClip = {
    id: 'test_clip_' + Date.now(),
    sourceFile: videoPath,
    duration: 10, // Will be detected from video
  };
  
  onProgress?.('📹 Loading video metadata...');
  
  // Get video duration
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = videoPath;
    
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => {
        testClip.duration = video.duration || 10;
        onProgress?.(`✅ Video loaded: ${testClip.duration.toFixed(2)}s duration`);
        URL.revokeObjectURL(video.src);
        resolve();
      });
      
      video.addEventListener('error', (e) => {
        reject(new Error(`Failed to load video: ${(e.target as HTMLVideoElement)?.error?.message || 'Unknown error'}`));
      });
    });
  } catch (error: any) {
    throw new Error(`Video metadata error: ${error.message}`);
  }
  
  onProgress?.('🔍 Processing clip with face detection worker...');
  
  // Use the face detection worker
  const results = await faceDetectionWorker.processClips(
    [testClip],
    {
      batchSize: 1,
      onProgress: (progress) => {
        if (progress.current) {
          onProgress?.(`⏳ Processing: ${progress.processed}/${progress.total}`);
        }
      },
    }
  );
  
  if (results.length === 0) {
    throw new Error('No results returned from face detection worker');
  }
  
  const result = results[0];
  
  if (result.error) {
    onProgress?.(`❌ Error: ${result.error}`);
  } else if (result.hasFace) {
    onProgress?.(`✅ Face detected! Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    onProgress?.(`   Face count: ${result.faceCount}`);
    onProgress?.(`   Analyzed at: ${result.timestamp.toFixed(2)}s`);
    
    if (result.analysis?.results.landmarks) {
      onProgress?.(`   Landmarks: ${result.analysis.results.landmarks.length} points`);
    }
    
    if (result.analysis?.results.headpose) {
      const { pitch, yaw, roll } = result.analysis.results.headpose;
      onProgress?.(`   Head pose: pitch=${pitch.toFixed(1)}°, yaw=${yaw.toFixed(1)}°, roll=${roll.toFixed(1)}°`);
    }
  } else {
    onProgress?.(`⚠️ No face detected in video`);
  }
  
  return result;
}

/**
 * Test direct FaceXFormer analysis on a video frame
 */
export async function testDirectFaceAnalysis(
  videoPath: string,
  timestamp: number = 0
): Promise<void> {
  console.log('🎬 Testing direct FaceXFormer analysis...');
  console.log(`📹 Video: ${videoPath}`);
  console.log(`⏱️  Timestamp: ${timestamp}s`);
  
  // Extract frame
  console.log('📸 Extracting frame...');
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'metadata';
  video.src = videoPath;
  video.currentTime = timestamp;
  
  await new Promise<void>((resolve, reject) => {
    video.addEventListener('seeked', async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(async (blob) => {
          if (!blob) {
            throw new Error('Could not create blob');
          }
          
          const file = new File([blob], 'test_frame.jpg', { type: 'image/jpeg' });
          console.log('✅ Frame extracted, analyzing with FaceXFormer...');
          
          // Analyze with FaceXFormer
          const result = await faceXFormerService.analyzeAll(file);
          
          console.log('📊 Analysis Results: ');
          console.log('  Success:', result.success);
          console.log('  Task:', result.task);
          
          if (result.results.landmarks) {
            console.log(`  ✅ Landmarks detected: ${result.results.landmarks.length} points`);
            console.log('  First few landmarks:', result.results.landmarks.slice(0, 3));
          } else {
            console.log('  ⚠️  No landmarks detected');
          }
          
          if (result.results.parsing) {
            console.log('  ✅ Face parsing mask available');
          }
          
          if (result.results.headpose) {
            const { pitch, yaw, roll } = result.results.headpose;
            console.log(`  ✅ Head pose: pitch=${pitch.toFixed(1)}°, yaw=${yaw.toFixed(1)}°, roll=${roll.toFixed(1)}°`);
          }
          
          if (result.results.attributes) {
            console.log(`  ✅ Attributes: ${result.results.attributes.length} detected`);
          }
          
          URL.revokeObjectURL(video.src);
          resolve();
        }, 'image/jpeg', 0.9);
      } catch (error: any) {
        URL.revokeObjectURL(video.src);
        reject(error);
      }
    }, { once: true });
    
    video.addEventListener('error', (e) => {
      URL.revokeObjectURL(video.src);
      reject(new Error(`Video error: ${(e.target as HTMLVideoElement)?.error?.message ||'Unknown'}`));
    });
    
    video.load();
  });
}

/**
 * Browser console test function
 * Call this from browser console after importing
 */
export function runTestInBrowser(videoPath: string) {
  console.log('🧪 Starting face detection test...');
  console.log(`📹 Video: ${videoPath}`);
  
  testFaceDetectionOnVideo(videoPath, {
    onProgress: (message) => {
      console.log(message);
    },
  })
    .then((result) => {
      console.log('✅ Test complete!');
      console.log('📊 Final result:', result);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
    });
}
