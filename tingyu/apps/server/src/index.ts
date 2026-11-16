// Server entry. Serves the API and, when built, the web app (apps/web/dist) with SPA fallback.
import express from 'express';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { config } from './core/config';

const app = createApp();
const dist = join(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}
app.listen(config.port, () => console.log(`听屿 server on http://localhost:${config.port}`));
