import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { flightRoutes } from './routes/flights';
import { cameraRoutes } from './routes/cameras';
import { websocketRoutes } from './websocket/flightStream';
import { searchRoutes } from './routes/search';
import { satelliteRoutes } from './routes/satellites';
import { aiRoutes } from './routes/ai';
import { flightPoller } from './services/flightPoller';
import { aiAnalyst } from './services/aiAnalyst';
import { getRedis } from './services/redis';
import { getPool } from './services/database';

const fastify = Fastify({
    logger: {
        transport:
            config.nodeEnv === 'development'
                ? { target: 'pino-pretty', options: { colorize: true } }
                : undefined,
    },
});

async function bootstrap(): Promise<void> {
    // Plugins
    await fastify.register(cors, {
        origin: config.corsOrigin === '*' ? true : config.corsOrigin,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    await fastify.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
    });

    await fastify.register(websocket);

    // Health check
    fastify.get('/health', async () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    }));

    // Routes
    await fastify.register(flightRoutes);
    await fastify.register(cameraRoutes);
    await fastify.register(searchRoutes);
    await fastify.register(satelliteRoutes);
    await fastify.register(aiRoutes);
    await fastify.register(websocketRoutes);

    // Start server
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`[Server] Running on port ${config.port}`);

    // Initialize services
    try {
        getRedis();
        console.log('[Server] Redis initialized');
    } catch (err) {
        console.warn('[Server] Redis unavailable:', (err as Error).message);
    }

    try {
        const pool = getPool();
        await pool.query('SELECT 1');
        console.log('[Server] PostgreSQL connected');
    } catch (err) {
        console.warn('[Server] PostgreSQL unavailable:', (err as Error).message);
    }

    // Start flight polling
    flightPoller.start();
    console.log('[Server] Flight poller started');

    // Start AI analyst (requires Ollama running at OLLAMA_URL)
    aiAnalyst.start(
        () => flightPoller.getCurrentFlights(),
        () => null  // stats computed inside aiAnalyst from flights
    );
    console.log('[Server] AI analyst started');

    // Clear stale camera cache so fresh data is fetched on first request
    try {
        const { cacheDel } = await import('./services/redis');
        await cacheDel(config.cacheKeys.cameras);
        console.log('[Server] Camera cache cleared');
    } catch { /* ignore */ }
}

// Graceful shutdown
const shutdown = async (signal: string): Promise<void> => {
    console.log(`[Server] Received ${signal}, shutting down...`);
    flightPoller.stop();
    await fastify.close();
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap().catch((err) => {
    console.error('[Server] Fatal error:', err);
    process.exit(1);
});
