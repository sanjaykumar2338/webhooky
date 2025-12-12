import logger from '../utils/logger.js';
import { getTemplatesLocalOnly } from '../services/templateStore.js';
import { sendSms } from '../services/twilioService.js';
import { normalizeToE164 } from '../utils/phone.js';

const aliasMap = {
  on_the_way: 'on_the_way',
  'on the way': 'on_the_way',
  ready_for_pickup: 'ready_for_pickup',
  'ready for pickup': 'ready_for_pickup',
  'pickup 2': 'pickup2',
  pickup_2: 'pickup2',
  pickup2: 'pickup2',
  'pickup 3': 'pickup3',
  pickup_3: 'pickup3',
  pickup3: 'pickup3',
  'alterations pickup': 'alterations_pickup',
  alterations_pickup: 'alterations_pickup',
  'alterations pickup2': 'alterations_pickup2',
  alterations_pickup2: 'alterations_pickup2',
  'alterations pickup3': 'alterations_pickup3',
  alterations_pickup3: 'alterations_pickup3',
  'make like new': 'MLN',
  make_like_new: 'MLN',
};

const normalizeTag = (tag) => {
  if (!tag) return null;
  const base = String(tag).trim().toLowerCase();
  if (!base) return null;
  const underscored = base.replace(/\s+/g, '_').replace(/_+/g, '_');
  const mapped = aliasMap[underscored] || aliasMap[base] || underscored;
  return mapped;
};

const extractTags = (order, forcedTag) => {
  if (forcedTag) {
    const single = normalizeTag(forcedTag);
    return single ? [single] : [];
  }

  let rawTags = [];
  if (Array.isArray(order.tags)) {
    rawTags = order.tags;
  } else if (typeof order.tags === 'string') {
    rawTags = order.tags.split(',');
  }

  const normalized = rawTags
    .map(normalizeTag)
    .filter(Boolean);

  // de-dup while preserving order
  const seen = new Set();
  const result = [];
  for (const t of normalized) {
    if (!seen.has(t)) {
      seen.add(t);
      result.push(t);
    }
  }
  return result;
};

const resolvePhone = (order) => {
  const candidates = [
    order?.customer?.phone,
    order?.phone,
    order?.shipping_address?.phone,
    order?.billing_address?.phone,
  ];

  const found = candidates.find((p) => p);
  if (!found) {
    throw new Error('Customer phone not found in order payload');
  }
  return normalizeToE164(found);
};

const resolveOrderNumber = (order) => {
  if (order?.order_number) return String(order.order_number);
  if (order?.name) return String(order.name).replace(/^#/, '');
  return order?.id ? String(order.id) : '';
};

const lookupPath = (obj, keyPath) => {
  return keyPath.split('.').reduce((acc, part) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
      return acc[part];
    }
    return undefined;
  }, obj);
};

const renderTemplate = (template, data) =>
  template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const value = lookupPath(data, key);
    return value ?? `{{${key}}}`;
  });

export const handleTestWebhookOrder = async (req, res) => {
  try {
    const order = req.body || {};
    const forcedTag = req.query.tag;

    let phone;
    try {
      phone = resolvePhone(order);
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message });
    }

    const orderNumber = resolveOrderNumber(order);
    const tags = extractTags(order, forcedTag);

    if (tags.length === 0) {
      return res.status(200).json({
        ok: true,
        to: phone,
        order_number: orderNumber,
        matched_tags: [],
        sent: [],
        skipped: [{ tag: null, reason: 'No tags provided' }],
      });
    }

    const templates = await getTemplatesLocalOnly();
    const sent = [];
    const skipped = [];
    const matchedTags = [];

    const customerName = `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim();

    const ctx = {
      order_number: orderNumber,
      name: customerName || order.name || '',
      customer_first_name: order.customer?.first_name,
      customer_last_name: order.customer?.last_name,
      phone,
      order,
    };

    for (const tag of tags) {
      const template =
        templates[tag] ||
        templates[tag.replace(/_/g, ' ')];

      if (!template) {
        skipped.push({ tag, reason: 'No template found' });
        continue;
      }

      const smsBody = renderTemplate(template, ctx);

      try {
        const message = await sendSms({ to: phone, body: smsBody });
        sent.push({ tag, sid: message.sid });
        matchedTags.push(tag);
      } catch (error) {
        logger.error('Failed to send test webhook SMS', { tag, error: error.message });
        skipped.push({ tag, reason: error.message });
      }
    }

    return res.status(200).json({
      ok: true,
      to: phone,
      order_number: orderNumber,
      matched_tags: matchedTags,
      sent,
      skipped,
    });
  } catch (error) {
    logger.error('Unhandled test webhook error', { error: error.message, stack: error.stack });
    return res.status(500).json({ ok: false, error: error.message });
  }
};

export default {
  handleTestWebhookOrder,
};
