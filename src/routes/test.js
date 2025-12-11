import { Router } from 'express';
import { sendTestSms } from '../controllers/testController.js';

const router = Router();

router.get('/sms', sendTestSms);

export default router;
