#!/usr/bin/env node

import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginDirectoryName = 'CreatorHubNorge.lrplugin';
const requiredFiles = [
  'Info.lua',
  'PluginInfoProvider.lua',
  'ExportServiceProvider.lua',
  'CreatorHubDefaults.lua',
  'README.txt',
];

export async function copyLightroomPluginTemplate({
  sourceRoot = path.join(backendRoot, 'server', 'lightroom-plugin-template', pluginDirectoryName),
  outputRoot = path.join(backendRoot, 'dist', 'lightroom-plugin-template', pluginDirectoryName),
} = {}) {
  await mkdir(outputRoot, { recursive: true });

  for (const fileName of requiredFiles) {
    const sourcePath = path.join(sourceRoot, fileName);
    const outputPath = path.join(outputRoot, fileName);
    await copyFile(sourcePath, outputPath);

    const [source, output] = await Promise.all([readFile(sourcePath), readFile(outputPath)]);
    if (!source.equals(output)) {
      throw new Error(`Lightroom template verification failed for ${fileName}`);
    }
  }

  return { outputRoot, fileCount: requiredFiles.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await copyLightroomPluginTemplate();
  console.log(`Copied ${result.fileCount} Lightroom plugin files to ${result.outputRoot}`);
}
