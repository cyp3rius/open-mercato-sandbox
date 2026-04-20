import type { NextConfig } from "next";
import path from "node:path";

const optionalDbDriverStub = path.resolve(__dirname, "webpack-stubs/optional-db-driver.cjs");

const optionalKnexDriverModules = [
  'mariadb/callback',
  'libsql',
  'better-sqlite3',
] as const

const nextConfig: NextConfig = {
  distDir: '.mercato/next',
  experimental: {
    serverMinification: false,
    turbopackMinify: false,
  },
  turbopack: {
    // Monorepo root is two levels up from apps/<app>
    root: path.resolve(process.cwd(), "../.."),
    resolveAlias: Object.fromEntries(
      optionalKnexDriverModules.map((name) => [
        name,
        { browser: optionalDbDriverStub, default: name },
      ]),
    ),
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      const stubAliases = Object.fromEntries(
        optionalKnexDriverModules.map((name) => [name, optionalDbDriverStub]),
      )
      config.resolve.alias = {
        ...config.resolve.alias,
        ...stubAliases,
      }
    }
    return config
  },
  // Externalize packages that are only used in CLI context, not Next.js
  serverExternalPackages: [
    'esbuild',
    '@esbuild/darwin-arm64',
    '@open-mercato/cli',
  ],
}

export default nextConfig
