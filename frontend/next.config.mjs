const backendApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendApiUrl.replace(/\/+$/, '')}/:path*`,
      },
    ];
  },
};

export default nextConfig;
