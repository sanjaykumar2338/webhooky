import crypto from 'crypto';
import logger from '../utils/logger.js';

const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

export const verifyShopifyHmac = (req, res, next) => {
  if (!WEBHOOK_SECRET) {
    logger.error('SHOPIFY_WEBHOOK_SECRET is not configured');
    return res.status(500).json({ 
      error: 'Webhook secret not configured' 
    });
  }

  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  
  if (!hmacHeader) {
    logger.warn('Missing X-Shopify-Hmac-Sha256 header', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return res.status(401).json({ 
      error: 'Missing HMAC signature' 
    });
  }

  // Get raw body
  const body = req.rawBody || JSON.stringify(req.body);
  
  // Calculate expected HMAC
  const expectedHmac = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  // Compare HMACs using crypto.timingSafeEqual to prevent timing attacks
  const providedHmac = Buffer.from(hmacHeader, 'base64');
  const computedHmac = Buffer.from(expectedHmac, 'base64');

  if (providedHmac.length !== computedHmac.length || 
      !crypto.timingSafeEqual(providedHmac, computedHmac)) {
    logger.warn('Invalid HMAC signature', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      providedHmac: hmacHeader.substring(0, 10) + '...' // Log partial for debugging
    });
    return res.status(401).json({ 
      error: 'Invalid HMAC signature' 
    });
  }

  logger.debug('HMAC verification successful', {
    ip: req.ip
  });
  
  next();
};

export default verifyShopifyHmac;