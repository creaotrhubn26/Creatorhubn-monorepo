/**
 * Test Face Detection on Video File
 * 
 * Standalone test script for face detection worker
 * Tests on: Martin4k.mp4
 */

import { faceDetectionWorker, type FaceDetectionProgress } from './services/face-detection-worker';

// Test video file path (needs to be accessible from browser)
const TEST_VIDEO_PATH = '/api/test-video/Martin4k.mp4'; // You'll need to serve this file

async function testFaceDetection() {
  console.log('🧪 Starting face detection test on Martin4k.mp4...');
  
  // Create a test clip object
  const testClip = {
    id: 'test_martin4k',
    sourceFile: TEST_VIDEO_PATH,
    duration: 10, // Approximate duration - will be adjusted
  };
  
  // Progress callback
  const onProgress = (progress: FaceDetectionProgress) => {
    console.log(`📊 Progress: ${progress.processed}/${progress.total} (${Math.round((progress.processed / progress.total) * 100)}%)`);
    
    if (progress.current) {
      console.log(`   Currently processing: ${progress.current}`);
    }
    
    const withFaces = progress.results.filter(r => r.hasFace).length;
    const withoutFaces = progress.results.filter(r => !r.hasFace).length;
    
    console.log(`   Results: ${withFaces} with faces, ${withoutFaces} without faces`);
    
    if (progress.errors.length > 0) {
      console.log(`   Errors: ${progress.errors.length}`);
      progress.errors.forEach(err => {
        console.log(`     - ${err.clipId}: ${err.error}`);
      });
    }
  };
  
  try {
    // Process the clip
    const results = await faceDetectionWorker.processClips(
      [testClip],
      {
        batchSize: 1,
        onProgress,
        sampleFrames: 4, // Sample more frames for better detection
      }
    );
    
    // Print results
    console.log('\n✅ Face Detection Test Complete!');
    console.log('='.repeat(50));
    
    results.forEach(result => {
      console.log(`\nClip: ${result.clipId}`);
      console.log(`  Has Face: ${result.hasFace ? '✅ YES' : '❌ NO'}`);
      console.log(`  Face Count: ${result.faceCount}`);
      console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`  Timestamp: ${result.timestamp.toFixed(2)}s`);
      
      if (result.analysis) {
        console.log(`  Analysis Details:`);
        if (result.analysis.results.landmarks) {
          console.log(`    - Landmarks: ${result.analysis.results.landmarks.length} points`);
        }
        if (result.analysis.results.headpose) {
          const hp = result.analysis.results.headpose;
          console.log(`    - Head Pose: pitch=${hp.pitch.toFixed(2)}°, yaw=${hp.yaw.toFixed(2)}°, roll=${hp.roll.toFixed(2)}°`);
        }
        if (result.analysis.results.parsing) {
          console.log(`    - Face Parsing: ✅ Available`);
        }
        if (result.analysis.results.attributes) {
          console.log(`    - Attributes: ${result.analysis.results.attributes.length} detected`);
        }
      }
      
      if (result.error) {
        console.log(`  ❌ Error: ${result.error}`);
      }
    });
    
    console.log('\n' + '='.repeat(50));
    
    return results;
  } catch (error: any) {
    console.error('❌ Face detection test failed: ', error);
    throw error;
  }
}

// Export for use in browser console or test file
if (typeof window !=='undefined') {
  (window as any).testFaceDetection = testFaceDetection;
}

export { testFaceDetection };
