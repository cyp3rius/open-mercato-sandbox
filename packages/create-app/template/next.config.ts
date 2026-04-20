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
  // Transpile @open-mercato packages that have TypeScript in src/
  // Note: @open-mercato/shared is excluded as it has pre-built dist/ files
  transpilePackages: [
    '@open-mercato/core',
    '@open-mercato/ui',
    '@open-mercato/events',
    '@open-mercato/cache',
    '@open-mercato/queue',
    '@open-mercato/search',
    '@open-mercato/content',
    '@open-mercato/onboarding',
    '@open-mercato/ai-assistant',
  ],
  serverExternalPackages: [
    'esbuild',
    '@esbuild/darwin-arm64',
    '@open-mercato/cli',
  ],
}

export default nextConfig
