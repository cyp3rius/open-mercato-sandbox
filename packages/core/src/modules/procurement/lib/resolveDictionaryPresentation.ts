import type { EntityManager } from '@mikro-orm/postgresql'
import { Dictionary, DictionaryEntry } from '@open-mercato/core/modules/dictionaries/data/entities'
import { normalizeDictionaryValue } from '@open-mercato/core/modules/dictionaries/lib/utils'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'

export type DictionaryPresentation = {
  value: string
  label: string
  color: string | null
  icon: string | null
}

type Scope = { tenantId: string; organizationId: string }

export async function resolveDictionaryPresentation(
  em: EntityManager,
  scope: Scope,
  dictionaryKey: string,
  rawValue: string,
  missingDictionaryMessage: string,
  missingEntryMessage: string,
): Promise<DictionaryPresentation> {
  const trimmed = rawValue.trim()
  if (!trimmed) {
    throw new CrudHttpError(400, { error: 'Value is required.' })
  }
  const dictionary = await findOneWithDecryption(
    em,
    Dictionary,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      key: dictionaryKey,
      deletedAt: null,
      isActive: true,
    },
    undefined,
    scope,
  )
  if (!dictionary) {
    throw new CrudHttpError(400, { error: missingDictionaryMessage })
  }
  const normalizedValue = normalizeDictionaryValue(trimmed)
  const entry = await findOneWithDecryption(
    em,
    DictionaryEntry,
    {
      dictionary,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      normalizedValue,
    },
    { populate: ['dictionary'] },
    scope,
  )
  if (!entry) {
    throw new CrudHttpError(400, { error: missingEntryMessage })
  }
  return {
    value: entry.value,
    label: entry.label?.trim().length ? entry.label : entry.value,
    color: entry.color ?? null,
    icon: entry.icon ?? null,
  }
}

export async function findDefaultDictionaryEntry(
  em: EntityManager,
  scope: Scope,
  dictionaryKey: string,
): Promise<DictionaryPresentation | null> {
  const dictionary = await findOneWithDecryption(
    em,
    Dictionary,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      key: dictionaryKey,
      deletedAt: null,
      isActive: true,
    },
    undefined,
    scope,
  )
  if (!dictionary) return null
  const entry = await findOneWithDecryption(
    em,
    DictionaryEntry,
    {
      dictionary,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      isDefault: true,
    },
    { populate: ['dictionary'] },
    scope,
  )
  if (!entry) return null
  return {
    value: entry.value,
    label: entry.label?.trim().length ? entry.label : entry.value,
    color: entry.color ?? null,
    icon: entry.icon ?? null,
  }
}
