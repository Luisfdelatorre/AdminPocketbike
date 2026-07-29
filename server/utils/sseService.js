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
    addClient(clientId, response, metadata = {}) {
        console.log(`📡 SSE client connected: ${clientId}`, metadata?.companyId ? `(Company: ${metadata.companyId})` : '');

        // Set headers for SSE
        response.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        // Store client with metadata
        this.clients.set(clientId, { response, metadata });

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
     * Helper to write SSE message to client response
     */
    _writeToClient(clientEntry, message) {
        const res = clientEntry?.response || clientEntry;
        if (res && typeof res.write === 'function') {
            res.write(message);
            return true;
        }
        return false;
    }

    /**
     * Send event to a specific client
     */
    sendToClient(clientId, event, data) {
        const clientEntry = this.clients.get(clientId);
        if (clientEntry) {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            this._writeToClient(clientEntry, message);
        }
    }

    /**
     * Broadcast event to all connected clients (or filter by companyId if specified)
     */
    broadcast(event, data, filterOptions = {}) {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

        let sentCount = 0;
        this.clients.forEach((clientEntry, clientId) => {
            try {
                const targetCompanyId = data?.companyId || filterOptions?.companyId;
                const clientCompanyId = clientEntry?.metadata?.companyId;

                if (targetCompanyId && clientCompanyId) {
                    if (String(clientCompanyId) !== String(targetCompanyId)) {
                        return; // Skip clients from other companies
                    }
                }

                if (this._writeToClient(clientEntry, message)) {
                    sentCount++;
                }
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
