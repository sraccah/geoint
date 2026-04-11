'use client';

import { useEffect } from 'react';
import axios from 'axios';
import { useSatelliteStore } from '@/store/satelliteStore';
import { SatelliteGP, SatelliteGroupDef } from '@/types/satellite';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Fetch group list once
export function useSatelliteGroups(): void {
    const { setGroups, groups } = useSatelliteStore();

    useEffect(() => {
        if (groups.length > 0) return;
        axios.get<{ data: SatelliteGroupDef[] }>(`${API_URL}/satellites/groups`)
            .then((res) => setGroups(res.data.data))
            .catch((err) => console.error('[Satellites] Groups fetch error:', err.message));
    }, [groups.length, setGroups]);
}

// Load a single group's TLE data (called for each group on mount)
export function useSatelliteGroup(groupId: string | null): void {
    const { setSatellites, setLoading, markGroupLoaded, loadedGroups } = useSatelliteStore();

    useEffect(() => {
        if (!groupId) return;
        if (loadedGroups.has(groupId)) return; // already loaded

        setLoading(groupId, true);
        axios.get<{ data: SatelliteGP[] }>(`${API_URL}/satellites/${groupId}`)
            .then((res) => {
                setSatellites(groupId, res.data.data || []);
                markGroupLoaded(groupId);
                console.log(`[Satellites] ${groupId}: ${res.data.data?.length ?? 0} loaded`);
            })
            .catch((err) => console.error(`[Satellites] ${groupId} fetch error:`, err.message))
            .finally(() => setLoading(groupId, false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);
}

// Load ALL groups eagerly — called once from the sidebar
export function useLoadAllSatelliteGroups(): void {
    const { groups, loadedGroups, setSatellites, setLoading, markGroupLoaded } = useSatelliteStore();

    useEffect(() => {
        if (groups.length === 0) return;

        for (const group of groups) {
            if (loadedGroups.has(group.id)) continue;

            setLoading(group.id, true);
            axios.get<{ data: SatelliteGP[] }>(`${API_URL}/satellites/${group.id}`)
                .then((res) => {
                    setSatellites(group.id, res.data.data || []);
                    markGroupLoaded(group.id);
                    console.log(`[Satellites] ${group.id}: ${res.data.data?.length ?? 0} loaded`);
                })
                .catch((err) => console.warn(`[Satellites] ${group.id} load error:`, err.message))
                .finally(() => setLoading(group.id, false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups.length]);
}
