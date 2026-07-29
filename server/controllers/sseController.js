import { sseService } from '../utils/sseService.js';
import { nanoid } from 'nanoid';

/**
 * Subscribe to Server-Sent Events for real-time updates
 */
const subscribe = (req, res) => {
    const clientId = req.query.clientId || `client-${nanoid(8)}`;
    const companyId = req.query.companyId || req.auth?.companyId || null;

    sseService.addClient(clientId, res, { companyId });

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
