/**
 * Production Deployment Service
 * One-click deployment to Vercel with environment management
 */

export type Environment = 'development' | 'preview' | 'production';
export type DeploymentStatus = 'queued' | 'building' | 'ready' | 'error' | 'canceled';

export interface DeploymentConfig {
  projectName: string;
  framework: 'nextjs' | 'react' | 'vue' | 'static';
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  environmentVariables?: Record<string, string>;
  domains?: string[];
}

export interface Deployment {
  id: string;
  url: string;
  status: DeploymentStatus;
  environment: Environment;
  createdAt: number;
  readyAt?: number;
  buildTime?: number;
  creator: string;
  commit?: {
    sha: string;
    message: string;
    author: string;
  };
  logs?: string[];
  error?: string;
}

export interface VercelProject {
  id: string;
  name: string;
  framework: string;
  createdAt: number;
  updatedAt: number;
  link?: {
    type: string;
    repo: string;
    org: string;
  };
  targets?: {
    production?: {
      id: string;
      url: string;
    };
  };
}

export interface VercelDomain {
  name: string;
  verified: boolean;
  verification?: {
    type: string;
    domain: string;
    value: string;
    reason: string;
  }[];
}

export interface DeploymentEnvironment {
  name: Environment;
  variables: Record<string, string>;
  domains: string[];
  protectionBypass?: string;
}

export class DeploymentService {
  private vercelToken: string | null = null;
  private vercelTeamId: string | null = null;
  private deployments: Map<string, Deployment> = new Map();
  private baseUrl = 'https://api.vercel.com';

  constructor() {
    this.loadConfig();
  }

  /**
   * Load configuration from storage
   */
  private loadConfig() {
    this.vercelToken = localStorage.getItem('vercel_token');
    this.vercelTeamId = localStorage.getItem('vercel_team_id');
  }

  /**
   * Set Vercel credentials
   */
  setCredentials(token: string, teamId?: string) {
    this.vercelToken = token;
    this.vercelTeamId = teamId || null;

    localStorage.setItem('vercel_token', token);
    if (teamId) {
      localStorage.setItem('vercel_team_id', teamId);
    }
  }

  /**
   * Check if configured
   */
  isConfigured(): boolean {
    return this.vercelToken !== null;
  }

  /**
   * Create Vercel project
   */
  async createProject(config: DeploymentConfig): Promise<VercelProject> {
    if (!this.isConfigured()) {
      throw new Error('Vercel token not configured');
    }

    const response = await fetch(`${this.baseUrl}/v9/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.vercelToken}`, 'Content-Type' : 'application/json',
        ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
      },
      body: JSON.stringify({
        name: config.projectName,
        framework: config.framework,
        buildCommand: config.buildCommand,
        outputDirectory: config.outputDirectory,
        installCommand: config.installCommand,
        environmentVariables: config.environmentVariables
          ? Object.entries(config.environmentVariables).map(([key, value]) => ({
              key,
              value,
              type: 'encrypted',
              target: ['production','preview','development'],
            }))
          : [],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create project: ${error.error?.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Deploy to Vercel
   */
  async deploy(
    projectName: string,
    files: { [path: string]: string },
    environment: Environment = 'production',
    config?: Partial<DeploymentConfig>,
  ): Promise<Deployment> {
    if (!this.isConfigured()) {
      throw new Error('Vercel token not configured');
    }

    const deploymentId = `deploy-${Date.now()}`;

    // Create deployment record
    const deployment: Deployment = {
      id: deploymentId,
      url: ', ',
      status: 'queued',
      environment,
      createdAt: Date.now(),
      creator: 'user',
    };

    this.deployments.set(deploymentId, deployment);

    try {
      // Prepare files for Vercel
      const vercelFiles = Object.entries(files).map(([path, content]) => ({
        file: path,
        data: content,
      }));

      deployment.status = 'building';
      this.deployments.set(deploymentId, deployment);

      // Deploy to Vercel
      const response = await fetch(`${this.baseUrl}/v13/deployments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.vercelToken}`,
          'Content-Type' : 'application/json',
          ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
        },
        body: JSON.stringify({
          name: projectName,
          files: vercelFiles,
          projectSettings: {
            framework: config?.framework || 'react',
            buildCommand: config?.buildCommand,
            outputDirectory: config?.outputDirectory,
            installCommand: config?.installCommand,
          },
          target: environment,
          meta: {
            deployedBy: 'visual-editor',
            timestamp: Date.now().toString(),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Deployment failed: ${error.error?.message || response.statusText}`);
      }

      const vercelDeployment = await response.json();

      // Update deployment with Vercel response
      deployment.id = vercelDeployment.id;
      deployment.url = vercelDeployment.url;
      deployment.status = 'building';

      // Poll deployment status
      await this.pollDeploymentStatus(deployment.id);

      deployment.status = 'ready';
      deployment.readyAt = Date.now();
      deployment.buildTime = deployment.readyAt - deployment.createdAt;
    } catch (error) {
      deployment.status = 'error';
      deployment.error = error instanceof Error ? error.message : 'Deployment failed';
      console.error('Deployment error: ', error);
    }

    this.deployments.set(deploymentId, deployment);
    return deployment;
  }

  /**
   * Poll deployment status
   */
  private async pollDeploymentStatus(deploymentId: string): Promise<void> {
    const maxAttempts = 60; // 5 minutes (5s intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
          headers: {
            Authorization: `Bearer ${this.vercelToken}`,
            ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
          },
        });

        if (response.ok) {
          const data = await response.json();

          if (data.readyState === 'READY') {
            return;
          } else if (data.readyState === 'ERROR') {
            throw new Error('Deployment failed on Vercel');
          }
        }

        // Wait 5 seconds before next poll
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
      } catch (error) {
        throw error;
      }
    }

    throw new Error('Deployment timeout');
  }

  /**
   * Get deployment status
   */
  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    const local = this.deployments.get(deploymentId);
    if (local) return local;

    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
        headers: {
          Authorization: `Bearer ${this.vercelToken}`,
          ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
        },
      });

      if (!response.ok) return null;

      const data = await response.json();

      return {
        id: data.id,
        url: data.url,
        status: this.mapVercelState(data.readyState),
        environment: data.target || 'production',
        createdAt: data.createdAt,
        readyAt: data.ready,
        buildTime: data.buildingAt ? data.ready - data.buildingAt : undefined,
        creator: data.creator?.username || 'unknown',
      };
    } catch (error) {
      console.error('Failed to get deployment:', error);
      return null;
    }
  }

  /**
   * List deployments for project
   */
  async listDeployments(projectName: string, limit = 20): Promise<Deployment[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/v6/deployments?projectId=${projectName}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.vercelToken}`,
            ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
          },
        },
      );

      if (!response.ok) return [];

      const data = await response.json();

      return data.deployments.map((d: unknown) => ({
        id: d.id,
        url: d.url,
        status: this.mapVercelState(d.readyState),
        environment: d.target || 'production',
        createdAt: d.createdAt,
        readyAt: d.ready,
        creator: d.creator?.username || 'unknown',
      }));
    } catch (error) {
      console.error('Failed to list deployments:', error);
      return [];
    }
  }

  /**
   * Get project details
   */
  async getProject(projectName: string): Promise<VercelProject | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${this.baseUrl}/v9/projects/${projectName}`, {
        headers: {
          Authorization: `Bearer ${this.vercelToken}`,
          ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
        },
      });

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error('Failed to get project:', error);
      return null;
    }
  }

  /**
   * Add domain to project
   */
  async addDomain(projectName: string, domain: string): Promise<VercelDomain> {
    if (!this.isConfigured()) {
      throw new Error('Vercel token not configured');
    }

    const response = await fetch(`${this.baseUrl}/v9/projects/${projectName}/domains`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.vercelToken}`,
        'Content-Type' : 'application/json',
        ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
      },
      body: JSON.stringify({ name: domain }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to add domain: ${error.error?.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Verify domain
   */
  async verifyDomain(projectName: string, domain: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await fetch(
        `${this.baseUrl}/v9/projects/${projectName}/domains/${domain}/verify`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.vercelToken}`,
            ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
          },
        },
      );

      if (!response.ok) return false;

      const data = await response.json();
      return data.verified === true;
    } catch (error) {
      console.error('Failed to verify domain:', error);
      return false;
    }
  }

  /**
   * Set environment variables
   */
  async setEnvironmentVariables(
    projectName: string,
    variables: Record<string, string>,
    target: Environment[] = ['production','preview','development'],
  ): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Vercel token not configured');
    }

    const envVars = Object.entries(variables).map(([key, value]) => ({
      key,
      value,
      type: 'encrypted',
      target,
    }));

    const response = await fetch(`${this.baseUrl}/v9/projects/${projectName}/env`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.vercelToken}`,
        'Content-Type' : 'application/json',
        ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
      },
      body: JSON.stringify(envVars),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to set env vars: ${error.error?.message || response.statusText}`);
    }
  }

  /**
   * Delete deployment
   */
  async deleteDeployment(deploymentId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await fetch(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.vercelToken}`,
          ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
        },
      });

      if (response.ok) {
        this.deployments.delete(deploymentId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete deployment:', error);
      return false;
    }
  }

  /**
   * Promote deployment to production
   */
  async promoteToProduction(deploymentId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await fetch(`${this.baseUrl}/v13/deployments/${deploymentId}/promote`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.vercelToken}`,
          ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to promote deployment:', error);
      return false;
    }
  }

  /**
   * Get deployment logs
   */
  async getDeploymentLogs(deploymentId: string): Promise<string[]> {
    if (!this.isConfigured()) return [];

    try {
      const response = await fetch(`${this.baseUrl}/v2/deployments/${deploymentId}/events`, {
        headers: {
          Authorization: `Bearer ${this.vercelToken}`,
          ...(this.vercelTeamId ? { 'X-Vercel-Team-Id': this.vercelTeamId } : {}),
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.events?.map((e: unknown) => e.text || ', ') || [];
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  /**
   * Map Vercel state to internal status
   */
  private mapVercelState(state: string): DeploymentStatus {
    switch (state) {
      case 'QUEUED':
      case 'INITIALIZING':
        return 'queued';
      case 'BUILDING':
      case 'ANALYZING':
        return 'building';
      case 'READY':
        return 'ready';
      case 'ERROR':
        return 'error';
      case 'CANCELED':
        return 'canceled';
      default:
        return 'queued';
    }
  }

  /**
   * Generate deployment files from canvas
   */
  generateDeploymentFiles(
    html: string,
    css: string,
    js: string,
    framework: 'react' | 'static' = 'static',
  ): { [path: string]: string } {
    if (framework === 'static') {
      return {
        'index.html': html,
        'styles.css': css,
        'script.js': js,
        'package.json': JSON.stringify(
          {
            name: 'visual-editor-deployment',
            version: '1.0.0',
            scripts: {
              build: 'echo "Static site, no build needed"',
            },
          },
          null,
          2,
        ),
      };
    } else {
      // React deployment
      return {
        'pages/index.tsx': `
import React from 'react';
import '../styles.css';

export default function Home() {
  return (
    ${html}
  );
}
        `,
        'styles.css': css,
        'package.json': JSON.stringify(
          {
            name: 'visual-editor-deployment',
            version: '1.0.0',
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start',
            },
            dependencies: {
              next: '^14.0.0',
              react: '^18.2.0','react-dom' : '^18.2.0',
            },
          },
          null,
          2,
        ),
        'next.config.js': `
module.exports = {
  reactStrictMode: true,
}
        `,
        'tsconfig.json': JSON.stringify(
          {
            compilerOptions: {
              target: 'es5',
              lib: ['dom','dom.iterable', 'esnext'],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              forceConsistentCasingInFileNames: true,
              noEmit: true,
              esModuleInterop: true,
              module: 'esnext',
              moduleResolution: 'node',
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: 'preserve',
              incremental: true,
            },
            include: ['next-env.d.ts','**/*.ts''**/*.tsx'],
            exclude: ['node_modules'],
          },
          null,
          2,
        ),
      };
    }
  }
}

// Singleton instance
export const deploymentService = new DeploymentService();
