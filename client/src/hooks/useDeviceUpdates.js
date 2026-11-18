import { useEffect, useRef } from 'react';
import { useSSE } from '../context/SSEContext';

/**
 * Custom hook to listen to real-time 'device_update' events from global SSE.
 * Handles event subscription, payload parsing, and unsubscription cleanly.
 * 
 * @param {Function} onUpdate - Callback function receiving array of device updates: (updates: Array<Object>) => void
 */
export const useDeviceUpdates = (onUpdate) => {
    const { subscribe } = useSSE();
    const callbackRef = useRef(onUpdate);

    // Keep reference updated to avoid unnecessary resubscriptions
    useEffect(() => {
        callbackRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        if (!subscribe) return;

        const unsubscribe = subscribe('device_update', (e) => {
            try {
                const data = e.parsedData;
                if (!data) return;
                const updates = Array.isArray(data) ? data : [data];
                if (updates.length > 0 && callbackRef.current) {
                    callbackRef.current(updates);
                }
            } catch (err) {
                console.error('[useDeviceUpdates] Error handling device_update:', err);
            }
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [subscribe]);
};

export default useDeviceUpdates;

