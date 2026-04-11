import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Intelligence dashboard palette
                'hud-bg': '#050a0f',
                'hud-panel': '#0a1520',
                'hud-border': '#0d2137',
                'hud-border-bright': '#1a4a6e',
                'hud-cyan': '#00d4ff',
                'hud-cyan-dim': '#0099bb',
                'hud-green': '#00ff88',
                'hud-green-dim': '#00aa55',
                'hud-amber': '#ffaa00',
                'hud-red': '#ff3355',
                'hud-purple': '#aa44ff',
                'hud-text': '#a0c4d8',
                'hud-text-bright': '#e0f4ff',
                'hud-text-dim': '#4a7a99',
            },
            fontFamily: {
                mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'scan': 'scan 2s linear infinite',
                'blink': 'blink 1s step-end infinite',
                'fade-in': 'fadeIn 0.3s ease-in-out',
            },
            keyframes: {
                scan: {
                    '0%': { transform: 'translateY(-100%)' },
                    '100%': { transform: 'translateY(100%)' },
                },
                blink: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0' },
                },
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(4px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
};

export default config;
