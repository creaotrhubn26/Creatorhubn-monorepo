#!/usr/bin/env node

import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const FULL_GOOGLE_CHAT_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/chat.messages.reactions.create',
];
const MINIMAL_GOOGLE_CHAT_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
];

const shouldOpenBrowser = !process.argv.includes('--no-open');
const useMinimalScopes = process.argv.includes('--minimal');

function readString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function loadCredentialsFromFile(credentialsPath) {
  if (!credentialsPath || !fs.existsSync(credentialsPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const payload = raw.installed ?? raw.web ?? null;
    if (!payload) {
      return null;
    }

    const clientId = readString(payload.client_id);
    const clientSecret = readString(payload.client_secret);
    const redirectUris = Array.isArray(payload.redirect_uris)
      ? payload.redirect_uris.map(readString).filter(Boolean)
      : [];

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      clientId,
      clientSecret,
      redirectUri: redirectUris[0] ?? null,
      source: credentialsPath,
      clientType: raw.installed ? 'installed' : 'web',
    };
  } catch {
    return null;
  }
}

async function main() {
  const credentialsPath = readString(process.env.GOOGLE_OAUTH_CREDENTIALS_PATH)
    ?? path.join(process.cwd(), 'credentials.json');
  const fileCredentials = loadCredentialsFromFile(credentialsPath);
  const envRedirectUri = readString(process.env.ROLE_ROOM_GOOGLE_REDIRECT_URI ?? process.env.GOOGLE_REDIRECT_URI);
  const clientId = fileCredentials?.clientId
    ?? readString(process.env.ROLE_ROOM_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID);
  const clientSecret = fileCredentials?.clientSecret
    ?? readString(process.env.ROLE_ROOM_GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET);
  const redirectUri =
    envRedirectUri
    ?? (fileCredentials?.clientType === 'installed' ? 'http://127.0.0.1:5050/oauth2callback' : null)
    ?? fileCredentials?.redirectUri
    ?? 'http://localhost:5050/oauth2callback';

  if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET or ROLE_ROOM_GOOGLE_CLIENT_ID/ROLE_ROOM_GOOGLE_CLIENT_SECRET.');
    process.exit(1);
  }

  const parsedRedirectUri = new URL(redirectUri);
  const callbackPort = parsedRedirectUri.port
    ? Number(parsedRedirectUri.port)
    : parsedRedirectUri.protocol === 'https:'
      ? 443
      : 80;
  const callbackPath = parsedRedirectUri.pathname || '/oauth2callback';

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const requestedScopes = useMinimalScopes ? MINIMAL_GOOGLE_CHAT_SCOPES : FULL_GOOGLE_CHAT_SCOPES;
  const { codeVerifier, codeChallenge } = await oauth2Client.generateCodeVerifierAsync();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [...requestedScopes],
    prompt: 'consent',
    include_granted_scopes: true,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  console.log('Google Chat OAuth reauth');
  console.log('');
  if (fileCredentials) {
    console.log(`Credentials source: ${fileCredentials.source} (${fileCredentials.clientType})`);
  } else {
    console.log('Credentials source: environment variables');
  }
  console.log(`Scope mode: ${useMinimalScopes ? 'minimal' : 'full'}`);
  console.log(`Redirect URI: ${redirectUri}`);
  console.log(`Scopes (${requestedScopes.length}):`);
  for (const scope of requestedScopes) {
    console.log(`- ${scope}`);
  }
  console.log('');
  console.log('Open this URL if the browser does not open automatically:');
  console.log(authUrl);
  console.log('');

  if (shouldOpenBrowser) {
    exec(`open "${authUrl}"`);
  }

  const server = http.createServer(async (req, res) => {
    if (!req.url || !req.url.includes(callbackPath)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const qs = new url.URL(req.url, redirectUri).searchParams;
    const code = qs.get('code');
    const error = qs.get('error');

    if (error) {
      res.end(`OAuth failed: ${error}`);
      server.close();
      process.exit(1);
    }

    if (!code) {
      res.end('Missing authorization code.');
      server.close();
      process.exit(1);
    }

    res.end('Google OAuth completed. Return to the terminal.');
    server.close();

    try {
      const { tokens } = await oauth2Client.getToken({
        code,
        codeVerifier,
      });
      const grantedScopes = typeof tokens.scope === 'string'
        ? tokens.scope.split(' ').filter(Boolean)
        : [];

      console.log('');
      console.log('New refresh token:');
      console.log(tokens.refresh_token ?? '(Google did not return a new refresh token)');
      console.log('');
      console.log('Update backend/.env with:');
      if (tokens.refresh_token) {
        console.log(`GOOGLE_WORKSPACE_REFRESH_TOKEN=${tokens.refresh_token}`);
      }
      console.log('');
      console.log('Granted scopes:');
      for (const scope of grantedScopes) {
        console.log(`- ${scope}`);
      }
      console.log('');

      if (!tokens.refresh_token) {
        console.log('Google did not return a new refresh token. Remove the existing app grant or force a new OAuth consent, then retry.');
        process.exit(1);
      }

      process.exit(0);
    } catch (tokenError) {
      console.error(tokenError instanceof Error ? tokenError.message : String(tokenError));
      process.exit(1);
    }
  });

  server.listen(callbackPort, () => {
    console.log(`Waiting for callback on ${redirectUri}`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
