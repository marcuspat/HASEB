import { BaseExecutionAgent, BaseAgentConfig, TaskExecution, AgentMetrics } from './BaseExecutionAgent';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface GUIAutomationConfig extends BaseAgentConfig {
  displayWidth?: number;
  displayHeight?: number;
  screenshotInterval?: number;
  maxSteps?: number;
  browserType?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
}

export interface GUITask extends TaskExecution {
  url?: string;
  instructions: string[];
  expectedActions: string[];
  validationCriteria: string[];
  environment: {
    type: 'web' | 'desktop';
    applications?: string[];
    urls?: string[];
  };
}

export interface GUIAction {
  type: 'click' | 'type' | 'scroll' | 'drag' | 'hover' | 'screenshot';
  selector?: string;
  coordinates?: { x: number; y: number };
  text?: string;
  duration?: number;
  screenshot?: string;
}

export interface GUIStepResult {
  action: GUIAction;
  success: boolean;
  screenshot: string;
  executionTime: number;
  error?: string;
  detectedElements: string[];
}

export class GUI_Automation_Agent extends BaseExecutionAgent {
  private displayWidth: number;
  private displayHeight: number;
  private screenshotInterval: number;
  private maxSteps: number;
  private browserType: string;
  private headless: boolean;
  private virtualDisplay?: number;
  private browserProcess?: ChildProcess;
  private currentTask?: GUITask;
  private stepCount: number = 0;
  private screenshots: string[] = [];
  private actionHistory: GUIStepResult[] = [];

  constructor(config: GUIAutomationConfig) {
    super(config);

    this.displayWidth = config.displayWidth || 1920;
    this.displayHeight = config.displayHeight || 1080;
    this.screenshotInterval = config.screenshotInterval || 2000;
    this.maxSteps = config.maxSteps || 50;
    this.browserType = config.browserType || 'chromium';
    this.headless = config.headless || false;
  }

  protected async executeTasks(): Promise<void> {
    try {
      this.log('Starting GUI Automation execution');

      // Setup virtual display and browser
      await this.setupGUIEnvironment();

      // Load GUI automation tasks
      const tasks = await this.loadGUITasks();
      this.log(`Loaded ${tasks.length} GUI automation tasks`);

      this.updateProgress(5, 'GUI environment setup complete');

      let completedTasks = 0;
      for (const task of tasks) {
        if (!this.isRunning) break;

        this.currentTask = task;
        this.stepCount = 0;
        this.actionHistory = [];

        this.log(`Processing GUI task ${task.taskId}: ${task.environment.type} environment`);

        const result = await this.processGUITask(task);

        if (result.success) {
          completedTasks++;
          this.recordTaskCompletion(true, result.tokensUsed, result.cost);
          this.log(`GUI task ${task.taskId} completed successfully`);
        } else {
          this.recordTaskCompletion(false, result.tokensUsed, result.cost);
          this.log(`GUI task ${task.taskId} failed: ${result.error}`);

          if (result.errorRecovered) {
            this.recordErrorRecovery();
          }
        }

        const progress = 5 + (completedTasks / tasks.length) * 90;
        this.updateProgress(progress, `Completed ${completedTasks}/${tasks.length} GUI tasks`);
      }

      await this.cleanupGUIEnvironment();

      this.updateProgress(100, `GUI Automation execution complete. ${completedTasks}/${tasks.length} tasks successful`);
      this.log(`GUI Automation execution completed: ${completedTasks}/${tasks.length} tasks successful`);

    } catch (error) {
      this.log(`GUI Automation execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.cleanupGUIEnvironment();
      throw error;
    }
  }

  private async setupGUIEnvironment(): Promise<void> {
    try {
      this.log('Setting up GUI automation environment');

      // Setup virtual display
      await this.setupVirtualDisplay();

      // Setup browser if needed
      if (this.shouldUseBrowser()) {
        await this.setupBrowser();
      }

      // Verify environment
      await this.verifyGUIEnvironment();

      this.log('GUI automation environment ready');

    } catch (error) {
      this.log(`Failed to setup GUI environment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async setupVirtualDisplay(): Promise<void> {
    try {
      this.log('Setting up virtual display');

      // Start Xvfb for virtual display
      const displayNum = Math.floor(Math.random() * 100) + 10;
      const xvfbCmd = [
        'Xvfb', `:${displayNum}`,
        '-screen', '0', `${this.displayWidth}x${this.displayHeight}x24`,
        '-ac', '+extension', 'GLX', '+render', '-noreset'
      ];

      await this.executeCommand(xvfbCmd.join(' '), { detached: true });
      this.virtualDisplay = displayNum;

      // Set DISPLAY environment variable
      process.env.DISPLAY = `:${displayNum}`;

      this.log(`Virtual display setup on :${displayNum}`);

    } catch (error) {
      this.log(`Failed to setup virtual display: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async setupBrowser(): Promise<void> {
    try {
      this.log(`Setting up ${this.browserType} browser`);

      const browserArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        `--window-size=${this.displayWidth},${this.displayHeight}`
      ];

      if (this.headless) {
        browserArgs.push('--headless');
      }

      let browserCmd: string;
      switch (this.browserType) {
        case 'chromium':
          browserCmd = `chromium-browser ${browserArgs.join(' ')}`;
          break;
        case 'firefox':
          browserCmd = `firefox ${browserArgs.join(' ')}`;
          break;
        default:
          browserCmd = `chromium-browser ${browserArgs.join(' ')}`;
      }

      this.browserProcess = spawn(browserCmd, {
        shell: true,
        detached: true,
        env: { ...process.env, DISPLAY: `:${this.virtualDisplay}` }
      });

      // Wait for browser to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      this.log('Browser setup complete');

    } catch (error) {
      this.log(`Failed to setup browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private shouldUseBrowser(): boolean {
    return this.currentTask?.environment.type === 'web';
  }

  private async verifyGUIEnvironment(): Promise<void> {
    try {
      // Take a test screenshot to verify display is working
      const testScreenshot = await this.takeScreenshot('test');
      if (testScreenshot) {
        this.log('GUI environment verified successfully');
      } else {
        throw new Error('Failed to take test screenshot');
      }
    } catch (error) {
      this.log(`GUI environment verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async loadGUITasks(): Promise<GUITask[]> {
    try {
      // For demo purposes, create sample GUI tasks
      // In real implementation, this would load from WebArena/OSWorld datasets
      const tasks: GUITask[] = [
        {
          taskId: 'gui-web-1',
          type: 'web-automation',
          input: { url: 'https://example.com', instructions: ['Fill form', 'Submit'] },
          expectedOutput: { formSubmitted: true, confirmationShown: true },
          metadata: { difficulty: 'easy' },
          url: 'https://example.com',
          instructions: [
            'Navigate to the website',
            'Find and fill the contact form',
            'Submit the form',
            'Verify confirmation message'
          ],
          expectedActions: ['click', 'type', 'click', 'verify'],
          validationCriteria: [
            'Form fields are populated',
            'Submit button is clicked',
            'Confirmation message appears'
          ],
          environment: {
            type: 'web',
            urls: ['https://example.com']
          }
        },
        {
          taskId: 'gui-desktop-1',
          type: 'desktop-automation',
          input: { application: 'calculator', instructions: ['Open', 'Calculate 2+2'] },
          expectedOutput: { result: 4, applicationRunning: true },
          metadata: { difficulty: 'medium' },
          instructions: [
            'Open the calculator application',
            'Click number 2',
            'Click plus button',
            'Click number 2 again',
            'Click equals button',
            'Verify result shows 4'
          ],
          expectedActions: ['launch', 'click', 'click', 'click', 'click', 'click', 'verify'],
          validationCriteria: [
            'Calculator opens successfully',
            'All buttons are clicked in correct order',
            'Result displays correct calculation'
          ],
          environment: {
            type: 'desktop',
            applications: ['calculator']
          }
        }
      ];

      return tasks;

    } catch (error) {
      this.log(`Failed to load GUI tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async processGUITask(task: GUITask): Promise<{
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
      this.log(`Processing ${task.environment.type} GUI task`);

      if (task.environment.type === 'web') {
        return await this.processWebTask(task);
      } else if (task.environment.type === 'desktop') {
        return await this.processDesktopTask(task);
      } else {
        throw new Error(`Unsupported environment type: ${task.environment.type}`);
      }

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordStepExecution(executionTime);

      return {
        success: false,
        tokensUsed,
        cost,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorRecovered: this.stepCount < this.maxSteps
      };
    }
  }

  private async processWebTask(task: GUITask): Promise<{
    success: boolean;
    tokensUsed: number;
    cost: number;
    error?: string;
    errorRecovered?: boolean;
  }> {
    try {
      this.log(`Processing web task: ${task.url}`);

      // Navigate to URL
      if (task.url) {
        await this.navigateToUrl(task.url);
      }

      // Process instructions
      for (let i = 0; i < task.instructions.length; i++) {
        if (!this.isRunning || this.stepCount >= this.maxSteps) break;

        const instruction = task.instructions[i];
        this.log(`Executing instruction ${i + 1}: ${instruction}`);

        const action = await this.parseInstructionToAction(instruction);
        const result = await this.executeGUIAction(action);

        this.actionHistory.push(result);
        this.stepCount++;

        if (!result.success) {
          this.log(`Action failed: ${result.error}`);
          // Try to recover with alternative action
          const recoveryAction = await this.generateRecoveryAction(instruction, result);
          if (recoveryAction) {
            const recoveryResult = await this.executeGUIAction(recoveryAction);
            if (recoveryResult.success) {
              this.recordErrorRecovery();
              this.log('Recovery action succeeded');
            } else {
              return {
                success: false,
                tokensUsed: 0,
                cost: 0,
                error: `Failed to execute instruction: ${instruction}. Recovery failed: ${recoveryResult.error}`,
                errorRecovered: false
              };
            }
          }
        }

        // Take screenshot after each action
        await this.takeScreenshot(`step-${this.stepCount}`);

        // Estimate tokens and cost for action generation
        const tokensUsed = this.estimateTokens(instruction + JSON.stringify(result));
        const cost = this.estimateCost(tokensUsed);

        return {
          success: true,
          tokensUsed,
          cost
        };
      }

      // Validate task completion
      const validationPassed = await this.validateTaskCompletion(task);

      return {
        success: validationPassed,
        tokensUsed: 0,
        cost: 0,
        errorRecovered: false
      };

    } catch (error) {
      return {
        success: false,
        tokensUsed: 0,
        cost: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorRecovered: this.stepCount < this.maxSteps
      };
    }
  }

  private async processDesktopTask(task: GUITask): Promise<{
    success: boolean;
    tokensUsed: number;
    cost: number;
    error?: string;
    errorRecovered?: boolean;
  }> {
    try {
      this.log(`Processing desktop task with applications: ${task.environment.applications?.join(', ')}`);

      // Launch required applications
      if (task.environment.applications) {
        for (const app of task.environment.applications) {
          await this.launchApplication(app);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Process instructions similar to web task
      for (let i = 0; i < task.instructions.length; i++) {
        if (!this.isRunning || this.stepCount >= this.maxSteps) break;

        const instruction = task.instructions[i];
        this.log(`Executing desktop instruction ${i + 1}: ${instruction}`);

        const action = await this.parseInstructionToAction(instruction);
        const result = await this.executeGUIAction(action);

        this.actionHistory.push(result);
        this.stepCount++;

        if (!result.success) {
          this.log(`Desktop action failed: ${result.error}`);
          // Recovery logic for desktop actions
          const recoveryAction = await this.generateDesktopRecoveryAction(instruction, result);
          if (recoveryAction) {
            const recoveryResult = await this.executeGUIAction(recoveryAction);
            if (recoveryResult.success) {
              this.recordErrorRecovery();
              this.log('Desktop recovery action succeeded');
            }
          }
        }

        await this.takeScreenshot(`desktop-step-${this.stepCount}`);
      }

      // Validate desktop task completion
      const validationPassed = await this.validateTaskCompletion(task);

      return {
        success: validationPassed,
        tokensUsed: 0,
        cost: 0,
        errorRecovered: false
      };

    } catch (error) {
      return {
        success: false,
        tokensUsed: 0,
        cost: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorRecovered: this.stepCount < this.maxSteps
      };
    }
  }

  private async navigateToUrl(url: string): Promise<void> {
    // In real implementation, this would use browser automation
    this.log(`Navigating to URL: ${url}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async parseInstructionToAction(instruction: string): Promise<GUIAction> {
    // Simple instruction parsing - in real implementation, use NLP/LLM
    if (instruction.toLowerCase().includes('click')) {
      return {
        type: 'click',
        coordinates: { x: Math.random() * this.displayWidth, y: Math.random() * this.displayHeight }
      };
    } else if (instruction.toLowerCase().includes('type') || instruction.toLowerCase().includes('fill')) {
      return {
        type: 'type',
        text: 'sample text'
      };
    } else if (instruction.toLowerCase().includes('scroll')) {
      return {
        type: 'scroll',
        duration: 1000
      };
    } else {
      return {
        type: 'click',
        coordinates: { x: this.displayWidth / 2, y: this.displayHeight / 2 }
      };
    }
  }

  private async executeGUIAction(action: GUIAction): Promise<GUIStepResult> {
    const startTime = Date.now();

    try {
      this.log(`Executing GUI action: ${action.type}`);

      let success = false;
      let error: string | undefined;

      switch (action.type) {
        case 'click':
          success = await this.executeClick(action.coordinates);
          break;
        case 'type':
          success = await this.executeType(action.text);
          break;
        case 'scroll':
          success = await this.executeScroll(action.duration);
          break;
        case 'screenshot':
          await this.takeScreenshot(action.screenshot);
          success = true;
          break;
        default:
          error = `Unknown action type: ${action.type}`;
      }

      const executionTime = Date.now() - startTime;

      // Take screenshot after action
      const screenshot = await this.takeScreenshot(`action-${Date.now()}`);

      return {
        action,
        success,
        screenshot,
        executionTime,
        error,
        detectedElements: await this.detectVisibleElements()
      };

    } catch (err) {
      const executionTime = Date.now() - startTime;
      return {
        action,
        success: false,
        screenshot: '',
        executionTime,
        error: err instanceof Error ? err.message : 'Unknown error',
        detectedElements: []
      };
    }
  }

  private async executeClick(coordinates?: { x: number; y: number }): Promise<boolean> {
    if (!coordinates) return false;

    try {
      const cmd = `xdotool mousemove ${coordinates.x} ${coordinates.y} click 1`;
      await this.executeCommand(cmd);
      return true;
    } catch (error) {
      this.log(`Click execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  private async executeType(text?: string): Promise<boolean> {
    if (!text) return false;

    try {
      const cmd = `xdotool type "${text}"`;
      await this.executeCommand(cmd);
      return true;
    } catch (error) {
      this.log(`Type execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  private async executeScroll(duration?: number): Promise<boolean> {
    try {
      const scrollDuration = duration || 1000;
      const cmd = `xdotool click 4; sleep ${scrollDuration / 1000}`;
      await this.executeCommand(cmd);
      return true;
    } catch (error) {
      this.log(`Scroll execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  private async takeScreenshot(name?: string): Promise<string> {
    try {
      const filename = name || `screenshot-${Date.now()}`;
      const filepath = `/tmp/${filename}.png`;

      const cmd = `import -window root ${filepath}`;
      await this.executeCommand(cmd);

      this.screenshots.push(filepath);
      return filepath;

    } catch (error) {
      this.log(`Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return '';
    }
  }

  private async detectVisibleElements(): Promise<string[]> {
    try {
      // In real implementation, use computer vision to detect UI elements
      // For demo purposes, return mock elements
      return [
        'button',
        'input field',
        'link',
        'text area',
        'dropdown'
      ];
    } catch (error) {
      return [];
    }
  }

  private async generateRecoveryAction(instruction: string, failedResult: GUIStepResult): Promise<GUIAction | null> {
    // Simple recovery strategy - try different coordinates for click
    if (failedResult.action.type === 'click') {
      return {
        type: 'click',
        coordinates: {
          x: Math.random() * this.displayWidth,
          y: Math.random() * this.displayHeight
        }
      };
    }
    return null;
  }

  private async generateDesktopRecoveryAction(instruction: string, failedResult: GUIStepResult): Promise<GUIAction | null> {
    // Desktop-specific recovery strategies
    if (failedResult.action.type === 'click') {
      // Try to find application window and click within it
      return {
        type: 'click',
        coordinates: {
          x: this.displayWidth / 2 + (Math.random() - 0.5) * 200,
          y: this.displayHeight / 2 + (Math.random() - 0.5) * 200
        }
      };
    }
    return null;
  }

  private async launchApplication(application: string): Promise<void> {
    try {
      this.log(`Launching application: ${application}`);

      let launchCmd: string;
      switch (application.toLowerCase()) {
        case 'calculator':
          launchCmd = 'gnome-calculator';
          break;
        case 'text editor':
          launchCmd = 'gedit';
          break;
        case 'terminal':
          launchCmd = 'gnome-terminal';
          break;
        default:
          launchCmd = application;
      }

      await this.executeCommand(launchCmd);
      this.log(`Application launched: ${application}`);

    } catch (error) {
      this.log(`Failed to launch application ${application}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateTaskCompletion(task: GUITask): Promise<boolean> {
    try {
      this.log('Validating task completion');

      // Take final screenshot
      const finalScreenshot = await this.takeScreenshot('validation');

      // Simple validation - check if we have screenshots for each step
      const validationPassed = this.screenshots.length > 0 && this.actionHistory.length > 0;

      // In real implementation, use computer vision to validate specific criteria
      for (const criterion of task.validationCriteria) {
        this.log(`Checking validation criterion: ${criterion}`);
        // Implement actual validation logic here
      }

      return validationPassed;

    } catch (error) {
      this.log(`Task validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  private async cleanupGUIEnvironment(): Promise<void> {
    try {
      this.log('Cleaning up GUI automation environment');

      // Close browser if running
      if (this.browserProcess) {
        this.browserProcess.kill('SIGTERM');
        this.browserProcess = undefined;
      }

      // Clean up virtual display
      if (this.virtualDisplay) {
        await this.executeCommand(`pkill -f "Xvfb :${this.virtualDisplay}"`);
        this.virtualDisplay = undefined;
      }

      // Clean up screenshots
      for (const screenshot of this.screenshots) {
        try {
          await fs.unlink(screenshot);
        } catch (error) {
          // Ignore cleanup errors
        }
      }

      this.log('GUI environment cleanup complete');

    } catch (error) {
      this.log(`GUI environment cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeCommand(command: string, options: { detached?: boolean } = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        detached: options.detached || false,
        env: { ...process.env, DISPLAY: `:${this.virtualDisplay}` }
      });

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

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private estimateCost(tokens: number): number {
    return tokens * 0.00001;
  }
}