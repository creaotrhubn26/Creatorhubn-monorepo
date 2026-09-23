import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
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

describe('Lightroom Classic CreatorHub bridge', () => {
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

  it('owner-scopes project selection and session-authenticates browser management routes', () => {
    expect(routeSource).toContain('WHERE id = $1 AND user_id = $2 LIMIT 1');
    expect(routeSource).toContain("router.get('/status', requireSession");
    expect(routeSource).toContain("router.post('/token', requireSession");
    expect(routeSource).toContain("router.get('/download-plugin', requireSession");
    expect(routeSource).toContain("router.post('/smoke-export', requireSession");
    expect(routeSource).toContain('export async function streamLightroomPluginPackageForUser(');
  });

  it('streams the rendered file as multipart from Lightroom instead of base64 JSON', () => {
    expect(pluginSource).toContain('LrHttp.postMultipart');
    expect(pluginSource).toContain('local requestSucceeded, responseBody, responseInfo = LrTasks.pcall(function()');
    expect(pluginSource).toContain('Nettverksfeil under opplasting. Den eksporterte filen er beholdt lokalt.');
    expect(pluginSource).toContain('local callSucceeded, uploadSuccess, uploadMessage = LrTasks.pcall(');
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
    expect(pluginSource).toContain("items = Defaults.projects");
    expect(pluginSource).toContain('enabled = Defaults.driveAvailable');
    expect(pluginSource).toContain("Defaults.deskBrokerUrl .. '/v1/lightroom/session'");
    expect(pluginSource).toContain("value = 'Bearer ' .. Defaults.deskBrokerSecret");
    expect(pluginSource).toContain('prefs.pluginToken = nil');
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
