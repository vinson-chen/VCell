import cors from '@fastify/cors';
import Fastify from 'fastify';
import { registerChatTableAgentRoute } from './chatTableAgentRoute.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get('/api/health', async () => ({ ok: true as const }));
await registerChatTableAgentRoute(app);

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`vcell-api http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
