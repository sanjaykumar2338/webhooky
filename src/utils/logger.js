/* eslint-disable no-console */
const timestamp = () => new Date().toISOString();

const formatMessage = (level, message, meta) => {
  if (!meta) return `[${timestamp()}] [${level}] ${message}`;
  return `[${timestamp()}] [${level}] ${message} ${JSON.stringify(meta)}`;
};

const logger = {
  info(message, meta) {
    console.log(formatMessage('INFO', message, meta));
  },
  warn(message, meta) {
    console.warn(formatMessage('WARN', message, meta));
  },
  error(message, meta) {
    console.error(formatMessage('ERROR', message, meta));
  },
  debug(message, meta) {
    if (process.env.NODE_ENV === 'production') return;
    console.debug(formatMessage('DEBUG', message, meta));
  },
};

export default logger;
