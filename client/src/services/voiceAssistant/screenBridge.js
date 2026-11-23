/**
 * ScreenBridge — Synchronizes real React screen state & controls with the Voice Assistant
 *
 * Pages register their live filters, search handler, detail opener, loading status,
 * and safe summary metrics (`count`, `total`, `isPaginated`, `selectedItem`).
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

export const registerScreenBridge = (moduleId, bridgeConfig) => {
    if (!moduleId) return () => {};

    const entry = {
        moduleId,
        updatedAt: Date.now(),
        loading: Boolean(bridgeConfig?.loading),
        activeFilters: bridgeConfig?.activeFilters || {},
        metrics: bridgeConfig?.metrics || {},
        cardsData: bridgeConfig?.cardsData || null,
        selectedItem: bridgeConfig?.selectedItem || null,
        singleMatchItem: bridgeConfig?.singleMatchItem || null,
        applyFilter: bridgeConfig?.applyFilter || null,
        search: bridgeConfig?.search || null,
        clearFilters: bridgeConfig?.clearFilters || null,
        openDetail: bridgeConfig?.openDetail || null,
    };

    activeScreens.set(moduleId, entry);

    const mWaiters = mountWaiters.get(moduleId);
    if (mWaiters && mWaiters.length > 0) {
        mountWaiters.delete(moduleId);
        mWaiters.forEach((resolve) => resolve(entry));
    }

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

export const waitForScreenMount = (moduleId, timeoutMs = 4000) => {
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
 * Waits until the registered screen finishes any pending React state updates
 * and reports `loading === false`.
 */
export const waitForScreenDataReady = (moduleId, timeoutMs = 6000) => {
    return new Promise((resolve) => {
        // Give React 80ms to commit state changes (e.g. setFilter, setSearchQuery, setLoading(true))
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
                // Wait one extra frame after loading turns false so memoized metrics are fresh
                setTimeout(() => resolve(activeScreens.get(moduleId) || bridge), 40);
            };

            const list = readyWaiters.get(moduleId) || [];
            list.push(onReady);
            readyWaiters.set(moduleId, list);
        }, 80);
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
