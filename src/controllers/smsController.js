import templates from '../messages/templates.json' with { type: 'json' };
import logger from '../utils/logger.js';
import { getSentTagLog, persistSentTagLog } from '../services/shopifyService.js';
import { sendSms } from '../services/twilioService.js';
import { normalizeToE164 } from '../utils/phone.js';

const extractOrderData = (shopifyOrder) => {
  const orderId = shopifyOrder.id;
  const orderNumber = shopifyOrder.order_number || shopifyOrder.name;
  const customerPhone = shopifyOrder.phone || shopifyOrder.customer?.phone;
  const customer = shopifyOrder.customer;
  
  if (!customer) {
    throw new Error('Customer information is required');
  }
  
  const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  const orderTags = shopifyOrder.tags ? shopifyOrder.tags.split(',').map(tag => tag.trim()) : [];
  
  return {
    orderId,
    orderNumber,
    customerPhone,
    customerName,
    orderTags
  };
};

const validateShopifyOrder = (order) => {
  const errors = [];
  
  if (!order.id) errors.push('Order ID is required');
  if (!order.customer) errors.push('Customer information is required');
  if (!order.phone && !order.customer?.phone) errors.push('Customer phone is required');
  if (!order.customer?.first_name && !order.customer?.last_name) errors.push('Customer name is required');
  
  if (order.phone && !/^[\d+\-().\s]+$/.test(order.phone)) {
    errors.push('Customer phone format is invalid');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

const renderTemplate = (template, data) =>
  template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => data[key] ?? '');

export const handleOrderWebhook = async (req, res) => {
  const shopifyOrder = req.body || {};
  
  logger.info('Received Shopify order webhook', {
    orderId: shopifyOrder.id,
    orderNumber: shopifyOrder.order_number || shopifyOrder.name,
    tags: shopifyOrder.tags
  });
  
  const { valid, errors } = validateShopifyOrder(shopifyOrder);
  
  if (!valid) {
    logger.warn('Shopify order validation failed', { errors });
    return res.status(400).json({ message: 'Invalid Shopify order payload', errors });
  }
  
  try {
    const { orderId, orderNumber, customerPhone, customerName, orderTags } = extractOrderData(shopifyOrder);
    let normalizedPhone;
    
    try {
      normalizedPhone = normalizeToE164(customerPhone);
    } catch (phoneError) {
      logger.warn('Invalid customer phone number for SMS', {
        orderId,
        rawPhone: customerPhone,
        error: phoneError.message,
      });
      return res.status(400).json({ 
        message: 'Invalid customer phone number',
        error: phoneError.message,
      });
    }
    
    // Process each tag that has a template
    const processedTags = [];
    
    for (const tag of orderTags) {
      const template = templates[tag];
      
      if (!template) {
        logger.debug('No template configured for tag. Skipping SMS send.', {
          orderId,
          tag
        });
        continue;
      }
      
      // Check if we already sent SMS for this tag
      const { metafieldId, sentTags } = await getSentTagLog(orderId);
      
      if (sentTags.includes(tag)) {
        logger.info('Duplicate tag detected. SMS already sent for this tag.', {
          orderId,
          tag
        });
        continue;
      }
      
      // Render and send SMS
      const smsBody = renderTemplate(template, {
        name: customerName,
        order_number: orderNumber,
        tracking: '' // Can be extracted from fulfillments if needed
      });
      
      await sendSms({
        to: normalizedPhone,
        body: smsBody,
      });
      
      // Update metafield with new tag
      await persistSentTagLog(orderId, [...sentTags, tag], metafieldId);
      
      processedTags.push(tag);
      logger.info('SMS sent and metafield updated.', { orderId, tag });
    }
    
    if (processedTags.length === 0) {
      return res.status(200).json({ 
        message: 'No templates configured for any order tags',
        tags: orderTags
      });
    }
    
    return res.status(200).json({ 
      message: 'SMS processing completed',
      processedTags,
      skippedTags: orderTags.filter(tag => !processedTags.includes(tag))
    });
    
  } catch (error) {
    logger.error('Failed to process Shopify order webhook.', {
      error: error.message,
      orderId: shopifyOrder.id,
      stack: error.stack
    });
    
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Keep the original function for backward compatibility
export const handleSmsWebhook = handleOrderWebhook;

export default {
  handleSmsWebhook,
};
