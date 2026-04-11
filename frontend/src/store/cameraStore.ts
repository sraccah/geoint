import { create } from 'zustand';
import { Camera } from '@/types';

interface CameraStore {
    cameras: Camera[];
    setCameras: (cameras: Camera[]) => void;
}

export const useCameraStore = create<CameraStore>((set) => ({
    cameras: [],
    setCameras: (cameras) => set({ cameras }),
}));
