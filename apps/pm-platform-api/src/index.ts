import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { setupSocket } from './sockets/index.js';
import { registerCronJobs } from './queues/schedulers/cron.js';
import { emitTimerTicks } from './services/timer.service.js';
import './queues/workers/email.worker.js';
import './queues/workers/webhook.worker.js';
import './queues/workers/search.worker.js';
import './queues/workers/performance.worker.js';

const app = createApp();
const server = http.createServer(app);
await setupSocket(server);
await registerCronJobs();
setInterval(() => void emitTimerTicks(), 10_000).unref();

server.listen(env.PORT, () => {
  console.log(`PM Platform API running on http://localhost:${env.PORT}`);
});
