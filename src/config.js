import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const requiredEnv = ['SHOPIFY_TOKEN', 'SHOP_DOMAIN', 'SHOPIFY_WEBHOOK_SECRET'];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length) {
  // eslint-disable-next-line no-console
  console.warn(
    `Warning: Missing required environment variables: ${missing.join(
      ', ',
    )}. The application may not function correctly.`,
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultTemplatesFile = path.join(process.cwd(), 'data', 'templates.json');
const defaultTemplatesFallback = path.join(__dirname, 'messages', 'templates.json');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  admin: {
    user: process.env.ADMIN_USER,
    pass: process.env.ADMIN_PASS,
  },
  shopify: {
    storeDomain: process.env.SHOP_DOMAIN,
    adminToken: process.env.SHOPIFY_TOKEN,
    apiVersion: '2024-10',
    metafield: {
      namespace: 'sms',
      key: 'sent_log',
      type: 'json',
    },
    templatesMetafield: {
      namespace: process.env.TEMPLATES_METAFIELD_NAMESPACE || 'marlas_sms',
      key: process.env.TEMPLATES_METAFIELD_KEY || 'templates',
      type: 'json',
    },
  },
  templateStore: {
    store: process.env.TEMPLATES_STORE || 'local',
    file: process.env.TEMPLATES_FILE || defaultTemplatesFile,
    fallback: process.env.TEMPLATES_FILE_FALLBACK || defaultTemplatesFallback,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM,
  },
};

export default config;
