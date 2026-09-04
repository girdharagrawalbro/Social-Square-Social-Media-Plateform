'use strict';

require('dotenv').config();

const { InfisicalClient } = require('@infisical/sdk');
const logger = require('./utils/logger');

async function loadSecrets() {
  const clientId = process.env.INFISICAL_UNIVERSAL_AUTH_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  if (!clientId || !clientSecret || !projectId) {
    logger.info('[Infisical] SDK credentials not set — running with local .env only');
    return;
  }

  const infisical = new InfisicalClient({
    siteUrl: process.env.INFISICAL_SITE_URL || 'https://app.infisical.com',
    cacheTtl: 300,
    auth: {
      universalAuth: { clientId, clientSecret },
    },
  });

  const secrets = await infisical.listSecrets({
    projectId,
    environment: process.env.INFISICAL_ENV || 'prod',
    path: process.env.INFISICAL_PATH || '/',
    includeImports: true,
    attachToProcessEnv: true,
  });

  logger.info(`[Infisical] ${secrets.length} secret(s) injected (env: ${process.env.INFISICAL_ENV || 'prod'})`);
}

module.exports = { loadSecrets };
