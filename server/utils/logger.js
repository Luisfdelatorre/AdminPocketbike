// logger.js
// Re-export unified logger for backwards compatibility with legacy imports
import logger, { Logger, createLogger } from '../config/logger.js';

export { Logger, createLogger };
export default logger;
