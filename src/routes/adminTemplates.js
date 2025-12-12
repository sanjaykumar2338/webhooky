import { Router } from 'express';
import {
  renderAdminUI,
  replaceTemplates,
  resetTemplates,
} from '../controllers/templateController.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

const router = Router();

router.use(requireAdminAuth);

router.get('/templates', renderAdminUI);
router.post('/templates/save', replaceTemplates);
router.post('/templates/reset', resetTemplates);

export default router;
