/**
 * AI-powered breaking news generator
 * Uses local Ollama LLM to analyze live flight/satellite data
 * and generate intelligence-style breaking news every 10 minutes.
 *
 * Runs alongside the rule-based intelAnalyzer — can be toggled independently.
 */
import axios from 'axios';
import { Flight, FlightStats } from '../types';
import { SatelliteGP } from '../types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://host.docker.internal:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';
const AI_NEWS_INTERVAL = parseInt(process.env.AI_NEWS_INTERVAL || '600000', 10); // 10 min
const AI_NEWS_ENABLED = process.env.AI_NEWS_ENABLED !== 'false';

export interface AINewsItem {
    id: string;
    timestamp: number;
    headline: string;
    detail: string;
    category: string;
    level: 'critical' | 'warning' | 'info' | 'nominal';
    source: 'ai';
    model: string;
}

type NewsCallback = (items: AINewsItem[]) => void;

class AINewsService {
    private callbacks: NewsCallback[] = [];
    private interval: NodeJS.Timeout | null = null;
    private isRunning = false;
    private lastItems: AINewsItem[] = [];
    private modelAvailable = false;

    onNews(cb: NewsCallback): void { this.callbacks.push(cb); }

    getLastItems(): AINewsItem[] { return this.lastItems; }

    async start(): Promise<void> {
        if (!AI_NEWS_ENABLED) {
            console.log('[AI News] Disabled via AI_NEWS_ENABLED=false');
            return;
        }

        // Check Ollama availability
        try {
            await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
            this.modelAvailable = true;
            console.log(`[AI News] Ollama available at ${OLLAMA_URL}, model: ${OLLAMA_MODEL}`);
        } catch {
            console.warn(`[AI News] Ollama not reachable at ${OLLAMA_URL} — AI news disabled`);
            return;
        }

        this.isRunning = true;
        // First run after 30s (let data load first)
        setTimeout(() => this.generate(), 30000);
        this.interval = setInterval(() => this.generate(), AI_NEWS_INTERVAL);
        console.log(`[AI News] Started — generating every ${AI_NEWS_INTERVAL / 60000} minutes`);
    }

    stop(): void {
        if (this.interval) { clearInterval(this.interval); this.interval = null; }
        this.isRunning = false;
    }

    isEnabled(): boolean { return AI_NEWS_ENABLED && this.modelAvailable; }

    async generateNow(flights: Flight[], stats: FlightStats | null): Promise<AINewsItem[]> {
        return this.generate(flights, stats);
    }

    private async generate(flights?: Flight[], stats?: FlightStats | null): Promise<AINewsItem[]> {
        if (!this.modelAvailable) return [];

        // Get current data from the poller if not provided
        let currentFlights = flights;
        let currentStats = stats;

        if (!currentFlights) {
            try {
                const { flightPoller } = await import('./flightPoller');
                currentFlights = await flightPoller.getCurrentFlights();
                // Build basic stats
                const airborne = currentFlights.filter(f => !f.on_ground);
                currentStats = {
                    total: currentFlights.length,
                    commercial: airborne.filter(f => f.category === 'commercial').length,
                    cargo: airborne.filter(f => f.category === 'cargo').length,
                    military: airborne.filter(f => f.category === 'military').length,
                    private: airborne.filter(f => f.category === 'private').length,
                    helicopter: airborne.filter(f => f.category === 'helicopter').length,
                    unknown: airborne.filter(f => f.category === 'unknown').length,
                    on_ground: currentFlights.filter(f => f.on_ground).length,
                    airborne: airborne.length,
                };
            } catch {
                return [];
            }
        }

        if (!currentFlights || currentFlights.length === 0) return [];

        const prompt = this.buildPrompt(currentFlights, currentStats);

        try {
            console.log('[AI News] Generating with', OLLAMA_MODEL, '...');
            const res = await axios.post(
                `${OLLAMA_URL}/api/generate`,
                {
                    model: OLLAMA_MODEL,
                    prompt,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        num_predict: 600,
                        top_p: 0.9,
                    },
                },
                { timeout: 60000 }
            );

            const text: string = res.data?.response || '';
            const items = this.parseResponse(text);

            if (items.length > 0) {
                this.lastItems = items;
                this.callbacks.forEach(cb => cb(items));
                console.log(`[AI News] Generated ${items.length} items`);
            }

            return items;
        } catch (err) {
            console.warn('[AI News] Generation failed:', (err as Error).message);
            return [];
        }
    }

    private buildPrompt(flights: Flight[], stats: FlightStats | null): string {
        const airborne = flights.filter(f => !f.on_ground);
        const military = airborne.filter(f => f.category === 'military');
        const cargo = airborne.filter(f => f.category === 'cargo');

        // Find notable military callsigns
        const milCallsigns = military
            .filter(f => f.callsign)
            .slice(0, 10)
            .map(f => f.callsign)
            .join(', ');

        // Find high-altitude fast movers
        const fastMovers = airborne
            .filter(f => f.velocity && f.velocity > 250 && f.altitude && f.altitude > 10000)
            .slice(0, 5)
            .map(f => `${f.callsign || f.flight_id} (${Math.round((f.velocity || 0) * 1.944)}kts FL${Math.round((f.altitude || 0) / 30.48)})`)
            .join(', ');

        // Emergency squawks
        const emergencies = airborne.filter(f => f.squawk === '7700' || f.squawk === '7500' || f.squawk === '7600');

        // Geographic clusters — count flights by rough region
        const regions: Record<string, number> = {};
        for (const f of military) {
            if (!f.latitude || !f.longitude) continue;
            const region = this.getRegion(f.latitude, f.longitude);
            regions[region] = (regions[region] || 0) + 1;
        }
        const hotspots = Object.entries(regions)
            .filter(([, n]) => n >= 3)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([r, n]) => `${n} military aircraft over ${r}`)
            .join('; ');

        return `You are an OSINT intelligence analyst monitoring global air traffic in real-time.

CURRENT GLOBAL AIR TRAFFIC DATA (${new Date().toISOString()}):
- Total airborne: ${stats?.airborne || airborne.length} aircraft
- Commercial: ${stats?.commercial || 0}
- Military: ${stats?.military || military.length}
- Cargo: ${stats?.cargo || cargo.length}
- On ground: ${stats?.on_ground || 0}
${milCallsigns ? `- Military callsigns active: ${milCallsigns}` : ''}
${fastMovers ? `- High-speed aircraft: ${fastMovers}` : ''}
${hotspots ? `- Military concentrations: ${hotspots}` : ''}
${emergencies.length > 0 ? `- EMERGENCY SQUAWKS: ${emergencies.map(f => `${f.callsign || f.flight_id} (${f.squawk})`).join(', ')}` : ''}

Based on this real-time data, generate 3-5 intelligence breaking news items. Each item should:
1. Be factual and based ONLY on the data provided above
2. Be written in the style of an intelligence briefing
3. Highlight genuinely notable patterns or anomalies

Format your response as JSON array ONLY, no other text:
[
  {
    "headline": "SHORT HEADLINE IN CAPS",
    "detail": "One sentence detail with specific data",
    "category": "CATEGORY NAME",
    "level": "critical|warning|info|nominal"
  }
]

Use level "critical" only for emergencies or very large military formations (20+).
Use "warning" for notable military activity or anomalies.
Use "info" for interesting patterns.
Use "nominal" for general status updates.`;
    }

    private parseResponse(text: string): AINewsItem[] {
        try {
            // Extract JSON array from response
            const match = text.match(/\[[\s\S]*\]/);
            if (!match) return [];

            const parsed = JSON.parse(match[0]);
            if (!Array.isArray(parsed)) return [];

            return parsed
                .filter((item: Record<string, unknown>) => item.headline && item.detail)
                .slice(0, 5)
                .map((item: Record<string, unknown>, i: number): AINewsItem => ({
                    id: `ai_${Date.now()}_${i}`,
                    timestamp: Date.now(),
                    headline: String(item.headline || '').substring(0, 100),
                    detail: String(item.detail || '').substring(0, 200),
                    category: String(item.category || 'AI INTEL').substring(0, 30),
                    level: (['critical', 'warning', 'info', 'nominal'].includes(String(item.level))
                        ? item.level : 'info') as AINewsItem['level'],
                    source: 'ai',
                    model: OLLAMA_MODEL,
                }));
        } catch {
            return [];
        }
    }

    private getRegion(lat: number, lon: number): string {
        if (lat > 35 && lat < 42 && lon > 26 && lon < 45) return 'Eastern Mediterranean';
        if (lat > 45 && lat < 70 && lon > 20 && lon < 60) return 'Eastern Europe';
        if (lat > 20 && lat < 40 && lon > 40 && lon < 65) return 'Middle East';
        if (lat > 30 && lat < 45 && lon > 100 && lon < 130) return 'East Asia';
        if (lat > 25 && lat < 50 && lon > -130 && lon < -60) return 'North America';
        if (lat > 35 && lat < 60 && lon > -10 && lon < 30) return 'Europe';
        if (lat > -35 && lat < 15 && lon > -80 && lon < -35) return 'South America';
        if (lat > 0 && lat < 35 && lon > 60 && lon < 100) return 'South Asia';
        return `${lat.toFixed(0)}°${lat >= 0 ? 'N' : 'S'}`;
    }
}

export const aiNewsService = new AINewsService();
