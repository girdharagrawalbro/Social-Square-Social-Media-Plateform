'use strict';

const { loadSecrets } = require('./loadSecrets');
const logger = require('./utils/logger');

loadSecrets()
  .then(() => {
    // All secrets now injected into process.env — boot the app
    require('./index');
  })
  .catch((err) => {
    logger.error('[Infisical] Fatal: could not load secrets — refusing to start', { message: err.message });
    process.exit(1);
  });
