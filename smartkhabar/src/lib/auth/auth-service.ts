import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getNeonClient } from '@/lib/database/neon-client';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: {
    topics: string[];
    tone: 'formal' | 'casual' | 'fun';
    readingTime: number;
    preferredSources: string[];
    excludedSources: string[];
    notifications: boolean;
    realTimeUpdates: boolean;
  };
  subscription: {
    plan: 'free' | 'premium';
    expiresAt?: Date;
  };
  createdAt: Date;
  lastLoginAt: Date;
}

export interface AuthToken {
  userId: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export class AuthService {
  private jwtSecret: string;
  private jwtExpiry: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.jwtExpiry = process.env.JWT_EXPIRY || '7d';
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string, name: string): Promise<{ user: User; token: string }> {
    const neonClient = getNeonClient();
    
    // Check if user already exists
    const existingUser = await neonClient.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const defaultPreferences = {
      topics: ['technology', 'business'],
      tone: 'casual' as const,
      readingTime: 5,
      preferredSources: [],
      excludedSources: [],
      notifications: true,
      realTimeUpdates: true
    };

    await neonClient.query(`
      INSERT INTO users (
        id, email, name, password_hash, preferences, subscription_plan, 
        created_at, last_login_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      userId,
      email,
      name,
      hashedPassword,
      JSON.stringify(defaultPreferences),
      'free',
      now,
      now
    ]);

    const user: User = {
      id: userId,
      email,
      name,
      preferences: defaultPreferences,
      subscription: { plan: 'free' },
      createdAt: now,
      lastLoginAt: now
    };

    const token = this.generateToken(user);

    return { user, token };
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const neonClient = getNeonClient();
    
    const result = await neonClient.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const userData = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, userData.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await neonClient.query(
      'UPDATE users SET last_login_at = $1 WHERE id = $2',
      [new Date(), userData.id]
    );

    const user: User = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      avatar: userData.avatar,
      preferences: JSON.parse(userData.preferences || '{}'),
      subscription: {
        plan: userData.subscription_plan,
        expiresAt: userData.subscription_expires_at
      },
      createdAt: userData.created_at,
      lastLoginAt: new Date()
    };

    const token = this.generateToken(user);

    return { user, token };
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<AuthToken> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as AuthToken;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user from token
   */
  async getUserFromToken(token: string): Promise<User> {
    const decoded = await this.verifyToken(token);
    const neonClient = getNeonClient();
    
    const result = await neonClient.query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const userData = result.rows[0];
    
    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      avatar: userData.avatar,
      preferences: JSON.parse(userData.preferences || '{}'),
      subscription: {
        plan: userData.subscription_plan,
        expiresAt: userData.subscription_expires_at
      },
      createdAt: userData.created_at,
      lastLoginAt: userData.last_login_at
    };
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: Partial<User['preferences']>): Promise<User> {
    const neonClient = getNeonClient();
    
    // Get current preferences
    const result = await neonClient.query(
      'SELECT preferences FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const currentPreferences = JSON.parse(result.rows[0].preferences || '{}');
    const updatedPreferences = { ...currentPreferences, ...preferences };

    await neonClient.query(
      'UPDATE users SET preferences = $1 WHERE id = $2',
      [JSON.stringify(updatedPreferences), userId]
    );

    return this.getUserById(userId);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User> {
    const neonClient = getNeonClient();
    
    const result = await neonClient.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const userData = result.rows[0];
    
    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      avatar: userData.avatar,
      preferences: JSON.parse(userData.preferences || '{}'),
      subscription: {
        plan: userData.subscription_plan,
        expiresAt: userData.subscription_expires_at
      },
      createdAt: userData.created_at,
      lastLoginAt: userData.last_login_at
    };
  }

  /**
   * Extract user from request
   */
  async getUserFromRequest(request: NextRequest): Promise<User | null> {
    try {
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.substring(7);
      return await this.getUserFromToken(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: User): string {
    const payload: Omit<AuthToken, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      name: user.name
    };

    // If no expiry is set, create a token without expiration
    const options: any = {};
    if (this.jwtExpiry && this.jwtExpiry !== 'never') {
      options.expiresIn = this.jwtExpiry;
    }

    return jwt.sign(payload, this.jwtSecret, options);
  }

  /**
   * Initialize user tables
   */
  async initializeUserTables(): Promise<void> {
    const neonClient = getNeonClient();
    
    await neonClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar TEXT,
        preferences JSONB DEFAULT '{}',
        subscription_plan VARCHAR(50) DEFAULT 'free',
        subscription_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await neonClient.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await neonClient.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
    `);
  }
}

// Global auth service instance
let authService: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}