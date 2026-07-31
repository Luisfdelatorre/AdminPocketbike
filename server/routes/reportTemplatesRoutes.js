import express from 'express';
import reportTemplateController from '../controllers/reportTemplateController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', reportTemplateController.getAllTemplates);
router.get('/:key', reportTemplateController.getTemplateByKey);
router.put('/:key', authenticate, reportTemplateController.upsertTemplate);

export default router;
