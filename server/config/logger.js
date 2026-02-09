// logger.js
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import simpleNodeLogger from 'simple-node-logger';
import * as config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const opts = {
    logDirectory: join(__dirname, '../logs'),
    fileNamePattern: config.LOGFILENAMEFORMAT,
    dateFormat: config.DATEFORMAT,
    timestampFormat: config.TIMEFORMAT,
    separator: ' ',
};

// Ensure log directory exists? simple-node-logger usually handles file creation, 
// but might error if dir doesn't exist. 
// However, the original code didn't check. We'll stick to original logic but ESM.

const log = simpleNodeLogger.createRollingFileLogger(opts);

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

    // Debug log
    debug(message, data = null) {
        if (!config.debugMode) return;
        const msg = this.M[message] || message;
        const dataStr = data ? ` | Data: ${this._formatData(data)}` : '';
        const logMessage = `[DEBUG] ${msg}${dataStr}`;

        log.info(logMessage); // Using underlying info but labeled as DEBUG
        console.log(`\x1b[35m${logMessage}\x1b[0m`); // Magenta for Debug
    }

    // Info log
    info(message, data = null, code = null) {
        const msg = this.M[message] || message;
        const dataStr = data ? ` | Data: ${this._formatData(data)}` : '';
        const codeStr = code ? ` [${code}]` : '';
        const logMessage = `[INFO] ${msg}${codeStr}${dataStr}`;

        log.info(logMessage);
        if (config.debugMode) console.log(`\x1b[36m${logMessage}\x1b[0m`); // Cyan for Info
    }

    // Warning log
    warn(message, data = null, code = null) {
        const msg = this.M[message] || message;
        const dataStr = data ? ` | Data: ${this._formatData(data)}` : '';
        const codeStr = code ? ` [${code}]` : '';
        const logMessage = `[WARN] ${msg}${codeStr}${dataStr}`;

        log.warn(logMessage);
        if (config.debugMode) console.warn(`\x1b[33m${logMessage}\x1b[0m`); // Yellow for Warn
    }

    // Error log
    error(message, error = null) {
        const msg = this.M[message] || message;
        let errorDetails = '';
        if (error instanceof Error) {
            errorDetails = ` | ${error.message}\nStack: ${error.stack}`;
        } else if (error) {
            errorDetails = ` | ${this._formatData(error)}`;
        }

        const logMessage = `[ERROR] ${msg}${errorDetails}`;

        log.error(logMessage);
        if (config.debugMode) console.error(`\x1b[31m${logMessage}\x1b[0m`); // Red for Error
    }

    _formatData(data) {
        try {
            return typeof data === 'object' ? JSON.stringify(data) : String(data);
        } catch (e) {
            return '[Circular/Unserializable]';
        }
    }
}

export default new Logger();
