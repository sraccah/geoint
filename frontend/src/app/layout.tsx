import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'GeoINT Platform — Global Intelligence Dashboard',
    description: 'Real-time geospatial intelligence: flight tracking, camera feeds, and global situational awareness.',
    icons: {
        icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="bg-hud-bg text-hud-text overflow-hidden h-screen">
                {children}
            </body>
        </html>
    );
}
