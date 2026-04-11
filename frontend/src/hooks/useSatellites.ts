'use client';

import { useEffect } from 'react';
import axios from 'axios';
import { useSatelliteStore } from '@/store/satelliteStore';
import { SatelliteGP, SatelliteGroupDef } from '@/types/satellite';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export function useSatelliteGroups(): void {
    const { setGroups } = useSatelliteStore();

    useEffect(() => {
        axios.get<{ data: SatelliteGroupDef[] }>(`${API_URL}/satellites/groups`)
            .then((res) => setGroups(res.data.data))
            .catch((err) => console.error('[Satellites] Groups fetch error:', err.message));
    }, [setGroups]);
}

export function useSatelliteGroup(groupId: string | null): void {
    const { setSatellites, setLoading, satellites } = useSatelliteStore();

    useEffect(() => {
        if (!groupId) return;
        if (satellites.has(groupId)) return; // already loaded

        setLoading(groupId, true);
        axios.get<{ data: SatelliteGP[] }>(`${API_URL}/satellites/${groupId}`)
            .then((res) => {
                setSatellites(groupId, res.data.data);
            })
            .catch((err) => console.error(`[Satellites] ${groupId} fetch error:`, err.message))
            .finally(() => setLoading(groupId, false));
    }, [groupId, satellites, setSatellites, setLoading]);
}
