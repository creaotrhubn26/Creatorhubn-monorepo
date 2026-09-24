import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  buildLightroomMimeType,
  canonicalizeLightroomPublicBase,
  findEditableLightroomProject,
  issueLightroomDeskSsoToken,
  verifyLightroomDeskSsoToken,
} from './lightroom-routes';

const routeSource = readFileSync(
  fileURLToPath(new URL('./lightroom-routes.ts', import.meta.url)),
  'utf8',
);
const migrationSource = readFileSync(
  fileURLToPath(new URL('../migrations/0664_lightroom_classic_creatorhub_bridge.sql', import.meta.url)),
  'utf8',
);
const pluginSource = readFileSync(
  fileURLToPath(new URL(
    './lightroom-plugin-template/CreatorHubNorge.lrplugin/ExportServiceProvider.lua',
    import.meta.url,
  )),
  'utf8',
);
const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as { scripts: { build: string } };
const packagingScript = readFileSync(
  fileURLToPath(new URL('../scripts/copy-lightroom-plugin-template.mjs', import.meta.url)),
  'utf8',
);

describe('Lightroom Classic CreatorHub bridge', () => {
  it('packages every required Lightroom template file with the production bundle', () => {
    expect(packageJson.scripts.build).toContain('node scripts/copy-lightroom-plugin-template.mjs');
    for (const fileName of [
      'Info.lua',
      'CreatorHubManifest.json',
      'PluginInit.lua',
      'PluginInfoProvider.lua',
      'ExportServiceProvider.lua',
      'CreatorHubDefaults.lua',
      'README.txt',
      'TranslatedStrings_en.txt',
      'TranslatedStrings_nb.txt',
    ]) {
      expect(packagingScript).toContain(`'${fileName}'`);
    }
    expect(packagingScript).toContain('source.equals(output)');
  });

  it('makes private CreatorHub S3 the verified source of truth before Drive mirroring', () => {
    const s3Write = routeSource.indexOf('await putCreatorHubObject(');
    const s3Verify = routeSource.indexOf('sizeBytes = await verifyCreatorHubLightroomObject(', s3Write);
    const driveWrite = routeSource.indexOf('await driveApi.files.create(', s3Write);

    expect(s3Write).toBeGreaterThan(0);
    expect(s3Verify).toBeGreaterThan(s3Write);
    expect(driveWrite).toBeGreaterThan(s3Verify);
    expect(routeSource).toContain("storageProvider: 'creatorhub_s3'");
    expect(routeSource).toContain("syncStatus: driveMirrorError ? 'synced_drive_warning' : 'synced'");
    expect(routeSource).not.toContain("type: 'anyone'");
    expect(routeSource).not.toContain('GOOGLE_WORKSPACE_REFRESH_TOKEN');
    expect(routeSource).not.toContain('GOOGLE_APPLICATION_CREDENTIALS');
  });

  it('requires workspace write access and session-authenticates browser management routes', () => {
    expect(routeSource).toContain('await findEditableLightroomProject(');
    expect(routeSource).toContain('payload.projectName = writableProject.title');
    expect(routeSource).toContain('FROM projects p');
    expect(routeSource).toContain("member.role <> 'viewer'");
    expect(routeSource).toContain("member.permissions @> '{\"canEdit\":true}'::jsonb");
    expect(routeSource).toContain("router.get('/status', requireSession");
    expect(routeSource).toContain("router.post('/token', requireSession");
    expect(routeSource).toContain("router.get('/download-plugin', requireSession");
    expect(routeSource).toContain("router.post('/smoke-export', requireSession");
    expect(routeSource).toContain('export async function streamLightroomPluginPackageForUser(');
  });

  it('streams the rendered file as multipart from Lightroom instead of base64 JSON', () => {
    expect(pluginSource).toContain('LrHttp.postMultipart');
    expect(pluginSource).toContain('local requestSucceeded, responseBody, responseInfo = LrTasks.pcall(function()');
    expect(pluginSource).toContain('CreatorHub/Lightroom/OfflineQueue');
    expect(pluginSource).toContain('queueRenderedPhoto');
    expect(pluginSource).toContain('drainOfflineQueue');
    expect(pluginSource).toContain('local callSucceeded, uploadSuccess, uploadMessage, driveStatus, publishedAssetId = LrTasks.pcall(');
    expect(pluginSource).not.toContain('= pcall(');
    expect(pluginSource).toContain('LrApplication.activeCatalog():getPath()');
    expect(pluginSource).not.toContain('LrApplication.activeCatalog():getName()');
    expect(pluginSource).toContain("filePath = exportPath");
    expect(pluginSource).not.toContain('fileDataBase64');
    expect(pluginSource).not.toContain('base64Encode');
    expect(routeSource.indexOf('requirePluginToken,')).toBeLessThan(
      routeSource.indexOf("lightroomMultipartUpload.single('file')"),
    );
    expect(routeSource).toContain('CREATORHUB_PROJECTS_LUA');
    expect(pluginSource).toContain("items = bind 'creatorhubProjectItems'");
    expect(pluginSource).toContain("enabled = bind 'creatorhubDriveAvailable'");
    expect(pluginSource).toContain("extractJsonString(responseBody, 'projectOptions')");
    expect(pluginSource).toContain("allowFileFormats = { 'JPEG', 'TIFF' }");
    expect(pluginSource).toContain('supportsIncrementalPublish = true');
    expect(pluginSource).toContain('recordPublishedPhotoId');
    expect(pluginSource).toContain(
      'publishedAssetId and exportContext.publishService and rendition.recordPublishedPhotoId',
    );
    expect(pluginSource).toContain('deletePhotosFromPublishedCollection');
    expect(pluginSource).toContain("Defaults.deskBrokerUrl .. '/v1/lightroom/session'");
    expect(pluginSource).toContain("value = 'Bearer ' .. Defaults.deskBrokerSecret");
    expect(pluginSource).toContain('prefs.pluginToken = nil');
    expect(pluginSource).toContain("extractJsonString(responseBody, 'driveMirrorError')");
    expect(pluginSource).toContain("driveMirroredCount > 0 and LOC '$$$/CreatorHub/Export/DriveSuffix= and mirrored to Google Drive' or ''");
    expect(pluginSource).not.toContain("exportSettings.creatorhubMirrorToDrive == true and ' og speilet til Google Drive'");
  });

  it('uses CreatorHub naming, produces previews and includes structured EXIF metadata', () => {
    expect(routeSource).toContain('FROM creatorhub_google_connections');
    expect(routeSource).toContain('resolveCreatorHubGoogleConnection');
    expect(routeSource).toContain('createLightroomPreview');
    expect(routeSource).toContain("kind: 'preview'");
    expect(pluginSource).toContain('cameraModel');
    expect(pluginSource).toContain('isoSpeedRating');
    expect(pluginSource).not.toContain('CreatorHub Norge');
  });

  it('uses the canonical www host for Lightroom API calls', () => {
    expect(canonicalizeLightroomPublicBase('https://creatorhubn.com/')).toBe('https://www.creatorhubn.com');
    expect(canonicalizeLightroomPublicBase('https://www.creatorhubn.com')).toBe('https://www.creatorhubn.com');
    expect(canonicalizeLightroomPublicBase('http://localhost:3003/')).toBe('http://localhost:3003');
  });

  it('accepts only supported formats with matching MIME types', () => {
    expect(buildLightroomMimeType('image/jpeg', 'portrait.JPG')).toBe('image/jpeg');
    expect(buildLightroomMimeType(undefined, 'album.tiff')).toBe('image/tiff');
    expect(() => buildLightroomMimeType('image/jpeg', 'raw.dng')).toThrow('støttes ikke');
    expect(() => buildLightroomMimeType('image/png', 'portrait.jpg')).toThrow('samsvarer ikke');
  });

  it('scopes writable project lookup to public projects and the authenticated user', async () => {
    const query = vi.fn(async () => ({
      rows: [{ id: 'project-1', title: 'Workspace project', name: null }],
    }));
    await expect(findEditableLightroomProject({ query } as never, 'user-1', 'project-1'))
      .resolves.toEqual({ id: 'project-1', title: 'Workspace project' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM projects p'),
      ['project-1', 'user-1'],
    );
    expect(query.mock.calls[0]?.[0]).toContain("member.permissions @> '{\"canEdit\":true}'::jsonb");
  });

  it('recovers an abandoned upload lease but protects an active upload', () => {
    expect(routeSource).toContain('Date.now() - duplicateUpdatedAt > 30 * 60 * 1000');
    expect(routeSource).toContain("duplicate.rows[0]?.status === 'uploading' && !staleUpload");
    expect(routeSource).toContain("duplicate.rows[0]?.status === 'error' || staleUpload");
  });

  it('issues short-lived, tamper-evident sessions bound to one Desk device', () => {
    vi.stubEnv('LIGHTROOM_DESK_SSO_SECRET', 't'.repeat(64));
    const issued = issueLightroomDeskSsoToken('user-1', 'device-1', 1_800_000_000);
    expect(issued.token).toMatch(/^lrs_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyLightroomDeskSsoToken(issued.token, 1_800_000_001)).toEqual(
      expect.objectContaining({ sub: 'user-1', did: 'device-1' }),
    );
    expect(verifyLightroomDeskSsoToken(`${issued.token}x`, 1_800_000_001)).toBeNull();
    expect(verifyLightroomDeskSsoToken(issued.token, 1_800_000_601)).toBeNull();
    vi.unstubAllEnvs();
  });

  it('persists a constrained, project-bound and auditable export receipt', () => {
    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS lightroom_classic_exports');
    expect(migrationSource).toContain('REFERENCES projects(id) ON DELETE CASCADE');
    expect(migrationSource).toContain('REFERENCES capture_assets(id) ON DELETE CASCADE');
    expect(migrationSource).toContain("CHECK (status IN ('uploading', 'verified', 'error'))");
    expect(migrationSource).toContain('lightroom_classic_exports_dedupe_idx');
    expect(migrationSource).toContain("status <> 'verified' OR verified_at IS NOT NULL");
    expect(migrationSource).toContain('DROP COLUMN IF EXISTS plugin_token_plain');
    expect(routeSource).not.toContain('plugin_token_plain');
    expect(routeSource).not.toContain('CREATE TABLE IF NOT EXISTS');
  });
});
