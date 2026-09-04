import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repository sits below another checkout with its own lockfile. Pin the
  // tracing boundary so production bundles cannot accidentally include parent
  // workspace files.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
