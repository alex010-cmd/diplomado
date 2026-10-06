'use strict';

const { createApp } = require('./app');
const { config } = require('./config/env');
const logger = require('./utils/logger');

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv, db: config.dbPath },
    'portal-academico escuchando'
  );
});

function shutdown(signal) {
  logger.info({ signal }, 'apagando servidor');
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
