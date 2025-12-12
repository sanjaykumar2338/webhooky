import { Router } from 'express';
import {
  listTemplates,
  replaceTemplates,
  upsertSingleTemplate,
} from '../controllers/templateController.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

const router = Router();

router.use(requireAdminAuth);
router.get('/', listTemplates);
router.put('/', replaceTemplates);
router.put('/:key', upsertSingleTemplate);

export default router;
