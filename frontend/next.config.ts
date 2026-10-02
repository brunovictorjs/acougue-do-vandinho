import type { NextConfig } from "next"

const backend = process.env.BACKEND_URL ?? "http://localhost:3333"

const nextConfig: NextConfig = {
  // The browser only talks to this origin; /api is forwarded to the NestJS API,
  // so the session cookie is first-party and there is no CORS in the app.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }]
  },
  experimental: {
    proxyClientMaxBodySize: "60mb",
  },
}

export default nextConfig
