'use client';

import dynamic from 'next/dynamic';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useCameras } from '@/hooks/useCameras';
import { TopBar } from '@/components/HUD/TopBar';
import { StatusBar } from '@/components/HUD/StatusBar';
import { FlightDetailsPanel } from '@/components/Details/FlightDetailsPanel';
import { SatelliteDetails } from '@/components/Details/SatelliteDetails';
import { CameraViewer } from '@/components/Details/CameraViewer';
import { useUIStore } from '@/store/uiStore';
import { useFlightStore } from '@/store/flightStore';
import { useSatelliteStore } from '@/store/satelliteStore';

// SSR disabled for all interactive panels — they use browser-only APIs
// (Radix sliders, MapLibre, Zustand Sets/Maps)
const MapView = dynamic(() => import('@/components/Map/MapView'), { ssr: false });
const LeftPanel = dynamic(
    () => import('@/components/Sidebar/LeftPanel').then((m) => ({ default: m.LeftPanel })),
    { ssr: false }
);

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
                    <div className="w-64 flex flex-col z-10 h-full overflow-hidden">
                        <LeftPanel />
                    </div>
                )}

                {/* Map */}
                <div className="flex-1 relative">
                    <MapView />
                </div>

                {/* Right Panel */}
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
