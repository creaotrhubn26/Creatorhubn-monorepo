/**
 * Vercel CLI Service
 * Wrapper for Vercel CLI commands for more powerful deployments
 */

export interface VercelCLIConfig {
  token?: string;
  teamId?: string;
  projectPath: string;
}

export interface VercelCLIDeployment {
  url: string;
  deploymentUrl: string;
  inspectorUrl: string;
  readyState: string;
}

export class VercelCLIService {
  private token: string | null = null;
  private teamId: string | null = null;

  constructor() {
    this.loadConfig();
  }

  /**
   * Load configuration
   */
  private loadConfig() {
    this.token = localStorage.getItem('vercel_token');
    this.teamId = localStorage.getItem('vercel_team_id');
  }

  /**
   * Set credentials
   */
  setCredentials(token: string, teamId?: string) {
    this.token = token;
    this.teamId = teamId || null;

    localStorage.setItem('vercel_token', token);
    if (teamId) {
      localStorage.setItem('vercel_team_id', teamId);
    }
  }

  /**
   * Check if Vercel CLI is installed
   */
  async checkCLIInstalled(): Promise<boolean> {
    try {
      const response = await fetch('/api/vercel/check-cli', {
        method: 'GET',
        headers: {
          'Content-Type' : 'application/json',
        },
      });

      if (!response.ok) return false;
      const data = await response.json();
      return data.installed === true;
    } catch (error) {
      console.error('Failed to check Vercel CLI: ', error);
      return false;
    }
  }

  /**
   * Install Vercel CLI via npm
   */
  async installCLI(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/vercel/install-cli', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: 'Failed to install Vercel CLI',
        };
      }

      return {
        success: true,
        message: 'Vercel CLI installed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Installation failed',
      };
    }
  }

  /**
   * Deploy using Vercel CLI
   */
  async deploy(
    projectPath: string,
    options: {
      prod?: boolean;
      name?: string;
      env?: Record<string, string>;
      buildEnv?: Record<string, string>;
      regions?: string[];
      confirmClobber?: boolean;
    } = {},
  ): Promise<VercelCLIDeployment> {
    if (!this.token) {
      throw new Error('Vercel token not configured');
    }

    try {
      const response = await fetch('/api/vercel/deploy', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          projectPath,
          token: this.token,
          teamId: this.teamId,
          prod: options.prod || false,
          name: options.name,
          env: options.env,
          buildEnv: options.buildEnv,
          regions: options.regions,
          confirmClobber: options.confirmClobber,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Deployment failed');
      }

      return await response.json();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Deployment failed');
    }
  }

  /**
   * Link project to Vercel
   */
  async link(projectPath: string, projectName?: string): Promise<boolean> {
    try {
      const response = await fetch('/api/vercel/link', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          projectPath,
          projectName,
          token: this.token,
          teamId: this.teamId,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to link project:', error);
      return false;
    }
  }

  /**
   * Pull environment variables
   */
  async pullEnv(
    projectPath: string,
    environment: 'development' | 'preview' | 'production' = 'development',
  ): Promise<Record<string, string> | null> {
    try {
      const response = await fetch('/api/vercel/pull-env', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          projectPath,
          environment,
          token: this.token,
          teamId: this.teamId,
        }),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Failed to pull env:', error);
      return null;
    }
  }

  /**
   * Get project info using CLI
   */
  async getProjectInfo(projectPath: string): Promise<any> {
    try {
      const response = await fetch('/api/vercel/project-info', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          projectPath,
          token: this.token,
          teamId: this.teamId,
        }),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Failed to get project info:', error);
      return null;
    }
  }

  /**
   * List all deployments for project
   */
  async listDeployments(projectPath: string): Promise<VercelCLIDeployment[]> {
    try {
      const response = await fetch('/api/vercel/list-deployments', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          projectPath,
          token: this.token,
          teamId: this.teamId,
        }),
      });

      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Failed to list deployments:', error);
      return [];
    }
  }

  /**
   * Promote deployment to production
   */
  async promoteToProduction(deploymentUrl: string): Promise<boolean> {
    try {
      const response = await fetch('/api/vercel/promote', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          deploymentUrl,
          token: this.token,
          teamId: this.teamId,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to promote deployment:', error);
      return false;
    }
  }

  /**
   * Remove deployment
   */
  async removeDeployment(deploymentUrl: string): Promise<boolean> {
    try {
      const response = await fetch('/api/vercel/remove', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          deploymentUrl,
          token: this.token,
          teamId: this.teamId,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to remove deployment:', error);
      return false;
    }
  }

  /**
   * Get deployment logs (streaming)
   */
  async getDeploymentLogs(deploymentUrl: string): Promise<string[]> {
    try {
      const response = await fetch('/api/vercel/logs', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          deploymentUrl,
          token: this.token,
          teamId: this.teamId,
        }),
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data.logs || [];
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  /**
   * Add domain to project
   */
  async addDomain(projectPath: string, domain: string): Promise<boolean> {
    try {
      const response = await fetch('/api/vercel/add-domain', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          projectPath,
          domain,
          token: this.token,
          teamId: this.teamId,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to add domain:', error);
      return false;
    }
  }

  /**
   * Generate vercel.json configuration
   */
  generateVercelConfig(options: {
    buildCommand?: string;
    outputDirectory?: string;
    installCommand?: string;
    framework?: string;
    regions?: string[];
    env?: Record<string, string>;
    headers?: Array<{
      source: string;
      headers: Array<{ key: string; value: string }>;
    }>;
    rewrites?: Array<{ source: string; destination: string }>;
    redirects?: Array<{
      source: string;
      destination: string;
      permanent?: boolean;
    }>;
  }): string {
    const config: unknown = {};

    if (options.buildCommand) config.buildCommand = options.buildCommand;
    if (options.outputDirectory) config.outputDirectory = options.outputDirectory;
    if (options.installCommand) config.installCommand = options.installCommand;
    if (options.framework) config.framework = options.framework;
    if (options.regions) config.regions = options.regions;
    if (options.env) config.env = options.env;
    if (options.headers) config.headers = options.headers;
    if (options.rewrites) config.rewrites = options.rewrites;
    if (options.redirects) config.redirects = options.redirects;

    return JSON.stringify(config, null, 2);
  }

  /**
   * Generate .vercelignore file
   */
  generateVercelIgnore(): string {
    return `# Vercel ignore patterns
node_modules/
.next/
out/
.vercel/
.git/
.env.local
.env*.local
*.log
.DS_Store
coverage/
.cache/
dist/
build/
`;
  }
}

// Singleton instance
export const vercelCLIService = new VercelCLIService();
