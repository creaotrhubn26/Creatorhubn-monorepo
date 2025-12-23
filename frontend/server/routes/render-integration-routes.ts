/**
 * CreatorHub Norge - Render Integration Routes
 * API endpoints for syncing with Render environment
 */

import { Router } from 'express';
import { RenderIntegrationService } from '../services/render-integration-service';
import { getAPIVersionManager } from '../services/api-version-manager';
import { pool } from '../db';

const router = Router();

const RENDER_API_KEY = process.env.RENDER_API_KEY || 'rnd_rH0675zL2giMgpYDbsrxEAMXSWxe';
const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID || 'srv-d47s5lur433s739mr9j0';

/**
 * GET /api/admin/render/env-vars
 * Get all environment variables from Render
 */
router.get('/api/admin/render/env-vars', async (req, res) => {
  try {
    const renderService = new RenderIntegrationService(RENDER_API_KEY, RENDER_SERVICE_ID, pool);
    const envVars = await renderService.getEnvironmentVariables();

    res.json({
      success: true,
      envVars: envVars.map((v) => ({
        key: v.key,
        configured: !!v.value,
        masked: v.value ? `***${v.value.slice(-4)}` : undefined,
      })),
    });
  } catch (error) {
    console.error('Error fetching Render env vars:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch environment variables from Render',
    });
  }
});

/**
 * GET /api/admin/render/api-services
 * Get configured API services from Render
 */
router.get('/api/admin/render/api-services', async (req, res) => {
  try {
    const renderService = new RenderIntegrationService(RENDER_API_KEY, RENDER_SERVICE_ID, pool);
    const apiServices = await renderService.getConfiguredAPIServices();

    res.json({
      success: true,
      apiServices,
    });
  } catch (error) {
    console.error('Error fetching API services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API services from Render',
    });
  }
});

/**
 * POST /api/admin/render/pull-from-render
 * PULL from Render: Get API configurations from Render (Source of Truth)
 */
router.post('/api/admin/render/pull-from-render', async (req, res) => {
  try {
    const renderService = new RenderIntegrationService(RENDER_API_KEY, RENDER_SERVICE_ID, pool);

    console.log('🔽 Pulling API configurations from Render (Source of Truth)...');
    const result = await renderService.syncVersionsWithRender('pull');

    res.json({
      success: true,
      direction: 'pull',
      synced: result.synced,
      pullResults: result.pullResults,
      errors: result.errors,
      message: `Pulled ${result.pullResults?.length || 0} services from Render`,
      summary: {
        pulled: result.pullResults?.length || 0,
        failed: result.errors.length
      }
    });
  } catch (error) {
    console.error('Error pulling from Render:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pull from Render',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/render/push-to-render
 * PUSH to Render: Explicitly push API versions to Render (Manual action with safety checks)
 */
router.post('/api/admin/render/push-to-render', async (req, res) => {
  try {
    const { forceUpdate } = req.body;
    const renderService = new RenderIntegrationService(RENDER_API_KEY, RENDER_SERVICE_ID, pool);

    console.log('🔼 Pushing API versions to Render (SAFE MODE - No overwrites unless forced)...');
    const result = await renderService.syncVersionsWithRender('push', { forceUpdate });

    res.json({
      success: true,
      direction: 'push',
      pushResults: result.pushResults,
      errors: result.errors,
      message: `Pushed ${result.pushResults?.filter(r => r.action === 'pushed_to_render').length || 0} versions to Render`,
      summary: {
        pushed: result.pushResults?.filter(r => r.action === 'pushed_to_render').length || 0,
        skipped: result.pushResults?.filter(r => r.skipped).length || 0,
        failed: result.errors.length
      }
    });
  } catch (error) {
    console.error('Error pushing to Render:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to push to Render',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/render/sync-versions (DEPRECATED - Use pull/push separately)
 * BIDIRECTIONAL SYNC: Sync API versions with Render configuration
 * Query params:
 *   - direction: 'pull' | 'push' | 'both' (default: 'pull')
 *
 * PULL: Get versions from Render → Update our database
 * PUSH: Get versions from our database → Update Render
 * BOTH: Do both operations
 */
router.post('/api/admin/render/sync-versions', async (req, res) => {
  try {
    const direction = (req.query.direction as 'pull' | 'push' | 'both') || 'pull'; // Default to pull only
    const { forceUpdate } = req.body;
    const renderService = new RenderIntegrationService(RENDER_API_KEY, RENDER_SERVICE_ID, pool);

    console.log(`🔄 Starting ${direction} sync with Render...`);
    const result = await renderService.syncVersionsWithRender(direction, { forceUpdate });

    res.json({
      success: true,
      direction,
      synced: result.synced,
      pullResults: result.pullResults,
      pushResults: result.pushResults,
      errors: result.errors,
      message: `Synced ${result.synced.length} services with Render (${direction})`,
      summary: {
        pulled: result.pullResults?.length || 0,
        pushed: result.pushResults?.filter(r => r.action === 'pushed_to_render').length || 0,
        skipped: result.pushResults?.filter(r => r.skipped).length || 0,
        failed: result.errors.length
      }
    });
  } catch (error) {
    console.error('Error syncing with Render:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync with Render',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/admin/render/env-vars/:key
 * Update environment variable in Render
 */
router.put('/api/admin/render/env-vars/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!value) {
      return res.status(400).json({
        success: false,
        error: 'Value is required',
      });
    }

    const renderService = new RenderIntegrationService(RENDER_API_KEY, RENDER_SERVICE_ID, pool);
    await renderService.updateEnvironmentVariable(key, value);

    res.json({
      success: true,
      message: `Environment variable ${key} updated in Render`,
    });
  } catch (error) {
    console.error(`Error updating env var ${req.params.key}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update environment variable in Render',
    });
  }
});

export default router;

