/**
 * Simple Node.js test script for face detection
 * Run with: node test-face-detection-simple.js
 * 
 * Note: This requires the backend API to be running
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const VIDEO_PATH = '/Users/usmanqazi/creatorhub-backend/python_ml_service/training/test_outputs/facexformer/Martin4k.mp4';

async function extractFrameFromVideo(videoPath, timestamp = 0) {
  // This would require ffmpeg or similar
  // For now, we'll use a placeholder
  console.log(`📸 Extracting frame at ${timestamp}s from ${videoPath}...`);
  
  // In a real implementation, you'd use ffmpeg:
  // ffmpeg -i video.mp4 -ss 00:00:02.5 -vframes 1 frame.jpg
  
  return null; // Placeholder
}

async function testFaceDetection() {
  console.log('🎬 Starting face detection test...');
  console.log(`📹 Video: ${VIDEO_PATH}`);
  
  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`❌ Video file not found: ${VIDEO_PATH}`);
    console.log('💡 Make sure the file path is correct');
    return;
  }
  
  console.log('✅ Video file found');
  console.log('📊 File size:', (fs.statSync(VIDEO_PATH).size / 1024 / 1024).toFixed(2), 'MB');
  
  // Extract a frame (would need ffmpeg)
  console.log('\n📸 Extracting test frame...');
  console.log('⚠️  Note: Frame extraction requires ffmpeg or similar tool');
  console.log('💡 You can manually extract a frame and test it:');
  console.log(`   ffmpeg -i "${VIDEO_PATH}" -ss 00:00:02.5 -vframes 1 test_frame.jpg`);
  
  // If you have a frame file, test it:
  const framePath = path.join(path.dirname(VIDEO_PATH), 'test_frame.jpg');
  
  if (fs.existsSync(framePath)) {
    console.log(`\n✅ Found frame file: ${framePath}`);
    console.log('🔍 Testing with FaceXFormer API...');
    
    try {
      const formData = new FormData();
      formData.append('image', fs.createReadStream(framePath));
      formData.append('task', 'all');
      
      const response = await fetch('http://localhost:3000/api/face-analysis/analyze', {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log('\n✅ Analysis Results:');
      console.log('  Success:', result.success);
      console.log('  Task:', result.task);
      
      if (result.results?.landmarks) {
        console.log(`  ✅ Landmarks: ${result.results.landmarks.length} points detected`);
      }
      
      if (result.results?.headpose) {
        const { pitch, yaw, roll } = result.results.headpose;
        console.log(`  ✅ Head pose: pitch=${pitch.toFixed(1)}°, yaw=${yaw.toFixed(1)}°, roll=${roll.toFixed(1)}°`);
      }
      
      if (result.results?.parsing) {
        console.log('  ✅ Face parsing mask available');
      }
      
      if (result.results?.attributes) {
        console.log(`  ✅ Attributes: ${result.results.attributes.length} detected`);
      }
      
      console.log('\n📊 Full result:', JSON.stringify(result, null, 2));
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.log('\n💡 Make sure:');
      console.log('   1. Backend server is running on port 3000');
      console.log('   2. FaceXFormer service is properly configured');
      console.log('   3. You have extracted a frame from the video');
    }
  } else {
    console.log(`\n⚠️  Frame file not found: ${framePath}`);
    console.log('\n📝 To test:');
    console.log('   1. Extract a frame from the video:');
    console.log(`      ffmpeg -i "${VIDEO_PATH}" -ss 00:00:02.5 -vframes 1 "${framePath}"`);
    console.log('   2. Run this script again');
  }
}

// Run the test
testFaceDetection().catch(console.error);
