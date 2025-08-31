import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '@/lib/config';
import { getNeonClient } from '@/lib/database/neon-client';
import { getLogger } from '@/lib/monitoring/production-logger';

const logger = getLogger();

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
  subscription: UserSubscription;
  createdAt: Date;
  lastLoginAt: Date;
  isActive: boolean;
}

export interface UserPreferences {
  topics: string[];
  sources: string[];
  tone: 'casual' | 'formal' | 'technical';
  readingTime: number;
  language: string;
  timezone: string;
  notifications: NotificationSettings;
  layout: LayoutPreferences;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  breaking: boolean;
  digest: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
}

export interface LayoutPreferences {
  theme: 'light' | 'dark' | 'auto';
  density: 'compact' | 'comfortable' | 'spacious';
  cardStyle: 'minimal' | 'detailed' | 'magazine';
  showImages: boolean;
  showSummaries: boolean;
}

export interface UserSubscription {
  plan: 'free' | 'premium' | 'enterprise';
  status: 'active' | 'inactive' | 'cancelled';
  expiresAt?: Date;
  features: string[];
}

export interface AuthToken {
  userId: string;
  email: string;
  name: string;
  plan: string;
  iat: number;
  exp?: number;
}

export class EnhancedAuthService {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
    preferences?: Partial<UserPreferences>;
  }): Promise<{ user: User; token: string }> {
    const client = await getNeonClient();
    
    try {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Default preferences
      const defaultPreferences: UserPreferences = {
        topics: ['general', 'technology', 'business'],
        sources: [],
        tone: 'casual',
        readingTime: 5,
        language: 'en',
        timezone: 'UTC',
        notifications: {
          email: true,
          push: false,
          breaking: true,
          digest: true,
          frequency: 'daily'
        },
        layout: {
          theme: 'auto',
          density: 'comfortable',
          cardStyle: 'detailed',
          showImages: true,
          showSummaries: true
        }
      };

      const preferences = { ...defaultPreferences, ...userData.preferences };

      // Create user
      const result = await client.query(`
        INSERT INTO users (
          email, password_hash, name, preferences, subscription, 
          created_at, last_login_at, is_active
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), true)
        RETURNING id, email, name, preferences, subscription, created_at, last_login_at, is_active
      `, [
        userData.email,
        hashedPassword,
        userData.name,
        JSON.stringify(preferences),
        JSON.stringify({
          plan: 'free',
          status: 'active',
          features: ['basic_news', 'personalization', 'mobile_app']
        })
      ]);

      const user = this.mapDbUserToUser(result.rows[0]);
      const token = this.generateToken(user);

      logger.info('User registered successfully', { userId: user.id, email: user.email });

      return { user, token };
    } finally {
      // Neon client doesn't need manual release
    }
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const client = await getNeonClient();
    
    try {
      const result = await client.query(`
        SELECT id, email, password_hash, name, preferences, subscription, 
               created_at, last_login_at, is_active
        FROM users WHERE email = $1 AND is_active = true
      `, [email]);

      if (result.rows.length === 0) {
        throw new Error('Invalid credentials');
      }

      const dbUser = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, dbUser.password_hash);

      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Update last login
      await client.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [dbUser.id]
      );

      const user = this.mapDbUserToUser(dbUser);
      const token = this.generateToken(user);

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return { user, token };
    } finally {
      // Neon client doesn't need manual release
    }
  }

  async getUserFromToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as AuthToken;
      
      const client = await getNeonClient();
      try {
        const result = await client.query(`
          SELECT id, email, name, preferences, subscription, 
                 created_at, last_login_at, is_active
          FROM users WHERE id = $1 AND is_active = true
        `, [decoded.userId]);

        if (result.rows.length === 0) {
          return null;
        }

        return this.mapDbUserToUser(result.rows[0]);
      } finally {
        // Neon client doesn't need manual release
      }
    } catch (error) {
      logger.error('Token verification failed', error as Error);
      return null;
    }
  }

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<User> {
    const client = await getNeonClient();
    
    try {
      // Get current preferences
      const currentResult = await client.query(
        'SELECT preferences FROM users WHERE id = $1',
        [userId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const currentPreferences = currentResult.rows[0].preferences;
      const updatedPreferences = { ...currentPreferences, ...preferences };

      // Update preferences
      const result = await client.query(`
        UPDATE users SET preferences = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, name, preferences, subscription, created_at, last_login_at, is_active
      `, [JSON.stringify(updatedPreferences), userId]);

      const user = this.mapDbUserToUser(result.rows[0]);
      
      logger.info('User preferences updated', { userId, preferences: Object.keys(preferences) });
      
      return user;
    } finally {
      // Neon client doesn't need manual release
    }
  }

  async updateSubscription(userId: string, subscription: Partial<UserSubscription>): Promise<User> {
    const client = await getNeonClient();
    
    try {
      const currentResult = await client.query(
        'SELECT subscription FROM users WHERE id = $1',
        [userId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const currentSubscription = currentResult.rows[0].subscription;
      const updatedSubscription = { ...currentSubscription, ...subscription };

      const result = await client.query(`
        UPDATE users SET subscription = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, name, preferences, subscription, created_at, last_login_at, is_active
      `, [JSON.stringify(updatedSubscription), userId]);

      const user = this.mapDbUserToUser(result.rows[0]);
      
      logger.info('User subscription updated', { userId, plan: subscription.plan });
      
      return user;
    } finally {
      // Neon client doesn't need manual release
    }
  }

  async getUserAnalytics(userId: string): Promise<{
    readingStats: any;
    preferences: any;
    engagement: any;
  }> {
    const client = await getNeonClient();
    
    try {
      // Get reading statistics
      const readingStats = await client.query(`
        SELECT 
          COUNT(*) as articles_read,
          AVG(reading_time) as avg_reading_time,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          array_agg(DISTINCT category) as categories_read
        FROM user_interactions 
        WHERE user_id = $1 AND action = 'read'
        AND created_at >= NOW() - INTERVAL '30 days'
      `, [userId]);

      // Get preference insights
      const preferenceStats = await client.query(`
        SELECT 
          action,
          COUNT(*) as count,
          array_agg(DISTINCT category) as categories
        FROM user_interactions 
        WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY action
      `, [userId]);

      return {
        readingStats: readingStats.rows[0] || {},
        preferences: preferenceStats.rows || [],
        engagement: {
          totalInteractions: preferenceStats.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
          lastActive: new Date().toISOString()
        }
      };
    } finally {
      // Neon client doesn't need manual release
    }
  }

  private generateToken(user: User): string {
    const payload: AuthToken = {
      userId: user.id,
      email: user.email,
      name: user.name,
      plan: user.subscription.plan,
      iat: Math.floor(Date.now() / 1000)
    };

    // No expiry for persistent sessions
    return jwt.sign(payload, this.jwtSecret);
  }

  private mapDbUserToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      preferences: dbUser.preferences || {},
      subscription: dbUser.subscription || { plan: 'free', status: 'active', features: [] },
      createdAt: new Date(dbUser.created_at),
      lastLoginAt: new Date(dbUser.last_login_at),
      isActive: dbUser.is_active
    };
  }

  async extractUserFromRequest(request: NextRequest): Promise<User | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    return this.getUserFromToken(token);
  }
}

export const enhancedAuthService = new EnhancedAuthService();
