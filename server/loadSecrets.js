'use strict';

require('dotenv').config(); // Bootstrap INFISICAL_* vars from a local .env if present

const { InfisicalClient } = require('@infisical/sdk');

async function loadSecrets() {
  const clientId = process.env.INFISICAL_UNIVERSAL_AUTH_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  // ── Fallback: no SDK creds → rely on dotenv only (local dev) ──────────
  if (!clientId || !clientSecret || !projectId) {
    console.log(
      '[infisical] SDK credentials not set — running with local .env only'
    );
    return;
  }

  const infisical = new InfisicalClient({
    siteUrl: process.env.INFISICAL_SITE_URL || 'https://app.infisical.com',
    cacheTtl: 300, // cache secrets for 5 min
    auth: {
      universalAuth: {
        clientId,
        clientSecret,
      },
    },
  });

  // ── Fetch secrets & Inject into process.env ────────────────────────────────
  const secrets = await infisical.listSecrets({
    projectId,
    environment: process.env.INFISICAL_ENV || 'prod',
    path: process.env.INFISICAL_PATH || '/',
    includeImports: true,
    attachToProcessEnv: true,
  });

  console.log(
    `[infisical] ✓ ${secrets.length} secret(s) injected from Infisical` +
    ` (env: ${process.env.INFISICAL_ENV || 'prod'}, path: ${process.env.INFISICAL_PATH || '/'})`
  );
}

module.exports = { loadSecrets };
