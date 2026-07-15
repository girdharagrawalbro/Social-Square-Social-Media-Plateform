'use strict';

require('dotenv').config(); // Bootstrap INFISICAL_* vars from a local .env if present

const { InfisicalSDK } = require('@infisical/sdk');

async function loadSecrets() {
  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  // ── Fallback: no SDK creds → rely on dotenv only (local dev) ──────────
  if (!clientId || !clientSecret || !projectId) {
    console.log(
      '[infisical] SDK credentials not set — running with local .env only'
    );
    return;
  }

  const infisical = new InfisicalSDK({
    siteUrl: process.env.INFISICAL_SITE_URL || 'https://app.infisical.com',
    cacheTtl: 300, // cache secrets for 5 min
  });

  // ── Authenticate ────────────────────────────────────────────────────────
  await infisical.auth().universalAuth.login({ clientId, clientSecret });

  // ── Fetch secrets ───────────────────────────────────────────────────────
  const { secrets } = await infisical.secrets().listSecrets({
    projectId,
    environment: process.env.INFISICAL_ENV || 'prod',
    path: process.env.INFISICAL_PATH || '/',
    viewSecretValue: true,
    includeImports: true,
  });

  // ── Inject into process.env (existing values win — don't override) ──────
  let injected = 0;
  for (const secret of secrets) {
    if (!(secret.secretKey in process.env)) {
      process.env[secret.secretKey] = secret.secretValue;
      injected++;
    }
  }

  console.log(
    `[infisical] ✓ ${injected} secret(s) injected from Infisical` +
      ` (env: ${process.env.INFISICAL_ENV || 'prod'}, path: ${process.env.INFISICAL_PATH || '/'})`
  );
}

module.exports = { loadSecrets };
