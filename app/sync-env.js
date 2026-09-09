'use strict';

const fs = require('fs');
const path = require('path');
const { InfisicalClient } = require('@infisical/sdk');

// Try to load credentials from a .env.infisical file (if you created one locally)
require('dotenv').config({ path: path.join(__dirname, '.env.infisical') });


async function syncEnv() {
  const clientId = process.env.INFISICAL_UNIVERSAL_AUTH_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  if (!clientId || !clientSecret || !projectId) {
    console.log('[Infisical] SDK credentials not set — skipping sync, using local .env');
    return;
  }

  const infisical = new InfisicalClient({
    siteUrl: process.env.INFISICAL_SITE_URL || 'https://app.infisical.com',
    auth: {
      universalAuth: { clientId, clientSecret },
    },
  });

  const environment = process.env.INFISICAL_ENV || 'prod';
  const secretPath = process.env.INFISICAL_PATH || '/';

  console.log(`[Infisical] Fetching secrets for environment: ${environment}`);

  const secrets = await infisical.listSecrets({
    projectId,
    environment,
    path: secretPath,
    includeImports: true,
  });

  // Write to .env
  const envContent = secrets.map((s) => `${s.secretKey}="${s.secretValue}"`).join('\n');
  const envPath = path.join(__dirname, '.env');
  fs.writeFileSync(envPath, envContent, 'utf8');

  console.log(`[Infisical] Successfully synced ${secrets.length} secrets to .env`);
}

syncEnv().catch(console.error);
