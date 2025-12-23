/**
 * Admin Routes
 * 
 * Admin-only API endpoints for Virtual Studio analysis
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

/**
 * Middleware to check if user is admin
 */
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Check if user is authenticated and is admin
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

/**
 * Read file content (admin-only)
 * GET /api/admin/read-file?path=<file-path>
 */
router.get('/read-file', requireAdmin, async (req, res) => {
  try {
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Security: Only allow reading from specific directories
    const allowedDirs = [
      'client/src/components/creatorhubvirtualstudio',
      'client/src/services',
    ];

    const isAllowed = allowedDirs.some(dir => filePath.startsWith(dir));

    if (!isAllowed) {
      return res.status(403).json({ error: 'Access to this directory is not allowed' });
    }

    // Resolve absolute path
    const absolutePath = path.resolve(process.cwd(), filePath);

    // Check if file exists
    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    // Read file content
    const content = await fs.readFile(absolutePath, 'utf-8');

    res.json({
      path: filePath,
      content,
      size: content.length,
      lines: content.split('\n').length,
    });

  } catch (error: any) {
    console.error('Failed to read file:', error);
    res.status(500).json({ error: error.message || 'Failed to read file' });
  }
});

/**
 * List files in directory (admin-only)
 * GET /api/admin/list-files?dir=<directory-path>
 */
router.get('/list-files', requireAdmin, async (req, res) => {
  try {
    const dirPath = req.query.dir as string;

    if (!dirPath) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    // Security: Only allow listing specific directories
    const allowedDirs = [
      'client/src/components/creatorhubvirtualstudio',
      'client/src/services',
    ];

    const isAllowed = allowedDirs.some(dir => dirPath.startsWith(dir));

    if (!isAllowed) {
      return res.status(403).json({ error: 'Access to this directory is not allowed' });
    }

    // Resolve absolute path
    const absolutePath = path.resolve(process.cwd(), dirPath);

    // Check if directory exists
    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({ error: 'Directory not found' });
    }

    // Read directory
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });

    const files = entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));

    res.json({
      directory: dirPath,
      files,
      count: files.length,
    });

  } catch (error: any) {
    console.error('Failed to list files:', error);
    res.status(500).json({ error: error.message || 'Failed to list files' });
  }
});

/**
 * Get Virtual Studio component paths (admin-only)
 * GET /api/admin/component-paths
 */
router.get('/component-paths', requireAdmin, async (_req, res) => {
  try {
    const componentPaths = [
      'client/src/components/creatorhubvirtualstudio/VirtualStudio.tsx',
      'client/src/components/creatorhubvirtualstudio/src/core/renderer/EnhancedRenderer.ts',
      'client/src/components/creatorhubvirtualstudio/src/core/renderer/PBRSystem.ts',
      'client/src/components/creatorhubvirtualstudio/src/core/renderer/SkinShader.ts',
      'client/src/components/creatorhubvirtualstudio/src/core/renderer/GlobalIlluminationSystem.ts',
      'client/src/components/creatorhubvirtualstudio/src/core/lighting/AreaLight.ts',
      'client/src/components/creatorhubvirtualstudio/src/core/animation/IKSystem.ts',
      'client/src/components/creatorhubvirtualstudio/src/core/animation/PoseLibrary.ts',
      'client/src/components/creatorhubvirtualstudio/src/core/models/EquipmentModels.ts',
      'client/src/components/creatorhubvirtualstudio/src/ui/stage3d/EnhancedStage3D.tsx',
      'client/src/components/creatorhubvirtualstudio/src/components/panels/AreaLightPanel.tsx',
      'client/src/components/creatorhubvirtualstudio/src/components/panels/RenderingSettingsPanel.tsx',
      'client/src/components/creatorhubvirtualstudio/src/components/panels/PoseLibraryPanel.tsx',
    ];

    res.json({
      paths: componentPaths,
      count: componentPaths.length,
    });

  } catch (error: any) {
    console.error('Failed to get component paths:', error);
    res.status(500).json({ error: error.message || 'Failed to get component paths' });
  }
});

export default router;

