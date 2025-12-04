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

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  shopify: {
    storeDomain: process.env.SHOP_DOMAIN,
    adminToken: process.env.SHOPIFY_TOKEN,
    apiVersion: '2024-10',
    metafield: {
      namespace: 'sms',
      key: 'sent_log',
      type: 'json',
    },
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM,
  },
};

export default config;
