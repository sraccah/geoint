'use client';

import dynamic from 'next/dynamic';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useCameras } from '@/hooks/useCameras';
import { TopBar } from '@/components/HUD/TopBar';
import { StatusBar } from '@/components/HUD/StatusBar';
import { DataLayersPanel } from '@/components/Sidebar/DataLayersPanel';
import { FiltersPanel } from '@/components/Sidebar/FiltersPanel';
import { LeftPanel } from '@/components/Sidebar/LeftPanel';
import { FlightDetailsPanel } from '@/components/Details/FlightDetailsPanel';
import { SatelliteDetails } from '@/components/Details/SatelliteDetails';
import { CameraViewer } from '@/components/Details/CameraViewer';
import { useUIStore } from '@/store/uiStore';
import { useFlightStore } from '@/store/flightStore';
import { useSatelliteStore } from '@/store/satelliteStore';

const MapView = dynamic(() => import('@/components/Map/MapView'), {
    ssr: false,
    loading: () => (
        <div className="flex-1 flex items-center justify-center bg-hud-bg">
            <div className="text-center">
                <div className="text-hud-cyan font-mono text-sm animate-pulse">INITIALIZING MAP SYSTEMS...</div>
                <div className="mt-2 text-hud-text-dim text-xs">Loading geospatial data</div>
            </div>
        </div>
    ),
});

export default function HomePage() {
    useWebSocket();
    useCameras();

    const { leftPanelOpen, rightPanelOpen, cameraViewerOpen } = useUIStore();
    const { selectedFlight } = useFlightStore();
    const { selectedSatellite } = useSatelliteStore();

    const showRightPanel = selectedFlight || selectedSatellite || rightPanelOpen;

    return (
        <div className="flex flex-col h-screen bg-hud-bg overflow-hidden">
            <TopBar />

            <div className="flex flex-1 overflow-hidden relative">
                {/* Left Panel */}
                {leftPanelOpen && (
                    <div className="w-64 flex flex-col z-10 animate-fade-in h-full overflow-hidden">
                        <LeftPanel />
                    </div>
                )}

                {/* Map */}
                <div className="flex-1 relative">
                    <MapView />
                </div>

                {/* Right Panel — flight or satellite details */}
                {showRightPanel && (
                    <div className="w-72 z-10 animate-fade-in">
                        {selectedSatellite ? <SatelliteDetails /> : <FlightDetailsPanel />}
                    </div>
                )}
            </div>

            <StatusBar />

            {cameraViewerOpen && <CameraViewer />}
        </div>
    );
}
