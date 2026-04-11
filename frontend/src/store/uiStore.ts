import { create } from 'zustand';
import { Camera } from '@/types';

interface UIStore {
    leftPanelOpen: boolean;
    rightPanelOpen: boolean;
    selectedCamera: Camera | null;
    cameraViewerOpen: boolean;
    showCameras: boolean;
    showFlights: boolean;
    showHeatmap: boolean;
    mapStyle: 'dark' | 'satellite' | 'terrain';

    toggleLeftPanel: () => void;
    toggleRightPanel: () => void;
    selectCamera: (camera: Camera | null) => void;
    setCameraViewerOpen: (open: boolean) => void;
    toggleCameras: () => void;
    toggleFlights: () => void;
    toggleHeatmap: () => void;
    setMapStyle: (style: 'dark' | 'satellite' | 'terrain') => void;
}

export const useUIStore = create<UIStore>((set) => ({
    leftPanelOpen: true,
    rightPanelOpen: false,
    selectedCamera: null,
    cameraViewerOpen: false,
    showCameras: true,
    showFlights: true,
    showHeatmap: false,
    mapStyle: 'dark',

    toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
    toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
    selectCamera: (camera) => set({ selectedCamera: camera, cameraViewerOpen: !!camera }),
    setCameraViewerOpen: (open) => set({ cameraViewerOpen: open }),
    toggleCameras: () => set((s) => ({ showCameras: !s.showCameras })),
    toggleFlights: () => set((s) => ({ showFlights: !s.showFlights })),
    toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
    setMapStyle: (style) => set({ mapStyle: style }),
}));
