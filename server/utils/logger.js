const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logFile = process.env.LOG_FILE || './logs/app.log';
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Ensure logs directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Log levels
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
    
    this.currentLevel = this.levels[this.logLevel] || this.levels.info;
  }
  
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }
  
  writeToFile(formattedMessage) {
    if (this.isProduction) {
      try {
        fs.appendFileSync(this.logFile, formattedMessage + '\n');
      } catch (err) {
        console.error('Failed to write to log file:', err);
      }
    }
  }
  
  log(level, message, meta = {}) {
    if (this.levels[level] > this.currentLevel) {
      return; // Skip if log level is too verbose
    }
    
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Always write to file in production
    this.writeToFile(formattedMessage);
    
    // Console output based on environment and level
    if (!this.isProduction || level === 'error' || level === 'warn') {
      switch (level) {
        case 'error':
          console.error(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'info':
          console.info(formattedMessage);
          break;
        case 'debug':
          console.log(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }
  }
  
  error(message, meta = {}) {
    this.log('error', message, meta);
  }
  
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }
  
  info(message, meta = {}) {
    this.log('info', message, meta);
  }
  
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }
  
  // Special method for user actions (always logged)
  userAction(action, userId, details = {}) {
    this.info(`User Action: ${action}`, { userId, ...details });
  }
  
  // Special method for game events (always logged)
  gameEvent(event, gameId, details = {}) {
    this.info(`Game Event: ${event}`, { gameId, ...details });
  }
  
  // Special method for security events (always logged)
  security(event, details = {}) {
    this.warn(`Security Event: ${event}`, details);
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger; 