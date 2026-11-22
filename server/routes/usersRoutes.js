import express from 'express';
import { verifyToken, requireWriteRole } from '../middleware/authMiddleware.js';
import userController from '../controllers/userController.js';

const router = express.Router();

// Apply middleware to all routes
router.use(verifyToken);

router.post('/', requireWriteRole, userController.createUser);
router.get('/', userController.getAllUsers);
router.put('/:id', requireWriteRole, userController.updateUser);
router.delete('/:id', requireWriteRole, userController.deleteUser);

export default router;
