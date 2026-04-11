import Redis from 'ioredis';
import { config } from '../config';

let client: Redis | null = null;

export function getRedis(): Redis {
    if (!client) {
        client = new Redis(config.redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => Math.min(times * 100, 3000),
            lazyConnect: false,
        });

        client.on('error', (err) => {
            console.error('Redis error:', err.message);
        });

        client.on('connect', () => {
            console.log('Redis connected');
        });
    }
    return client;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    const data = await redis.get(key);
    if (!data) return null;
    try {
        return JSON.parse(data) as T;
    } catch {
        return null;
    }
}

export async function cacheDel(key: string): Promise<void> {
    const redis = getRedis();
    await redis.del(key);
}

export async function closeRedis(): Promise<void> {
    if (client) {
        await client.quit();
        client = null;
    }
}
