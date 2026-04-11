import { create } from 'zustand';
import { SatelliteGP, SatelliteGroupDef } from '@/types/satellite';

export const ALL_ORBIT_TYPES = ['LEO', 'MEO', 'GEO', 'HEO', 'SSO', 'Polar', 'Unknown'] as const;
export type OrbitType = typeof ALL_ORBIT_TYPES[number];

interface SatelliteStore {
    groups: SatelliteGroupDef[];
    // Which groups are VISIBLE (shown on map) — controlled by tag buttons like flight categories
    visibleGroups: Set<string>;
    // Which groups have been LOADED (data fetched) — all loaded on mount
    loadedGroups: Set<string>;
    satellites: Map<string, SatelliteGP[]>;
    selectedSatellite: SatelliteGP | null;
    loading: Set<string>;
    orbitFilter: OrbitType[];

    setGroups: (groups: SatelliteGroupDef[]) => void;
    toggleGroupVisibility: (groupId: string) => void;
    setGroupVisibility: (groupId: string, visible: boolean) => void;
    markGroupLoaded: (groupId: string) => void;
    setSatellites: (groupId: string, sats: SatelliteGP[]) => void;
    selectSatellite: (sat: SatelliteGP | null) => void;
    setLoading: (groupId: string, isLoading: boolean) => void;
    setOrbitFilter: (orbits: OrbitType[]) => void;
    toggleOrbitType: (orbit: OrbitType) => void;
    getVisibleSatellites: () => SatelliteGP[];
}

export const useSatelliteStore = create<SatelliteStore>((set, get) => ({
    groups: [],
    // Only military visible by default — same as flight filter default
    visibleGroups: new Set<string>(['military']),
    loadedGroups: new Set<string>(),
    satellites: new Map(),
    selectedSatellite: null,
    loading: new Set<string>(),
    orbitFilter: [...ALL_ORBIT_TYPES],

    setGroups: (groups) => set({ groups }),

    toggleGroupVisibility: (groupId) => {
        const next = new Set(get().visibleGroups);
        if (next.has(groupId)) next.delete(groupId);
        else next.add(groupId);
        set({ visibleGroups: next });
    },

    setGroupVisibility: (groupId, visible) => {
        const next = new Set(get().visibleGroups);
        if (visible) next.add(groupId);
        else next.delete(groupId);
        set({ visibleGroups: next });
    },

    markGroupLoaded: (groupId) => {
        const next = new Set(get().loadedGroups);
        next.add(groupId);
        set({ loadedGroups: next });
    },

    setSatellites: (groupId, sats) => {
        const next = new Map(get().satellites);
        next.set(groupId, sats);
        set({ satellites: next });
    },

    selectSatellite: (sat) => set({ selectedSatellite: sat }),

    setLoading: (groupId, isLoading) => {
        const next = new Set(get().loading);
        if (isLoading) next.add(groupId);
        else next.delete(groupId);
        set({ loading: next });
    },

    setOrbitFilter: (orbits) => set({ orbitFilter: orbits }),

    toggleOrbitType: (orbit) => {
        const current = get().orbitFilter;
        set({
            orbitFilter: current.includes(orbit)
                ? current.filter((o) => o !== orbit)
                : [...current, orbit],
        });
    },

    getVisibleSatellites: () => {
        const { visibleGroups, satellites } = get();
        const all: SatelliteGP[] = [];
        for (const groupId of visibleGroups) {
            all.push(...(satellites.get(groupId) || []));
        }
        return all;
    },
}));
