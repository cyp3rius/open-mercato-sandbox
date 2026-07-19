import fs from 'node:fs'
import path from 'node:path'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { AwilixContainer } from 'awilix'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { applyPlaybookMarkdown } from './applyPlaybookMarkdown'

function resolveProcedureContentDirs(): string[] {
  const candidates = [
    path.resolve(process.cwd(), 'apps/mercato/content/procedures'),
    path.resolve(process.cwd(), 'content/procedures'),
    path.resolve(process.cwd(), '../../apps/mercato/content/procedures'),
  ]
  return candidates.filter((dir) => {
    try {
      return fs.existsSync(dir) && fs.statSync(dir).isDirectory()
    } catch {
      return false
    }
  })
}

function listSeedMarkdownFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('_'))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b))
}

/**
 * Fail-soft seed of demo procedure Markdown files into the tenant/org.
 * Skips when content directory is missing (e.g. packaged installs without app content).
 */
export async function seedProcedureMarkdownExamples(params: {
  container: AwilixContainer
  em: EntityManager
  tenantId: string
  organizationId: string
}): Promise<{ imported: number; skipped: number; failed: number }> {
  const dirs = resolveProcedureContentDirs()
  if (!dirs.length) {
    console.warn('[playbooks.seed] No content/procedures directory found; skipping demo procedures')
    return { imported: 0, skipped: 1, failed: 0 }
  }

  const files = listSeedMarkdownFiles(dirs[0]!)
  if (!files.length) {
    console.warn(`[playbooks.seed] No procedure markdown files in ${dirs[0]}`)
    return { imported: 0, skipped: 1, failed: 0 }
  }

  const commandBus = params.container.resolve('commandBus') as CommandBus
  const ctx: CommandRuntimeContext = {
    container: params.container,
    auth: {
      sub: 'setup',
      tenantId: params.tenantId,
      orgId: params.organizationId,
    } as CommandRuntimeContext['auth'],
    organizationScope: null,
    selectedOrganizationId: params.organizationId,
    organizationIds: [params.organizationId],
    request: undefined as unknown as CommandRuntimeContext['request'],
  }

  let imported = 0
  let failed = 0
  for (const file of files) {
    try {
      const markdown = fs.readFileSync(file, 'utf8')
      const result = await applyPlaybookMarkdown({
        markdown,
        tenantId: params.tenantId,
        organizationId: params.organizationId,
        commandBus,
        ctx,
        em: params.em.fork(),
      })
      imported += 1
      console.log(`[playbooks.seed] ${result.action} ${result.slug} (${path.basename(file)})`)
    } catch (err) {
      failed += 1
      console.warn(
        `[playbooks.seed] failed ${path.basename(file)}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  return { imported, skipped: 0, failed }
}
