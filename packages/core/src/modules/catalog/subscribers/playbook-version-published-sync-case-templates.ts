import {
  syncProductCaseTemplatesOnPlaybookVersion,
  type PlaybookVersionPublishedPayload,
} from '../lib/syncProductCaseTemplatesOnPlaybookVersion'

export const metadata = {
  event: 'playbooks.playbook.version_published',
  persistent: true,
  id: 'catalog:playbook-version-sync-case-templates',
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(
  payload: PlaybookVersionPublishedPayload,
  ctx: ResolverContext,
): Promise<void> {
  try {
    await syncProductCaseTemplatesOnPlaybookVersion(payload, ctx)
  } catch (err) {
    console.error('[catalog:playbook-version-sync-case-templates] failed', err)
  }
}
