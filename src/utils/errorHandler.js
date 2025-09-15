const { logError, logWarn, logInfo } = require('./logger');
const fs = require('fs').promises;
const path = require('path');
const settings = require('../config/settings');

class CrawlerError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'CrawlerError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class ValidationError extends CrawlerError {
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

class NetworkError extends CrawlerError {
  constructor(message, details = {}) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

class RateLimitError extends CrawlerError {
  constructor(message, details = {}) {
    super(message, 'RATE_LIMIT_ERROR', details);
    this.name = 'RateLimitError';
  }
}

class ParsingError extends CrawlerError {
  constructor(message, details = {}) {
    super(message, 'PARSING_ERROR', details);
    this.name = 'ParsingError';
  }
}

class DataValidationError extends CrawlerError {
  constructor(message, details = {}) {
    super(message, 'DATA_VALIDATION_ERROR', details);
    this.name = 'DataValidationError';
  }
}

class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      maxConsecutiveErrors: options.maxConsecutiveErrors || 3,
      errorLogPath: options.errorLogPath || 'logs/errors',
      saveErrorLogs: options.saveErrorLogs !== false,
      notifyOnError: options.notifyOnError || false,
      exitOnFatalError: options.exitOnFatalError !== false,
      ...options
    };

    this.errors = [];
    this.errorCounts = new Map();
    this.consecutiveErrors = new Map();
  }

  async init() {
    if (this.options.saveErrorLogs) {
      await this.ensureLogDirectory();
    }
  }

  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.options.errorLogPath, { recursive: true });
    } catch (error) {
      logWarn(`Failed to create error log directory: ${error.message}`);
    }
  }

  async handleError(error, context = {}) {
    const errorInfo = {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      code: error.code,
      stack: error.stack,
      context: {
        url: context.url,
        phase: context.phase,
        attemptNumber: context.attemptNumber,
        ...context
      },
      timestamp: new Date().toISOString(),
      type: this.categorizeError(error)
    };

    this.trackError(errorInfo);
    this.logError(errorInfo);

    if (this.options.saveErrorLogs) {
      await this.saveErrorLog(errorInfo);
    }

    if (this.shouldStopProcessing(errorInfo)) {
      if (this.options.exitOnFatalError) {
        logError('Fatal error threshold reached. Stopping process...');
        process.exit(1);
      }
    }

    return errorInfo;
  }

  categorizeError(error) {
    if (error instanceof ValidationError) return 'VALIDATION';
    if (error instanceof NetworkError) return 'NETWORK';
    if (error instanceof RateLimitError) return 'RATE_LIMIT';
    if (error instanceof ParsingError) return 'PARSING';
    if (error instanceof DataValidationError) return 'DATA_VALIDATION';

    if (error.response) {
      const status = error.response.status;
      if (status === 429) return 'RATE_LIMIT';
      if (status === 404) return 'NOT_FOUND';
      if (status >= 400 && status < 500) return 'CLIENT_ERROR';
      if (status >= 500) return 'SERVER_ERROR';
    }

    if (error.code === 'ECONNABORTED') return 'TIMEOUT';
    if (error.code === 'ENOTFOUND') return 'DNS_ERROR';
    if (error.code === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
    if (error.code === 'ECONNRESET') return 'CONNECTION_RESET';
    if (error.code === 'ETIMEDOUT') return 'TIMEOUT';

    if (error.code === 'ENOENT') return 'FILE_NOT_FOUND';
    if (error.code === 'EACCES') return 'PERMISSION_DENIED';
    if (error.code === 'EISDIR') return 'IS_DIRECTORY';

    if (error.message.includes('PDF')) return 'PDF_ERROR';
    if (error.message.includes('HTML')) return 'HTML_ERROR';
    if (error.message.includes('JSON')) return 'JSON_ERROR';
    if (error.message.includes('URL')) return 'URL_ERROR';

    return 'UNKNOWN';
  }

  trackError(errorInfo) {
    const { type, context } = errorInfo;
    const key = `${type}:${context.url || 'unknown'}`;

    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);

    if (this.lastErrorKey === key) {
      this.consecutiveErrors.set(key, (this.consecutiveErrors.get(key) || 0) + 1);
    } else {
      this.consecutiveErrors.set(key, 1);
    }
    this.lastErrorKey = key;

    this.detectErrorPatterns(key, errorInfo);
  }

  detectErrorPatterns(key, errorInfo) {
    const consecutiveCount = this.consecutiveErrors.get(key) || 0;
    const totalCount = this.errorCounts.get(key) || 0;

    if (consecutiveCount >= this.options.maxConsecutiveErrors) {
      logWarn(`High frequency of consecutive errors detected: ${key} (${consecutiveCount} times in a row)`);
    }

    if (totalCount >= 10) {
      logWarn(`High total error count for: ${key} (${totalCount} times total)`);
    }

    if (errorInfo.type === 'RATE_LIMIT' && totalCount >= 3) {
      logWarn('Multiple rate limit errors detected. Consider reducing request frequency.');
    }

    if (errorInfo.type === 'PARSING' && consecutiveCount >= 2) {
      logWarn('Multiple parsing errors detected. Check content structure changes.');
    }
  }

  async saveErrorLog(errorInfo) {
    try {
      const filename = `error-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(this.options.errorLogPath, filename);
      
      await fs.writeFile(
        filePath,
        JSON.stringify(errorInfo, null, 2),
        'utf8'
      );
      
      logInfo(`Error details saved to: ${filePath}`);
    } catch (error) {
      logWarn(`Failed to save error log: ${error.message}`);
    }
  }

  shouldRetry(error, attempt = 1, maxAttempts = 3) {
    if (attempt >= maxAttempts) return false;

    const errorType = this.categorizeError(error);

    const noRetryTypes = [
      'VALIDATION',
      'DATA_VALIDATION',
      'FILE_NOT_FOUND',
      'PERMISSION_DENIED',
      'IS_DIRECTORY',
      'CLIENT_ERROR',
      'NOT_FOUND'
    ];

    if (noRetryTypes.includes(errorType)) {
      return false;
    }

    const alwaysRetryTypes = [
      'NETWORK',
      'TIMEOUT',
      'CONNECTION_RESET',
      'CONNECTION_REFUSED',
      'DNS_ERROR',
      'SERVER_ERROR'
    ];

    if (alwaysRetryTypes.includes(errorType)) {
      return true;
    }

    if (errorType === 'RATE_LIMIT') {
      return attempt < maxAttempts + 2;
    }

    return false;
  }

  getRetryDelay(error, attempt) {
    const baseDelay = 1000;
    const errorType = this.categorizeError(error);
    let delay = baseDelay * Math.pow(2, attempt - 1);
    delay += Math.random() * 1000;

    switch (errorType) {
      case 'RATE_LIMIT':
        delay *= 3;
        break;
      case 'SERVER_ERROR':
        delay *= 2;
        break;
      case 'NETWORK':
      case 'CONNECTION_RESET':
        delay *= 1.5;
        break;
    }
    
    return Math.min(delay, 60000);
  }

  shouldStopProcessing(errorInfo) {
    const consecutiveCount = this.consecutiveErrors.get(this.lastErrorKey) || 0;
    const totalErrors = this.errors.length;

    if (consecutiveCount >= this.options.maxConsecutiveErrors) {
      return true;
    }

    if (totalErrors >= 50) {
      return true;
    }

    const fatalErrorTypes = ['PERMISSION_DENIED', 'DATA_CORRUPTION'];
    if (fatalErrorTypes.includes(errorInfo.type)) {
      return true;
    }

    return false;
  }

  getErrorStats() {
    const stats = {
      totalErrors: this.errors.length,
      errorsByType: {},
      errorsByDomain: {},
      consecutiveErrors: Object.fromEntries(this.consecutiveErrors),
      lastError: this.errors[this.errors.length - 1],
      timestamp: new Date().toISOString()
    };

    for (const [key, count] of this.errorCounts.entries()) {
      const [type, url] = key.split(':');
      stats.errorsByType[type] = (stats.errorsByType[type] || 0) + count;
      if (url && url !== 'unknown') {
        try {
          const domain = new URL(url).hostname;
          stats.errorsByDomain[domain] = (stats.errorsByDomain[domain] || 0) + count;
        } catch {}
      }
    }

    return stats;
  }

  reset() {
    this.errors = [];
    this.errorCounts.clear();
    this.consecutiveErrors.clear();
    this.lastErrorKey = null;
  }
}

const globalErrorHandler = new ErrorHandler(settings.errorHandling || {});

globalErrorHandler.init().catch(error => {
  logError('Failed to initialize error handler:', error);
});

async function withErrorHandling(fn, context = {}) {
  try {
    return await fn();
  } catch (error) {
    await globalErrorHandler.handleError(error, context);
    throw error;
  }
}

module.exports = {
  CrawlerError,
  ValidationError,
  NetworkError,
  RateLimitError,
  ParsingError,
  DataValidationError,
  ErrorHandler,
  globalErrorHandler,
  withErrorHandling
};
