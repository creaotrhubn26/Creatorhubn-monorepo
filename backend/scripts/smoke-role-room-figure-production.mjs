#!/usr/bin/env node

import crypto from 'node:crypto';
import sharp from 'sharp';

const bearer = (
  process.env.ROLE_ROOM_BEARER_TOKEN || process.env.RR_BEARER_TOKEN || ''
).trim();
const configuredBase = (
  process.env.ROLE_ROOM_POST_AGENT_BASE_URL ||
  process.env.RR_POST_AGENT_BASE_URL ||
  'https://theroleroom.com/api/post-agent'
).replace(/\/$/, '');
const endpoint = configuredBase.endsWith('/api/post-agent')
  ? `${configuredBase}/ai/generate-image`
  : `${configuredBase}/api/post-agent/ai/generate-image`;
const projectId = (process.env.ROLE_ROOM_SMOKE_PROJECT_ID || '').trim();

if (!bearer) {
  console.error('Mangler ROLE_ROOM_BEARER_TOKEN eller RR_BEARER_TOKEN.');
  process.exit(2);
}

function dataUrlBytes(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Provideren returnerte ikke en inline PNG.');
  return Buffer.from(match[1], 'base64');
}

async function assertTransparentPng(bytes, label) {
  const image = sharp(bytes, { failOn: 'error' });
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
  const alpha = stats.channels[3];
  if (metadata.format !== 'png') throw new Error(`${label}: forventet PNG.`);
  if ((metadata.width || 0) < 1024 || (metadata.height || 0) < 1024) {
    throw new Error(`${label}: oppløsningen er lavere enn 1024 px.`);
  }
  if (!metadata.hasAlpha || !alpha || alpha.min >= 255 || alpha.max <= 0) {
    throw new Error(`${label}: mangler målbar transparent bakgrunn.`);
  }
  return {
    width: metadata.width,
    height: metadata.height,
    alphaMin: alpha.min,
    alphaMax: alpha.max,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

async function generate(prompt, referenceImage, variantKey) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      options: {
        model: 'gpt-image-2',
        image_size: 'portrait_4_3',
        quality: 'high',
        background: 'transparent',
        output_format: 'png',
        audit_image: true,
        brand_primary: '#102A43',
        brand_accent: '#2CB1A6',
        ...(referenceImage ? { reference_image: referenceImage } : {}),
        ...(projectId
          ? {
              asset_context: {
                project_id: projectId,
                image_id: 'production-smoke-clinician',
                variant_key: variantKey,
              },
            }
          : {}),
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Role Room svarte HTTP ${response.status}: ${payload.error || 'ukjent feil'}`);
  }
  if (payload.model !== 'gpt-image-2') {
    const actualModel = String(payload.model || 'mangler');
    const actualProvider = String(payload.provider || 'mangler');
    throw new Error(
      `Feil produksjonsmodell: forventet gpt-image-2, fikk ${actualModel} (provider ${actualProvider}).`,
    );
  }
  if (!payload.visual_audit || payload.visual_audit.unavailable) {
    throw new Error('Strukturert visuell QA ble ikke gjennomført.');
  }
  if (projectId && !String(payload.asset_ref || '').startsWith(`mockup-cloud-file:${projectId}:`)) {
    throw new Error('Privat prosjektfil ble ikke lagret.');
  }
  return payload;
}

async function verifyPrivateAsset(assetRef, expectedHash) {
  if (!assetRef) return null;
  const parts = assetRef.split(':');
  const assetUrl = `${configuredBase.replace(/\/api\/post-agent$/, '')}/api/role-room/mockup-projects/${encodeURIComponent(parts[1])}/assets/${encodeURIComponent(parts[2])}?raw=1`;
  const response = await fetch(assetUrl, {
    headers: { Authorization: `Bearer ${bearer}` },
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Privat asset-lesing feilet med HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (hash !== expectedHash) throw new Error('Privat asset avviker fra generert payload.');
  return { bytes: bytes.length, sha256Match: true };
}

const master = await generate(
  'Original high-end cinematic 3D feature-animation clinician, full body, calm warm expression, neutral presentation pose, premium white medical coat with subtle navy and teal accents, anatomically correct hands, isolated subject, no text, no logo, transparent background.',
  null,
  'master-three-quarter',
);
const masterBytes = dataUrlBytes(master.image_url);
const masterPixels = await assertTransparentPng(masterBytes, 'master');
if (master.asset_hash !== masterPixels.sha256) throw new Error('Master-hash samsvarer ikke.');

const variant = await generate(
  'Keep exactly the same character identity, face, hair, outfit and proportions. Change only to a friendly presenting pose with one open hand, anatomically correct fingers, full body visible, isolated subject, no text, no logo, transparent background.',
  master.asset_ref || master.image_url,
  'presenting-warm',
);
if (variant.provider_mode !== 'reference-edit') throw new Error('Varianten brukte ikke reference-edit.');
const variantBytes = dataUrlBytes(variant.image_url);
const variantPixels = await assertTransparentPng(variantBytes, 'variant');
if (variant.asset_hash !== variantPixels.sha256) throw new Error('Variant-hash samsvarer ikke.');
if (variantPixels.sha256 === masterPixels.sha256) throw new Error('Varianten er identisk med masteren.');

const privateAsset = await verifyPrivateAsset(variant.asset_ref, variant.asset_hash);
console.log(JSON.stringify({
  ok: true,
  endpointHost: new URL(endpoint).host,
  model: master.model,
  master: { width: masterPixels.width, height: masterPixels.height, alpha: true },
  variant: { width: variantPixels.width, height: variantPixels.height, alpha: true },
  referenceEdit: true,
  visualAudit: true,
  privateAsset,
}));
