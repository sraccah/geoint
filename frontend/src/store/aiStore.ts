import { create } from 'zustand';

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface AIStore {
    alerts: AIAlert[];
    aiModeEnabled: boolean;
    lastGenerated: number | null;
    loading: boolean;

    setAlerts: (alerts: AIAlert[]) => void;
    fetchStatus: () => Promise<void>;
    toggleAIMode: () => Promise<void>;
}

export const useAIStore = create<AIStore>((set, get) => ({
    alerts: [],
    aiModeEnabled: false, // real state fetched from backend on mount
    lastGenerated: null,
    loading: false,

    setAlerts: (alerts) => set({ alerts, lastGenerated: Date.now() }),

    // Fetch real enabled state from backend (stored in Redis)
    fetchStatus: async () => {
        try {
            const res = await fetch(`${API_URL}/ai/status`);
            const data = await res.json();
            set({ aiModeEnabled: !!data.enabled });
            if (data.lastAlerts?.length > 0) {
                set({ alerts: data.lastAlerts, lastGenerated: Date.now() });
            }
        } catch { /* ignore — backend may not be ready yet */ }
    },

    // Toggle via backend REST API — persists in Redis, no restart needed
    toggleAIMode: async () => {
        const next = !get().aiModeEnabled;
        set({ loading: true });
        try {
            const res = await fetch(`${API_URL}/ai/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: next }),
            });
            if (res.ok) {
                set({ aiModeEnabled: next });
                console.log(`[AI] ${next ? 'Enabled' : 'Disabled'} via API`);
            }
        } catch (err) {
            console.error('[AI] Toggle failed:', err);
        } finally {
            set({ loading: false });
        }
    },
}));
