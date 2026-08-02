import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { createSSEConnection } from '../services/api';

const SSEContext = createContext(null);

export const useSSE = () => {
    const context = useContext(SSEContext);
    if (!context) {
        throw new Error('useSSE must be used within an SSEProvider');
    }
    return context;
};

export const SSEProvider = ({ children }) => {
    const { token, isAuthenticated } = useAuth();
    const eventSourceRef = useRef(null);
    const subscribersRef = useRef({});
    const [status, setStatus] = useState('disconnected');

    const connect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        if (!token) return;

        setStatus('connecting');
        const clientId = `global-${Math.random().toString(36).substr(2, 9)}`;
        const eventSource = createSSEConnection(clientId);

        eventSource.addEventListener('connected', () => {
            console.log('✅ Global SSE Connected');
            setStatus('connected');
        });

        eventSource.addEventListener('error', (err) => {
            console.warn('⚠️ Global SSE Error:', err);
            setStatus('error');
        });

        // Delegate incoming events to registered subscribers
        const handleEvent = (eventName, e) => {
            const callbacks = subscribersRef.current[eventName];
            if (callbacks) {
                callbacks.forEach(cb => cb(e));
            }
        };

        // We need to capture specific events to dispatch them.
        // EventSource doesn't have a catch-all for named events, so we dynamically
        // add listeners for any event that gets subscribed to.
        const knownEvents = [
            'device_update', 
            'payment-updated',
            'payment_update',
            'reconciliation_update',
            'invoice_update',
            'summary_update'
        ];
        
        knownEvents.forEach(evt => {
            eventSource.addEventListener(evt, (e) => handleEvent(evt, e));
        });

        eventSourceRef.current = eventSource;
    }, [token]);

    useEffect(() => {
        if (isAuthenticated()) {
            connect();
        } else if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            setStatus('disconnected');
        }

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, [token, isAuthenticated, connect]);

    const subscribe = useCallback((eventName, callback) => {
        if (!subscribersRef.current[eventName]) {
            subscribersRef.current[eventName] = new Set();
        }
        subscribersRef.current[eventName].add(callback);

        return () => {
            if (subscribersRef.current[eventName]) {
                subscribersRef.current[eventName].delete(callback);
            }
        };
    }, []);

    const value = {
        status,
        subscribe,
    };

    return (
        <SSEContext.Provider value={value}>
            {children}
        </SSEContext.Provider>
    );
};
