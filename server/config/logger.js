// logger.js
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import simpleNodeLogger from 'simple-node-logger';
import * as config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default directory is server/logs
const DEFAULT_LOG_DIR = join(__dirname, '../logs');

// Cache of underlying rolling file loggers keyed by `${logDirectory}:::${fileNamePattern}`
// to prevent opening duplicate file descriptors for the same destination.
const rollingLoggerCache = new Map();

function getRollingLogger({ logDirectory, fileNamePattern, dateFormat, timestampFormat }) {
    const key = `${logDirectory}:::${fileNamePattern}`;
    if (!rollingLoggerCache.has(key)) {
        if (!fs.existsSync(logDirectory)) {
            fs.mkdirSync(logDirectory, { recursive: true });
        }
        const opts = {
            logDirectory,
            fileNamePattern,
            dateFormat: dateFormat || config.DATEFORMAT || 'YYYY.MM.DD',
            timestampFormat: timestampFormat || config.TIMEFORMAT || 'YYYY-MM-DD HH:mm:ss.SSS',
            separator: ' ',
        };
        const createRolling = simpleNodeLogger.createRollingFileLogger || simpleNodeLogger;
        const rolling = createRolling(opts);
        rollingLoggerCache.set(key, rolling);
    }
    return rollingLoggerCache.get(key);
}

export class Logger {
    constructor(options = {}) {
        const {
            logDirectory,
            subDir = '',
            fileNamePattern = config.LOGFILENAMEFORMAT || 'roll-<DATE>.log',
            dateFormat = config.DATEFORMAT || 'YYYY.MM.DD',
            timestampFormat = config.TIMEFORMAT || 'YYYY-MM-DD HH:mm:ss.SSS',
            context = '',
            transport = null,
        } = options;

        const resolvedDir = logDirectory || (subDir ? join(DEFAULT_LOG_DIR, subDir) : DEFAULT_LOG_DIR);

        this.context = context;
        this.logDirectory = resolvedDir;
        this.fileNamePattern = fileNamePattern;
        this.dateFormat = dateFormat;
        this.timestampFormat = timestampFormat;

        this.rollingLogger = transport || getRollingLogger({
            logDirectory: resolvedDir,
            fileNamePattern,
            dateFormat,
            timestampFormat,
        });

        this.M = {
            // General device / payment actions
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
            WE: 'Webhook Traccar Event',
            WW: 'Webhook Wompi',

            // Cron-specific action mappings
            CUTOFF_START: 'Scheduled CutOff Process Started',
            CUTOFF_DONE: 'Scheduled CutOff Process Completed',
            CURFEW_START: 'Curfew Start (Immobilize) Executed',
            CURFEW_END: 'Curfew End (Reactivate) Executed',
            INVOICE_START: 'Daily Invoice Generation Started',
            INVOICE_DONE: 'Daily Invoice Generation Completed',
            KM_SYNC_START: 'Yesterday KM Synchronization Started',
            KM_SYNC_DONE: 'Yesterday KM Synchronization Completed',
            STATUS_SYNC: 'Device Status Update Executed',
            RELOAD_JOBS: 'Reloaded Dynamic Cron Schedules',
        };
    }

    /**
     * Create a scoped child logger with a context label, sharing the same rolling file transport.
     * @param {string} context
     * @returns {Logger}
     */
    child(context) {
        const childContext = this.context ? `${this.context}:${context}` : context;
        return new Logger({
            logDirectory: this.logDirectory,
            fileNamePattern: this.fileNamePattern,
            dateFormat: this.dateFormat,
            timestampFormat: this.timestampFormat,
            context: childContext,
            transport: this.rollingLogger,
        });
    }

    /**
     * Alias for child() for cron job scoping and backwards compatibility.
     * @param {string} jobName
     * @returns {Logger}
     */
    forJob(jobName) {
        return new Logger({
            logDirectory: this.logDirectory,
            fileNamePattern: this.fileNamePattern,
            dateFormat: this.dateFormat,
            timestampFormat: this.timestampFormat,
            context: jobName,
            transport: this.rollingLogger,
        });
    }

    _formatContext() {
        return this.context ? `[${this.context}] ` : '';
    }

    _formatData(data) {
        if (data === null || data === undefined) return '';
        if (data instanceof Error) return `${data.message}\nStack: ${data.stack}`;
        try {
            return typeof data === 'object' ? JSON.stringify(data) : String(data);
        } catch (e) {
            return '[Circular/Unserializable]';
        }
    }

    debug(message, data = null) {
        if (!config.debugMode) return;
        const msg = this.M[message] || message;
        const dataStr = data !== null && data !== undefined ? ` | Data: ${this._formatData(data)}` : '';
        const logMessage = `[DEBUG] ${this._formatContext()}${msg}${dataStr}`;

        this.rollingLogger.info(logMessage);
        console.log(`\x1b[35m${logMessage}\x1b[0m`);
    }

    info(message, data = null, code = null) {
        const msg = this.M[message] || message;
        const codeStr = code ? ` [${code}]` : '';
        const dataStr = data !== null && data !== undefined ? ` | Data: ${this._formatData(data)}` : '';
        const logMessage = `[INFO] ${this._formatContext()}${msg}${codeStr}${dataStr}`;

        this.rollingLogger.info(logMessage);
        if (config.debugMode) console.log(`\x1b[36m${logMessage}\x1b[0m`);
    }

    warn(message, data = null, code = null) {
        const msg = this.M[message] || message;
        const codeStr = code ? ` [${code}]` : '';
        const dataStr = data !== null && data !== undefined ? ` | Data: ${this._formatData(data)}` : '';
        const logMessage = `[WARN] ${this._formatContext()}${msg}${codeStr}${dataStr}`;

        this.rollingLogger.warn(logMessage);
        if (config.debugMode) console.warn(`\x1b[33m${logMessage}\x1b[0m`);
    }

    error(message, error = null) {
        let msg = message;
        let errObj = error;

        if (message instanceof Error) {
            msg = message.message;
            errObj = message;
        } else {
            msg = this.M[message] || message;
        }

        let errorDetails = '';
        if (errObj instanceof Error) {
            errorDetails = ` | ${errObj.message}${errObj.stack ? `\nStack: ${errObj.stack}` : ''}`;
        } else if (errObj !== null && errObj !== undefined) {
            errorDetails = ` | ${this._formatData(errObj)}`;
        }

        const logMessage = `[ERROR] ${this._formatContext()}${msg}${errorDetails}`;

        this.rollingLogger.error(logMessage);
        if (config.debugMode) console.error(`\x1b[31m${logMessage}\x1b[0m`);
    }
}

/**
 * Factory function to create parameterized Logger instances.
 * @param {Object} options
 * @returns {Logger}
 */
export function createLogger(options = {}) {
    return new Logger(options);
}

/**
 * Parameterized logger dedicated to cron jobs, using config variables.
 */
export const cronLogger = createLogger({
    subDir: config.CRON_LOG_SUBDIR || 'cron',
    fileNamePattern: config.CRON_LOG_FILENAME_FORMAT || 'cron-<DATE>.log',
});

const defaultLogger = new Logger();
export default defaultLogger;

