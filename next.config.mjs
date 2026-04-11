/** @type {import('next').NextConfig} */
const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  // Proxy /backend/* → Python backend (HTTP REST + option candles)
  // Proxy /ws/*      → Python backend WebSocket
  // Browser only needs port 3000; Next.js server reaches port 8000 internally.
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${BACKEND}/:path*`,
      },
      {
        source: "/ws/:path*",
        destination: `${BACKEND}/ws/:path*`,
      },
    ];
  },
};

export default nextConfig;
