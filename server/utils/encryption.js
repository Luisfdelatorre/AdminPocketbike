import crypto from 'crypto';
import { Transaction } from '../config/config.js';

const ENCRYPTION_KEY = Transaction.ENCRYPTION_KEY || 'default-secret-key-32-chars-long-!!!'; // Must be 32 chars
const IV_LENGTH = 16; // For AES, this is always 16

export function encrypt(text) {
    if (!text) return text;

    // Ensure key is 32 bytes
    const key = Buffer.alloc(32, ENCRYPTION_KEY);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text) {
    if (!text || !text.includes(':')) return text;

    try {
        const key = Buffer.alloc(32, ENCRYPTION_KEY);
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    } catch (error) {
        console.error('Decryption failed:', error.message);
        return text; // Return as is if decryption fails (might not be encrypted)
    }
}
