/**
 * Production logging and monitoring service
 * Provides structured logging with different levels and monitoring integration
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  requestId?: string;
  userId?: string;
  error?: Error;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStructuredLogging: boolean;
  includeStackTrace: boolean;
  maxLogSize: number;
  bufferSize: number;
  flushInterval: number;
}

export class ProductionLogger {
  private logBuffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  
  constructor(private config: LoggerConfig) {
    this.startPeriodicFlush();
  }
  
  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>, requestId?: string): void {
    this.log(LogLevel.DEBUG, message, context, requestId);
  }
  
  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>, requestId?: string): void {
    this.log(LogLevel.INFO, message, context, requestId);
  }
  
  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>, requestId?: string): void {
    this.log(LogLevel.WARN, message, context, requestId);
  }
  
  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, any>, requestId?: string): void {
    this.log(LogLevel.ERROR, message, context, requestId, error);
  }
  
  /**
   * Log critical message
   */
  critical(message: string, error?: Error, context?: Record<string, any>, requestId?: string): void {
    this.log(LogLevel.CRITICAL, message, context, requestId, error);
    // Immediately flush critical logs
    this.flush();
  }
  
  /**
   * Log API request/response
   */
  logApiCall(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    requestId?: string,
    userId?: string,
    error?: Error
  ): void {
    const level = statusCode >= 500 ? LogLevel.ERROR : 
                 statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, `API ${method} ${path}`, {
      method,
      path,
      statusCode,
      duration,
      userId
    }, requestId, error, duration);
  }
  
  /**
   * Log database operation
   */
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    requestId?: string,
    error?: Error
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    
    this.log(level, `DB ${operation} on ${table}`, {
      operation,
      table,
      success,
      duration
    }, requestId, error, duration);
  }
  
  /**
   * Log external API call
   */
  logExternalApiCall(
    service: string,
    endpoint: string,
    duration: number,
    success: boolean,
    requestId?: string,
    error?: Error
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    
    this.log(level, `External API ${service}`, {
      service,
      endpoint,
      success,
      duration
    }, requestId, error, duration);
  }
  
  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>,
    requestId?: string
  ): void {
    this.log(LogLevel.INFO, `Performance: ${operation}`, {
      operation,
      duration,
      ...metadata
    }, requestId, undefined, duration);
  }
  
  /**
   * Create a child logger with context
   */
  child(context: Record<string, any>): ProductionLogger {
    const childLogger = new ProductionLogger(this.config);
    
    // Override log method to include parent context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level, message, childContext, requestId, error, duration) => {
      const mergedContext = { ...context, ...childContext };
      originalLog(level, message, mergedContext, requestId, error, duration);
    };
    
    return childLogger;
  }
  
  /**
   * Flush logs immediately
   */
  flush(): void {
    if (this.logBuffer.length === 0) {
      return;
    }
    
    const logs = [...this.logBuffer];
    this.logBuffer = [];
    
    // In production, you might send these to a logging service
    // For now, we'll just output to console if enabled
    if (this.config.enableConsole) {
      logs.forEach(log => this.outputToConsole(log));
    }
    
    // Here you could integrate with external logging services like:
    // - Vercel's logging
    // - DataDog
    // - New Relic
    // - Custom logging endpoint
  }
  
  /**
   * Get logger statistics
   */
  getStats() {
    const levelCounts = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.CRITICAL]: 0
    };
    
    this.logBuffer.forEach(log => {
      levelCounts[log.level]++;
    });
    
    return {
      bufferSize: this.logBuffer.length,
      maxBufferSize: this.config.bufferSize,
      levelCounts,
      flushInterval: this.config.flushInterval
    };
  }
  
  /**
   * Cleanup and stop logging
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
  
  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    requestId?: string,
    error?: Error,
    duration?: number
  ): void {
    // Skip if below configured level
    if (level < this.config.level) {
      return;
    }
    
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      requestId,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: this.config.includeStackTrace ? error.stack : undefined
      } as any : undefined,
      duration,
      metadata: {
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version
      }
    };
    
    // Add to buffer
    this.logBuffer.push(logEntry);
    
    // Flush if buffer is full
    if (this.logBuffer.length >= this.config.bufferSize) {
      this.flush();
    }
  }
  
  /**
   * Output log to console
   */
  private outputToConsole(log: LogEntry): void {
    const levelNames = {
      [LogLevel.DEBUG]: 'DEBUG',
      [LogLevel.INFO]: 'INFO',
      [LogLevel.WARN]: 'WARN',
      [LogLevel.ERROR]: 'ERROR',
      [LogLevel.CRITICAL]: 'CRITICAL'
    };
    
    const prefix = `[${log.timestamp}] ${levelNames[log.level]}`;
    const suffix = log.requestId ? ` (${log.requestId})` : '';
    
    if (this.config.enableStructuredLogging) {
      console.log(JSON.stringify(log));
    } else {
      const contextStr = log.context ? ` ${JSON.stringify(log.context)}` : '';
      const durationStr = log.duration ? ` (${log.duration}ms)` : '';
      
      switch (log.level) {
        case LogLevel.DEBUG:
          console.debug(`${prefix} ${log.message}${contextStr}${durationStr}${suffix}`);
          break;
        case LogLevel.INFO:
          console.info(`${prefix} ${log.message}${contextStr}${durationStr}${suffix}`);
          break;
        case LogLevel.WARN:
          console.warn(`${prefix} ${log.message}${contextStr}${durationStr}${suffix}`);
          break;
        case LogLevel.ERROR:
        case LogLevel.CRITICAL:
          console.error(`${prefix} ${log.message}${contextStr}${durationStr}${suffix}`);
          if (log.error && log.error.stack) {
            console.error(log.error.stack);
          }
          break;
      }
    }
  }
  
  /**
   * Start periodic flush
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }
}

// Default logger configuration
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  enableStructuredLogging: process.env.NODE_ENV === 'production',
  includeStackTrace: process.env.NODE_ENV !== 'production',
  maxLogSize: 1024 * 1024, // 1MB
  bufferSize: 100,
  flushInterval: 5000 // 5 seconds
};

// Global logger instance
let globalLogger: ProductionLogger | null = null;

/**
 * Get or create global logger
 */
export function getLogger(config?: Partial<LoggerConfig>): ProductionLogger {
  if (!globalLogger) {
    globalLogger = new ProductionLogger({
      ...DEFAULT_LOGGER_CONFIG,
      ...config
    });
  }
  return globalLogger;
}

/**
 * Request ID generator
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Logging middleware for API routes
 */
export function withLogging<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  operationName: string
): T {
  return (async (...args: any[]) => {
    const logger = getLogger();
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    logger.info(`Starting ${operationName}`, { args: args.length }, requestId);
    
    try {
      const result = await operation(...args);
      const duration = Date.now() - startTime;
      
      logger.info(`Completed ${operationName}`, { duration }, requestId);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed ${operationName}`, error as Error, { duration }, requestId);
      throw error;
    }
  }) as T;
}