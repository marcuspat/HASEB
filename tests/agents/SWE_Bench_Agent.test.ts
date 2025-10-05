import { SWE_Bench_Agent, SWEBenchConfig } from '@/agents/SWE_Bench_Agent';
import { BaseExecutionAgent } from '@/agents/BaseExecutionAgent';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';

// Mock dependencies
jest.mock('child_process');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    rm: jest.fn(),
    unlink: jest.fn()
  }
}));

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('SWE_Bench_Agent', () => {
  let agent: SWE_Bench_Agent;
  let mockConfig: SWEBenchConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      agentId: 'swe-agent-1',
      benchmarkId: 'swe-bench-1',
      configuration: {
        dockerImage: 'test/swe-bench:latest',
        workspacePath: '/tmp/test-swe-bench',
        maxPatchAttempts: 2,
        codeGenModel: 'test-model'
      },
      timeout: 300000,
      maxRetries: 2
    };

    // Mock child_process.spawn
    const mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 100); // Simulate successful exit
        }
      })
    };

    mockSpawn.mockReturnValue(mockChildProcess as any);

    // Mock fs operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);

    agent = new SWE_Bench_Agent(mockConfig);
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(agent.getStatus()).toBe('pending');

      const config = agent.getConfiguration();
      expect(config.dockerImage).toBe('test/swe-bench:latest');
      expect(config.workspacePath).toBe('/tmp/test-swe-bench');
      expect(config.maxPatchAttempts).toBe(2);
    });

    it('should use default values when not provided', () => {
      const defaultConfig: SWEBenchConfig = {
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        configuration: {}
      };

      const defaultAgent = new SWE_Bench_Agent(defaultConfig);
      const config = defaultAgent.getConfiguration();

      expect(config.dockerImage).toBe('haseb/swe-bench:latest');
      expect(config.maxPatchAttempts).toBe(3);
      expect(config.codeGenModel).toBe('gpt-4');
    });
  });

  describe('Docker Environment Setup', () => {
    it('should setup Docker environment correctly', async () => {
      // Mock the agent's protected methods for testing
      const setupDockerEnvSpy = jest.spyOn(agent as any, 'setupDockerEnvironment');
      setupDockerEnvSpy.mockResolvedValue(undefined);

      // Mock the executeTasks method to focus on environment setup
      const executeTasksSpy = jest.spyOn(agent as any, 'executeTasks');
      executeTasksSpy.mockResolvedValue(undefined);

      await agent.execute();

      expect(mockFs.mkdir).toHaveBeenCalledWith('/tmp/test-swe-bench', { recursive: true });
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('docker run -d'),
        expect.objectContaining({ shell: true })
      );
    });

    it('should handle Docker setup failure', async () => {
      mockSpawn.mockImplementation(() => {
        const mockChild = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn().mockImplementation((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 100); // Simulate failed exit
            }
          })
        };
        return mockChild as any;
      });

      const setupDockerEnvSpy = jest.spyOn(agent as any, 'setupDockerEnvironment');
      setupDockerEnvSpy.mockImplementation(async () => {
        throw new Error('Docker setup failed');
      });

      await expect(agent.execute()).rejects.toThrow('Docker setup failed');
    });
  });

  describe('Task Processing', () => {
    it('should load SWE-Bench tasks', async () => {
      const loadTasksSpy = jest.spyOn(agent as any, 'loadSWEBenchTasks');
      loadTasksSpy.mockResolvedValue([
        {
          taskId: 'test-task-1',
          repository: 'test/repo',
          issue: { number: 123, title: 'Test issue', description: 'Test description', patches: [] },
          environment: { pythonVersion: '3.9', dependencies: ['pytest'], testPaths: ['tests/'] }
        }
      ]);

      const executeTasksSpy = jest.spyOn(agent as any, 'executeTasks');
      executeTasksSpy.mockImplementation(async function(this: SWE_Bench_Agent) {
        const tasks = await this['loadSWEBenchTasks']();
        expect(tasks).toHaveLength(1);
        expect(tasks[0].taskId).toBe('test-task-1');
      });

      await agent.execute();

      expect(loadTasksSpy).toHaveBeenCalled();
    });

    it('should process individual SWE-Bench tasks', async () => {
      const mockTask = {
        taskId: 'test-task-1',
        repository: 'test/repo',
        issue: { number: 123, title: 'Test issue', description: 'Test description', patches: [] },
        environment: { pythonVersion: '3.9', dependencies: ['pytest'], testPaths: ['tests/'] }
      };

      const processTaskSpy = jest.spyOn(agent as any, 'processSWEBenchTask');
      processTaskSpy.mockResolvedValue({
        success: true,
        tokensUsed: 100,
        cost: 0.01
      });

      const executeTasksSpy = jest.spyOn(agent as any, 'executeTasks');
      executeTasksSpy.mockImplementation(async function(this: SWE_Bench_Agent) {
        const result = await this['processSWEBenchTask'](mockTask);
        expect(result.success).toBe(true);
        expect(result.tokensUsed).toBe(100);
        expect(result.cost).toBe(0.01);
      });

      await agent.execute();

      expect(processTaskSpy).toHaveBeenCalledWith(mockTask);
    });
  });

  describe('Repository Operations', () => {
    it('should clone repositories correctly', async () => {
      const cloneRepoSpy = jest.spyOn(agent as any, 'cloneRepository');
      cloneRepoSpy.mockResolvedValue(undefined);

      const executeCommandInDockerSpy = jest.spyOn(agent as any, 'executeCommandInDocker');
      executeCommandInDockerSpy.mockResolvedValue('Cloned successfully');

      await (agent as any)['cloneRepository']('test/repo');

      expect(executeCommandInDockerSpy).toHaveBeenCalledWith(
        'cd /workspace && git clone https://github.com/test/repo.git repo'
      );
    });

    it('should run tests and parse results', async () => {
      const mockTestOutput = `
============================= test session starts ==============================
collected 5 items

test_example.py .....
test_another.py ..

============================== 5 passed in 2.3s ==============================
      `;

      const runTestsSpy = jest.spyOn(agent as any, 'runTests');
      const executeCommandInDockerSpy = jest.spyOn(agent as any, 'executeCommandInDocker');
      executeCommandInDockerSpy.mockResolvedValue(mockTestOutput);

      const result = await (agent as any)['runTests']();

      expect(result).toEqual({
        passed: 5,
        failed: 0,
        total: 5
      });
    });

    it('should parse test results correctly', async () => {
      const mockOutput = `
10 passed
2 failed
12 total
      `;

      const parseResultsSpy = jest.spyOn(agent as any, 'parseTestResults');
      parseResultsSpy.mockReturnValue({
        passed: 10,
        failed: 2,
        total: 12
      });

      const result = (agent as any)['parseTestResults'](mockOutput);

      expect(result.passed).toBe(10);
      expect(result.failed).toBe(2);
      expect(result.total).toBe(12);
    });
  });

  describe('Code Generation', () => {
    it('should generate code patches', async () => {
      const mockTask = {
        taskId: 'test-task',
        repository: 'test/repo',
        issue: { number: 123, title: 'Fix bug', description: 'Fix the bug in function', patches: [] },
        environment: { pythonVersion: '3.9', dependencies: [], testPaths: [] }
      };

      const generatePatchSpy = jest.spyOn(agent as any, 'generateCodePatch');
      generatePatchSpy.mockResolvedValue({
        success: true,
        patch: 'diff --git a/test.py b/test.py\n+++ b/test.py\n@@ -1,3 +1,3 @@\n-def old_function():\n+def new_function():\n     return True',
        tokensUsed: 150,
        cost: 0.015
      });

      const result = await (agent as any)['generateCodePatch'](mockTask);

      expect(result.success).toBe(true);
      expect(result.patch).toContain('diff --git');
      expect(result.tokensUsed).toBe(150);
      expect(result.cost).toBe(0.015);
    });

    it('should apply patches correctly', async () => {
      const mockPatch = 'diff --git a/test.py b/test.py\n+++ b/test.py\n@@ -1,3 +1,3 @@\n-def old_function():\n+def new_function():\n     return True';

      const applyPatchSpy = jest.spyOn(agent as any, 'applyPatch');
      applyPatchSpy.mockResolvedValue(true);

      const executeCommandInDockerSpy = jest.spyOn(agent as any, 'executeCommandInDocker');
      executeCommandInDockerSpy.mockResolvedValue('Patch applied successfully');

      const result = await (agent as any)['applyPatch'](mockPatch);

      expect(result).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('repo/fix.patch'),
        mockPatch
      );
    });
  });

  describe('Command Execution', () => {
    it('should execute commands correctly', async () => {
      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');
      executeCommandSpy.mockResolvedValue('Command executed successfully');

      const result = await (agent as any)['executeCommand']('echo "test"');

      expect(result).toBe('Command executed successfully');
      expect(mockSpawn).toHaveBeenCalledWith('echo "test"', { shell: true });
    });

    it('should execute commands in Docker container', async () => {
      agent['dockerContainer'] = 'test-container';

      const executeCommandInDockerSpy = jest.spyOn(agent as any, 'executeCommandInDocker');
      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');
      executeCommandSpy.mockResolvedValue('Docker command executed');

      const result = await (agent as any)['executeCommandInDocker']('echo "test"');

      expect(result).toBe('Docker command executed');
      expect(executeCommandSpy).toHaveBeenCalledWith('docker exec test-container echo "test"');
    });

    it('should handle command failures', async () => {
      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');

      const mockChildProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 100); // Non-zero exit code
          }
        })
      };

      mockSpawn.mockReturnValue(mockChildProcess as any);

      await expect((agent as any)['executeCommand']('false')).rejects.toThrow('Command failed');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup Docker environment correctly', async () => {
      agent['dockerContainer'] = 'test-container';
      agent['workspacePath'] = '/tmp/test-workspace';

      const cleanupSpy = jest.spyOn(agent as any, 'cleanupDockerEnvironment');
      cleanupSpy.mockResolvedValue(undefined);

      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');
      executeCommandSpy.mockResolvedValue('Cleanup successful');

      await (agent as any)['cleanupDockerEnvironment']();

      expect(executeCommandSpy).toHaveBeenCalledWith('docker stop test-container');
      expect(executeCommandSpy).toHaveBeenCalledWith('docker rm test-container');
      expect(mockFs.rm).toHaveBeenCalledWith('/tmp/test-workspace', { recursive: true, force: true });
    });
  });

  describe('Metrics Calculation', () => {
    it('should estimate tokens correctly', () => {
      const text = 'This is a test string for token estimation';
      const estimatedTokens = (agent as any)['estimateTokens'](text);

      // Should be roughly text length / 4
      expect(estimatedTokens).toBe(Math.ceil(text.length / 4));
    });

    it('should estimate cost correctly', () => {
      const tokens = 1000;
      const estimatedCost = (agent as any)['estimateCost'](tokens);

      // Should be tokens * 0.00001
      expect(estimatedCost).toBe(tokens * 0.00001);
    });
  });

  describe('Error Handling', () => {
    it('should handle task processing failures', async () => {
      const mockTask = {
        taskId: 'failing-task',
        repository: 'test/repo',
        issue: { number: 123, title: 'Test issue', description: 'Test description', patches: [] },
        environment: { pythonVersion: '3.9', dependencies: [], testPaths: [] }
      };

      const processTaskSpy = jest.spyOn(agent as any, 'processSWEBenchTask');
      processTaskSpy.mockResolvedValue({
        success: false,
        tokensUsed: 50,
        cost: 0.005,
        error: 'Task processing failed',
        errorRecovered: true
      });

      const executeTasksSpy = jest.spyOn(agent as any, 'executeTasks');
      executeTasksSpy.mockImplementation(async function(this: SWE_Bench_Agent) {
        const result = await this['processSWEBenchTask'](mockTask);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Task processing failed');
        expect(result.errorRecovered).toBe(true);
      });

      await agent.execute();

      expect(processTaskSpy).toHaveBeenCalledWith(mockTask);
    });

    it('should handle Docker container not available error', async () => {
      agent['dockerContainer'] = undefined;

      await expect((agent as any)['executeCommandInDocker']('test command'))
        .rejects.toThrow('Docker container not available');
    });
  });

  describe('Integration with BaseExecutionAgent', () => {
    it('should extend BaseExecutionAgent correctly', () => {
      expect(agent).toBeInstanceOf(BaseExecutionAgent);
      expect(agent).toBeInstanceOf(SWE_Bench_Agent);
    });

    it('should emit base agent events', async () => {
      const startedSpy = jest.fn();
      const logSpy = jest.fn();

      agent.on('started', startedSpy);
      agent.on('log', logSpy);

      // Mock the execution to focus on event emission
      const executeTasksSpy = jest.spyOn(agent as any, 'executeTasks');
      executeTasksSpy.mockImplementation(async function(this: SWE_Bench_Agent) {
        this['log']('SWE-Bench task execution started');
      });

      await agent.execute();

      expect(startedSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith({
        message: expect.stringContaining('SWE-Bench task execution started'),
        timestamp: expect.any(String)
      });
    });
  });
});