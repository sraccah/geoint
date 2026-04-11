import { create } from 'zustand';
import { Flight, FlightStats, FlightFilter, FlightCategory } from '@/types';

interface FlightStore {
    flights: Flight[];
    stats: FlightStats | null;
    selectedFlight: Flight | null;
    filter: FlightFilter;
    isConnected: boolean;
    lastUpdate: number | null;
    dataSourceError: string | null;

    setFlights: (flights: Flight[]) => void;
    setStats: (stats: FlightStats) => void;
    selectFlight: (flight: Flight | null) => void;
    setFilter: (filter: Partial<FlightFilter>) => void;
    setConnected: (connected: boolean) => void;
    setDataSourceError: (error: string | null) => void;
    getFilteredFlights: () => Flight[];
}

export const ALL_CATEGORIES: FlightCategory[] = [
    'commercial', 'cargo', 'military', 'private', 'helicopter', 'glider', 'unknown',
];

// Default: military only + no ground traffic — user enables more via filters
const DEFAULT_FILTER: FlightFilter = {
    categories: ['military'],
    minAltitude: 0,
    maxAltitude: 15000,
    minSpeed: 0,
    maxSpeed: 1000,
    showOnGround: false,
};

export const useFlightStore = create<FlightStore>((set, get) => ({
    flights: [],
    stats: null,
    selectedFlight: null,
    filter: DEFAULT_FILTER,
    isConnected: false,
    lastUpdate: null,
    dataSourceError: null,

    setFlights: (flights) => set({ flights, lastUpdate: Date.now() }),
    setStats: (stats) => set({ stats }),
    selectFlight: (flight) => set({ selectedFlight: flight }),
    setFilter: (partial) => set((s) => ({ filter: { ...s.filter, ...partial } })),
    setConnected: (connected) => set({ isConnected: connected }),
    setDataSourceError: (error) => set({ dataSourceError: error }),

    getFilteredFlights: () => {
        const { flights, filter } = get();
        return flights.filter((f) => {
            if (!filter.categories.includes(f.category)) return false;
            if (!filter.showOnGround && f.on_ground) return false;
            if (f.altitude !== null) {
                if (f.altitude < filter.minAltitude) return false;
                if (f.altitude > filter.maxAltitude) return false;
            }
            if (f.velocity !== null) {
                if (f.velocity < filter.minSpeed) return false;
                if (f.velocity > filter.maxSpeed) return false;
            }
            return true;
        });
    },
}));
