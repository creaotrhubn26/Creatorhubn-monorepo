#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const artifactsDir = path.resolve(process.argv[2] || 'artifacts');
const version = String(process.argv[3] || '').trim();
const publicBaseUrl = String(process.argv[4] || 'https://www.creatorhubn.com').replace(/\/+$/, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid release version: ${version}`);

const files = fs.readdirSync(artifactsDir).filter((name) => fs.statSync(path.join(artifactsDir, name)).isFile());
const one = (pattern, label) => {
  const matches = files.filter((name) => pattern.test(name));
  if (matches.length !== 1) throw new Error(`Expected one ${label}, found ${matches.length}: ${matches.join(', ')}`);
  return matches[0];
};
const signatureFor = (filename) => fs.readFileSync(path.join(artifactsDir, `${filename}.sig`), 'utf8').trim();
const artifact = (id, filename, extra = {}) => {
  if (filename.includes('/') || filename.includes('\\')) throw new Error(`Unsafe filename: ${filename}`);
  const body = fs.readFileSync(path.join(artifactsDir, filename));
  return {
    id,
    filename,
    key: `platform/releases/protools-companion/${version}/${filename}`,
    sizeBytes: body.byteLength,
    sha256: crypto.createHash('sha256').update(body).digest('hex'),
    ...extra,
  };
};

const macArmDmg = one(new RegExp(`_${version.replaceAll('.', '\\.')}_aarch64_signed-notarized\\.dmg$`), 'Apple Silicon DMG');
const macIntelDmg = one(new RegExp(`_${version.replaceAll('.', '\\.')}_x64_signed-notarized\\.dmg$`), 'Intel DMG');
const windowsExe = one(new RegExp(`_${version.replaceAll('.', '\\.')}_x64_signed\\.exe$`), 'Windows EXE');
const windowsMsi = one(new RegExp(`_${version.replaceAll('.', '\\.')}_x64_signed\\.msi$`), 'Windows MSI');
const macArmUpdater = one(new RegExp(`_${version.replaceAll('.', '\\.')}_aarch64\\.app\\.tar\\.gz$`), 'Apple Silicon updater');
const macIntelUpdater = one(new RegExp(`_${version.replaceAll('.', '\\.')}_x64\\.app\\.tar\\.gz$`), 'Intel updater');
const windowsUpdater = one(new RegExp(`_${version.replaceAll('.', '\\.')}_x64-setup\\.exe\\.zip$`), 'Windows updater');
const publishedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const notes = `CreatorHub Pro Tools Companion ${version}`;

const distribution = {
  schemaVersion: 1,
  product: 'protools-companion',
  version,
  publishedAt,
  notes,
  downloads: [
    artifact('mac-arm-dmg', macArmDmg, { os: 'macOS', arch: 'Apple Silicon', format: 'DMG', signed: true }),
    artifact('mac-intel-dmg', macIntelDmg, { os: 'macOS', arch: 'Intel', format: 'DMG', signed: true }),
    artifact('windows-exe', windowsExe, { os: 'Windows', arch: 'x64', format: 'EXE', signed: true }),
    artifact('windows-msi', windowsMsi, { os: 'Windows', arch: 'x64', format: 'MSI', signed: true }),
  ],
  updater: {
    'darwin-aarch64': artifact('updater-darwin-arm', macArmUpdater, { signature: signatureFor(macArmUpdater) }),
    'darwin-x86_64': artifact('updater-darwin-intel', macIntelUpdater, { signature: signatureFor(macIntelUpdater) }),
    'windows-x86_64': artifact('updater-windows-x64', windowsUpdater, { signature: signatureFor(windowsUpdater) }),
  },
};

const updater = {
  version,
  notes,
  pub_date: publishedAt,
  platforms: Object.fromEntries(Object.entries(distribution.updater).map(([target, item]) => [target, {
    signature: item.signature,
    url: `${publicBaseUrl}/api/protools/companion/download/${version}/${item.id}`,
  }])),
};

fs.writeFileSync(path.join(artifactsDir, 'creatorhub-s3-release.json'), `${JSON.stringify(distribution, null, 2)}\n`);
fs.writeFileSync(path.join(artifactsDir, 'protools-companion-latest.json'), `${JSON.stringify(updater, null, 2)}\n`);
