export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  metadata?: any;
}

// Filter out potential sensitive key patterns from logged objects
const sanitize = (data: any): any => {
  if (!data) return data;
  if (typeof data !== 'object') return data;
  
  const sensitiveKeys = [
    'password', 'token', 'access_token', 'secret', 'key', 
    'api_key', 'apikey', 'credential', 'auth', 'jwt'
  ];

  try {
    const serialized = JSON.stringify(data);
    const parsed = JSON.parse(serialized);
    
    const recursiveSanitize = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const k in obj) {
        if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
          obj[k] = '[REDACTED_FOR_SECURITY]';
        } else if (typeof obj[k] === 'object') {
          recursiveSanitize(obj[k]);
        }
      }
    };
    recursiveSanitize(parsed);
    return parsed;
  } catch (err) {
    return '[UNABLE_TO_SANITIZE_METADATA]';
  }
};

export const logger = {
  log(level: LogLevel, context: string, message: string, metadata?: any) {
    const sanitizedMeta = metadata ? sanitize(metadata) : undefined;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      metadata: sanitizedMeta
    };

    const formattedMessage = `[${entry.timestamp}] [${level}] [${context}] ${message}`;

    switch (level) {
      case LogLevel.INFO:
        console.log(`%c${formattedMessage}`, 'color: #3b82f6', entry.metadata || '');
        break;
      case LogLevel.WARN:
        console.warn(`%c${formattedMessage}`, 'color: #eab308', entry.metadata || '');
        break;
      case LogLevel.ERROR:
        console.error(`%c${formattedMessage}`, 'color: #ef4444', entry.metadata || '');
        break;
      case LogLevel.CRITICAL:
        console.error(`%c🔥 ${formattedMessage} 🔥`, 'color: #be123c; font-weight: bold; background-color: #ffe4e6', entry.metadata || '');
        break;
    }
  },

  info(context: string, message: string, metadata?: any) {
    this.log(LogLevel.INFO, context, message, metadata);
  },

  warn(context: string, message: string, metadata?: any) {
    this.log(LogLevel.WARN, context, message, metadata);
  },

  error(context: string, message: string, metadata?: any) {
    this.log(LogLevel.ERROR, context, message, metadata);
  },

  critical(context: string, message: string, metadata?: any) {
    this.log(LogLevel.CRITICAL, context, message, metadata);
  }
};
