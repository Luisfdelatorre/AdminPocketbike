import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import { initializeParticles } from '../utils/particles';
import { useSSE } from '../context/SSEContext';

const Layout = () => {
    const [sseStatus, setSSEStatus] = useState('connecting');

    const { subscribe } = useSSE();

    useEffect(() => {
        // Initialize particles
        initializeParticles();

        const unsub = subscribe('payment-updated', (event) => {
            const data = JSON.parse(event.data);
            console.log('💳 Payment Updated:', data);

            // Dispatch custom event for components to listen to
            window.dispatchEvent(new CustomEvent('payment-update', { detail: data }));
        });

        eventSource.addEventListener('device_update', (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📡 Device Updated via SSE:', data);
                window.dispatchEvent(new CustomEvent('device-update', { detail: data }));
            } catch (err) {
                console.error('Error parsing SSE device_update event:', err);
            }
        });

        subscribe('error', () => {
            console.error('❌ SSE Error');
            setSSEStatus('disconnected');
        });

        return () => {
            unsub();
        };
    }, [subscribe]);

    return (
        <>
            <div className="bg-gradient"></div>
            <div className="bg-particles" id="particles"></div>

            <div className="app-container">
                <Header sseStatus={sseStatus} />
                <main className="app-main">
                    <div className="container">
                        <Outlet />
                    </div>
                </main>
                <div className="toast-container" id="toast-container"></div>
            </div>
        </>
    );
};

export default Layout;

