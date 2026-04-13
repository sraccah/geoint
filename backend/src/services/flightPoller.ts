/**
 * Multi-source flight aggregator
 * Sources (in priority order):
 *   1. OpenSky Network  — global, ~10s delay, origin_country data
 *   2. ADSB.fi          — free, no auth, fast, no military filtering
 *   3. airplanes.live   — community aggregator, military flag in dbFlags
 *
 * Deduplication: by ICAO hex. Prefer source with most recent last_contact.
 */
import { openSkyService } from './opensky';
import { fetchAdsbFiAll } from './adsbfi';
import { fetchAirplanesLive } from './airplaneslive';
import { cacheSet, cacheGet } from './redis';
import { saveFlights } from './database';
import { config } from '../config';
import { Flight, FlightStats } from '../types';

type FlightUpdateCallback = (flights: Flight[], stats: FlightStats) => void;
type ErrorCallback = (status: string, message: string) => void;

export type PollStatus = 'ok' | 'degraded' | 'rate_limited' | 'unavailable' | 'error';

interface SourceStatus {
    name: string;
    ok: boolean;
    count: number;
    error?: string;
}

class FlightPoller {
    private interval: NodeJS.Timeout | null = null;
    private callbacks: FlightUpdateCallback[] = [];
    private errorCallbacks: ErrorCallback[] = [];
    private lastFlights: Map<string, Flight> = new Map();
    private isRunning = false;
    private backoffMs = config.flightPollInterval;
    private status: PollStatus = 'ok';
    private lastSuccessfulPoll: number | null = null;
    private sourceStatuses: SourceStatus[] = [];

    onUpdate(cb: FlightUpdateCallback): void { this.callbacks.push(cb); }
    onError(cb: ErrorCallback): void { this.errorCallbacks.push(cb); }
    removeCallback(cb: FlightUpdateCallback): void {
        this.callbacks = this.callbacks.filter((c) => c !== cb);
    }

    getStatus(): PollStatus { return this.status; }
    getLastSuccessfulPoll(): number | null { return this.lastSuccessfulPoll; }
    getSourceStatuses(): SourceStatus[] { return this.sourceStatuses; }

    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[FlightPoller] Starting — sources: OpenSky + ADSB.fi + airplanes.live');
        this.scheduleNext(0);
    }

    stop(): void {
        if (this.interval) { clearTimeout(this.interval); this.interval = null; }
        this.isRunning = false;
    }

    async getCurrentFlights(): Promise<Flight[]> {
        const cached = await cacheGet<Flight[]>(config.cacheKeys.flights);
        if (cached) return cached;
        return Array.from(this.lastFlights.values());
    }

    private scheduleNext(delayMs: number): void {
        if (this.interval) clearTimeout(this.interval);
        this.interval = setTimeout(() => this.poll(), delayMs);
    }

    private async poll(): Promise<void> {
        if (!this.isRunning) return;

        // Fetch all sources in parallel — don't let one failure block others
        const [openskyResult, adsbfiResult, airplanesResult] = await Promise.allSettled([
            openSkyService.getAllFlights(),
            fetchAdsbFiAll(),
            fetchAirplanesLive(),
        ]);

        const statuses: SourceStatus[] = [
            {
                name: 'OpenSky',
                ok: openskyResult.status === 'fulfilled',
                count: openskyResult.status === 'fulfilled' ? openskyResult.value.length : 0,
                error: openskyResult.status === 'rejected' ? (openskyResult.reason as Error).message : undefined,
            },
            {
                name: 'ADSB.fi',
                ok: adsbfiResult.status === 'fulfilled',
                count: adsbfiResult.status === 'fulfilled' ? adsbfiResult.value.length : 0,
                error: adsbfiResult.status === 'rejected' ? (adsbfiResult.reason as Error).message : undefined,
            },
            {
                name: 'airplanes.live',
                ok: airplanesResult.status === 'fulfilled',
                count: airplanesResult.status === 'fulfilled' ? airplanesResult.value.length : 0,
                error: airplanesResult.status === 'rejected' ? (airplanesResult.reason as Error).message : undefined,
            },
        ];

        this.sourceStatuses = statuses;
        const successCount = statuses.filter((s) => s.ok).length;

        if (successCount === 0) {
            this.status = 'unavailable';
            this.backoffMs = Math.min(this.backoffMs * 1.5, 60000);
            console.error('[FlightPoller] All sources failed');
            this.errorCallbacks.forEach((cb) =>
                cb('unavailable', 'All flight data sources unavailable. Retrying.')
            );
            this.scheduleNext(this.backoffMs);
            return;
        }

        // Merge and deduplicate by ICAO hex
        // Priority: OpenSky (has origin_country) > ADSB.fi > airplanes.live
        // For duplicates, keep the one with most recent last_contact
        const merged = new Map<string, Flight>();

        const addFlights = (flights: Flight[], priority: number) => {
            for (const f of flights) {
                const existing = merged.get(f.flight_id);
                if (!existing) {
                    merged.set(f.flight_id, f);
                } else {
                    // Merge: keep best data from each source
                    const better: Flight = {
                        ...existing,
                        // Prefer OpenSky for origin_country
                        origin_country: existing.origin_country || f.origin_country,
                        // Prefer airplanes.live for origin/dest airports
                        origin_airport: existing.origin_airport || f.origin_airport,
                        destination_airport: existing.destination_airport || f.destination_airport,
                        // Prefer airplanes.live for aircraft type
                        aircraft_type: existing.aircraft_type || f.aircraft_type,
                        // Use most recent position
                        ...(f.last_contact > existing.last_contact ? {
                            latitude: f.latitude,
                            longitude: f.longitude,
                            altitude: f.altitude,
                            velocity: f.velocity,
                            heading: f.heading,
                            vertical_rate: f.vertical_rate,
                            last_contact: f.last_contact,
                        } : {}),
                        // Military flag wins
                        category: (existing.category === 'military' || f.category === 'military')
                            ? 'military'
                            : existing.category !== 'unknown' ? existing.category : f.category,
                    };
                    merged.set(f.flight_id, better);
                }
            }
        };

        // Add in reverse priority so higher priority overwrites
        if (airplanesResult.status === 'fulfilled') addFlights(airplanesResult.value, 0);
        if (adsbfiResult.status === 'fulfilled') addFlights(adsbfiResult.value, 1);
        if (openskyResult.status === 'fulfilled') addFlights(openskyResult.value, 2);

        const flights = Array.from(merged.values()).filter(
            (f) => f.latitude !== null && f.longitude !== null
        );

        this.status = successCount < 3 ? 'degraded' : 'ok';
        this.backoffMs = config.flightPollInterval;
        this.lastSuccessfulPoll = Date.now();

        this.lastFlights.clear();
        for (const f of flights) this.lastFlights.set(f.flight_id, f);

        const stats = this.computeStats(flights);

        console.log(
            `[FlightPoller] ${flights.length} total aircraft | ` +
            statuses.map((s) => `${s.name}: ${s.ok ? s.count : 'ERR'}`).join(' | ')
        );

        await cacheSet(config.cacheKeys.flights, flights, config.cacheTTL.flights);
        await cacheSet(config.cacheKeys.stats, stats, config.cacheTTL.stats);

        saveFlights(flights).catch((err) =>
            console.error('[FlightPoller] DB save error:', err.message)
        );

        this.callbacks.forEach((cb) => cb(flights, stats));

        // Only broadcast degraded warning if we have very few flights
        // (meaning the working sources aren't compensating for the failed ones)
        if (this.status === 'degraded' && flights.length < 1000) {
            const failed = statuses.filter((s) => !s.ok).map((s) => s.name).join(', ');
            this.errorCallbacks.forEach((cb) =>
                cb('degraded', `Some sources unavailable (${failed}). Data may be incomplete.`)
            );
        }

        this.scheduleNext(this.backoffMs);
    }

    private computeStats(flights: Flight[]): FlightStats {
        const stats: FlightStats = {
            total: flights.length,
            commercial: 0, cargo: 0, military: 0,
            private: 0, helicopter: 0, unknown: 0,
            on_ground: 0, airborne: 0,
        };
        for (const f of flights) {
            if (f.category in stats) (stats as Record<string, number>)[f.category]++;
            if (f.on_ground) stats.on_ground++;
            else stats.airborne++;
        }
        return stats;
    }
}

export const flightPoller = new FlightPoller();
