import { WebSocket } from 'ws';
import { getLogger } from '@/lib/monitoring/production-logger';
import { enhancedAuthService } from '@/lib/auth/enhanced-auth-service';
import { NewsDataClient } from '@/lib/news-collection/newsdata-client';
import { config } from '@/lib/config';

const logger = getLogger();

export interface WebSocketConnection {
  id: string;
  userId?: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  lastPing: Date;
  isAlive: boolean;
}

export interface NewsUpdate {
  type: 'breaking' | 'update' | 'personalized';
  article: any;
  timestamp: Date;
  priority: 'high' | 'medium' | 'low';
}

export interface SubscriptionFilter {
  categories?: string[];
  sources?: string[];
  keywords?: string[];
  userId?: string;
}

export class WebSocketManager {
  private connections: Map<string, WebSocketConnection> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // topic -> connectionIds
  private newsClient: NewsDataClient;
  private updateInterval: NodeJS.Timeout | null = null;
  private lastNewsCheck: Date = new Date();

  constructor() {
    this.newsClient = new NewsDataClient(config.newsdata.apiKey);
    this.startNewsPolling();
    this.startHealthCheck();
  }

  addConnection(ws: WebSocket, connectionId: string): void {
    const connection: WebSocketConnection = {
      id: connectionId,
      ws,
      subscriptions: new Set(),
      lastPing: new Date(),
      isAlive: true
    };

    this.connections.set(connectionId, connection);
    
    ws.on('message', (data) => this.handleMessage(connectionId, data));
    ws.on('close', () => this.removeConnection(connectionId));
    ws.on('error', (error) => {
      logger.error('WebSocket error', error, { connectionId });
      this.removeConnection(connectionId);
    });

    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'connected',
      connectionId,
      timestamp: new Date().toISOString()
    });

    logger.info('WebSocket connection added', { connectionId });
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from all subscriptions
    connection.subscriptions.forEach(topic => {
      const topicConnections = this.subscriptions.get(topic);
      if (topicConnections) {
        topicConnections.delete(connectionId);
        if (topicConnections.size === 0) {
          this.subscriptions.delete(topic);
        }
      }
    });

    this.connections.delete(connectionId);
    logger.info('WebSocket connection removed', { connectionId });
  }

  private async handleMessage(connectionId: string, data: any): Promise<void> {
    try {
      const message = JSON.parse(data.toString());
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      switch (message.type) {
        case 'authenticate':
          await this.handleAuthentication(connectionId, message.token);
          break;

        case 'subscribe':
          await this.handleSubscription(connectionId, message.filters);
          break;

        case 'unsubscribe':
          this.handleUnsubscription(connectionId, message.topic);
          break;

        case 'ping':
          connection.lastPing = new Date();
          connection.isAlive = true;
          this.sendToConnection(connectionId, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        case 'get_breaking':
          await this.sendBreakingNews(connectionId);
          break;

        default:
          logger.warn('Unknown message type', { type: message.type, connectionId });
      }
    } catch (error) {
      logger.error('Error handling WebSocket message', error as Error, { connectionId });
    }
  }

  private async handleAuthentication(connectionId: string, token: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const user = await enhancedAuthService.getUserFromToken(token);
      if (user) {
        connection.userId = user.id;
        
        // Auto-subscribe to user's preferred categories
        const userTopics = user.preferences.topics || ['general'];
        userTopics.forEach(topic => {
          this.addSubscription(connectionId, `category:${topic}`);
        });

        this.sendToConnection(connectionId, {
          type: 'authenticated',
          user: {
            id: user.id,
            name: user.name,
            preferences: user.preferences
          },
          subscriptions: Array.from(connection.subscriptions)
        });

        logger.info('WebSocket authenticated', { connectionId, userId: user.id });
      } else {
        this.sendToConnection(connectionId, {
          type: 'auth_failed',
          message: 'Invalid token'
        });
      }
    } catch (error) {
      logger.error('Authentication failed', error as Error, { connectionId });
      this.sendToConnection(connectionId, {
        type: 'auth_failed',
        message: 'Authentication error'
      });
    }
  }

  private async handleSubscription(connectionId: string, filters: SubscriptionFilter): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Create subscription topics based on filters
    const topics: string[] = [];

    if (filters.categories) {
      filters.categories.forEach(cat => topics.push(`category:${cat}`));
    }

    if (filters.sources) {
      filters.sources.forEach(source => topics.push(`source:${source}`));
    }

    if (filters.keywords) {
      filters.keywords.forEach(keyword => topics.push(`keyword:${keyword}`));
    }

    if (connection.userId) {
      topics.push(`user:${connection.userId}`);
    }

    // Add subscriptions
    topics.forEach(topic => this.addSubscription(connectionId, topic));

    this.sendToConnection(connectionId, {
      type: 'subscribed',
      topics,
      timestamp: new Date().toISOString()
    });

    logger.info('WebSocket subscribed', { connectionId, topics });
  }

  private handleUnsubscription(connectionId: string, topic: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.subscriptions.delete(topic);
    
    const topicConnections = this.subscriptions.get(topic);
    if (topicConnections) {
      topicConnections.delete(connectionId);
      if (topicConnections.size === 0) {
        this.subscriptions.delete(topic);
      }
    }

    this.sendToConnection(connectionId, {
      type: 'unsubscribed',
      topic,
      timestamp: new Date().toISOString()
    });
  }

  private addSubscription(connectionId: string, topic: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.subscriptions.add(topic);
    
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(connectionId);
  }

  private sendToConnection(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) return;

    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Error sending message to connection', error as Error, { connectionId });
      this.removeConnection(connectionId);
    }
  }

  private broadcastToTopic(topic: string, message: any): void {
    const connections = this.subscriptions.get(topic);
    if (!connections) return;

    connections.forEach(connectionId => {
      this.sendToConnection(connectionId, message);
    });
  }

  private async sendBreakingNews(connectionId: string): Promise<void> {
    try {
      const response = await this.newsClient.getLatestNews({
        language: 'en',
        size: 5,
        prioritydomain: 'top'
      });

      const articles = response.results.map(article => ({
        id: article.article_id,
        headline: article.title,
        content: article.description,
        source: article.source_id,
        publishedAt: article.pubDate,
        url: article.link,
        imageUrl: article.image_url
      }));

      this.sendToConnection(connectionId, {
        type: 'breaking_news',
        articles,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching breaking news for WebSocket', error as Error, { connectionId });
    }
  }

  private startNewsPolling(): void {
    this.updateInterval = setInterval(async () => {
      await this.checkForNewsUpdates();
    }, 60000); // Check every minute
  }

  private async checkForNewsUpdates(): Promise<void> {
    try {
      const response = await this.newsClient.getLatestNews({
        language: 'en',
        size: 10,
        prioritydomain: 'top'
      });

      const newArticles = response.results.filter(article => {
        const publishedAt = new Date(article.pubDate);
        return publishedAt > this.lastNewsCheck;
      });

      if (newArticles.length > 0) {
        newArticles.forEach(article => {
          const newsUpdate: NewsUpdate = {
            type: 'breaking',
            article: {
              id: article.article_id,
              headline: article.title,
              content: article.description,
              source: article.source_id,
              publishedAt: article.pubDate,
              url: article.link,
              imageUrl: article.image_url,
              category: article.category?.[0] || 'general'
            },
            timestamp: new Date(),
            priority: this.calculatePriority(article)
          };

          // Broadcast to relevant subscriptions
          this.broadcastNewsUpdate(newsUpdate);
        });

        this.lastNewsCheck = new Date();
        logger.info('Broadcasted news updates', { count: newArticles.length });
      }
    } catch (error) {
      logger.error('Error checking for news updates', error as Error);
    }
  }

  private broadcastNewsUpdate(update: NewsUpdate): void {
    // Broadcast to category subscribers
    if (update.article.category) {
      this.broadcastToTopic(`category:${update.article.category}`, {
        type: 'news_update',
        update,
        timestamp: new Date().toISOString()
      });
    }

    // Broadcast to source subscribers
    this.broadcastToTopic(`source:${update.article.source}`, {
      type: 'news_update',
      update,
      timestamp: new Date().toISOString()
    });

    // Broadcast breaking news to all connections if high priority
    if (update.priority === 'high') {
      this.connections.forEach((connection, connectionId) => {
        this.sendToConnection(connectionId, {
          type: 'breaking_alert',
          update,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  private calculatePriority(article: any): 'high' | 'medium' | 'low' {
    const title = article.title.toLowerCase();
    const content = (article.content || article.description || '').toLowerCase();
    
    const highPriorityKeywords = [
      'breaking', 'urgent', 'alert', 'emergency', 'crisis'
    ];
    
    const text = `${title} ${content}`;
    
    if (highPriorityKeywords.some(keyword => text.includes(keyword))) {
      return 'high';
    }
    
    return 'medium';
  }

  private startHealthCheck(): void {
    setInterval(() => {
      this.connections.forEach((connection, connectionId) => {
        if (!connection.isAlive) {
          this.removeConnection(connectionId);
          return;
        }

        connection.isAlive = false;
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
        }
      });
    }, 30000); // Health check every 30 seconds
  }

  getStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    totalSubscriptions: number;
    topicBreakdown: Record<string, number>;
  } {
    const authenticatedConnections = Array.from(this.connections.values())
      .filter(conn => conn.userId).length;

    const topicBreakdown: Record<string, number> = {};
    this.subscriptions.forEach((connections, topic) => {
      topicBreakdown[topic] = connections.size;
    });

    return {
      totalConnections: this.connections.size,
      authenticatedConnections,
      totalSubscriptions: this.subscriptions.size,
      topicBreakdown
    };
  }

  shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.connections.forEach((connection, connectionId) => {
      connection.ws.close();
      this.removeConnection(connectionId);
    });
  }
}

export const wsManager = new WebSocketManager();