import { FastifyInstance } from 'fastify';
import { aiAnalyst, getAINewsHistory } from '../services/aiAnalyst';

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
    // GET /ai/status
    fastify.get('/ai/status', async (_req, reply) => {
        const enabled = await aiAnalyst.isEnabled();
        return reply.send({
            enabled,
            model: process.env.OLLAMA_MODEL || 'gemma4:e4b',
            lastAlerts: aiAnalyst.getLastAlerts(),
            alertCount: aiAnalyst.getLastAlerts().length,
            timestamp: Date.now(),
        });
    });

    // POST /ai/toggle
    fastify.post<{ Body: { enabled: boolean } }>('/ai/toggle', async (request, reply) => {
        const { enabled } = request.body;
        if (typeof enabled !== 'boolean') {
            return reply.status(400).send({ error: 'Body must be { "enabled": true|false }' });
        }
        await aiAnalyst.setEnabled(enabled);
        return reply.send({ enabled, timestamp: Date.now() });
    });

    // GET /ai/alerts — latest AI alerts (from memory)
    fastify.get('/ai/alerts', async (_req, reply) => {
        return reply.send({
            data: aiAnalyst.getLastAlerts(),
            total: aiAnalyst.getLastAlerts().length,
            enabled: await aiAnalyst.isEnabled(),
            timestamp: Date.now(),
        });
    });

    // GET /ai/history?hours=24 — AI news from DB (last 24h by default)
    fastify.get<{ Querystring: { hours?: string } }>('/ai/history', async (request, reply) => {
        const hours = parseInt(request.query.hours || '24', 10);
        const history = await getAINewsHistory(hours);
        return reply.send({
            data: history,
            total: history.length,
            hours,
            timestamp: Date.now(),
        });
    });
}
