const backendTarget =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.BACKEND_URL ||
  (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith('http')
    ? process.env.NEXT_PUBLIC_API_URL
    : 'http://127.0.0.1:4000/api/v1');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendTarget.replace(/\/+$/, '')}/:path*`,
      },
    ];
  },
};

export default nextConfig;
