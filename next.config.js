/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ["projectpulseai.com", "demo.projectpulseai.com"] } },
  images: { remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }] },
};

module.exports = nextConfig;
