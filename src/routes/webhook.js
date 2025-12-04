import { Router } from 'express';
import { handleOrderWebhook, handleSmsWebhook } from '../controllers/smsController.js';
import { verifyShopifyHmac } from '../middleware/hmacVerify.js';
import { captureRawBody } from '../middleware/rawBody.js';

const router = Router();

// Shopify webhook endpoint (main endpoint)
router.post('/order', captureRawBody, verifyShopifyHmac, handleOrderWebhook);

// Legacy SMS endpoint (kept for backward compatibility)
router.post('/sms', handleSmsWebhook);

export default router;
