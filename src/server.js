import express from 'express';
import morgan from 'morgan';
import config from './config.js';
import adminTemplateRoutes from './routes/adminTemplates.js';
import templateRoutes from './routes/templates.js';
import testRoutes from './routes/test.js';
import testWebhookOrderRoutes from './routes/testWebhookOrder.js';
import webhookRoutes from './routes/webhook.js';
import logger from './utils/logger.js';

const app = express();

// Use raw body for webhooks, JSON parsing for other routes
app.use('/webhook', webhookRoutes);

// JSON middleware for other routes
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }),
);

app.use('/admin', adminTemplateRoutes);
app.use('/templates', templateRoutes);
app.use(testWebhookOrderRoutes);
app.use('/test', testRoutes);

app.get('/health', (req, res) =>
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }),
);

app.use((err, req, res, next) => {
  logger.error('Unhandled application error', { error: err.message, stack: err.stack });
  return res.status(500).json({ message: 'Internal server error' });
});

const { port } = config;

app.listen(port, () => {
  logger.info(`Webhook service listening on port ${port}`);
});

export default app;
