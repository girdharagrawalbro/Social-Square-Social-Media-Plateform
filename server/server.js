'use strict';

const { loadSecrets } = require('./loadSecrets');

loadSecrets()
  .then(() => {
    // Secrets are now in process.env — boot the app
    require('./index');
  })
  .catch((err) => {
    console.error('[infisical] Fatal: could not load secrets:', err.message);
    process.exit(1);
  });
