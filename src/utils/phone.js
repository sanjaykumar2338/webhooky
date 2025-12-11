// Normalize phone numbers to E.164 format to satisfy Twilio requirements.
// - Removes spaces, dashes, parentheses.
// - Converts leading "00" to "+".
// - Ensures a single leading "+" and 8–15 digits (E.164 max length).
export const normalizeToE164 = (input) => {
  if (!input) {
    throw new Error('Phone number is required');
  }

  const raw = String(input).trim();

  // If the plus was turned into a space (e.g., via querystring), trim keeps digits only.
  let candidate = raw.replace(/[^\d+]/g, '');

  // Convert leading 00 to +
  if (candidate.startsWith('00')) {
    candidate = `+${candidate.slice(2)}`;
  }

  // Enforce a single leading +
  if (candidate.startsWith('+')) {
    candidate = `+${candidate.slice(1).replace(/\D/g, '')}`;
  } else {
    candidate = `+${candidate.replace(/\D/g, '')}`;
  }

  const digits = candidate.slice(1);

  if (!digits) {
    throw new Error('Phone number is missing digits');
  }

  if (digits.length < 8 || digits.length > 15) {
    throw new Error('Phone number must have 8-15 digits for E.164 format');
  }

  return candidate;
};

export default {
  normalizeToE164,
};
