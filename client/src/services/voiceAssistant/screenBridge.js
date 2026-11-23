/**
 * ScreenBridge — Synchronizes real React screen state & controls with the Voice Assistant
 *
 * Pages register their live filters, search handler, detail opener, loading status,
 * and safe summary metrics (`count`, `total`, `isPaginated`, `selectedItem`).
 *
 * The Action Dispatcher uses this bridge to:
 *  1. Wait for a screen to mount after `navigate(route)` without arbitrary fixed delays.
 *  2. Execute `applyFilter`, `search`, `clearFilters`, `openDetail` directly on the real page state.
 *  3. Wait until `loading === false` after a filter/search triggers a server reload.
 *  4. Expose safe, read-only metrics to Local Response Resolvers (`resolvers.js`).
 */

const activeScreens = new Map();
const listeners = new Set();
const mountWaiters = new Map();
const readyWaiters = new Map();

const notifyListeners = () => {
    listeners.forEach((cb) => {
        try {
            cb();
        } catch {
            // Ignore listener errors
        }
    });
};

const flushReadyWaiters = (moduleId, bridge) => {
    if (!bridge || bridge.loading) return;
    const list = readyWaiters.get(moduleId);
    if (!list || list.length === 0) return;
    readyWaiters.delete(moduleId);
    list.forEach((resolve) => resolve(bridge));
};

/**
 * Registers or updates a screen bridge for `moduleId`.
 * @param {string} moduleId
 * @param {{
 *   loading?: boolean,
 *   activeFilters?: object,
 *   metrics?: object,
 *   selectedItem?: string|null,
 *   singleMatchItem?: string|null,
 *   applyFilter?: (params: object) => Promise<boolean>|boolean,
 *   search?: (query: string) => Promise<boolean>|boolean,
 *   clearFilters?: () => Promise<boolean>|boolean,
 *   openDetail?: (params: object) => Promise<boolean>|boolean,
 * }} bridgeConfig
 */
export const registerScreenBridge = (moduleId, bridgeConfig) => {
    if (!moduleId) return () => {};

    const entry = {
        moduleId,
        updatedAt: Date.now(),
        loading: Boolean(bridgeConfig?.loading),
        activeFilters: bridgeConfig?.activeFilters || {},
        metrics: bridgeConfig?.metrics || {},
        selectedItem: bridgeConfig?.selectedItem || null,
        singleMatchItem: bridgeConfig?.singleMatchItem || null,
        applyFilter: bridgeConfig?.applyFilter || null,
        search: bridgeConfig?.search || null,
        clearFilters: bridgeConfig?.clearFilters || null,
        openDetail: bridgeConfig?.openDetail || null,
    };

    activeScreens.set(moduleId, entry);

    // Resolve any pending mount waiters
    const mWaiters = mountWaiters.get(moduleId);
    if (mWaiters && mWaiters.length > 0) {
        mountWaiters.delete(moduleId);
        mWaiters.forEach((resolve) => resolve(entry));
    }

    // Resolve any pending data-readiness waiters when loading is false
    flushReadyWaiters(moduleId, entry);
    notifyListeners();

    return () => {
        const current = activeScreens.get(moduleId);
        if (current === entry) {
            activeScreens.delete(moduleId);
            notifyListeners();
        }
    };
};

export const getScreenBridge = (moduleId) => activeScreens.get(moduleId) || null;

export const getAllScreenBridges = () => Object.fromEntries(activeScreens.entries());

export const subscribeScreenBridge = (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

/**
 * Waits until `moduleId` registers its bridge (e.g., right after React Router navigation).
 */
export const waitForScreenMount = (moduleId, timeoutMs = 2500) => {
    const existing = activeScreens.get(moduleId);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            const list = mountWaiters.get(moduleId) || [];
            mountWaiters.set(
                moduleId,
                list.filter((fn) => fn !== onMounted)
            );
            resolve(activeScreens.get(moduleId) || null);
        }, timeoutMs);

        const onMounted = (bridge) => {
            clearTimeout(timer);
            resolve(bridge);
        };

        const list = mountWaiters.get(moduleId) || [];
        list.push(onMounted);
        mountWaiters.set(moduleId, list);
    });
};

/**
 * Waits until the registered screen reports `loading === false` after a state update.
 */
export const waitForScreenDataReady = (moduleId, timeoutMs = 3500) => {
    return new Promise((resolve) => {
        // Yield one microtask/frame so React state transitions (e.g. setLoading(true)) settle first
        setTimeout(() => {
            const current = activeScreens.get(moduleId);
            if (current && !current.loading) {
                resolve(current);
                return;
            }

            const timer = setTimeout(() => {
                const list = readyWaiters.get(moduleId) || [];
                readyWaiters.set(
                    moduleId,
                    list.filter((fn) => fn !== onReady)
                );
                resolve(activeScreens.get(moduleId) || null);
            }, timeoutMs);

            const onReady = (bridge) => {
                clearTimeout(timer);
                resolve(bridge);
            };

            const list = readyWaiters.get(moduleId) || [];
            list.push(onReady);
            readyWaiters.set(moduleId, list);
        }, 35);
    });
};

export const clearAllScreenBridges = () => {
    activeScreens.clear();
    mountWaiters.clear();
    readyWaiters.clear();
};

export default {
    registerScreenBridge,
    getScreenBridge,
    getAllScreenBridges,
    subscribeScreenBridge,
    waitForScreenMount,
    waitForScreenDataReady,
    clearAllScreenBridges,
};
