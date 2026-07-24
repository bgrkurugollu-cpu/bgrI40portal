/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Ağır kütüphaneleri barrel import yerine yalnızca kullanılan modüller
    // olarak paketle — client bundle'ı ve derleme süresini küçültür.
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
};

export default nextConfig;
