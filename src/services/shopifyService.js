import axios from 'axios';
import config from '../config.js';
import logger from '../utils/logger.js';

const {
  shopify: { storeDomain, adminToken, apiVersion, metafield },
} = config;

let shopifyClient;

const ensureShopifyConfig = () => {
  if (!storeDomain || !adminToken) {
    throw new Error('Shopify credentials are not configured.');
  }
};

const getShopifyClient = () => {
  ensureShopifyConfig();

  if (!shopifyClient) {
    shopifyClient = axios.create({
      baseURL: `https://${storeDomain}/admin/api/${apiVersion}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      timeout: 10000,
    });
  }

  return shopifyClient;
};

const parseMetafieldValue = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.warn('Failed to parse metafield JSON value. Returning empty array.', {
      error: error.message,
    });
    return [];
  }
};

export const getSentTagLog = async (orderId, retries = 3) => {
  const client = getShopifyClient();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data } = await client.get(`/orders/${orderId}/metafields.json`, {
        params: { namespace: metafield.namespace },
      });

      const existing = data.metafields?.find(
        (field) => field.key === metafield.key,
      );

      if (!existing) {
        return { metafieldId: null, sentTags: [] };
      }

      return {
        metafieldId: existing.id,
        sentTags: parseMetafieldValue(existing.value),
      };
    } catch (error) {
      const isRateLimit = error.response?.status === 429;
      const shouldRetry = attempt < retries && (isRateLimit || error.response?.status >= 500);
      
      logger.warn(`Failed to fetch Shopify metafield (attempt ${attempt}/${retries})`, {
        orderId,
        error: error.message,
        status: error.response?.status,
        willRetry: shouldRetry
      });
      
      if (!shouldRetry) {
        logger.error('Unable to fetch Shopify metafield for order after retries.', {
          orderId,
          error: error.message,
          attempts: attempt
        });
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export const persistSentTagLog = async (orderId, tags, metafieldId, retries = 3) => {
  const client = getShopifyClient();
  const uniqueTags = Array.from(new Set(tags));

  const payload = {
    metafield: {
      namespace: metafield.namespace,
      key: metafield.key,
      type: metafield.type,
      value: JSON.stringify(uniqueTags),
    },
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (metafieldId) {
        payload.metafield.id = metafieldId;
        await client.put(`/metafields/${metafieldId}.json`, payload);
      } else {
        payload.metafield.owner_id = orderId;
        payload.metafield.owner_resource = 'order';
        await client.post('/metafields.json', payload);
      }

      logger.info('Shopify metafield updated for order.', {
        orderId,
        tagCount: uniqueTags.length,
      });
      return; // Success, exit retry loop
      
    } catch (error) {
      const isRateLimit = error.response?.status === 429;
      const shouldRetry = attempt < retries && (isRateLimit || error.response?.status >= 500);
      
      logger.warn(`Failed to persist Shopify metafield (attempt ${attempt}/${retries})`, {
        orderId,
        error: error.message,
        status: error.response?.status,
        willRetry: shouldRetry
      });
      
      if (!shouldRetry) {
        logger.error('Failed to persist Shopify metafield after retries.', {
          orderId,
          error: error.message,
          attempts: attempt
        });
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export const getShopMetafield = async (namespace, key, retries = 3) => {
  const client = getShopifyClient();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data } = await client.get('/metafields.json', {
        params: { namespace, key, owner_resource: 'shop' },
      });

      const metafieldMatch = data.metafields?.find(
        (field) => field.namespace === namespace && field.key === key && field.owner_resource === 'shop',
      );

      if (!metafieldMatch) {
        return null;
      }

      return metafieldMatch;
    } catch (error) {
      const isRateLimit = error.response?.status === 429;
      const shouldRetry = attempt < retries && (isRateLimit || error.response?.status >= 500);

      logger.warn(`Failed to fetch shop metafield (attempt ${attempt}/${retries})`, {
        namespace,
        key,
        error: error.message,
        status: error.response?.status,
        willRetry: shouldRetry,
      });

      if (!shouldRetry) {
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export const setShopMetafield = async (namespace, key, value, type = 'json', retries = 3) => {
  const client = getShopifyClient();
  const payload = {
    metafield: {
      namespace,
      key,
      type,
      value,
      owner_resource: 'shop',
    },
  };

  const existing = await getShopMetafield(namespace, key, 1);
  if (existing?.id) {
    payload.metafield.id = existing.id;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (payload.metafield.id) {
        await client.put(`/metafields/${payload.metafield.id}.json`, payload);
      } else {
        await client.post('/metafields.json', payload);
      }

      logger.info('Shop metafield saved', { namespace, key });
      return;
    } catch (error) {
      const isRateLimit = error.response?.status === 429;
      const shouldRetry = attempt < retries && (isRateLimit || error.response?.status >= 500);

      logger.warn(`Failed to persist shop metafield (attempt ${attempt}/${retries})`, {
        namespace,
        key,
        error: error.message,
        status: error.response?.status,
        willRetry: shouldRetry,
      });

      if (!shouldRetry) {
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export default {
  getSentTagLog,
  persistSentTagLog,
  getShopMetafield,
  setShopMetafield,
};
