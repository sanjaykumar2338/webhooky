import { Router } from 'express';
import { handleTestWebhookOrder } from '../controllers/testWebhookOrderController.js';

const router = Router();

router.post('/test/webhook/order', handleTestWebhookOrder);

export default router;
