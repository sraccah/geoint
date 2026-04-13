'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useCameras } from '@/hooks/useCameras';
import { TopBar } from '@/components/HUD/TopBar';
import { StatusBar } from '@/components/HUD/StatusBar';
import { FlightDetailsPanel } from '@/components/Details/FlightDetailsPanel';
import { SatelliteDetails } from '@/components/Details/SatelliteDetails';
import { AINewsPanel } from '@/components/Details/AINewsPanel';
import { CameraViewer } from '@/components/Details/CameraViewer';
import { useUIStore } from '@/store/uiStore';
import { useFlightStore } from '@/store/flightStore';
import { useSatelliteStore } from '@/store/satelliteStore';
import { useAIStore } from '@/store/aiStore';

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
    const { fetchStatus } = useAIStore();

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    // Right panel content:
    // 1. Satellite selected → satellite details
    // 2. Flight selected → flight details
    // 3. Nothing selected → AI news feed (last 24h)
    const rightPanelContent = selectedSatellite
        ? <SatelliteDetails />
        : selectedFlight
            ? <FlightDetailsPanel />
            : <AINewsPanel />;

    // Always show right panel (AI news when nothing selected)
    const showRightPanel = true;

    return (
        <div className="flex flex-col h-screen bg-hud-bg overflow-hidden">
            <TopBar />
            <div className="flex flex-1 overflow-hidden relative">
                {leftPanelOpen && (
                    <div className="w-64 flex flex-col z-10 h-full overflow-hidden">
                        <LeftPanel />
                    </div>
                )}
                <div className="flex-1 relative">
                    <MapView />
                </div>
                {showRightPanel && (
                    <div className="w-72 z-10 animate-fade-in h-full">
                        {rightPanelContent}
                    </div>
                )}
            </div>
            <StatusBar />
            {cameraViewerOpen && <CameraViewer />}
        </div>
    );
}
