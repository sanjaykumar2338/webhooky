import { sendSms } from '../services/twilioService.js';
import logger from '../utils/logger.js';
import { getTemplates } from '../services/templateStore.js';
import { normalizeToE164 } from '../utils/phone.js';

const renderTemplate = (template, data) =>
  template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => data[key] ?? '');

export const sendTestSms = async (req, res) => {
  const { phone, template: templateKey } = req.query;
  const name = req.query.name || 'Test Customer';
  const orderNumber = req.query.order_number || req.query.order || '#TEST123';
  const tracking = req.query.tracking || 'https://example.com/tracking';
  const rawPhone = phone;

  if (!phone || !templateKey) {
    return res.status(400).json({
      message: 'Query params "phone" and "template" are required',
      required: ['phone', 'template'],
      availableTemplates: Object.keys(await getTemplates()),
    });
  }

  const templates = await getTemplates();
  const template = templates[templateKey];

  if (!template) {
    return res.status(404).json({
      message: `Template "${templateKey}" not found`,
      availableTemplates: Object.keys(templates),
    });
  }

  const smsBody = renderTemplate(template, {
    name,
    order_number: orderNumber,
    tracking,
  });

  let normalizedTo;
  try {
    normalizedTo = normalizeToE164(phone);
  } catch (normalizationError) {
    return res.status(400).json({
      message: 'Invalid phone number',
      error: normalizationError.message,
      received: phone,
    });
  }

  try {
    const message = await sendSms({ to: normalizedTo, body: smsBody });

    logger.info('Test SMS dispatched', {
      to: normalizedTo,
      template: templateKey,
      sid: message.sid,
    });

    return res.status(200).json({
      message: 'Test SMS sent',
      to: rawPhone,
      normalizedTo,
      template: templateKey,
      sid: message.sid,
      preview: smsBody,
    });
  } catch (error) {
    const twilioError = {
      message: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
    };

    logger.error('Failed to send test SMS', {
      to: normalizedTo,
      rawTo: rawPhone,
      template: templateKey,
      error: twilioError,
    });

    return res.status(error.status || 500).json({
      message: 'Failed to send test SMS',
      error: twilioError,
    });
  }
};

export default {
  sendTestSms,
};
