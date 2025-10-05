import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';
import { WebSocketMessage } from '../types/orchestrator';

interface ClientInfo {
  id: string;
  userId?: string;
  evaluationIds: Set<string>;
  connectedAt: Date;
  lastActivity: Date;
  preferences: {
    receiveLogs: boolean;
    receiveMetrics: boolean;
    receiveProgress: boolean;
    maxMessagesPerSecond: number;
  };
}

interface SubscriptionInfo {
  evaluationId: string;
  clients: Set<string>;
  createdAt: Date;
}

export class WebSocketManager {
  private io: SocketIOServer;
  private clients: Map<string, ClientInfo>;
  private subscriptions: Map<string, SubscriptionInfo>;
  private messageQueue: Map<string, WebSocketMessage[]>;
  private rateLimiters: Map<string, { count: number; resetTime: number }>;
  private heartbeatInterval: NodeJS.Timeout;

  constructor() {
    this.clients = new Map();
    this.subscriptions = new Map();
    this.messageQueue = new Map();
    this.rateLimiters = new Map();
  }

  initialize(server: HttpServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    this.startHeartbeat();
    this.startCleanup();

    logger.info('WebSocket manager initialized');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket): void {
    const clientInfo: ClientInfo = {
      id: socket.id,
      userId: socket.handshake.auth?.userId,
      evaluationIds: new Set(),
      connectedAt: new Date(),
      lastActivity: new Date(),
      preferences: {
        receiveLogs: true,
        receiveMetrics: true,
        receiveProgress: true,
        maxMessagesPerSecond: 10
      }
    };

    this.clients.set(socket.id, clientInfo);

    logger.info(`Client connected: ${socket.id} (User: ${clientInfo.userId || 'anonymous'})`);

    // Send welcome message
    socket.emit('connected', {
      clientId: socket.id,
      timestamp: new Date(),
      serverTime: new Date().toISOString()
    });

    // Setup client event handlers
    socket.on('subscribe', (data) => this.handleSubscribe(socket, data));
    socket.on('unsubscribe', (data) => this.handleUnsubscribe(socket, data));
    socket.on('update_preferences', (data) => this.handleUpdatePreferences(socket, data));
    socket.on('get_status', () => this.handleGetStatus(socket));
    socket.on('disconnect', () => this.handleDisconnect(socket));
    socket.on('ping', () => this.handlePing(socket));
    socket.on('error', (error) => this.handleError(socket, error));
  }

  private handleSubscribe(socket: Socket, data: { evaluationId: string; userId?: string }): void {
    const { evaluationId, userId } = data;
    const clientInfo = this.clients.get(socket.id);

    if (!clientInfo) {
      socket.emit('error', { message: 'Client not found' });
      return;
    }

    // Validate access (you could add authentication here)
    if (userId && clientInfo.userId !== userId) {
      socket.emit('error', { message: 'Unauthorized access to evaluation' });
      return;
    }

    // Add evaluation to client's subscriptions
    clientInfo.evaluationIds.add(evaluationId);
    clientInfo.lastActivity = new Date();

    // Add client to evaluation subscription
    if (!this.subscriptions.has(evaluationId)) {
      this.subscriptions.set(evaluationId, {
        evaluationId,
        clients: new Set(),
        createdAt: new Date()
      });
    }

    this.subscriptions.get(evaluationId)!.clients.add(socket.id);

    // Send queued messages if any
    this.sendQueuedMessages(socket.id, evaluationId);

    logger.info(`Client ${socket.id} subscribed to evaluation ${evaluationId}`);
    socket.emit('subscribed', { evaluationId, timestamp: new Date() });
  }

  private handleUnsubscribe(socket: Socket, data: { evaluationId: string }): void {
    const { evaluationId } = data;
    const clientInfo = this.clients.get(socket.id);

    if (!clientInfo) {
      return;
    }

    // Remove evaluation from client's subscriptions
    clientInfo.evaluationIds.delete(evaluationId);
    clientInfo.lastActivity = new Date();

    // Remove client from evaluation subscription
    const subscription = this.subscriptions.get(evaluationId);
    if (subscription) {
      subscription.clients.delete(socket.id);

      // Clean up empty subscription
      if (subscription.clients.size === 0) {
        this.subscriptions.delete(evaluationId);
        this.messageQueue.delete(evaluationId);
      }
    }

    logger.info(`Client ${socket.id} unsubscribed from evaluation ${evaluationId}`);
    socket.emit('unsubscribed', { evaluationId, timestamp: new Date() });
  }

  private handleUpdatePreferences(socket: Socket, preferences: Partial<ClientInfo['preferences']>): void {
    const clientInfo = this.clients.get(socket.id);

    if (!clientInfo) {
      socket.emit('error', { message: 'Client not found' });
      return;
    }

    clientInfo.preferences = { ...clientInfo.preferences, ...preferences };
    clientInfo.lastActivity = new Date();

    logger.info(`Client ${socket.id} updated preferences`);
    socket.emit('preferences_updated', { preferences: clientInfo.preferences });
  }

  private handleGetStatus(socket: Socket): void {
    const clientInfo = this.clients.get(socket.id);

    if (!clientInfo) {
      socket.emit('error', { message: 'Client not found' });
      return;
    }

    socket.emit('status', {
      clientId: socket.id,
      subscriptions: Array.from(clientInfo.evaluationIds),
      connectedAt: clientInfo.connectedAt,
      lastActivity: clientInfo.lastActivity,
      preferences: clientInfo.preferences,
      timestamp: new Date()
    });
  }

  private handlePing(socket: Socket): void {
    const clientInfo = this.clients.get(socket.id);

    if (clientInfo) {
      clientInfo.lastActivity = new Date();
    }

    socket.emit('pong', { timestamp: new Date() });
  }

  private handleError(socket: Socket, error: any): void {
    logger.error(`Socket error for client ${socket.id}:`, error);
  }

  private handleDisconnect(socket: Socket): void {
    const clientInfo = this.clients.get(socket.id);

    if (clientInfo) {
      // Remove client from all subscriptions
      for (const evaluationId of clientInfo.evaluationIds) {
        const subscription = this.subscriptions.get(evaluationId);
        if (subscription) {
          subscription.clients.delete(socket.id);

          // Clean up empty subscription
          if (subscription.clients.size === 0) {
            this.subscriptions.delete(evaluationId);
            this.messageQueue.delete(evaluationId);
          }
        }
      }

      // Remove client
      this.clients.delete(socket.id);
      this.rateLimiters.delete(socket.id);

      const duration = new Date().getTime() - clientInfo.connectedAt.getTime();
      logger.info(`Client ${socket.id} disconnected (Duration: ${Math.round(duration / 1000)}s)`);
    }
  }

  broadcast(evaluationId: string, message: WebSocketMessage): void {
    const subscription = this.subscriptions.get(evaluationId);

    if (!subscription || subscription.clients.size === 0) {
      // Queue message for when clients subscribe
      this.queueMessage(evaluationId, message);
      return;
    }

    const clientsToNotify: string[] = [];

    for (const clientId of subscription.clients) {
      const clientInfo = this.clients.get(clientId);

      if (!clientInfo) {
        continue;
      }

      // Check rate limit
      if (!this.checkRateLimit(clientId)) {
        continue;
      }

      // Check if client should receive this message type
      if (!this.shouldSendToClient(clientInfo, message)) {
        continue;
      }

      clientsToNotify.push(clientId);
    }

    if (clientsToNotify.length > 0) {
      this.io.to(clientsToNotify).emit('evaluation_update', message);
      logger.debug(`Broadcasted message to ${clientsToNotify.length} clients for evaluation ${evaluationId}`);
    }
  }

  private shouldSendToClient(clientInfo: ClientInfo, message: WebSocketMessage): boolean {
    switch (message.type) {
      case 'log':
        return clientInfo.preferences.receiveLogs;
      case 'metrics_update':
        return clientInfo.preferences.receiveMetrics;
      case 'progress_update':
        return clientInfo.preferences.receiveProgress;
      default:
        return true;
    }
  }

  private checkRateLimit(clientId: string): boolean {
    const clientInfo = this.clients.get(clientId);

    if (!clientInfo) {
      return false;
    }

    const now = Date.now();
    const rateLimiter = this.rateLimiters.get(clientId);

    if (!rateLimiter || now > rateLimiter.resetTime) {
      this.rateLimiters.set(clientId, {
        count: 1,
        resetTime: now + 1000 // Reset every second
      });
      return true;
    }

    if (rateLimiter.count >= clientInfo.preferences.maxMessagesPerSecond) {
      return false;
    }

    rateLimiter.count++;
    return true;
  }

  private queueMessage(evaluationId: string, message: WebSocketMessage): void {
    if (!this.messageQueue.has(evaluationId)) {
      this.messageQueue.set(evaluationId, []);
    }

    const queue = this.messageQueue.get(evaluationId)!;
    queue.push(message);

    // Keep only last 50 messages per evaluation
    if (queue.length > 50) {
      queue.splice(0, queue.length - 50);
    }
  }

  private sendQueuedMessages(clientId: string, evaluationId: string): void {
    const queuedMessages = this.messageQueue.get(evaluationId);

    if (!queuedMessages || queuedMessages.length === 0) {
      return;
    }

    const socket = this.io.sockets.sockets.get(clientId);
    if (!socket) {
      return;
    }

    const clientInfo = this.clients.get(clientId);
    if (!clientInfo) {
      return;
    }

    // Send queued messages that match client preferences
    const messagesToSend = queuedMessages.filter(message =>
      this.shouldSendToClient(clientInfo, message)
    );

    for (const message of messagesToSend) {
      socket.emit('evaluation_update', message);
    }

    logger.info(`Sent ${messagesToSend.length} queued messages to client ${clientId}`);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.io.emit('heartbeat', {
        timestamp: new Date(),
        serverTime: new Date().toISOString(),
        connectedClients: this.clients.size,
        activeSubscriptions: this.subscriptions.size
      });
    }, 30000); // Every 30 seconds
  }

  private startCleanup(): void {
    setInterval(() => {
      this.cleanupInactiveClients();
      this.cleanupOldMessages();
    }, 60000); // Every minute
  }

  private cleanupInactiveClients(): void {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [clientId, clientInfo] of this.clients.entries()) {
      const inactiveTime = now.getTime() - clientInfo.lastActivity.getTime();

      if (inactiveTime > inactiveThreshold) {
        const socket = this.io.sockets.sockets.get(clientId);
        if (socket) {
          socket.disconnect(true);
          logger.info(`Disconnected inactive client: ${clientId}`);
        }
      }
    }
  }

  private cleanupOldMessages(): void {
    const now = new Date();
    const messageAgeThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [evaluationId, messages] of this.messageQueue.entries()) {
      const filteredMessages = messages.filter(message => {
        const age = now.getTime() - message.timestamp.getTime();
        return age < messageAgeThreshold;
      });

      if (filteredMessages.length === 0) {
        this.messageQueue.delete(evaluationId);
      } else if (filteredMessages.length !== messages.length) {
        this.messageQueue.set(evaluationId, filteredMessages);
      }
    }
  }

  getConnectionCount(): number {
    return this.clients.size;
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  getStats(): any {
    const now = new Date();
    const connectionsByHour = new Map<string, number>();

    for (const clientInfo of this.clients.values()) {
      const hour = clientInfo.connectedAt.getHours();
      connectionsByHour.set(hour.toString(), (connectionsByHour.get(hour.toString()) || 0) + 1);
    }

    return {
      connectedClients: this.clients.size,
      activeSubscriptions: this.subscriptions.size,
      queuedMessages: Array.from(this.messageQueue.values()).reduce((total, queue) => total + queue.length, 0),
      averageSubscriptionsPerClient: this.clients.size > 0
        ? Array.from(this.clients.values()).reduce((total, client) => total + client.evaluationIds.size, 0) / this.clients.size
        : 0,
      connectionsByHour: Object.fromEntries(connectionsByHour),
      uptime: process.uptime()
    };
  }

  disconnectClient(clientId: string, reason?: string): void {
    const socket = this.io.sockets.sockets.get(clientId);
    if (socket) {
      socket.disconnect(true);
      logger.info(`Forcefully disconnected client: ${clientId} (Reason: ${reason || 'Manual'})`);
    }
  }

  disconnectAll(reason?: string): void {
    for (const [clientId] of this.clients.entries()) {
      this.disconnectClient(clientId, reason);
    }
  }

  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.disconnectAll('Server shutdown');
    this.io.close();

    logger.info('WebSocket manager closed');
  }
}