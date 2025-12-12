import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import logger from '../utils/logger.js';
import { getShopMetafield, setShopMetafield } from './shopifyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_TEMPLATE_PATH = config.templateStore.fallback;
const LOCAL_TEMPLATE_PATH = config.templateStore.file;
const STORE_MODE = (config.templateStore.store || 'local').toLowerCase();

const CACHE_TTL_MS = 60 * 1000;
const MAX_TEMPLATE_LENGTH = 5000;

let cache = { templates: null, fetchedAt: 0 };

const requiredKeyVariants = {
  processing: ['processing'],
  on_the_way: ['on_the_way', 'on the way'],
  ready_for_pickup: ['ready_for_pickup', 'ready for pickup'],
  pickup2: ['pickup2'],
  pickup3: ['pickup3'],
  MLN: ['MLN'],
  alterations_pickup: ['alterations_pickup', 'alterations pickup'],
  alterations_pickup2: ['alterations_pickup2', 'alterations pickup2'],
  alterations_pickup3: ['alterations_pickup3', 'alterations pickup3'],
  partially_paid1: ['partially_paid1', 'partially paid1'],
  partially_paid2: ['partially_paid2', 'partially paid2'],
  partially_paid3: ['partially_paid3', 'partially paid3'],
};

const aliasPairs = [
  ['on_the_way', 'on the way'],
  ['ready_for_pickup', 'ready for pickup'],
  ['alterations_pickup', 'alterations pickup'],
  ['alterations_pickup2', 'alterations pickup2'],
  ['alterations_pickup3', 'alterations pickup3'],
  ['partially_paid1', 'partially paid1'],
  ['partially_paid2', 'partially paid2'],
  ['partially_paid3', 'partially paid3'],
];

const loadDefaultTemplates = async () => {
  const data = await fs.readFile(DEFAULT_TEMPLATE_PATH, 'utf8');
  return JSON.parse(data);
};

export const validateTemplates = (templates) => {
  if (!templates || typeof templates !== 'object' || Array.isArray(templates)) {
    throw new Error('Templates payload must be an object');
  }

  const missing = [];
  const oversize = [];

  for (const [canonical, variants] of Object.entries(requiredKeyVariants)) {
    const keyFound = variants.find(
      (key) => typeof templates[key] === 'string' && templates[key].trim().length > 0,
    );
    if (!keyFound) {
      missing.push(canonical);
      continue;
    }

    if (templates[keyFound].length > MAX_TEMPLATE_LENGTH) {
      oversize.push(keyFound);
    }
  }

  if (missing.length) {
    throw new Error(`Missing required template keys: ${missing.join(', ')}`);
  }

  if (oversize.length) {
    throw new Error(`Template values exceed ${MAX_TEMPLATE_LENGTH} characters: ${oversize.join(', ')}`);
  }

  return true;
};

const applyKeyAliases = (templates) => {
  const copy = { ...templates };
  aliasPairs.forEach(([a, b]) => {
    const chosen = copy[b] || copy[a];
    if (chosen) {
      copy[a] = chosen;
      copy[b] = chosen;
    }
  });
  return copy;
};

const cacheTemplates = (templates) => {
  cache = { templates, fetchedAt: Date.now() };
};

const isCacheFresh = () => cache.templates && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

const loadTemplatesFromFile = async () => {
  try {
    const data = await fs.readFile(LOCAL_TEMPLATE_PATH, 'utf8');
    const parsed = JSON.parse(data);
    validateTemplates(parsed);
    return parsed;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn('Failed to read templates file. Falling back to defaults.', { error: error.message });
    }
    return null;
  }
};

const writeTemplatesToFile = async (templates) => {
  const dir = path.dirname(LOCAL_TEMPLATE_PATH);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = `${LOCAL_TEMPLATE_PATH}.tmp`;
  const serialized = `${JSON.stringify(templates, null, 2)}\n`;
  await fs.writeFile(tmpPath, serialized, 'utf8');
  await fs.rename(tmpPath, LOCAL_TEMPLATE_PATH);
};

const getTemplatesFromShopify = async () => {
  const { namespace, key } = config.shopify.templatesMetafield;
  try {
    const metafield = await getShopMetafield(namespace, key);
    if (!metafield || !metafield.value) {
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(metafield.value);
    } catch (error) {
      logger.warn('Templates metafield JSON parse failed. Falling back to default templates.', {
        error: error.message,
      });
      return null;
    }

    validateTemplates(parsed);
    return parsed;
  } catch (error) {
    logger.warn('Unable to load templates from Shopify metafield. Falling back to defaults.', {
      error: error.message,
    });
    return null;
  }
};

export const getTemplates = async () => {
  if (isCacheFresh()) {
    return cache.templates;
  }

  if (STORE_MODE === 'local') {
    const fromFile = await loadTemplatesFromFile();
    if (fromFile) {
      const withAliases = applyKeyAliases(fromFile);
      cacheTemplates(withAliases);
      return withAliases;
    }
    const defaults = await loadDefaultTemplates();
    validateTemplates(defaults);
    const withAliases = applyKeyAliases(defaults);
    cacheTemplates(withAliases);
    return withAliases;
  }

  // Shopify mode (legacy)
  const fromShopify = await getTemplatesFromShopify();
  if (fromShopify) {
    const withAliases = applyKeyAliases(fromShopify);
    cacheTemplates(withAliases);
    return withAliases;
  }

  const defaults = await loadDefaultTemplates();
  validateTemplates(defaults);
  const withAliases = applyKeyAliases(defaults);
  cacheTemplates(withAliases);
  return withAliases;
};

export const saveTemplates = async (templates) => {
  validateTemplates(templates);
  const normalized = applyKeyAliases(templates);

  if (STORE_MODE === 'local') {
    await writeTemplatesToFile(normalized);
    cacheTemplates(normalized);
    logger.info('Templates saved to local file', { path: LOCAL_TEMPLATE_PATH });
    return normalized;
  }

  const { namespace, key, type } = config.shopify.templatesMetafield;
  await setShopMetafield(namespace, key, JSON.stringify(normalized), type);
  cacheTemplates(normalized);
  logger.info('Templates saved to Shopify metafield', { namespace, key });
  return normalized;
};

export const resetTemplatesToDefault = async () => {
  const defaults = await loadDefaultTemplates();
  await saveTemplates(defaults);
  return defaults;
};

export default {
  getTemplates,
  saveTemplates,
  resetTemplatesToDefault,
  validateTemplates,
};
