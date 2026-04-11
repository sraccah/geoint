import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://geoint:geoint_secret@localhost:5432/geoint',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    opensky: {
        clientId: process.env.OPENSKY_CLIENT_ID || '',
        clientSecret: process.env.OPENSKY_CLIENT_SECRET || '',
        // Legacy basic auth fallback
        username: process.env.OPENSKY_USERNAME || '',
        password: process.env.OPENSKY_PASSWORD || '',
        baseUrl: 'https://opensky-network.org/api',
    },
    flightPollInterval: parseInt(process.env.FLIGHT_POLL_INTERVAL || '5000', 10),
    cacheKeys: {
        flights: 'geoint:flights:current',
        cameras: 'geoint:cameras:list',
        stats: 'geoint:stats:current',
    },
    cacheTTL: {
        flights: 15, // seconds
        cameras: 3600, // 1 hour
        stats: 15,
    },
};
