import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import { EvaluationEnvironment, EnvironmentRequirements } from '../types/orchestrator';
import { v4 as uuidv4 } from 'uuid';

interface EnvironmentConfig {
  evaluationId: string;
  agentId: string;
  benchmarkId: string;
  configuration: Record<string, any>;
}

interface DockerEnvironment {
  id: string;
  containerId: string;
  name: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  config: EnvironmentConfig;
  resources: {
    cpu: number;
    memory: number;
    disk: number;
  };
  createdAt: Date;
  lastActivity: Date;
}

interface SandboxEnvironment {
  id: string;
  type: 'e2b' | 'local';
  status: 'creating' | 'running' | 'stopped' | 'error';
  config: EnvironmentConfig;
  endpoint?: string;
  credentials?: Record<string, string>;
  createdAt: Date;
  lastActivity: Date;
}

export class EnvironmentManager extends EventEmitter {
  private environments: Map<string, EvaluationEnvironment>;
  private dockerEnvironments: Map<string, DockerEnvironment>;
  private sandboxEnvironments: Map<string, SandboxEnvironment>;
  private cleanupInterval!: NodeJS.Timeout;
  private defaultEnvironmentType: 'docker' | 'sandbox' | 'local';
  private resourceLimits: {
    maxCpu: number;
    maxMemory: number;
    maxDisk: number;
    maxEnvironments: number;
  };

  constructor() {
    super();
    this.environments = new Map();
    this.dockerEnvironments = new Map();
    this.sandboxEnvironments = new Map();
    this.defaultEnvironmentType = 'docker';
    this.resourceLimits = {
      maxCpu: 8,
      maxMemory: 16384, // 16GB in MB
      maxDisk: 102400, // 100GB in MB
      maxEnvironments: 20
    };

    this.startCleanupTimer();
    this.validateDockerInstallation();
  }

  private async validateDockerInstallation(): Promise<void> {
    try {
      const { exec } = await import('child_process');
      await new Promise<void>((resolve, reject) => {
        exec('docker --version', (error, stdout) => {
          if (error) {
            logger.warn('Docker not available, falling back to local environments');
            this.defaultEnvironmentType = 'local';
          } else {
            logger.info(`Docker available: ${stdout.trim()}`);
          }
          resolve();
        });
      });
    } catch (error) {
      logger.warn('Failed to check Docker availability:', error);
      this.defaultEnvironmentType = 'local';
    }
  }

  async createEnvironment(evaluationId: string, config: EnvironmentConfig): Promise<EvaluationEnvironment> {
    try {
      // Check environment limit
      if (this.environments.size >= this.resourceLimits.maxEnvironments) {
        throw new Error('Maximum environment limit reached');
      }

      const environmentType = config.configuration.environmentType || this.defaultEnvironmentType;

      let environment: EvaluationEnvironment;

      switch (environmentType) {
        case 'docker':
          environment = await this.createDockerEnvironment(evaluationId, config);
          break;
        case 'sandbox':
          environment = await this.createSandboxEnvironment(evaluationId, config);
          break;
        case 'local':
          environment = await this.createLocalEnvironment(evaluationId, config);
          break;
        default:
          throw new Error(`Unsupported environment type: ${environmentType}`);
      }

      this.environments.set(evaluationId, environment);

      logger.info(`Created ${environmentType} environment for evaluation ${evaluationId}`);
      this.emit('environmentCreated', evaluationId, environment);

      return environment;

    } catch (error) {
      logger.error(`Failed to create environment for evaluation ${evaluationId}:`, error);
      throw error;
    }
  }

  private async createDockerEnvironment(evaluationId: string, config: EnvironmentConfig): Promise<EvaluationEnvironment> {
    const containerName = `haseb-eval-${evaluationId}`;
    const workdir = `/workspace/evaluations/${evaluationId}`;

    // Create workspace directory
    await fs.mkdir(workdir, { recursive: true });

    // Dockerfile content for HASEB evaluations
    const dockerfile = `
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \\
    git \\
    python3 \\
    py3-pip \\
    make \\
    g++ \\
    curl \\
    wget \\
    htop \\
    strace

# Create workspace
WORKDIR /workspace

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy evaluation code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S haseb && \\
    adduser -S haseb -u 1001

# Change ownership
RUN chown -R haseb:haseb /workspace
USER haseb

# Set environment variables
ENV NODE_ENV=evaluation
ENV EVALUATION_ID=${evaluationId}

# Expose metrics port
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:9090/health || exit 1

CMD ["npm", "start"]
`;

    await fs.writeFile(join(workdir, 'Dockerfile'), dockerfile);

    // Prepare environment variables
    const envVars = [
      `EVALUATION_ID=${evaluationId}`,
      `AGENT_ID=${config.agentId}`,
      `BENCHMARK_ID=${config.benchmarkId}`,
      `NODE_ENV=evaluation`,
      ...Object.entries(config.configuration.environment || {}).map(([key, value]) => `${key}=${value}`)
    ];

    // Resource limits
    const resources = config.configuration.resources || {
      cpu: 2,
      memory: 4096,
      disk: 10240
    };

    // Docker run command
    const dockerArgs = [
      'run',
      '-d',
      '--name', containerName,
      '--cpus', resources.cpu.toString(),
      '--memory', `${resources.memory}m`,
      '--memory-swap', `${resources.memory * 1.5}m`,
      '--shm-size', '512m',
      '--network', 'haseb-network',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=1g',
      '--mount', `type=bind,source=${workdir},target=/workspace`,
      '--mount', 'type=volume,source=haseb-cache,target=/var/cache/haseb',
      '--label', 'managed-by=haseb',
      '--label', `evaluation-id=${evaluationId}`,
      '--restart', 'unless-stopped',
      ...envVars.flatMap(env => ['-e', env]),
      'haseb-evaluator:latest'
    ];

    // Create Docker network if it doesn't exist
    await this.createDockerNetwork();

    // Build Docker image
    await this.buildDockerImage(workdir);

    // Run container
    const containerId = await this.executeDockerCommand(dockerArgs);

    const dockerEnv: DockerEnvironment = {
      id: evaluationId,
      containerId: containerId.trim(),
      name: containerName,
      status: 'creating',
      config,
      resources,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.dockerEnvironments.set(evaluationId, dockerEnv);

    // Wait for container to be ready
    await this.waitForContainer(containerId);

    // Get container IP
    const containerInfo = await this.getDockerContainerInfo(containerId);
    const endpoint = `http://${containerInfo.IPAddress}:9090`;

    const environment: EvaluationEnvironment = {
      id: evaluationId,
      type: 'docker',
      status: 'ready',
      resources,
      configuration: config.configuration,
      endpoint,
      credentials: {
        containerId,
        network: 'haseb-network'
      }
    };

    dockerEnv.status = 'running';
    dockerEnv.lastActivity = new Date();

    return environment;
  }

  private async createSandboxEnvironment(evaluationId: string, config: EnvironmentConfig): Promise<EvaluationEnvironment> {
    try {
      // Try to use E2B sandbox if available
      const { createSandbox } = await import('@e2b/code-interpreter').catch(() => null);

      if (createSandbox) {
        return await this.createE2BSandbox(evaluationId, config);
      } else {
        // Fallback to local sandbox
        return await this.createLocalSandbox(evaluationId, config);
      }
    } catch (error) {
      logger.warn('E2B sandbox not available, using local sandbox:', error);
      return await this.createLocalSandbox(evaluationId, config);
    }
  }

  private async createE2BSandbox(evaluationId: string, config: EnvironmentConfig): Promise<EvaluationEnvironment> {
    // This would integrate with E2B sandbox service
    // For now, return a mock implementation
    const sandboxEnv: SandboxEnvironment = {
      id: evaluationId,
      type: 'e2b',
      status: 'running',
      config,
      endpoint: 'https://api.e2b.dev/v1/sandbox/' + evaluationId,
      credentials: {
        apiKey: process.env.E2B_API_KEY || '',
        sandboxId: evaluationId
      },
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sandboxEnvironments.set(evaluationId, sandboxEnv);

    return {
      id: evaluationId,
      type: 'sandbox',
      status: 'ready',
      resources: {
        cpu: 2,
        memory: 4096,
        disk: 10240,
        network: true
      },
      configuration: config.configuration,
      endpoint: sandboxEnv.endpoint,
      credentials: sandboxEnv.credentials
    };
  }

  private async createLocalSandbox(evaluationId: string, config: EnvironmentConfig): Promise<EvaluationEnvironment> {
    const workdir = join(process.cwd(), 'temp', 'evaluations', evaluationId);
    await fs.mkdir(workdir, { recursive: true });

    const sandboxEnv: SandboxEnvironment = {
      id: evaluationId,
      type: 'local',
      status: 'running',
      config,
      endpoint: `file://${workdir}`,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sandboxEnvironments.set(evaluationId, sandboxEnv);

    return {
      id: evaluationId,
      type: 'sandbox',
      status: 'ready',
      resources: {
        cpu: 2,
        memory: 4096,
        disk: 10240,
        network: false
      },
      configuration: config.configuration,
      endpoint: sandboxEnv.endpoint,
      credentials: {
        workdir
      }
    };
  }

  private async createLocalEnvironment(evaluationId: string, config: EnvironmentConfig): Promise<EvaluationEnvironment> {
    const workdir = join(process.cwd(), 'temp', 'evaluations', evaluationId);
    await fs.mkdir(workdir, { recursive: true });

    return {
      id: evaluationId,
      type: 'local',
      status: 'ready',
      resources: {
        cpu: 2,
        memory: 4096,
        disk: 10240,
        network: true
      },
      configuration: config.configuration,
      endpoint: `file://${workdir}`,
      credentials: {
        workdir
      }
    };
  }

  async cleanupEnvironment(evaluationId: string): Promise<void> {
    try {
      const environment = this.environments.get(evaluationId);
      if (!environment) {
        logger.warn(`Environment not found for evaluation ${evaluationId}`);
        return;
      }

      switch (environment.type) {
        case 'docker':
          await this.cleanupDockerEnvironment(evaluationId);
          break;
        case 'sandbox':
          await this.cleanupSandboxEnvironment(evaluationId);
          break;
        case 'local':
          await this.cleanupLocalEnvironment(evaluationId);
          break;
      }

      this.environments.delete(evaluationId);

      logger.info(`Cleaned up environment for evaluation ${evaluationId}`);
      this.emit('environmentCleanedUp', evaluationId);

    } catch (error) {
      logger.error(`Failed to cleanup environment for evaluation ${evaluationId}:`, error);
      throw error;
    }
  }

  private async cleanupDockerEnvironment(evaluationId: string): Promise<void> {
    const dockerEnv = this.dockerEnvironments.get(evaluationId);
    if (!dockerEnv) {
      return;
    }

    try {
      // Stop container
      await this.executeDockerCommand(['stop', dockerEnv.containerId]);

      // Remove container
      await this.executeDockerCommand(['rm', dockerEnv.containerId]);

      // Cleanup workspace directory
      const workdir = join(process.cwd(), 'temp', 'evaluations', evaluationId);
      await fs.rm(workdir, { recursive: true, force: true });

      this.dockerEnvironments.delete(evaluationId);

    } catch (error) {
      logger.error(`Failed to cleanup Docker environment for ${evaluationId}:`, error);
    }
  }

  private async cleanupSandboxEnvironment(evaluationId: string): Promise<void> {
    const sandboxEnv = this.sandboxEnvironments.get(evaluationId);
    if (!sandboxEnv) {
      return;
    }

    try {
      if (sandboxEnv.type === 'e2b' && sandboxEnv.credentials?.sandboxId) {
        // Close E2B sandbox
        // await closeSandbox(sandboxEnv.credentials.sandboxId);
      }

      // Cleanup workspace
      const workdir = join(process.cwd(), 'temp', 'evaluations', evaluationId);
      await fs.rm(workdir, { recursive: true, force: true });

      this.sandboxEnvironments.delete(evaluationId);

    } catch (error) {
      logger.error(`Failed to cleanup sandbox environment for ${evaluationId}:`, error);
    }
  }

  private async cleanupLocalEnvironment(evaluationId: string): Promise<void> {
    try {
      const workdir = join(process.cwd(), 'temp', 'evaluations', evaluationId);
      await fs.rm(workdir, { recursive: true, force: true });
    } catch (error) {
      logger.error(`Failed to cleanup local environment for ${evaluationId}:`, error);
    }
  }

  async executeCommand(evaluationId: string, command: string, args: string[] = []): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const environment = this.environments.get(evaluationId);
    if (!environment) {
      throw new Error(`Environment not found for evaluation ${evaluationId}`);
    }

    switch (environment.type) {
      case 'docker':
        return await this.executeDockerCommandInContainer(evaluationId, command, args);
      case 'sandbox':
        return await this.executeSandboxCommand(evaluationId, command, args);
      case 'local':
        return await this.executeLocalCommand(command, args, environment.credentials?.workdir);
      default:
        throw new Error(`Unsupported environment type: ${environment.type}`);
    }
  }

  private async executeDockerCommandInContainer(evaluationId: string, command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const dockerEnv = this.dockerEnvironments.get(evaluationId);
    if (!dockerEnv) {
      throw new Error(`Docker environment not found for evaluation ${evaluationId}`);
    }

    const dockerArgs = ['exec', dockerEnv.containerId, command, ...args];
    return await this.executeDockerCommandWithOutput(dockerArgs);
  }

  private async executeSandboxCommand(evaluationId: string, command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // This would integrate with the sandbox API
    // For now, execute locally
    return await this.executeLocalCommand(command, args);
  }

  private async executeLocalCommand(command: string, args: string[] = [], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd,
        stdio: 'pipe',
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      child.on('error', (error) => {
        logger.error(`Command execution failed: ${command} ${args.join(' ')}`, error);
        resolve({
          stdout: '',
          stderr: error.message,
          exitCode: 1
        });
      });
    });
  }

  private async executeDockerCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, { stdio: 'pipe' });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Docker command failed: ${stderr}`));
        }
      });

      child.on('error', reject);
    });
  }

  private async executeDockerCommandWithOutput(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const child = spawn('docker', args, { stdio: 'pipe' });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      child.on('error', (error) => {
        resolve({
          stdout: '',
          stderr: error.message,
          exitCode: 1
        });
      });
    });
  }

  private async createDockerNetwork(): Promise<void> {
    try {
      await this.executeDockerCommand(['network', 'create', 'haseb-network']);
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  private async buildDockerImage(workdir: string): Promise<void> {
    await this.executeDockerCommand(['build', '-t', 'haseb-evaluator:latest', workdir]);
  }

  private async waitForContainer(containerId: string, timeout: number = 60000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const info = await this.getDockerContainerInfo(containerId);
        if (info.State === 'running') {
          return;
        }
      } catch (error) {
        // Container might not be ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Container ${containerId} did not start within ${timeout}ms`);
  }

  private async getDockerContainerInfo(containerId: string): Promise<any> {
    const output = await this.executeDockerCommand(['inspect', containerId]);
    const info = JSON.parse(output)[0];
    return info;
  }

  async getEnvironmentStatus(evaluationId: string): Promise<EvaluationEnvironment | null> {
    const environment = this.environments.get(evaluationId);
    if (!environment) {
      return null;
    }

    // Update status based on actual environment state
    if (environment.type === 'docker') {
      const dockerEnv = this.dockerEnvironments.get(evaluationId);
      if (dockerEnv) {
        try {
          const info = await this.getDockerContainerInfo(dockerEnv.containerId);
          environment.status = info.State === 'running' ? 'ready' : 'destroyed';
        } catch (error) {
          environment.status = 'destroyed';
        }
      }
    }

    return environment;
  }

  async getEnvironmentMetrics(evaluationId: string): Promise<any> {
    const environment = this.environments.get(evaluationId);
    if (!environment || environment.type !== 'docker') {
      return {};
    }

    const dockerEnv = this.dockerEnvironments.get(evaluationId);
    if (!dockerEnv) {
      return {};
    }

    try {
      const stats = await this.executeDockerCommand(['stats', '--no-stream', '--format', 'json', dockerEnv.containerId]);
      return JSON.parse(stats);
    } catch (error) {
      logger.error(`Failed to get Docker stats for ${evaluationId}:`, error);
      return {};
    }
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupStaleEnvironments();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Stop the periodic stale-environment cleanup timer. This releases the
   * interval handle created in the constructor so the process (or a test
   * runner) is not kept alive by a dangling timer.
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private async cleanupStaleEnvironments(): Promise<void> {
    const staleThreshold = 2 * 60 * 60 * 1000; // 2 hours
    const now = Date.now();

    for (const [evaluationId, environment] of this.environments.entries()) {
      const dockerEnv = this.dockerEnvironments.get(evaluationId);
      if (dockerEnv && (now - dockerEnv.lastActivity.getTime()) > staleThreshold) {
        logger.info(`Cleaning up stale environment: ${evaluationId}`);
        await this.cleanupEnvironment(evaluationId).catch(error => {
          logger.error(`Failed to cleanup stale environment ${evaluationId}:`, error);
        });
      }
    }
  }

  async cleanupAll(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    const environmentIds = Array.from(this.environments.keys());
    await Promise.all(environmentIds.map(id =>
      this.cleanupEnvironment(id).catch(error =>
        logger.error(`Failed to cleanup environment ${id}:`, error)
      )
    ));

    logger.info('All environments cleaned up');
  }

  getEnvironmentStats(): any {
    return {
      totalEnvironments: this.environments.size,
      dockerEnvironments: this.dockerEnvironments.size,
      sandboxEnvironments: this.sandboxEnvironments.size,
      resourceLimits: this.resourceLimits,
      activeEnvironments: Array.from(this.environments.values()).filter(env => env.status === 'ready').length
    };
  }
}