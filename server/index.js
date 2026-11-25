'use strict';

const { loadEnv } = require('./config');
const { createApp } = require('./app');

loadEnv();

createApp()
  .then(({ app, config, mailer }) => {
    app.listen(config.port, () => {
      console.log(`[citybin] Server berjalan di ${config.baseUrl}`);
      console.log(`[citybin] Mode: ${config.nodeEnv}`);
      if (!mailer.enabled) {
        console.warn('[citybin] SMTP belum dikonfigurasi. Link reset akan dicetak di console saat development.');
      }
    });
  })
  .catch((error) => {
    console.error('[citybin] Gagal menjalankan server:', error.message);
    process.exitCode = 1;
  });
