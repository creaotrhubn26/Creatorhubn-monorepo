#!/usr/bin/env node

/**
 * Google OAuth Token Regeneration Script
 *
 * This script helps you regenerate expired OAuth refresh tokens for Google APIs.
 * It will open a browser window for you to authenticate with Google and generate
 * a new refresh token that can be used for GSC and GA4 APIs.
 */

import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import { exec } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly', // Google Search Console
  'https://www.googleapis.com/auth/analytics.readonly',  // Google Analytics
];

const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

async function main() {
  console.log('🔐 Google OAuth Token Regeneration');
  console.log('==================================\n');

  // Get client credentials from ADC_JSON
  let clientId, clientSecret;
  
  if (process.env.ADC_JSON) {
    try {
      const adcCredentials = JSON.parse(process.env.ADC_JSON);
      clientId = adcCredentials.client_id;
      clientSecret = adcCredentials.client_secret;
      console.log('✅ Using client credentials from ADC_JSON');
    } catch (e) {
      console.error('❌ Failed to parse ADC_JSON:', e.message);
    }
  }

  // Fallback to environment variables
  if (!clientId || !clientSecret) {
    clientId = process.env.GOOGLE_CLIENT_ID;
    clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    console.log('✅ Using client credentials from environment variables');
  }

  if (!clientId || !clientSecret) {
    console.error('❌ Error: Missing GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    console.error('   Please set these in your .env file or ADC_JSON');
    process.exit(1);
  }

  console.log(`\n📋 Client ID: ${clientId.substring(0, 20)}...`);
  console.log(`📋 Scopes: ${SCOPES.join(', ')}\n`);

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  // Generate the authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent screen to get refresh token
  });

  console.log('🌐 Opening browser for authentication...\n');
  console.log('If the browser doesn\'t open automatically, visit this URL:');
  console.log(authUrl);
  console.log('');

  // Open browser (macOS)
  exec(`open "${authUrl}"`);

  // Start local server to receive the callback
  const server = http.createServer(async (req, res) => {
    if (req.url.indexOf('/oauth2callback') > -1) {
      const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
      const code = qs.get('code');

      res.end('✅ Authentication successful! You can close this window and return to the terminal.');

      server.close();

      console.log('\n✅ Authorization code received!');
      console.log('🔄 Exchanging code for tokens...\n');

      try {
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('✅ Tokens received successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 NEW REFRESH TOKEN:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(tokens.refresh_token);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        console.log('📋 NEXT STEPS:\n');
        console.log('1. Update your .env file with the new refresh token:');
        console.log('   GOOGLE_WORKSPACE_REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('');
        console.log('2. Update ADC_JSON with the new refresh token:');
        const adcJson = {
          "account": "",
          "client_id": clientId,
          "client_secret": clientSecret,
          "refresh_token": tokens.refresh_token,
          "type": "authorized_user",
          "universe_domain": "googleapis.com"
        };
        console.log('   ADC_JSON=' + JSON.stringify(adcJson));
        console.log('');
        console.log('3. Restart your server');
        console.log('');
        console.log('✅ Done! Your new tokens are ready to use.');
        
        process.exit(0);
      } catch (error) {
        console.error('❌ Error exchanging code for tokens:', error.message);
        process.exit(1);
      }
    }
  });

  server.listen(3000, () => {
    console.log('🔄 Waiting for authentication callback on http://localhost:3000...\n');
  });
}

main().catch(console.error);

