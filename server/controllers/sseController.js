import { sseService } from '../utils/sseService.js';
import { nanoid } from 'nanoid';

/**
 * Subscribe to Server-Sent Events for real-time updates
 */
const subscribe = (req, res) => {
    const clientId = req.query.clientId || `client-${nanoid(8)}`;

    sseService.addClient(clientId, res);

    // Handle client disconnect
    req.on('close', () => {
        sseService.removeClient(clientId);
    });
};

/**
 * Get SSE service status
 */
const getStatus = (req, res) => {
    res.json({
        success: true,
        connectedClients: sseService.getClientCount(),
    });
};

export default {
    subscribe,
    getStatus
};
