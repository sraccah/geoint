import { FastifyInstance } from 'fastify';
import { aiAnalyst } from '../services/aiAnalyst';

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
    // GET /ai/status — current AI analyst state
    fastify.get('/ai/status', async (_req, reply) => {
        const enabled = await aiAnalyst.isEnabled();
        return reply.send({
            enabled,
            model: process.env.OLLAMA_MODEL || 'gemma4:latest',
            ollamaUrl: process.env.OLLAMA_URL || 'http://host.docker.internal:11434',
            interval: parseInt(process.env.AI_NEWS_INTERVAL || '600000', 10),
            lastAlerts: aiAnalyst.getLastAlerts(),
            alertCount: aiAnalyst.getLastAlerts().length,
            timestamp: Date.now(),
        });
    });

    // POST /ai/toggle — enable or disable AI analyst at runtime (no restart needed)
    fastify.post<{ Body: { enabled: boolean } }>('/ai/toggle', async (request, reply) => {
        const { enabled } = request.body;
        if (typeof enabled !== 'boolean') {
            return reply.status(400).send({ error: 'Body must be { "enabled": true|false }' });
        }
        await aiAnalyst.setEnabled(enabled);
        return reply.send({
            enabled,
            message: enabled ? 'AI analyst enabled — will generate alerts every interval' : 'AI analyst disabled',
            timestamp: Date.now(),
        });
    });

    // GET /ai/alerts — latest AI-generated alerts
    fastify.get('/ai/alerts', async (_req, reply) => {
        return reply.send({
            data: aiAnalyst.getLastAlerts(),
            total: aiAnalyst.getLastAlerts().length,
            enabled: await aiAnalyst.isEnabled(),
            timestamp: Date.now(),
        });
    });
}
