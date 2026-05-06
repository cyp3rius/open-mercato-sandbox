import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core'
import type { ProcedureBlock } from '../lib/procedureBlocks'

@Entity({ tableName: 'playbooks_playbooks' })
@Index({ name: 'playbooks_scope_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'playbooks_slug_idx', properties: ['organizationId', 'slug'] })
export class Playbook {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  slug!: string

  @Property({ type: 'text' })
  title!: string

  @Property({ type: 'text' })
  body!: string

  @Property({ name: 'context_tags', type: 'json' })
  contextTags: string[] = []

  @Property({ name: 'procedure_definition', type: 'json', nullable: true })
  procedureDefinition?: ProcedureBlock[] | null

  @Property({ type: 'text' })
  audience: string = 'internal'

  @Property({ type: 'int', default: 0 })
  version: number = 0

  @Property({ name: 'published_at', type: Date, nullable: true })
  publishedAt?: Date | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'playbooks_bindings' })
@Index({ name: 'playbooks_bindings_case_idx', properties: ['caseId'] })
export class PlaybookBinding {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'playbook_id', type: 'uuid' })
  playbookId!: string

  @Property({ name: 'case_id', type: 'uuid', nullable: true })
  caseId?: string | null

  @Property({ name: 'resource_type_slug', type: 'text', nullable: true })
  resourceTypeSlug?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}
