import { Request } from 'express';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogContext {
  userId?: string;
  brandId?: string;
  threePlId?: string;
  requestId?: string;
  url?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    return levels.indexOf(level) <= levels.indexOf(this.logLevel);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const levelEmoji = {
      [LogLevel.ERROR]: '🚨',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.DEBUG]: '🔍'
    }[level];

    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `${levelEmoji} [${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);
    
    if (error) {
      console.error(formattedMessage, error);
    } else {
      console.log(formattedMessage);
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // Request logging
  logRequest(req: Request, context?: LogContext): void {
    const requestContext: LogContext = {
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.claims?.sub,
      ...context
    };

    this.info(`${req.method} ${req.url}`, requestContext);
  }

  // API response logging
  logApiResponse(req: Request, statusCode: number, responseTime: number, context?: LogContext): void {
    const responseContext: LogContext = {
      url: req.url,
      method: req.method,
      statusCode,
      responseTime: `${responseTime}ms`,
      userId: (req as any).user?.claims?.sub,
      ...context
    };

    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, `API Response: ${req.method} ${req.url} - ${statusCode} (${responseTime}ms)`, responseContext);
  }

  // Database operation logging
  logDbOperation(operation: string, table: string, duration: number, context?: LogContext): void {
    const dbContext: LogContext = {
      operation,
      table,
      duration: `${duration}ms`,
      ...context
    };

    this.debug(`DB ${operation} on ${table}`, dbContext);
  }

  // Sync operation logging
  logSyncOperation(brandId: string, syncType: string, status: string, recordCount: number, context?: LogContext): void {
    const syncContext: LogContext = {
      brandId,
      syncType,
      status,
      recordCount,
      ...context
    };

    this.info(`Sync ${syncType} for brand ${brandId}: ${status} (${recordCount} records)`, syncContext);
  }

  // Error logging with full context
  logError(error: Error, context?: LogContext): void {
    const errorContext: LogContext = {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...context
    };

    this.error(`Error: ${error.message}`, errorContext, error);
  }
}

export const logger = new Logger();

// Request timing middleware
export const requestTimer = (req: Request, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logApiResponse(req, res.statusCode, duration);
  });
  
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: any, next: any) => {
  logger.logRequest(req);
  next();
};
