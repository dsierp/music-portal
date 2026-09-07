import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (Postgres w WASM) i pg muszą być ładowane z node_modules, nie bundlowane.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
