/**
 * OpenSky Network — OAuth2 client credentials flow
 * Docs: https://opensky-network.org/apidoc/rest.html
 *
 * With client credentials: higher rate limits, access to more data
 * Token endpoint: https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token
 */
import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { Flight, OpenSkyState } from '../types';
import { classifyFlight } from './flightClassifier';

const TOKEN_URL =
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

interface TokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

class OpenSkyService {
    private client: AxiosInstance;
    private accessToken: string | null = null;
    private tokenExpiresAt: number = 0;
    private lastFetch: number = 0;
    // OpenSky rate limit: 1 request per 10s for authenticated users
    private minInterval: number = 10000;

    constructor() {
        this.client = axios.create({
            baseURL: config.opensky.baseUrl,
            timeout: 20000,
            headers: { 'User-Agent': 'GeoINT-OSINT/1.0' },
        });
    }

    private async getToken(): Promise<string | null> {
        const { clientId, clientSecret } = config.opensky;
        if (!clientId || !clientSecret) return null;

        // Reuse token if still valid (with 30s buffer)
        if (this.accessToken && Date.now() < this.tokenExpiresAt - 30000) {
            return this.accessToken;
        }

        try {
            const res = await axios.post<TokenResponse>(
                TOKEN_URL,
                new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: clientId,
                    client_secret: clientSecret,
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
            );

            this.accessToken = res.data.access_token;
            this.tokenExpiresAt = Date.now() + res.data.expires_in * 1000;
            console.log('[OpenSky] OAuth2 token obtained, expires in', res.data.expires_in, 's');
            return this.accessToken;
        } catch (err) {
            console.warn('[OpenSky] Token fetch failed:', (err as Error).message);
            return null;
        }
    }

    async getAllFlights(): Promise<Flight[]> {
        const now = Date.now();
        // If we're within the minimum interval, skip this cycle gracefully
        // (don't throw — let the poller use other sources)
        if (now - this.lastFetch < this.minInterval) {
            throw new Error(`OpenSky: waiting ${Math.round((this.minInterval - (now - this.lastFetch)) / 1000)}s before next request`);
        }

        const token = await this.getToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            this.lastFetch = now;
            const response = await this.client.get<{ states: unknown[][] | null; time: number }>(
                '/states/all',
                { headers }
            );

            if (!response.data.states) return [];

            const flights: Flight[] = response.data.states
                .map((s) => this.parseState(s))
                .filter((f): f is Flight => f !== null)
                .filter((f) => f.latitude !== null && f.longitude !== null);

            console.log(`[OpenSky] ${flights.length} flights (${token ? 'authenticated' : 'anonymous'})`);
            // Reset to base interval on success
            this.minInterval = 10000;
            return flights;
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                if (err.response?.status === 429) {
                    // Back off exponentially but cap at 60s, reset after next success
                    this.minInterval = Math.min(this.minInterval * 2, 60000);
                    console.warn('[OpenSky] Rate limited by server, backoff to', this.minInterval / 1000, 's');
                } else if (err.response?.status === 401) {
                    this.accessToken = null;
                    this.tokenExpiresAt = 0;
                    console.warn('[OpenSky] Auth failed, clearing token');
                }
            }
            throw err;
        }
    }

    private parseState(state: unknown[]): Flight | null {
        try {
            const s: OpenSkyState = {
                icao24: state[0] as string,
                callsign: state[1] as string | null,
                origin_country: state[2] as string,
                time_position: state[3] as number | null,
                last_contact: state[4] as number,
                longitude: state[5] as number | null,
                latitude: state[6] as number | null,
                baro_altitude: state[7] as number | null,
                on_ground: state[8] as boolean,
                velocity: state[9] as number | null,
                true_track: state[10] as number | null,
                vertical_rate: state[11] as number | null,
                sensors: state[12] as number[] | null,
                geo_altitude: state[13] as number | null,
                squawk: state[14] as string | null,
                spi: state[15] as boolean,
                position_source: state[16] as number,
                category: (state[17] as number) || 0,
            };
            const adsbCat = s.category ? `A${s.category}` : '';
            return {
                flight_id: s.icao24,
                callsign: s.callsign?.trim() || null,
                latitude: s.latitude,
                longitude: s.longitude,
                altitude: s.baro_altitude ?? s.geo_altitude,
                velocity: s.velocity,
                heading: s.true_track,
                vertical_rate: s.vertical_rate,
                origin_country: s.origin_country,
                origin_airport: null,
                destination_airport: null,
                aircraft_type: null,
                category: classifyFlight(s.icao24, s.callsign || '', adsbCat, ''),
                on_ground: s.on_ground,
                last_contact: s.last_contact,
                squawk: s.squawk,
            };
        } catch {
            return null;
        }
    }
}

export const openSkyService = new OpenSkyService();
