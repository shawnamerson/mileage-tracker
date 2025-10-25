/**
 * Centralized logging utility
 * In production, only errors and warnings are logged
 * In development, all logs are shown
 */

const IS_DEV = __DEV__;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (!IS_DEV && (level === 'debug' || level === 'info')) {
      return false;
    }
    return true;
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  // Convenience methods for common patterns
  serviceCall(service: string, method: string, ...args: any[]) {
    this.debug(`[${service}] ${method}`, ...args);
  }

  apiSuccess(endpoint: string, data?: any) {
    this.info(`✅ API Success: ${endpoint}`, data);
  }

  apiError(endpoint: string, error: any) {
    this.error(`❌ API Error: ${endpoint}`, error);
  }
}

export const logger = new Logger();
