import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cravatar.cn",
      },
      {
        protocol: "https",
        hostname: "cravatar.com",
      },
      {
        protocol: "https",
        hostname: "cn.cravatar.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "kanle.net",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/post/:id",
        destination: "/moments/:id",
        permanent: true,
      },
      {
        source: "/profile",
        destination: "/archives",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
