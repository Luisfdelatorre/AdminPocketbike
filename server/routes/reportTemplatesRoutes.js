import express from 'express';
import reportTemplateController from '../controllers/reportTemplateController.js';
import { verifyToken, requireWriteRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Only staff sessions (never device/PIN tokens) can read or edit templates.
const requireUserSession = (req, res, next) => {
    if (req.auth?.type !== 'user') {
        return res.status(403).json({ success: false, error: 'User session required' });
    }
    return next();
};

router.use(verifyToken, requireUserSession);

router.get('/', reportTemplateController.list);
router.get('/:key', reportTemplateController.getByKey);
router.put('/:key', requireWriteRole, reportTemplateController.save);
router.delete('/:key', requireWriteRole, reportTemplateController.reset);

export default router;
