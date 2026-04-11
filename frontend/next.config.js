/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
    transpilePackages: ['maplibre-gl'],
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            'mapbox-gl': 'maplibre-gl',
        };
        return config;
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: '**' },
        ],
    },
};

module.exports = nextConfig;
