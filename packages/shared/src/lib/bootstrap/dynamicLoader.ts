import type { BootstrapData } from './types'
import { findAppRoot, type AppRoot } from './appResolver'
import { registerEntityIds } from '../encryption/entityIds'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

/**
 * Compile a TypeScript file to JavaScript using esbuild bundler.
 * This bundles the file and all its dependencies, handling JSON imports properly.
 * The compiled file is written next to the source file with a .mjs extension.
 */
async function compileAndImport(tsPath: string): Promise<Record<string, unknown>> {
  const jsPath = tsPath.replace(/\.ts$/, '.mjs')

  // Check if we need to recompile (source newer than compiled)
  const tsExists = fs.existsSync(tsPath)
  const jsExists = fs.existsSync(jsPath)

  if (!tsExists) {
    throw new Error(`Generated file not found: ${tsPath}`)
  }

  const needsCompile = !jsExists ||
    fs.statSync(tsPath).mtimeMs > fs.statSync(jsPath).mtimeMs

  if (needsCompile) {
    // Dynamically import esbuild only when needed
    const esbuild = await import('esbuild')

    // The app root is 2 levels up from .mercato/generated/
    const appRoot = path.dirname(path.dirname(path.dirname(tsPath)))

    // Plugin to resolve @/ alias to app src (Next.js convention: @/ → src/)
    const aliasPlugin: import('esbuild').Plugin = {
      name: 'alias-resolver',
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => {
          const relativePath = args.path.slice(2)
          const candidates = [
            path.join(appRoot, 'src', relativePath),
            path.join(appRoot, relativePath),
          ]
          for (const base of candidates) {
            if (fs.existsSync(base + '.ts')) {
              return { path: base + '.ts' }
            }
            if (fs.existsSync(base + '.tsx')) {
              return { path: base + '.tsx' }
            }
            if (fs.existsSync(base) && fs.statSync(base).isDirectory() && fs.existsSync(path.join(base, 'index.ts'))) {
              return { path: path.join(base, 'index.ts') }
            }
            if (fs.existsSync(base)) {
              return { path: base }
            }
          }
          return { path: path.join(appRoot, 'src', relativePath) }
        })
      },
    }

    // Plugin to mark non-JSON package imports as external
    const externalNonJsonPlugin: import('esbuild').Plugin = {
      name: 'external-non-json',
      setup(build) {
        // Mark all package imports as external EXCEPT JSON files
        // Filter matches paths that don't start with . or / (package imports like @open-mercato/shared)
        build.onResolve({ filter: /^[^./]/ }, (args) => {
          // Skip Windows absolute paths (e.g., C:\...) - they're local files, not packages
          if (/^[a-zA-Z]:/.test(args.path)) {
            return null // Let esbuild handle it
          }
          // If it's a JSON file, let esbuild bundle it
          if (args.path.endsWith('.json')) {
            return null // Let esbuild handle it
          }
          // Otherwise mark as external
          return { path: args.path, external: true }
        })
      },
    }

    // Use esbuild.build with bundling to handle JSON imports
    await esbuild.build({
      entryPoints: [tsPath],
      outfile: jsPath,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node18',
      plugins: [aliasPlugin, externalNonJsonPlugin],
      // Allow JSON imports
      loader: { '.json': 'json' },
    })
  }

  // Import the compiled JavaScript
  const fileUrl = pathToFileURL(jsPath).href
  return import(fileUrl)
}


/**
 * Dynamically load bootstrap data from a resolved app directory.
 *
 * IMPORTANT: This only works in unbundled contexts (CLI, tsx).
 * Do NOT use this in Next.js bundled code - use static imports instead.
 *
 * For CLI context, we skip loading modules.generated.ts which has Next.js dependencies.
 * CLI commands are discovered separately via the CLI module system.
 *
 * @param appRoot - Optional explicit app root path. If not provided, will search from cwd.
 * @returns The loaded bootstrap data
 * @throws Error if app root cannot be found or generated files are missing
 */
export async function loadBootstrapData(appRoot?: string): Promise<BootstrapData> {
  const resolved: AppRoot | null = appRoot
    ? {
        generatedDir: path.join(appRoot, '.mercato', 'generated'),
        appDir: appRoot,
        mercatoDir: path.join(appRoot, '.mercato'),
      }
    : findAppRoot()

  if (!resolved) {
    throw new Error(
      'Could not find app root with .mercato/generated directory. ' +
        'Make sure you run this command from within a Next.js app directory, ' +
        'or run "yarn mercato generate" first to create the generated files.',
    )
  }

  const { generatedDir } = resolved

  // IMPORTANT: Load entity IDs FIRST and register them before loading modules.
  // This is because modules (e.g., ce.ts files) use E.xxx.xxx at module scope,
  // and they need entity IDs to be available when they're imported.
  const entityIdsModule = await compileAndImport(path.join(generatedDir, 'entities.ids.generated.ts'))
  registerEntityIds(entityIdsModule.E as BootstrapData['entityIds'])

  // Now load the rest of the generated files.
  // modules.cli.generated.ts excludes Next.js-dependent code (routes, APIs, widgets)
  const [
    modulesModule,
    entitiesModule,
    diModule,
    searchModule,
  ] = await Promise.all([
    compileAndImport(path.join(generatedDir, 'modules.cli.generated.ts')),
    compileAndImport(path.join(generatedDir, 'entities.generated.ts')),
    compileAndImport(path.join(generatedDir, 'di.generated.ts')),
    compileAndImport(path.join(generatedDir, 'search.generated.ts')).catch(() => ({ searchModuleConfigs: [] })),
  ])

  return {
    modules: modulesModule.modules as BootstrapData['modules'],
    entities: entitiesModule.entities as BootstrapData['entities'],
    diRegistrars: diModule.diRegistrars as BootstrapData['diRegistrars'],
    entityIds: entityIdsModule.E as BootstrapData['entityIds'],
    // Search configs are needed by workers for indexing
    searchModuleConfigs: (searchModule.searchModuleConfigs ?? []) as BootstrapData['searchModuleConfigs'],
    // Empty UI-related data - not needed for CLI
    dashboardWidgetEntries: [],
    injectionWidgetEntries: [],
    injectionTables: [],
    interceptorEntries: [],
    componentOverrideEntries: [],
  }
}

/**
 * Create and execute bootstrap in CLI context.
 *
 * This is a convenience function that finds the app root, loads the generated
 * data dynamically, and runs bootstrap. Use this in CLI entry points.
 *
 * Returns the loaded bootstrap data so the CLI can register modules directly
 * (avoids module resolution issues when importing @open-mercato/cli/mercato).
 *
 * @param appRoot - Optional explicit app root path
 * @returns The loaded bootstrap data (modules, entities, etc.)
 */
export async function bootstrapFromAppRoot(appRoot?: string): Promise<BootstrapData> {
  const { createBootstrap, waitForAsyncRegistration } = await import('./factory.js')
  const resolved: AppRoot | null = appRoot
    ? {
        generatedDir: path.join(appRoot, '.mercato', 'generated'),
        appDir: appRoot,
        mercatoDir: path.join(appRoot, '.mercato'),
      }
    : findAppRoot()
  const data = await loadBootstrapData(appRoot)
  const bootstrap = createBootstrap(data)
  bootstrap()
  await waitForAsyncRegistration()

  if (resolved) {
    try {
      const regsModule = await compileAndImport(
        path.join(resolved.generatedDir, 'bootstrap-registrations.generated.ts'),
      )
      const run = regsModule.runBootstrapRegistrations
      if (typeof run === 'function') {
        run()
      }
    } catch (error) {
      console.warn(
        '[bootstrap] bootstrap registrations failed:',
        error instanceof Error ? error.message : error,
      )
    }
  }

  return data
}
