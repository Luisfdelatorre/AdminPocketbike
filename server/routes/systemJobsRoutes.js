import express from 'express';
import { 
    getAllSystemJobs, 
    createSystemJob, 
    updateSystemJob, 
    deleteSystemJob 
} from '../controllers/systemJobController.js';

const router = express.Router();

router.get('/', getAllSystemJobs);
router.post('/', createSystemJob);
router.put('/:id', updateSystemJob);
router.delete('/:id', deleteSystemJob);

export default router;
