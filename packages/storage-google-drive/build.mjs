import * as esbuild from 'esbuild'
import { glob } from 'glob'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const entryPoints = await glob('src/**/*.{ts,tsx}', {
  cwd: __dirname,
  ignore: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
  absolute: true,
})

if (entryPoints.length === 0) {
  console.error('No entry points found!')
  process.exit(1)
}

function rewriteRelativeJsExtensions(file) {
  const fileDir = dirname(file)
  let content = readFileSync(file, 'utf-8')
  content = content.replace(/from\s+["'](\.[^"']+)["']/g, (match, importPath) => {
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) return match
    const resolvedPath = join(fileDir, importPath)
    if (existsSync(resolvedPath) && existsSync(join(resolvedPath, 'index.js'))) {
      return `from "${importPath}/index.js"`
    }
    return `from "${importPath}.js"`
  })
  content = content.replace(/import\s*\(\s*["'](\.[^"']+)["']\s*\)/g, (match, importPath) => {
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) return match
    const resolvedPath = join(fileDir, importPath)
    if (existsSync(resolvedPath) && existsSync(join(resolvedPath, 'index.js'))) {
      return `import("${importPath}/index.js")`
    }
    return `import("${importPath}.js")`
  })
  content = content.replace(/import\s+["'](\.[^"']+)["'];/g, (match, importPath) => {
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) return match
    const resolvedPath = join(fileDir, importPath)
    if (existsSync(resolvedPath) && existsSync(join(resolvedPath, 'index.js'))) {
      return `import "${importPath}/index.js";`
    }
    return `import "${importPath}.js";`
  })
  writeFileSync(file, content)
}

const addJsExtension = {
  name: 'add-js-extension',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) return
      const outputFiles = await glob('dist/**/*.js', { cwd: __dirname, absolute: true })
      for (const file of outputFiles) {
        rewriteRelativeJsExtensions(file)
      }
    })
  },
}

await esbuild.build({
  entryPoints,
  outdir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  plugins: [addJsExtension],
})

// Sync require() entry for ATTACHMENTS_STORAGE_PROVIDER_MODULES
await esbuild.build({
  entryPoints: [join(__dirname, 'src/storage-driver.ts')],
  outfile: join(__dirname, 'dist/storage-driver.cjs'),
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  bundle: true,
  external: ['googleapis', 'google-auth-library', '@open-mercato/core', '@open-mercato/shared'],
})

console.log('storage-google-drive built successfully')
