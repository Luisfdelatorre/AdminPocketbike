/**
 * Generic memory storage utility to manage in-memory caches safely.
 * Encapsulates the Map object to provide a standard interface.
 */
class MemoryStorage {
    constructor() {
        this.store = new Map();
    }

    get(key) {
        return this.store.get(key);
    }

    set(key, value) {
        this.store.set(key, value);
    }

    has(key) {
        return this.store.has(key);
    }

    delete(key) {
        return this.store.delete(key);
    }

    clear() {
        this.store.clear();
    }

    entries() {
        return this.store.entries();
    }

    values() {
        return this.store.values();
    }

    get size() {
        return this.store.size;
    }
}

// Export singleton instances for specific domains
export const deviceStateCache = new MemoryStorage();
