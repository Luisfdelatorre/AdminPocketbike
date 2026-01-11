/**
 * Server-Sent Events (SSE) Service for real-time updates
 */
export class SSEService {
    constructor() {
        this.clients = new Map(); // clientId -> response object
    }

    /**
     * Register a new SSE client
     */
    addClient(clientId, response) {
        console.log(`📡 SSE client connected: ${clientId}`);

        // Set headers for SSE
        response.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        // Store client
        this.clients.set(clientId, response);

        // Send initial connection event
        this.sendToClient(clientId, 'connected', { clientId, timestamp: new Date().toISOString() });

        // Handle client disconnect
        response.on('close', () => {
            console.log(`📡 SSE client disconnected: ${clientId}`);
            this.clients.delete(clientId);
        });
    }

    /**
     * Remove a client
     */
    removeClient(clientId) {
        this.clients.delete(clientId);
    }

    /**
     * Send event to a specific client
     */
    sendToClient(clientId, event, data) {
        const client = this.clients.get(clientId);
        if (client) {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            client.write(message);
        }
    }

    /**
     * Broadcast event to all connected clients
     */
    broadcast(event, data) {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

        let sentCount = 0;
        this.clients.forEach((client, clientId) => {
            try {
                client.write(message);
                sentCount++;
            } catch (error) {
                console.error(`Failed to send to client ${clientId}:`, error);
                this.clients.delete(clientId);
            }
        });

        if (sentCount > 0) {
            console.log(`📡 Broadcasted "${event}" to ${sentCount} clients`);
        }
    }

    /**
     * Send event to clients matching a filter
     */
    broadcastToFilter(event, data, filterFn) {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

        this.clients.forEach((client, clientId) => {
            if (filterFn(clientId)) {
                try {
                    client.write(message);
                } catch (error) {
                    console.error(`Failed to send to client ${clientId}:`, error);
                    this.clients.delete(clientId);
                }
            }
        });
    }

    /**
     * Get number of connected clients
     */
    getClientCount() {
        return this.clients.size;
    }

    /**
     * Send heartbeat to all clients to keep connection alive
     */
    sendHeartbeat() {
        this.broadcast('heartbeat', { timestamp: new Date().toISOString() });
    }
}

export const sseService = new SSEService();

// Send heartbeat every 30 seconds to keep connections alive
setInterval(() => {
    if (sseService.getClientCount() > 0) {
        sseService.sendHeartbeat();
    }
}, 30000);

export default sseService;
