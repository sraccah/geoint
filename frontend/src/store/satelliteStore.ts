import { create } from 'zustand';
import { SatelliteGP, SatelliteGroupDef } from '@/types/satellite';

interface SatelliteStore {
    groups: SatelliteGroupDef[];
    activeGroups: Set<string>;
    satellites: Map<string, SatelliteGP[]>; // groupId → satellites
    selectedSatellite: SatelliteGP | null;
    loading: Set<string>;

    setGroups: (groups: SatelliteGroupDef[]) => void;
    toggleGroup: (groupId: string) => void;
    setSatellites: (groupId: string, sats: SatelliteGP[]) => void;
    selectSatellite: (sat: SatelliteGP | null) => void;
    setLoading: (groupId: string, loading: boolean) => void;
    getAllActiveSatellites: () => SatelliteGP[];
}

export const useSatelliteStore = create<SatelliteStore>((set, get) => ({
    groups: [],
    activeGroups: new Set(),
    satellites: new Map(),
    selectedSatellite: null,
    loading: new Set(),

    setGroups: (groups) => set({ groups }),

    toggleGroup: (groupId) => {
        const { activeGroups } = get();
        const next = new Set(activeGroups);
        if (next.has(groupId)) next.delete(groupId);
        else next.add(groupId);
        set({ activeGroups: next });
    },

    setSatellites: (groupId, sats) => {
        const { satellites } = get();
        const next = new Map(satellites);
        next.set(groupId, sats);
        set({ satellites: next });
    },

    selectSatellite: (sat) => set({ selectedSatellite: sat }),

    setLoading: (groupId, loading) => {
        const { loading: current } = get();
        const next = new Set(current);
        if (loading) next.add(groupId);
        else next.delete(groupId);
        set({ loading: next });
    },

    getAllActiveSatellites: () => {
        const { activeGroups, satellites } = get();
        const all: SatelliteGP[] = [];
        for (const groupId of activeGroups) {
            const sats = satellites.get(groupId) || [];
            all.push(...sats);
        }
        return all;
    },
}));
