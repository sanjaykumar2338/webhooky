import twilio from 'twilio';
import config from '../config.js';
import logger from '../utils/logger.js';
import { normalizeToE164 } from '../utils/phone.js';

const { accountSid, authToken, fromNumber } = config.twilio;
let twilioClient;

if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
} else {
  logger.warn('Twilio credentials are missing. SMS sending is disabled.');
}

export const sendSms = async ({ to, body }) => {
  if (!twilioClient) {
    throw new Error('Twilio client is not configured.');
  }

  if (!fromNumber) {
    throw new Error('TWILIO_FROM number is not configured.');
  }

  const normalizedTo = normalizeToE164(to);
  const normalizedFrom = normalizeToE164(fromNumber);

  try {
    const message = await twilioClient.messages.create({
      body,
      to: normalizedTo,
      from: normalizedFrom,
    });

    logger.info('SMS dispatched via Twilio', { sid: message.sid, to: normalizedTo });
    return message;
  } catch (error) {
    logger.error('Failed to send SMS via Twilio', {
      to: normalizedTo,
      error: error.message,
    });
    throw error;
  }
};

export default {
  sendSms,
};
