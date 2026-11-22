import express from 'express';
import { 
    getAllSystemJobs, 
    createSystemJob, 
    updateSystemJob, 
    deleteSystemJob 
} from '../controllers/systemJobController.js';

import { verifyToken, requireSuperAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken, requireSuperAdmin);

router.get('/', getAllSystemJobs);
router.post('/', createSystemJob);
router.put('/:id', updateSystemJob);
router.delete('/:id', deleteSystemJob);

export default router;
