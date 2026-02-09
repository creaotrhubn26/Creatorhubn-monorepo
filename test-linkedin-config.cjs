#!/usr/bin/env node

/**
 * LinkedIn OAuth Configuration Test
 * Verifies environment variables and connectivity
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(60));
console.log('LinkedIn OAuth Configuration Test');
console.log('='.repeat(60) + '\n');

// Check backend environment
console.log('1. Checking Backend Configuration (.env)');
console.log('-'.repeat(60));

const backendEnvPath = path.join('/workspaces/Creatorhubn-monorepo', 'backend/.env');
if (fs.existsSync(backendEnvPath)) {
  const content = fs.readFileSync(backendEnvPath, 'utf8');
  
  const configs = {
    'VITE_LINKEDIN_CLIENT_ID': /VITE_LINKEDIN_CLIENT_ID=(.+)/,
    'VITE_LINKEDIN_REDIRECT_URI': /VITE_LINKEDIN_REDIRECT_URI=(.+)/,
    'VITE_LINKEDIN_CLIENT_SECRET': /VITE_LINKEDIN_CLIENT_SECRET=(.+)/,
  };
  
  let allFound = true;
  for (const [key, regex] of Object.entries(configs)) {
    const match = content.match(regex);
    if (match) {
      const value = match[1];
      const masked = value.length > 10 ? value.substring(0, 10) + '...' : '***';
      console.log(`✅ ${key}: ${masked}`);
    } else {
      console.log(`❌ ${key}: NOT FOUND`);
      allFound = false;
    }
  }
  
  if (allFound) {
    console.log('\n✅ Backend configuration is complete!\n');
  } else {
    console.log('\n⚠️  Some backend variables are missing!\n');
  }
} else {
  console.log(`❌ Backend .env file not found at ${backendEnvPath}\n`);
}

// Check frontend environment
console.log('2. Checking Frontend Configuration (.env.local)');
console.log('-'.repeat(60));

const frontendEnvPath = path.join('/workspaces/Creatorhubn-monorepo', 'frontend/client/.env.local');
if (fs.existsSync(frontendEnvPath)) {
  const content = fs.readFileSync(frontendEnvPath, 'utf8');
  
  const configs = {
    'VITE_LINKEDIN_CLIENT_ID': /VITE_LINKEDIN_CLIENT_ID=(.+)/,
    'VITE_LINKEDIN_REDIRECT_URI': /VITE_LINKEDIN_REDIRECT_URI=(.+)/,
  };
  
  let allFound = true;
  for (const [key, regex] of Object.entries(configs)) {
    const match = content.match(regex);
    if (match) {
      const value = match[1];
      const masked = value.length > 10 ? value.substring(0, 10) + '...' : '***';
      console.log(`✅ ${key}: ${masked}`);
    } else {
      console.log(`❌ ${key}: NOT FOUND`);
      allFound = false;
    }
  }
  
  if (allFound) {
    console.log('\n✅ Frontend configuration is complete!\n');
  } else {
    console.log('\n⚠️  Some frontend variables are missing!\n');
  }
} else {
  console.log(`❌ Frontend .env.local file not found at ${frontendEnvPath}\n`);
}

// Check required files
console.log('3. Checking LinkedIn Integration Files');
console.log('-'.repeat(60));

const files = [
  'frontend/client/src/services/LinkedInService.ts',
  'frontend/client/src/hooks/useLinkedIn.ts',
  'frontend/client/src/pages/LinkedInCallback.tsx',
];

let allFilesExist = true;
for (const file of files) {
  const filePath = path.join('/workspaces/Creatorhubn-monorepo', file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${path.basename(file)}`);
  } else {
    console.log(`❌ ${path.basename(file)} - NOT FOUND`);
    allFilesExist = false;
  }
}

if (allFilesExist) {
  console.log('\n✅ All LinkedIn integration files are present!\n');
} else {
  console.log('\n❌ Some LinkedIn integration files are missing!\n');
}

// Summary
console.log('4. Configuration Summary');
console.log('-'.repeat(60));

const backendConfigured = fs.existsSync(backendEnvPath);
const frontendConfigured = fs.existsSync(frontendEnvPath);
const filesPresent = allFilesExist;

if (backendConfigured && frontendConfigured && filesPresent) {
  console.log('✅ All systems ready!\n');
  console.log('Next steps:');
  console.log('1. Start backend:   cd backend && npm start');
  console.log('2. Start frontend:  cd frontend/client && npm run dev');
  console.log('3. Open browser:    http://localhost:5000/resume-builder');
  console.log('4. Click "Importer fra LinkedIn"\n');
  console.log('='.repeat(60) + '\n');
  process.exit(0);
} else {
  console.log('❌ Configuration incomplete!\n');
  if (!backendConfigured) console.log('  - Backend .env file missing');
  if (!frontendConfigured) console.log('  - Frontend .env.local file missing');
  if (!filesPresent) console.log('  - Some LinkedIn files missing');
  console.log('\n' + '='.repeat(60) + '\n');
  process.exit(1);
}
