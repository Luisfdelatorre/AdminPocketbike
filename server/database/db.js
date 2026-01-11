import Database from 'better-sqlite3';
import { config } from '../config/config.js';

let db = null;

export function getDatabase() {
    if (!db) {
        db = new Database(config.database.path);
        db.pragma('foreign_keys = ON');
        db.pragma('journal_mode = WAL');
    }
    return db;
}

export default getDatabase;
