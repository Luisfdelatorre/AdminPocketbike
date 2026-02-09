// logger.js
const config = require('../config/default');
const path = require('path');
const { createRollingFileLogger } = require('simple-node-logger');

const opts = {
  logDirectory: path.join(__dirname, '../logs'),
  fileNamePattern: config.LOGFILENAMEFORMAT,
  dateFormat: config.DATEFORMAT,
  timestampFormat: config.TIMEFORMAT,
  separator: ' ',
};

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
  }

  // Info log
  info(message, data = null, code = null) {
    const logMessage = `[INFO] ${message} ${data ? code : ''} ${data ? ' | Data: ' + JSON.stringify(data) : ''}`;
    log.info(logMessage);
    if (config.debugMode) console.log(logMessage);
  }

  // Warning log
  warn(message, data = null, code = null) {
    const logMessage = `[WARN] ${message} ${data ? code : ''} ${data ? ' | Data: ' + JSON.stringify(data) : ''}`;
    log.warn(logMessage);
    if (config.debugMode) console.warn(logMessage);
  }

  // Error log
  error(message, error = null) {
    const logMessage = `[ERROR] ${message} ${error}`;

    log.error(logMessage);
    if (config.debugMode) console.error(logMessage);
  }
}

module.exports = new Logger();
