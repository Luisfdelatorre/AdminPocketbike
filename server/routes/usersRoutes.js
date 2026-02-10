import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import userController from '../controllers/userController.js';

const router = express.Router();

// Apply middleware to all routes
router.use(verifyToken);

router.post('/', userController.createUser);
router.get('/', userController.getAllUsers);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

export default router;
