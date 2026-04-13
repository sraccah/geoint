/**
 * AI Intelligence Analyst — powered by Ollama (local LLM)
 *
 * Every 60 seconds, sends a structured summary of current flight/satellite
 * data to the local Ollama instance and asks it to generate OSINT intelligence
 * assessments as breaking news alerts.
 *
 * Uses gemma4 by default (configurable via OLLAMA_MODEL env var).
 * Accessible from Docker via host.docker.internal.
 */
import axios from 'axios';
import { Flight, FlightStats } from '../types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://host.docker.internal:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral:latest';
const ANALYSIS_INTERVAL_MS = parseInt(process.env.AI_NEWS_INTERVAL || '600000', 10);
const AI_DEFAULT_ENABLED = process.env.AI_NEWS_ENABLED !== 'false';
const AI_REDIS_KEY = 'geoint:ai:enabled';

// Generation quality params — all tunable via env vars
const AI_NUM_PREDICT = parseInt(process.env.AI_NUM_PREDICT || '400', 10); // 400 tokens allows up to ~8 alerts
const AI_NUM_CTX = parseInt(process.env.AI_NUM_CTX || '1024', 10);
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || '0.3');
const AI_KEEP_ALIVE = parseInt(process.env.AI_KEEP_ALIVE || '0', 10); // 0 = unload after gen
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '60000', 10);
const AI_BACKGROUND_INTERVAL_MS = parseInt(process.env.AI_BACKGROUND_INTERVAL || '3600000', 10); // 1h
const AI_BACKGROUND_FIRST_MS = parseInt(process.env.AI_BACKGROUND_FIRST || '1800000', 10);    // 30min
const AI_MAX_ALERTS = parseInt(process.env.AI_MAX_ALERTS || '8', 10); // max alerts to keep

// Warn if using a large model — recommend smaller ones for this task
const LARGE_MODELS = ['gemma4', 'llama3.1', 'llama3.2', 'deepseek-r1:14b', 'gemma3:12b', 'phi4'];
if (LARGE_MODELS.some(m => OLLAMA_MODEL.startsWith(m))) {
    console.warn(`[AI Analyst] ⚠ Model ${OLLAMA_MODEL} is large. For better performance, consider: mistral:latest, llama3.2:3b, phi3:mini, qwen2.5:3b`);
}

export interface AIAlert {
    id: string;
    level: 'critical' | 'warning' | 'info' | 'nominal';
    category: string;
    message: string;
    detail?: string;
    source: 'ai';
    model: string;
    generatedAt: number;
}

type AIAlertCallback = (alerts: AIAlert[]) => void;

// Build a concise data summary for the LLM prompt
function buildDataSummary(flights: Flight[], stats: FlightStats): string {
    const military = flights.filter((f) => f.category === 'military' && !f.on_ground);
    const cargo = flights.filter((f) => f.category === 'cargo' && !f.on_ground);

    // Find geographic clusters of military aircraft
    const regions = new Map<string, number>();
    for (const f of military) {
        if (!f.latitude || !f.longitude) continue;
        const region = getRegion(f.latitude, f.longitude);
        regions.set(region, (regions.get(region) || 0) + 1);
    }

    const topRegions = [...regions.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([r, n]) => `${r}: ${n}`)
        .join(', ');

    const emergencies = flights.filter((f) => f.squawk === '7700').length;
    const hijacks = flights.filter((f) => f.squawk === '7500').length;
    const highAlt = flights.filter((f) => f.altitude !== null && f.altitude > 12000 && f.category === 'military').length;

    const milCallsigns = military.slice(0, 10)
        .map((f) => f.callsign || f.flight_id.toUpperCase())
        .join(', ');

    return `LIVE GLOBAL AIRSPACE DATA (${new Date().toUTCString()}):
- Total airborne: ${stats.airborne.toLocaleString()} aircraft
- Commercial: ${stats.commercial} | Cargo: ${stats.cargo} | Military: ${stats.military} | Helicopter: ${stats.helicopter}
- On ground: ${stats.on_ground}
- Military aircraft airborne: ${military.length}
- Military at high altitude (>12km): ${highAlt}
- Emergency squawk 7700: ${emergencies}
- Hijack squawk 7500: ${hijacks}
- Military geographic distribution: ${topRegions || 'dispersed globally'}
- Notable military callsigns: ${milCallsigns || 'none identified'}
- Active cargo hubs: ${cargo.length} cargo aircraft airborne`;
}

function getRegion(lat: number, lon: number): string {
    if (lat > 35 && lat < 42 && lon > 26 && lon < 45) return 'Eastern Mediterranean';
    if (lat > 45 && lat < 70 && lon > 20 && lon < 60) return 'Eastern Europe/Russia';
    if (lat > 20 && lat < 40 && lon > 40 && lon < 65) return 'Middle East/Gulf';
    if (lat > 30 && lat < 45 && lon > 100 && lon < 130) return 'East Asia';
    if (lat > 25 && lat < 50 && lon > -130 && lon < -60) return 'North America';
    if (lat > 35 && lat < 60 && lon > -10 && lon < 30) return 'Europe';
    if (lat > -35 && lat < 15 && lon > -80 && lon < -35) return 'South America';
    if (lat > -40 && lat < 40 && lon > -20 && lon < 55) return 'Africa';
    if (lat > 0 && lat < 35 && lon > 60 && lon < 100) return 'South Asia';
    return 'Other';
}

const SYSTEM_PROMPT = `You are an OSINT (Open Source Intelligence) analyst monitoring global air traffic in real-time.
You receive live ADS-B flight data and must generate intelligence assessments.

Rules:
- Generate as many alerts as the data warrants — one per notable finding, up to ${AI_MAX_ALERTS}
- Prioritize: CRITICAL first, then WARNING, then INFO, then NOMINAL
- Each alert must be on its own line in this exact format:
  LEVEL|CATEGORY|MESSAGE|DETAIL
- LEVEL must be one of: CRITICAL, WARNING, INFO, NOMINAL
- CATEGORY is a short label (max 20 chars, uppercase)
- MESSAGE is the alert text (max 100 chars)
- DETAIL is optional context (max 80 chars, or leave empty)
- Focus on: military concentrations, emergency squawks, geopolitical patterns, traffic anomalies, unusual activity
- Be factual — only report what is in the data
- Do NOT use markdown, bullet points, or any formatting other than the pipe-separated format
- Do NOT repeat the same finding twice`;

async function callOllama(dataSummary: string): Promise<string> {
    const response = await axios.post(
        `${OLLAMA_URL}/api/generate`,
        {
            model: OLLAMA_MODEL,
            prompt: `${dataSummary}\n\nGenerate intelligence alerts:`,
            system: SYSTEM_PROMPT,
            stream: false,
            options: {
                temperature: AI_TEMPERATURE,
                num_predict: AI_NUM_PREDICT,
                top_p: 0.9,
                num_ctx: AI_NUM_CTX,
            },
            keep_alive: AI_KEEP_ALIVE,
        },
        { timeout: AI_TIMEOUT_MS }
    );
    return response.data.response as string;
}

function parseAIResponse(raw: string, model: string): AIAlert[] {
    const alerts: AIAlert[] = [];
    const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.includes('|'));

    for (const line of lines) {
        const parts = line.split('|').map((p) => p.trim());
        if (parts.length < 3) continue;

        const [levelStr, category, message, detail] = parts;
        const levelMap: Record<string, AIAlert['level']> = {
            CRITICAL: 'critical', WARNING: 'warning', INFO: 'info', NOMINAL: 'nominal',
        };
        const level = levelMap[levelStr.toUpperCase()] || 'info';

        if (!message || message.length < 5) continue;

        alerts.push({
            id: `ai_${Date.now()}_${alerts.length}`,
            level,
            category: category.substring(0, 25).toUpperCase(),
            message: message.substring(0, 120),
            detail: detail?.substring(0, 100) || undefined,
            source: 'ai',
            model,
            generatedAt: Date.now(),
        });
    }

    return alerts.slice(0, AI_MAX_ALERTS); // configurable via AI_MAX_ALERTS env var
}

class AIAnalystService {
    private interval: NodeJS.Timeout | null = null;
    private backgroundInterval: NodeJS.Timeout | null = null;
    private callbacks: AIAlertCallback[] = [];
    private lastAlerts: AIAlert[] = [];
    private isRunning = false;
    private consecutiveErrors = 0;
    private getFlightsFn: (() => Promise<Flight[]>) | null = null;
    private isGenerating = false; // lock — prevents concurrent Ollama calls

    // Background interval: configurable via AI_BACKGROUND_INTERVAL env var (default 60min)
    private static readonly BACKGROUND_INTERVAL_MS = AI_BACKGROUND_INTERVAL_MS;

    onAlerts(cb: AIAlertCallback): void { this.callbacks.push(cb); }
    getLastAlerts(): AIAlert[] { return this.lastAlerts; }

    // Read enabled state from Redis (falls back to env default)
    async isEnabled(): Promise<boolean> {
        try {
            const { getRedis } = await import('./redis');
            const val = await getRedis().get(AI_REDIS_KEY);
            if (val === null) return AI_DEFAULT_ENABLED; // not set yet → use env default
            return val === 'true';
        } catch {
            return AI_DEFAULT_ENABLED;
        }
    }

    // Set enabled state in Redis — persists across restarts, no rebuild needed
    async setEnabled(enabled: boolean): Promise<void> {
        try {
            const { getRedis } = await import('./redis');
            await getRedis().set(AI_REDIS_KEY, enabled ? 'true' : 'false');
            console.log(`[AI Analyst] ${enabled ? 'Enabled (10min interval)' : 'Disabled (background 60min digest)'} via API`);

            if (enabled) {
                // Stop background loop, start active loop
                this.stopBackground();
                if (!this.isRunning && this.getFlightsFn) {
                    this.startLoop(this.getFlightsFn);
                }
            } else {
                // Stop active loop, start background hourly digest
                this.stopLoop();
                if (this.getFlightsFn) {
                    this.startBackground(this.getFlightsFn);
                }
            }
        } catch (err) {
            console.error('[AI Analyst] Failed to set enabled state:', (err as Error).message);
        }
    }

    start(getFlights: () => Promise<Flight[]>, _getStats: () => FlightStats | null): void {
        this.getFlightsFn = getFlights;

        this.isEnabled().then((enabled) => {
            console.log(`[AI Analyst] Initial state: ${enabled ? 'ENABLED (10min)' : 'DISABLED (60min background)'}`);
            if (enabled) {
                this.startLoop(getFlights);
            } else {
                // Even when disabled, run hourly background digest
                this.startBackground(getFlights);
            }
        });
    }

    // Shared generation logic — used by both active and background loops
    private async runGeneration(getFlights: () => Promise<Flight[]>, label: string): Promise<void> {
        // Lock — never run two generations concurrently
        if (this.isGenerating) {
            console.log(`[AI Analyst] Skipping ${label} — previous generation still running`);
            return;
        }
        this.isGenerating = true;

        try {
            const flights = await getFlights();
            if (flights.length === 0) return;

            const airborne = flights.filter(f => !f.on_ground);
            const stats: FlightStats = {
                total: flights.length,
                commercial: airborne.filter(f => f.category === 'commercial').length,
                cargo: airborne.filter(f => f.category === 'cargo').length,
                military: airborne.filter(f => f.category === 'military').length,
                private: airborne.filter(f => f.category === 'private').length,
                helicopter: airborne.filter(f => f.category === 'helicopter').length,
                unknown: airborne.filter(f => f.category === 'unknown').length,
                on_ground: flights.filter(f => f.on_ground).length,
                airborne: airborne.length,
            };

            const summary = buildDataSummary(flights, stats);
            console.log(`[AI Analyst] ${label} — calling Ollama (model: ${OLLAMA_MODEL})...`);

            const raw = await callOllama(summary);
            const alerts = parseAIResponse(raw, OLLAMA_MODEL);

            if (alerts.length > 0) {
                this.lastAlerts = alerts;
                this.consecutiveErrors = 0;
                console.log(`[AI Analyst] ${label} — generated ${alerts.length} alerts, model unloaded`);
                this.callbacks.forEach((cb) => cb(alerts));
            }
        } catch (err) {
            this.consecutiveErrors++;
            if (this.consecutiveErrors <= 3) {
                console.warn(`[AI Analyst] ${label} error:`, (err as Error).message);
            }
        } finally {
            // Always release lock — model is unloaded by keep_alive:0
            this.isGenerating = false;
        }
    }

    private startLoop(getFlights: () => Promise<Flight[]>): void {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`[AI Analyst] Active loop started — every ${ANALYSIS_INTERVAL_MS / 1000}s`);

        const run = async () => {
            const enabled = await this.isEnabled();
            if (!enabled) {
                this.stopLoop();
                this.startBackground(getFlights);
                return;
            }
            await this.runGeneration(getFlights, 'active');
        };

        setTimeout(run, 10_000);
        this.interval = setInterval(run, ANALYSIS_INTERVAL_MS);
    }

    // Background mode: hourly digest even when AI toggle is off
    private startBackground(getFlights: () => Promise<Flight[]>): void {
        if (this.backgroundInterval) return;
        console.log(`[AI Analyst] Background mode — hourly digest`);

        const run = async () => {
            const enabled = await this.isEnabled();
            if (enabled) {
                // Active mode took over — stop background
                this.stopBackground();
                return;
            }
            await this.runGeneration(getFlights, 'background hourly');
        };

        // First background run after AI_BACKGROUND_FIRST (default 30min)
        setTimeout(run, AI_BACKGROUND_FIRST_MS);
        this.backgroundInterval = setInterval(run, AIAnalystService.BACKGROUND_INTERVAL_MS);
    }

    private stopBackground(): void {
        if (this.backgroundInterval) { clearInterval(this.backgroundInterval); this.backgroundInterval = null; }
    }

    private stopLoop(): void {
        if (this.interval) { clearInterval(this.interval); this.interval = null; }
        this.isRunning = false;
        console.log('[AI Analyst] Active loop stopped');
    }

    stop(): void {
        this.stopLoop();
        this.stopBackground();
    }
}

export const aiAnalyst = new AIAnalystService();
