import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import { initializeParticles } from '../utils/particles';

const Layout = () => {
    const [sseStatus, setSSEStatus] = useState('connecting');

    useEffect(() => {
        // Initialize particles
        initializeParticles();

        // Setup SSE connection
        const clientId = `client-${Math.random().toString(36).substr(2, 9)}`;
        const sseUrl = `/apinode/sse/subscribe?clientId=${clientId}`;

        const eventSource = new EventSource(sseUrl);

        eventSource.addEventListener('connected', () => {
            console.log('✅ SSE Connected');
            setSSEStatus('connected');
        });

        eventSource.addEventListener('payment-updated', (event) => {
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

        eventSource.onerror = () => {
            console.error('❌ SSE Error');
            setSSEStatus('disconnected');
        };

        return () => {
            eventSource.close();
        };
    }, []);

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

