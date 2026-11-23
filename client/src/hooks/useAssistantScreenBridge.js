import { useEffect, useRef } from 'react';
import { registerScreenBridge } from '../services/voiceAssistant/screenBridge';

/**
 * Connects an active application screen to the Voice Assistant ScreenBridge.
 * Keeps callbacks fresh via ref while updating reactive metrics/loading state.
 *
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
 * }} config
 */
export default function useAssistantScreenBridge(moduleId, config = {}) {
    const handlersRef = useRef(config);
    handlersRef.current = config;

    useEffect(() => {
        if (!moduleId) return undefined;

        const unregister = registerScreenBridge(moduleId, {
            loading: Boolean(config.loading),
            activeFilters: config.activeFilters || {},
            metrics: config.metrics || {},
            selectedItem: config.selectedItem || null,
            singleMatchItem: config.singleMatchItem || null,
            applyFilter: (params) => handlersRef.current.applyFilter?.(params),
            search: (query) => handlersRef.current.search?.(query),
            clearFilters: () => handlersRef.current.clearFilters?.(),
            openDetail: (params) => handlersRef.current.openDetail?.(params),
        });

        return unregister;
    }, [
        moduleId,
        config.loading,
        JSON.stringify(config.activeFilters || {}),
        JSON.stringify(config.metrics || {}),
        config.selectedItem,
        config.singleMatchItem,
    ]);
}
