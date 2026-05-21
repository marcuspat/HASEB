import { BaseExecutionAgent, BaseAgentConfig, TaskExecution, AgentMetrics } from './BaseExecutionAgent';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { logger } from '../utils/logger';

export interface SWEBenchConfig extends BaseAgentConfig {
  dockerImage?: string;
  workspacePath?: string;
  pythonPath?: string;
  testCommand?: string;
  maxPatchAttempts?: number;
  codeGenModel?: string;
  temperature?: number;
}

export interface SWEBenchTask extends TaskExecution {
  repository: string;
  issue: {
    number: number;
    title: string;
    description: string;
    patches: string[];
  };
  environment: {
    pythonVersion: string;
    dependencies: string[];
    testPaths: string[];
  };
}

export interface PatchResult {
  patch: string;
  applied: boolean;
  testResults: {
    passed: number;
    failed: number;
    total: number;
    coverage?: number;
  };
  compilationSuccess: boolean;
  patchQuality: number;
}

export class SWE_Bench_Agent extends BaseExecutionAgent {
  private dockerContainer?: string;
  private workspacePath: string;
  private dockerImage: string;
  private pythonPath: string;
  private testCommand: string;
  private maxPatchAttempts: number;
  private codeGenModel: string;
  private temperature: number;
  private currentTask?: SWEBenchTask;
  private patchAttempts: number = 0;

  constructor(config: SWEBenchConfig) {
    super(config);

    const cfg = config.configuration || {};
    this.dockerImage = config.dockerImage ?? cfg.dockerImage ?? 'haseb/swe-bench:latest';
    this.workspacePath = config.workspacePath ?? cfg.workspacePath ?? `/tmp/haseb-swe-bench-${Date.now()}`;
    this.pythonPath = config.pythonPath ?? cfg.pythonPath ?? 'python3';
    this.testCommand = config.testCommand ?? cfg.testCommand ?? 'pytest -v --tb=short';
    this.maxPatchAttempts = config.maxPatchAttempts ?? cfg.maxPatchAttempts ?? 3;
    this.codeGenModel = config.codeGenModel ?? cfg.codeGenModel ?? 'gpt-4';
    this.temperature = config.temperature ?? cfg.temperature ?? 0.1;
    this.testMode = (config as any).testMode ?? cfg.testMode ?? false;
  }

  private testMode: boolean = false;

  protected async executeTasks(): Promise<void> {
    try {
      this.log('Starting SWE-Bench execution');

      // In testMode, simulate a brief running period without actual execution
      if (this.testMode) {
        await new Promise(resolve => setTimeout(resolve, 200));
        this.log('Test mode execution completed');
        return;
      }

      // Setup Docker environment
      await this.setupDockerEnvironment();

      // Load and process SWE-Bench tasks
      const tasks = await this.loadSWEBenchTasks();
      this.log(`Loaded ${tasks.length} SWE-Bench tasks`);

      this.updateProgress(5, 'Environment setup complete');

      let completedTasks = 0;
      for (const task of tasks) {
        if (!this._running) break;

        this.currentTask = task;
        this.patchAttempts = 0;

        this.log(`Processing task ${task.taskId}: ${task.repository}#${task.issue.number}`);

        const result = await this.processSWEBenchTask(task);

        if (result.success) {
          completedTasks++;
          this.recordTaskCompletion(true, result.tokensUsed, result.cost);
          this.log(`Task ${task.taskId} completed successfully`);
        } else {
          this.recordTaskCompletion(false, result.tokensUsed, result.cost);
          this.log(`Task ${task.taskId} failed: ${result.error}`);

          // Record error recovery attempt
          if (result.errorRecovered) {
            this.recordErrorRecovery();
          }
        }

        const progress = 5 + (completedTasks / tasks.length) * 90;
        this.updateProgress(progress, `Completed ${completedTasks}/${tasks.length} tasks`);
      }

      await this.cleanupDockerEnvironment();

      this.updateProgress(100, `SWE-Bench execution complete. ${completedTasks}/${tasks.length} tasks successful`);
      this.log(`SWE-Bench execution completed: ${completedTasks}/${tasks.length} tasks successful`);

    } catch (error) {
      this.log(`SWE-Bench execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.cleanupDockerEnvironment();
      throw error;
    }
  }

  private async setupDockerEnvironment(): Promise<void> {
    try {
      this.log('Setting up Docker environment for SWE-Bench');

      // Create workspace directory
      await fs.mkdir(this.workspacePath, { recursive: true });

      // Start Docker container
      const containerName = `haseb-swe-bench-${Date.now()}`;
      const dockerCmd = [
        'docker', 'run', '-d',
        '--name', containerName,
        '--mount', `type=bind,source=${this.workspacePath},target=/workspace`,
        '--cpus', '2',
        '--memory', '4g',
        this.dockerImage,
        'tail', '-f', '/dev/null'
      ];

      await this.executeCommand(dockerCmd.join(' '));
      this.dockerContainer = containerName;

      // Wait for container to be ready
      await this.waitForDockerReady();

      // Setup Python environment
      await this.setupPythonEnvironment();

      this.log('Docker environment ready');

    } catch (error) {
      this.log(`Failed to setup Docker environment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async waitForDockerReady(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        await this.executeCommandInDocker('echo "Container ready"');
        return;
      } catch (error) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Docker container failed to become ready');
  }

  private async setupPythonEnvironment(): Promise<void> {
    try {
      this.log('Setting up Python environment');

      // Install required Python packages
      const packages = [
        'pytest',
        'pytest-cov',
        'flake8',
        'black',
        'mypy',
        'setuptools',
        'wheel'
      ];

      for (const pkg of packages) {
        await this.executeCommandInDocker(`pip install ${pkg}`);
      }

      this.log('Python environment setup complete');

    } catch (error) {
      this.log(`Failed to setup Python environment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async loadSWEBenchTasks(): Promise<SWEBenchTask[]> {
    try {
      // For demo purposes, create sample tasks
      // In real implementation, this would load from SWE-Bench dataset
      const tasks: SWEBenchTask[] = [
        {
          taskId: 'swe-bench-1',
          type: 'code-generation',
          input: { repository: 'django/django', issue: 12345 },
          expectedOutput: { patchGenerated: true, testsPassed: true },
          metadata: { difficulty: 'medium' },
          repository: 'django/django',
          issue: {
            number: 12345,
            title: 'Fix query optimization in ORM',
            description: 'The ORM is generating inefficient queries for complex joins',
            patches: []
          },
          environment: {
            pythonVersion: '3.9',
            dependencies: ['django>=4.0', 'pytest-django'],
            testPaths: ['tests/', 'tests/queries/']
          }
        },
        {
          taskId: 'swe-bench-2',
          type: 'code-generation',
          input: { repository: 'numpy/numpy', issue: 23456 },
          expectedOutput: { patchGenerated: true, testsPassed: true },
          metadata: { difficulty: 'hard' },
          repository: 'numpy/numpy',
          issue: {
            number: 23456,
            title: 'Memory leak in array operations',
            description: 'Large array operations are not properly freeing memory',
            patches: []
          },
          environment: {
            pythonVersion: '3.8',
            dependencies: ['numpy>=1.20', 'pytest'],
            testPaths: ['numpy/tests/']
          }
        }
      ];

      return tasks;

    } catch (error) {
      this.log(`Failed to load SWE-Bench tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async processSWEBenchTask(task: SWEBenchTask): Promise<{
    success: boolean;
    tokensUsed: number;
    cost: number;
    error?: string;
    errorRecovered?: boolean;
  }> {
    const startTime = Date.now();
    let tokensUsed = 0;
    let cost = 0;

    try {
      this.log(`Processing repository: ${task.repository}`);

      // Clone repository
      await this.cloneRepository(task.repository);

      // Checkout specific commit/issue
      await this.checkoutIssueCommit(task);

      // Setup repository environment
      await this.setupRepositoryEnvironment(task);

      // Run baseline tests
      const baselineTests = await this.runTests();
      this.log(`Baseline tests: ${baselineTests.passed}/${baselineTests.total} passed`);

      // Generate code patch
      const patchResult = await this.generateCodePatch(task);
      tokensUsed += patchResult.tokensUsed;
      cost += patchResult.cost;

      if (!patchResult.success) {
        return {
          success: false,
          tokensUsed,
          cost,
          error: patchResult.error || 'Failed to generate patch'
        };
      }

      // Apply patch
      const applied = await this.applyPatch(patchResult.patch);
      if (!applied) {
        return {
          success: false,
          tokensUsed,
          cost,
          error: 'Failed to apply generated patch'
        };
      }

      // Run tests with patch
      const testResults = await this.runTests();
      this.log(`Patch tests: ${testResults.passed}/${testResults.total} passed`);

      const executionTime = Date.now() - startTime;
      this.recordStepExecution(executionTime);

      // Determine success based on test results
      const success = testResults.failed === 0 && testResults.passed > 0;

      return {
        success,
        tokensUsed,
        cost,
        errorRecovered: !success && this.patchAttempts < this.maxPatchAttempts
      };

    } catch (error) {
      return {
        success: false,
        tokensUsed,
        cost,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorRecovered: this.patchAttempts < this.maxPatchAttempts
      };
    }
  }

  private async cloneRepository(repository: string): Promise<void> {
    const repoUrl = `https://github.com/${repository}.git`;
    const cloneCmd = `cd /workspace && git clone ${repoUrl} repo`;

    await this.executeCommandInDocker(cloneCmd);
    this.log(`Cloned repository: ${repository}`);
  }

  private async checkoutIssueCommit(task: SWEBenchTask): Promise<void> {
    // In real implementation, this would checkout the specific commit related to the issue
    const checkoutCmd = 'cd /workspace/repo && git checkout main';
    await this.executeCommandInDocker(checkoutCmd);

    this.log(`Checked out repository for issue #${task.issue.number}`);
  }

  private async setupRepositoryEnvironment(task: SWEBenchTask): Promise<void> {
    // Install repository dependencies
    const env = task.environment;

    if (env.dependencies.length > 0) {
      const deps = env.dependencies.join(' ');
      await this.executeCommandInDocker(`cd /workspace/repo && pip install ${deps}`);
    }

    this.log('Repository environment setup complete');
  }

  private async runTests(): Promise<{ passed: number; failed: number; total: number; coverage?: number }> {
    try {
      const testOutput = await this.executeCommandInDocker(
        `cd /workspace/repo && ${this.testCommand} --tb=no --junitxml=test-results.xml`
      );

      // Parse test results from pytest output
      const results = this.parseTestResults(testOutput);

      return results;

    } catch (error) {
      this.log(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { passed: 0, failed: 1, total: 1 };
    }
  }

  private parseTestResults(output: string): { passed: number; failed: number; total: number; coverage?: number } {
    // Simple test result parsing - in real implementation, parse JUnit XML
    const lines = output.split('\n');
    let passed = 0;
    let failed = 0;
    let total = 0;

    for (const line of lines) {
      if (line.includes('passed')) {
        const match = line.match(/(\d+) passed/);
        if (match) passed = parseInt(match[1]);
      }
      if (line.includes('failed')) {
        const match = line.match(/(\d+) failed/);
        if (match) failed = parseInt(match[1]);
      }
    }

    total = passed + failed;
    return { passed, failed, total };
  }

  private async generateCodePatch(task: SWEBenchTask): Promise<{
    success: boolean;
    patch: string;
    tokensUsed: number;
    cost: number;
    error?: string;
  }> {
    try {
      this.log(`Generating code patch for issue #${task.issue.number}`);

      // Get repository context
      const context = await this.getRepositoryContext(task);

      // Simulate LLM call for code generation
      const startTime = Date.now();
      const patch = await this.callCodeGenerationModel(task, context);
      const executionTime = Date.now() - startTime;

      this.recordStepExecution(executionTime);

      // Estimate tokens and cost
      const tokensUsed = this.estimateTokens(task.issue.description + context + patch);
      const cost = this.estimateCost(tokensUsed);

      return {
        success: true,
        patch,
        tokensUsed,
        cost
      };

    } catch (error) {
      return {
        success: false,
        patch: '',
        tokensUsed: 0,
        cost: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getRepositoryContext(task: SWEBenchTask): Promise<string> {
    try {
      // Get relevant source files
      const files = await this.getRelevantFiles(task);

      let context = '';
      for (const file of files) {
        const content = await this.executeCommandInDocker(
          `cd /workspace/repo && cat ${file}`
        );
        context += `File: ${file}\n${content}\n\n`;
      }

      return context;

    } catch (error) {
      this.log(`Failed to get repository context: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return '';
    }
  }

  private async getRelevantFiles(task: SWEBenchTask): Promise<string[]> {
    // Simple heuristic to find relevant files based on issue description
    const issueDesc = task.issue.description.toLowerCase();
    const commonFiles = [
      'models.py',
      'views.py',
      'serializers.py',
      'tests.py',
      'urls.py'
    ];

    // Return relevant files based on issue content
    const relevantFiles: string[] = [];

    if (issueDesc.includes('query') || issueDesc.includes('orm')) {
      relevantFiles.push('**/models.py', '**/query.py', '**/orm.py');
    }
    if (issueDesc.includes('memory')) {
      relevantFiles.push('**/array.py', '**/core.py', '**/memory.py');
    }

    return relevantFiles.length > 0 ? relevantFiles : commonFiles;
  }

  private async callCodeGenerationModel(task: SWEBenchTask, context: string): Promise<string> {
    // Simulate LLM API call for code generation
    // In real implementation, this would call OpenAI/Anthropic/etc.

    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API delay

    const prompt = `
Issue: ${task.issue.title}
Description: ${task.issue.description}

Repository Context:
${context}

Generate a minimal patch that fixes this issue. The patch should be in diff format.
Only generate the necessary changes to fix the issue.
`;

    // Simulate generated patch
    const mockPatch = `diff --git a/file.py b/file.py
index abcdef..123456 100644
--- a/file.py
+++ b/file.py
@@ -10,7 +10,7 @@ def function():
     # Original code with issue
-    problematic_line()
+    fixed_line()
     # Rest of the function
     return result
`;

    return mockPatch;
  }

  private async applyPatch(patch: string): Promise<boolean> {
    try {
      // Write patch to file
      await fs.writeFile(join(this.workspacePath, 'repo', 'fix.patch'), patch);

      // Apply patch using git apply
      await this.executeCommandInDocker('cd /workspace/repo && git apply fix.patch');

      this.log('Patch applied successfully');
      return true;

    } catch (error) {
      this.log(`Failed to apply patch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  private async cleanupDockerEnvironment(): Promise<void> {
    if (this.dockerContainer) {
      try {
        await this.executeCommand(`docker stop ${this.dockerContainer}`);
        await this.executeCommand(`docker rm ${this.dockerContainer}`);
        this.log('Docker environment cleaned up');
      } catch (error) {
        this.log(`Failed to cleanup Docker environment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Cleanup workspace
    try {
      await fs.rm(this.workspacePath, { recursive: true, force: true });
    } catch (error) {
      this.log(`Failed to cleanup workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, { shell: true });
      let output = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${output}`));
        }
      });

      child.on('error', reject);
    });
  }

  private async executeCommandInDocker(command: string): Promise<string> {
    if (!this.dockerContainer) {
      throw new Error('Docker container not available');
    }

    const dockerCmd = `docker exec ${this.dockerContainer} ${command}`;
    return this.executeCommand(dockerCmd);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private estimateCost(tokens: number): number {
    return tokens * 0.00001;
  }

  public override getConfiguration(): Record<string, any> {
    return {
      ...this.configuration,
      dockerImage: this.dockerImage,
      workspacePath: this.workspacePath,
      maxPatchAttempts: this.maxPatchAttempts,
      codeGenModel: this.codeGenModel,
      temperature: this.temperature,
    };
  }
}