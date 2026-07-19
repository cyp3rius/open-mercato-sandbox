import type { ModuleCli } from '@open-mercato/shared/modules/registry'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import fs from 'node:fs'
import path from 'node:path'
import { Playbook } from './data/entities'
import { compileProcedureDocument, type PlaybookUpsertPayload } from './lib/procedureMarkdown'
import { applyPlaybookMarkdown } from './lib/applyPlaybookMarkdown'
import { exportProcedureDocument } from './lib/procedureMarkdownExport'

type ParsedArgs = Record<string, string | boolean>

function parseArgs(rest: string[]): ParsedArgs {
  const args: ParsedArgs = {}
  for (let index = 0; index < rest.length; index += 1) {
    const part = rest[index]
    if (!part?.startsWith('--')) continue
    const [rawKey, rawValue] = part.slice(2).split('=')
    if (!rawKey) continue
    if (rawValue !== undefined) {
      args[rawKey] = rawValue
      continue
    }
    const next = rest[index + 1]
    if (next && !next.startsWith('--')) {
      args[rawKey] = next
      index += 1
      continue
    }
    args[rawKey] = true
  }
  return args
}

function stringOption(args: ParsedArgs, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = args[key]
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (trimmed.length > 0) return trimmed
  }
  return undefined
}

function booleanOption(args: ParsedArgs, ...keys: string[]): boolean {
  for (const key of keys) {
    const raw = args[key]
    if (raw === true) return true
    if (typeof raw === 'string' && ['1', 'true', 'yes'].includes(raw.toLowerCase())) return true
  }
  return false
}

function buildCommandContext(
  container: Awaited<ReturnType<typeof createRequestContainer>>,
  tenantId: string,
  organizationId: string,
): CommandRuntimeContext {
  return {
    container,
    auth: {
      sub: 'cli',
      tenantId,
      orgId: organizationId,
    } as CommandRuntimeContext['auth'],
    organizationScope: null,
    selectedOrganizationId: organizationId,
    organizationIds: [organizationId],
    request: undefined as unknown as CommandRuntimeContext['request'],
  }
}

function listMarkdownFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('_'))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b))
}

function resolveInputFiles(args: ParsedArgs): string[] {
  const file = stringOption(args, 'file', 'f')
  const dir = stringOption(args, 'dir', 'd')
  if (file && dir) {
    throw new Error('Provide either --file or --dir, not both.')
  }
  if (file) {
    const resolved = path.resolve(file)
    if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`)
    return [resolved]
  }
  if (dir) {
    const resolved = path.resolve(dir)
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Directory not found: ${resolved}`)
    }
    const files = listMarkdownFiles(resolved)
    if (!files.length) throw new Error(`No procedure markdown files in ${resolved}`)
    return files
  }
  throw new Error('Missing --file <path> or --dir <path>')
}

async function runImport(rest: string[], commandLabel: 'import' | 'apply'): Promise<void> {
  const args = parseArgs(rest)
  const tenantId = stringOption(args, 'tenant', 'tenantId', 't')
  const organizationId = stringOption(args, 'org', 'organizationId', 'orgId', 'o')
  const dryRun = booleanOption(args, 'dry-run', 'dryRun')

  if (!tenantId || !organizationId) {
    console.error(
      `Usage: mercato playbooks ${commandLabel} --tenant <tenantId> --org <organizationId> (--file <path> | --dir <path>) [--dry-run]`,
    )
    process.exitCode = 1
    return
  }

  let files: string[]
  try {
    files = resolveInputFiles(args)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
    return
  }

  const container = await createRequestContainer()
  try {
    const commandBus = container.resolve('commandBus') as CommandBus
    const em = container.resolve('em') as EntityManager
    const ctx = buildCommandContext(container, tenantId, organizationId)
    const summary = { created: 0, updated: 0, unchanged: 0, dryRun: 0, failed: 0 }

    const payloads: Array<{ file: string; payload: PlaybookUpsertPayload }> = []
    for (const file of files) {
      try {
        const source = fs.readFileSync(file, 'utf8')
        const payload = compileProcedureDocument(source)
        payloads.push({ file, payload })
        console.log(`✓ compiled ${path.basename(file)} (${payload.slug})`)
      } catch (err) {
        summary.failed += 1
        console.error(`✗ compile failed ${file}:`, err instanceof Error ? err.message : err)
      }
    }
    if (summary.failed > 0) {
      process.exitCode = 1
      console.error(`Stopped before ${commandLabel}: ${summary.failed} file(s) failed validation.`)
      return
    }

    for (const entry of payloads) {
      try {
        const source = fs.readFileSync(entry.file, 'utf8')
        const result = await applyPlaybookMarkdown({
          markdown: source,
          tenantId,
          organizationId,
          dryRun,
          commandBus,
          ctx,
          em: em.fork(),
        })
        if (result.action === 'created') {
          summary.created += 1
          console.log(`✓ created ${result.slug} → ${result.playbookId ?? '?'}`)
        } else if (result.action === 'updated') {
          summary.updated += 1
          console.log(`✓ updated ${result.slug} → ${result.playbookId ?? '?'}`)
        } else if (result.action === 'unchanged') {
          summary.unchanged += 1
          console.log(`⊘ unchanged ${result.slug} (${result.playbookId})`)
        } else {
          summary.dryRun += 1
          console.log(JSON.stringify({ action: 'dry-run', ...result.payload }, null, 2))
        }
      } catch (err) {
        summary.failed += 1
        console.error(`✗ ${commandLabel} failed ${entry.file}:`, err instanceof Error ? err.message : err)
      }
    }

    console.log('\nSummary:', summary)
    if (summary.failed > 0) process.exitCode = 1
  } finally {
    const disposable = container as unknown as { dispose?: () => Promise<void> }
    if (typeof disposable.dispose === 'function') {
      await disposable.dispose()
    }
  }
}

const importCommand: ModuleCli = {
  command: 'import',
  async run(rest) {
    await runImport(rest, 'import')
  },
}

const applyCommand: ModuleCli = {
  command: 'apply',
  async run(rest) {
    await runImport(rest, 'apply')
  },
}

const exportCommand: ModuleCli = {
  command: 'export',
  async run(rest) {
    const args = parseArgs(rest)
    const tenantId = stringOption(args, 'tenant', 'tenantId', 't')
    const organizationId = stringOption(args, 'org', 'organizationId', 'orgId', 'o')
    const slug = stringOption(args, 'slug')
    const id = stringOption(args, 'id')
    const out = stringOption(args, 'out', 'o')
    const dir = stringOption(args, 'dir', 'd')
    const exportAll = booleanOption(args, 'all')

    if (!tenantId || !organizationId) {
      console.error(
        'Usage: mercato playbooks export --tenant <tenantId> --org <organizationId> (--slug <slug> | --id <uuid> | --all) (--out <file> | --dir <path>)',
      )
      process.exitCode = 1
      return
    }

    if (!exportAll && !slug && !id) {
      console.error('Provide --slug, --id, or --all')
      process.exitCode = 1
      return
    }

    if (exportAll && !dir) {
      console.error('--all requires --dir <path>')
      process.exitCode = 1
      return
    }

    if (!exportAll && !out && !dir) {
      console.error('Provide --out <file> or --dir <path>')
      process.exitCode = 1
      return
    }

    const container = await createRequestContainer()
    try {
      const em = (container.resolve('em') as EntityManager).fork()
      const where: Record<string, unknown> = {
        tenantId,
        organizationId,
        deletedAt: null,
        isActive: true,
      }
      if (id) where.id = id
      else if (slug) where.slug = slug.trim().toLowerCase()

      const rows = exportAll || (!id && !slug)
        ? await em.find(Playbook, where, { orderBy: { slug: 'asc' } })
        : await em.find(Playbook, where, { limit: 1 })

      if (!rows.length) {
        console.error('No matching active playbooks found.')
        process.exitCode = 1
        return
      }

      if (dir) {
        const resolvedDir = path.resolve(dir)
        fs.mkdirSync(resolvedDir, { recursive: true })
      }

      for (const row of rows) {
        const markdown = exportProcedureDocument({
          slug: row.slug,
          title: row.title,
          body: row.body,
          audience: row.audience,
          contextTags: row.contextTags ?? [],
          defaultSlaDuration: row.defaultSlaDuration ?? null,
          recommendedOwnerUserIds: row.recommendedOwnerUserIds ?? [],
          procedureDefinition: row.procedureDefinition ?? [],
        })
        let targetPath: string
        if (dir) {
          targetPath = path.join(path.resolve(dir), `${row.slug}.md`)
        } else {
          targetPath = path.resolve(out!)
        }
        fs.writeFileSync(targetPath, markdown, 'utf8')
        console.log(`✓ exported ${row.slug} → ${targetPath}`)
      }
    } finally {
      const disposable = container as unknown as { dispose?: () => Promise<void> }
      if (typeof disposable.dispose === 'function') {
        await disposable.dispose()
      }
    }
  },
}

const mcpRemoteCommand: ModuleCli = {
  command: 'mcp:remote',
  async run(rest) {
    const args = parseArgs(rest)
    const debug = booleanOption(args, 'debug')
    try {
      const { runRemotePlaybooksMcpServer } = await import('./mcp/remoteStdioServer')
      await runRemotePlaybooksMcpServer({ debug })
    } catch (err) {
      console.error(err instanceof Error ? err.message : err)
      console.error('')
      console.error('Usage: mercato playbooks mcp:remote')
      console.error('Env:')
      console.error('  OPEN_MERCATO_BASE_URL   Remote CRM origin (https://…)')
      console.error('  OPEN_MERCATO_API_KEY    API key with playbooks.create + playbooks.edit (+ view)')
      console.error('  OPEN_MERCATO_ORGANIZATION_ID  Optional org override (x-organization-id)')
      process.exitCode = 1
    }
  },
}

const playbooksCliCommands = [importCommand, applyCommand, exportCommand, mcpRemoteCommand]

export default playbooksCliCommands
