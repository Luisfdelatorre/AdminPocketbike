// logger.js
import { LOGFILENAMEFORMAT, DATEFORMAT, TIMEFORMAT, server } from '../config/config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import SimpleNodeLogger from 'simple-node-logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const opts = {
  logDirectory: path.join(__dirname, '../logs'),
  fileNamePattern: LOGFILENAMEFORMAT,
  dateFormat: DATEFORMAT,
  timestampFormat: TIMEFORMAT,
  separator: ' ',
};

// Create the log directory if it doesn't exist
import fs from 'fs';
if (!fs.existsSync(opts.logDirectory)) {
  fs.mkdirSync(opts.logDirectory, { recursive: true });
}

// Handle different import styles for simple-node-logger
const createRollingFileLogger = SimpleNodeLogger.createRollingFileLogger || SimpleNodeLogger;
const log = createRollingFileLogger(opts);

class Logger {
  constructor() {
    this.M = {
      CS: 'Change Status',
      ES: 'Engine Stop',
      ER: 'Engine Resume',
      PR: 'Payment Received',
      PS: 'Payment Saved',
      PRE: 'Payment Request',
      PNRE: 'Push Notification Request',
      RS: 'Request DaySales Start',
      RC: 'Request DaySales Complete',
      RF: 'Request DaySales Failed',
      TMS: 'Text message send',
      TMR: 'Text message Received',
      TMPR: 'Text message Payment Received',
      WE: 'Webhook Traccar Event ',
      WW: 'Webhook Wompi ',
    };
    this.debugMode = server.env === 'development';
  }

  // Info log
  info(message, data = null, code = null) {
    const logMessage = `[INFO] ${message} ${data ? code : ''} ${data ? ' | Data: ' + JSON.stringify(data) : ''}`;
    log.info(logMessage);
    if (this.debugMode) console.log(logMessage);
  }

  // Warning log
  warn(message, data = null, code = null) {
    const logMessage = `[WARN] ${message} ${data ? code : ''} ${data ? ' | Data: ' + JSON.stringify(data) : ''}`;
    log.warn(logMessage);
    if (this.debugMode) console.warn(logMessage);
  }

  // Error log
  error(message, error = null) {
    const logMessage = `[ERROR] ${message} ${error}`;

    log.error(logMessage);
    if (this.debugMode) console.error(logMessage);
  }
}

export default new Logger();
