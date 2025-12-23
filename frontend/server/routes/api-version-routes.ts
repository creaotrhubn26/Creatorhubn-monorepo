/**
 * CreatorHub Norge - API Version Management Routes
 * Endpoints for checking and managing API versions (Manual Update Only)
 * Updated for December 2025
 */

import { Router } from 'express';
import { getAPIVersionManager } from '../services/api-version-manager';
import { pool } from '../db';

const router = Router();

/**
 * GET /api/admin/api-versions
 * Get all API version information
 */
router.get('/api/admin/api-versions', async (req, res) => {
  try {
    const versionManager = getAPIVersionManager(pool);
    const versions = await versionManager.getAllVersions();

    res.json({
      success: true,
      versions,
      lastChecked: new Date(),
    });
  } catch (error) {
    console.error('Error fetching API versions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API versions',
    });
  }
});

/**
 * GET /api/admin/api-versions/:service
 * Get version info for specific service
 */
router.get('/api/admin/api-versions/:service', async (req, res) => {
  try {
    const { service } = req.params;
    const versionManager = getAPIVersionManager(pool);
    const versionInfo = await versionManager.getVersionInfo(service);

    if (!versionInfo) {
      return res.status(404).json({
        success: false,
        error: `Version info not found for ${service}`,
      });
    }

    res.json({
      success: true,
      versionInfo,
    });
  } catch (error) {
    console.error(`Error fetching version for ${req.params.service}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version info',
    });
  }
});

/**
 * POST /api/admin/api-versions/check
 * Manually trigger version check for all services
 */
router.post('/api/admin/api-versions/check', async (req, res) => {
  try {
    const versionManager = getAPIVersionManager(pool);
    const versions = await versionManager.checkAllVersions();

    res.json({
      success: true,
      message: 'Version check completed',
      versions: Array.from(versions.values()),
    });
  } catch (error) {
    console.error('Error checking API versions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check API versions',
    });
  }
});

/**
 * POST /api/admin/api-versions/:service/update
 * Manually update service to specific version
 */
router.post('/api/admin/api-versions/:service/update', async (req, res) => {
  try {
    const { service } = req.params;
    const { version } = req.body;

    if (!version) {
      return res.status(400).json({
        success: false,
        error: 'Version is required',
      });
    }

    const versionManager = getAPIVersionManager(pool);
    await versionManager.updateServiceVersion(service, version);

    res.json({
      success: true,
      message: `${service} updated to ${version}`,
    });
  } catch (error) {
    console.error(`Error updating ${req.params.service}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update service version',
    });
  }
});

export default router;

