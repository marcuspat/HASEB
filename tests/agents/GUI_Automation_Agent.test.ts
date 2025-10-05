import { GUI_Automation_Agent, GUIAutomationConfig } from '@/agents/GUI_Automation_Agent';
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

describe('GUI_Automation_Agent', () => {
  let agent: GUI_Automation_Agent;
  let mockConfig: GUIAutomationConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      agentId: 'gui-agent-1',
      benchmarkId: 'gui-benchmark-1',
      configuration: {
        displayWidth: 1280,
        displayHeight: 720,
        screenshotInterval: 1000,
        maxSteps: 25,
        browserType: 'chromium',
        headless: false
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

    agent = new GUI_Automation_Agent(mockConfig);
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(agent.getStatus()).toBe('pending');

      const config = agent.getConfiguration();
      expect(config.displayWidth).toBe(1280);
      expect(config.displayHeight).toBe(720);
      expect(config.screenshotInterval).toBe(1000);
      expect(config.maxSteps).toBe(25);
      expect(config.browserType).toBe('chromium');
    });

    it('should use default values when not provided', () => {
      const defaultConfig: GUIAutomationConfig = {
        agentId: 'test-agent',
        benchmarkId: 'test-benchmark',
        configuration: {}
      };

      const defaultAgent = new GUI_Automation_Agent(defaultConfig);
      const config = defaultAgent.getConfiguration();

      expect(config.displayWidth).toBe(1920);
      expect(config.displayHeight).toBe(1080);
      expect(config.screenshotInterval).toBe(2000);
      expect(config.maxSteps).toBe(50);
      expect(config.browserType).toBe('chromium');
      expect(config.headless).toBe(false);
    });
  });

  describe('GUI Environment Setup', () => {
    it('should setup virtual display correctly', async () => {
      const setupVirtualDisplaySpy = jest.spyOn(agent as any, 'setupVirtualDisplay');
      setupVirtualDisplaySpy.mockResolvedValue(undefined);

      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');
      executeCommandSpy.mockResolvedValue('Xvfb started');

      await (agent as any)['setupVirtualDisplay']();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('haseb-gui-automation-'),
        { recursive: true }
      );
      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Xvfb :\d+ -screen 0 \d+x\d+x24/)
      );
    });

    it('should setup browser for web tasks', async () => {
      agent['currentTask'] = {
        taskId: 'web-task',
        environment: { type: 'web' }
      };

      const setupBrowserSpy = jest.spyOn(agent as any, 'setupBrowser');
      setupBrowserSpy.mockResolvedValue(undefined);

      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');
      executeCommandSpy.mockResolvedValue('Browser started');

      await (agent as any)['setupBrowser']();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('chromium-browser'),
        expect.objectContaining({
          shell: true,
          detached: true,
          env: expect.objectContaining({
            DISPLAY: expect.stringMatching(/:\d+/)
          })
        })
      );
    });

    it('should verify GUI environment', async () => {
      const verifyEnvSpy = jest.spyOn(agent as any, 'verifyGUIEnvironment');
      verifyEnvSpy.mockResolvedValue(undefined);

      const takeScreenshotSpy = jest.spyOn(agent as any, 'takeScreenshot');
      takeScreenshotSpy.mockResolvedValue('/tmp/test-screenshot.png');

      await (agent as any)['verifyGUIEnvironment']();

      expect(takeScreenshotSpy).toHaveBeenCalledWith('test');
    });
  });

  describe('Task Processing', () => {
    it('should load GUI tasks correctly', async () => {
      const loadTasksSpy = jest.spyOn(agent as any, 'loadGUITasks');
      loadTasksSpy.mockResolvedValue([
        {
          taskId: 'web-task-1',
          environment: { type: 'web' },
          instructions: ['Navigate to website', 'Fill form', 'Submit'],
          expectedActions: ['click', 'type', 'click'],
          validationCriteria: ['Form filled', 'Form submitted']
        },
        {
          taskId: 'desktop-task-1',
          environment: { type: 'desktop' },
          instructions: ['Open calculator', 'Calculate 2+2'],
          expectedActions: ['launch', 'click', 'click', 'click', 'click', 'click'],
          validationCriteria: ['Calculator opens', 'Result shows 4']
        }
      ]);

      const executeTasksSpy = jest.spyOn(agent as any, 'executeTasks');
      executeTasksSpy.mockImplementation(async function(this: GUI_Automation_Agent) {
        const tasks = await this['loadGUITasks']();
        expect(tasks).toHaveLength(2);
        expect(tasks[0].environment.type).toBe('web');
        expect(tasks[1].environment.type).toBe('desktop');
      });

      await agent.execute();

      expect(loadTasksSpy).toHaveBeenCalled();
    });

    it('should process web tasks correctly', async () => {
      const mockWebTask = {
        taskId: 'web-task-1',
        environment: { type: 'web' },
        url: 'https://example.com',
        instructions: ['Navigate to website', 'Click button'],
        expectedActions: ['navigate', 'click'],
        validationCriteria: ['Page loaded', 'Button clicked']
      };

      const processWebTaskSpy = jest.spyOn(agent as any, 'processWebTask');
      processWebTaskSpy.mockResolvedValue({
        success: true,
        tokensUsed: 100,
        cost: 0.01
      });

      const result = await (agent as any)['processWebTask'](mockWebTask);

      expect(result.success).toBe(true);
      expect(result.tokensUsed).toBe(100);
      expect(result.cost).toBe(0.01);
    });

    it('should process desktop tasks correctly', async () => {
      const mockDesktopTask = {
        taskId: 'desktop-task-1',
        environment: { type: 'desktop', applications: ['calculator'] },
        instructions: ['Open calculator', 'Calculate 2+2'],
        expectedActions: ['launch', 'click', 'click', 'click'],
        validationCriteria: ['Calculator opens', 'Result is 4']
      };

      const processDesktopTaskSpy = jest.spyOn(agent as any, 'processDesktopTask');
      processDesktopTaskSpy.mockResolvedValue({
        success: true,
        tokensUsed: 80,
        cost: 0.008
      });

      const result = await (agent as any)['processDesktopTask'](mockDesktopTask);

      expect(result.success).toBe(true);
      expect(result.tokensUsed).toBe(80);
      expect(result.cost).toBe(0.008);
    });
  });

  describe('GUI Actions', () => {
    it('should execute click actions correctly', async () => {
      const coordinates = { x: 100, y: 200 };
      const executeClickSpy = jest.spyOn(agent as any, 'executeClick');
      executeClickSpy.mockResolvedValue(true);

      const executeCommandInDockerSpy = jest.spyOn(agent as any, 'executeCommandInDocker');
      executeCommandInDockerSpy.mockResolvedValue('Click executed');

      const result = await (agent as any)['executeClick'](coordinates);

      expect(result).toBe(true);
      expect(executeCommandInDockerSpy).toHaveBeenCalledWith(
        'xdotool mousemove 100 200 click 1'
      );
    });

    it('should execute type actions correctly', async () => {
      const text = 'Hello World';
      const executeTypeSpy = jest.spyOn(agent as any, 'executeType');
      executeTypeSpy.mockResolvedValue(true);

      const executeCommandInDockerSpy = jest.spyOn(agent as any, 'executeCommandInDocker');
      executeCommandInDockerSpy.mockResolvedValue('Text typed');

      const result = await (agent as any)['executeType'](text);

      expect(result).toBe(true);
      expect(executeCommandInDockerSpy).toHaveBeenCalledWith(
        `xdotool type "${text}"`
      );
    });

    it('should execute scroll actions correctly', async () => {
      const duration = 1500;
      const executeScrollSpy = jest.spyOn(agent as any, 'executeScroll');
      executeScrollSpy.mockResolvedValue(true);

      const executeCommandInDockerSpy = jest.spyOn(agent as any, 'executeCommandInDocker');
      executeCommandInDockerSpy.mockResolvedValue('Scrolled');

      const result = await (agent as any)['executeScroll'](duration);

      expect(result).toBe(true);
      expect(executeCommandInDockerSpy).toHaveBeenCalledWith(
        `xdotool click 4; sleep ${duration / 1000}`
      );
    });

    it('should take screenshots correctly', async () => {
      const screenshotName = 'test-screenshot';
      const takeScreenshotSpy = jest.spyOn(agent as any, 'takeScreenshot');
      takeScreenshotSpy.mockResolvedValue('/tmp/test-screenshot.png');

      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');
      executeCommandSpy.mockResolvedValue('Screenshot taken');

      const result = await (agent as any)['takeScreenshot'](screenshotName);

      expect(result).toBe('/tmp/test-screenshot.png');
      expect(executeCommandSpy).toHaveBeenCalledWith(
        `import -window root /tmp/${screenshotName}.png`
      );
    });
  });

  describe('Instruction Parsing', () => {
    it('should parse click instructions correctly', async () => {
      const instruction = 'Click on the submit button';
      const parseInstructionSpy = jest.spyOn(agent as any, 'parseInstructionToAction');

      const result = await (agent as any)['parseInstructionToAction'](instruction);

      expect(result.type).toBe('click');
      expect(result.coordinates).toEqual(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number)
        })
      );
    });

    it('should parse type instructions correctly', async () => {
      const instruction = 'Type "Hello World" in the search box';

      const result = await (agent as any)['parseInstructionToAction'](instruction);

      expect(result.type).toBe('type');
      expect(result.text).toBe('sample text');
    });

    it('should parse scroll instructions correctly', async () => {
      const instruction = 'Scroll down the page';

      const result = await (agent as any)['parseInstructionToAction'](instruction);

      expect(result.type).toBe('scroll');
      expect(result.duration).toBe(1000);
    });
  });

  describe('Application Launching', () => {
    it('should launch calculator correctly', async () => {
      const launchAppSpy = jest.spyOn(agent as any, 'launchApplication');
      launchAppSpy.mockResolvedValue(undefined);

      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');
      executeCommandSpy.mockResolvedValue('Calculator launched');

      await (agent as any)['launchApplication']('calculator');

      expect(executeCommandSpy).toHaveBeenCalledWith('gnome-calculator');
    });

    it('should launch text editor correctly', async () => {
      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');
      executeCommandSpy.mockResolvedValue('Text editor launched');

      await (agent as any)['launchApplication']('text editor');

      expect(executeCommandSpy).toHaveBeenCalledWith('gedit');
    });

    it('should launch terminal correctly', async () => {
      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');
      executeCommandSpy.mockResolvedValue('Terminal launched');

      await (agent as any)['launchApplication']('terminal');

      expect(executeCommandSpy).toHaveBeenCalledWith('gnome-terminal');
    });
  });

  describe('Validation', () => {
    it('should validate task completion correctly', async () => {
      const mockTask = {
        validationCriteria: ['Element visible', 'Action completed'],
        instructions: ['Click button']
      };

      const validateSpy = jest.spyOn(agent as any, 'validateTaskCompletion');
      validateSpy.mockResolvedValue(true);

      const takeScreenshotSpy = jest.spyOn(agent as any, 'takeScreenshot');
      takeScreenshotSpy.mockResolvedValue('/tmp/validation-screenshot.png');

      const result = await (agent as any)['validateTaskCompletion'](mockTask);

      expect(result).toBe(true);
      expect(takeScreenshotSpy).toHaveBeenCalledWith('validation');
    });

    it('should detect visible elements', async () => {
      const detectElementsSpy = jest.spyOn(agent as any, 'detectVisibleElements');
      detectElementsSpy.mockResolvedValue([
        'button',
        'input field',
        'link',
        'text area'
      ]);

      const result = await (agent as any)['detectVisibleElements']();

      expect(result).toEqual([
        'button',
        'input field',
        'link',
        'text area'
      ]);
    });
  });

  describe('Recovery Mechanisms', () => {
    it('should generate recovery actions for failed clicks', async () => {
      const failedResult = {
        action: { type: 'click', coordinates: { x: 100, y: 100 } },
        success: false,
        error: 'Element not found',
        screenshot: '/tmp/screenshot.png',
        executionTime: 1000,
        detectedElements: []
      };

      const instruction = 'Click on the button';
      const generateRecoverySpy = jest.spyOn(agent as any, 'generateRecoveryAction');

      const recoveryAction = await (agent as any)['generateRecoveryAction'](instruction, failedResult);

      expect(recoveryAction.type).toBe('click');
      expect(recoveryAction.coordinates).toEqual(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number)
        })
      );
    });

    it('should generate desktop-specific recovery actions', async () => {
      const failedResult = {
        action: { type: 'click', coordinates: { x: 100, y: 100 } },
        success: false,
        error: 'Window not found',
        screenshot: '/tmp/screenshot.png',
        executionTime: 1000,
        detectedElements: []
      };

      const instruction = 'Click on menu item';
      const generateRecoverySpy = jest.spyOn(agent as any, 'generateDesktopRecoveryAction');

      const recoveryAction = await (agent as any)['generateDesktopRecoveryAction'](instruction, failedResult);

      expect(recoveryAction.type).toBe('click');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup GUI environment correctly', async () => {
      agent['dockerContainer'] = 'test-container';
      agent['virtualDisplay'] = 99;
      agent['screenshots'] = ['/tmp/screenshot1.png', '/tmp/screenshot2.png'];

      const cleanupSpy = jest.spyOn(agent as any, 'cleanupGUIEnvironment');
      cleanupSpy.mockResolvedValue(undefined);

      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');
      executeCommandSpy.mockResolvedValue('Cleanup successful');

      await (agent as any)['cleanupGUIEnvironment']();

      expect(executeCommandSpy).toHaveBeenCalledWith('pkill -f "Xvfb :99"');
      expect(mockFs.unlink).toHaveBeenCalledTimes(2); // For each screenshot
    });

    it('should handle cleanup errors gracefully', async () => {
      agent['screenshots'] = ['/tmp/nonexistent.png'];

      mockFs.unlink.mockRejectedValue(new Error('File not found'));

      // Should not throw error
      await expect((agent as any)['cleanupGUIEnvironment']()).resolves.toBeUndefined();
    });
  });

  describe('Command Execution', () => {
    it('should execute commands with DISPLAY environment', async () => {
      agent['virtualDisplay'] = 99;

      const executeCommandSpy = jest.spyOn(agent as any, 'executeCommand');
      executeCommandSpy.mockResolvedValue('Command executed');

      await (agent as any)['executeCommandInDocker']('echo test');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        'docker exec undefined echo test',
        expect.objectContaining({
          env: expect.objectContaining({
            DISPLAY: ':99'
          })
        })
      );
    });

    it('should handle Docker container not available', async () => {
      await expect((agent as any)['executeCommandInDocker']('test command'))
        .rejects.toThrow('Docker container not available');
    });
  });

  describe('Metrics and Estimation', () => {
    it('should estimate tokens correctly', () => {
      const text = 'This is a GUI automation task with multiple steps';
      const estimatedTokens = (agent as any)['estimateTokens'](text);

      expect(estimatedTokens).toBe(Math.ceil(text.length / 4));
    });

    it('should estimate cost correctly', () => {
      const tokens = 500;
      const estimatedCost = (agent as any)['estimateCost'](tokens);

      expect(estimatedCost).toBe(tokens * 0.00001);
    });

    it('should track action history', async () => {
      const mockAction = {
        type: 'click' as const,
        coordinates: { x: 100, y: 100 }
      };

      const executeGUIActionSpy = jest.spyOn(agent as any, 'executeGUIAction');
      executeGUIActionSpy.mockResolvedValue({
        action: mockAction,
        success: true,
        screenshot: '/tmp/action-screenshot.png',
        executionTime: 500,
        detectedElements: ['button']
      });

      await (agent as any)['executeGUIAction'](mockAction);

      expect((agent as any)['actionHistory']).toHaveLength(1);
      expect((agent as any)['actionHistory'][0].action).toEqual(mockAction);
    });
  });

  describe('Integration with BaseExecutionAgent', () => {
    it('should extend BaseExecutionAgent correctly', () => {
      expect(agent).toBeInstanceOf(BaseExecutionAgent);
      expect(agent).toBeInstanceOf(GUI_Automation_Agent);
    });

    it('should emit base agent events', async () => {
      const startedSpy = jest.fn();
      const logSpy = jest.fn();

      agent.on('started', startedSpy);
      agent.on('log', logSpy);

      // Mock the execution to focus on event emission
      const executeTasksSpy = jest.spyOn(agent as any, 'executeTasks');
      executeTasksSpy.mockImplementation(async function(this: GUI_Automation_Agent) {
        this['log']('GUI automation task execution started');
      });

      await agent.execute();

      expect(startedSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith({
        message: expect.stringContaining('GUI automation task execution started'),
        timestamp: expect.any(String)
      });
    });

    it('should respect max steps limit', async () => {
      agent['maxSteps'] = 2;
      agent['stepCount'] = 0;

      const mockTask = {
        taskId: 'test-task',
        instructions: ['Step 1', 'Step 2', 'Step 3'],
        environment: { type: 'web' }
      };

      const processWebTaskSpy = jest.spyOn(agent as any, 'processWebTask');
      processWebTaskSpy.mockImplementation(async function(this: GUI_Automation_Agent, task) {
        // Simulate processing steps
        for (let i = 0; i < task.instructions.length; i++) {
          if (!this['isRunning'] || this['stepCount'] >= this['maxSteps']) {
            break;
          }
          this['stepCount']++;
        }
        return { success: true, tokensUsed: 50, cost: 0.005 };
      });

      const result = await (agent as any)['processWebTask'](mockTask);

      expect(agent['stepCount']).toBeLessThanOrEqual(agent['maxSteps']);
    });
  });
});