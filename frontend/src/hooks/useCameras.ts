'use client';

import { useEffect } from 'react';
import axios from 'axios';
import { useCameraStore } from '@/store/cameraStore';
import { Camera } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export function useCameras(): void {
    const { setCameras } = useCameraStore();

    useEffect(() => {
        const fetchCameras = async () => {
            try {
                const res = await axios.get<{ data: Camera[] }>(`${API_URL}/cameras`);
                setCameras(res.data.data);
            } catch (err) {
                console.error('[Cameras] Fetch error:', err);
            }
        };

        fetchCameras();
        // Refresh cameras every hour
        const interval = setInterval(fetchCameras, 3600000);
        return () => clearInterval(interval);
    }, [setCameras]);
}
