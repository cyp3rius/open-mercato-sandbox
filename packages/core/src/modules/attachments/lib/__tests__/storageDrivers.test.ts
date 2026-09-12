import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import {
  getStorageDriverFactory,
  readStorageDriverConfigFromEnv,
  resetStorageDriverFactoryForTests,
  resolveDefaultStorageDriverKey,
  StorageDriverFactory,
  toStorageDriverEnvFragment,
} from '../drivers'
import type { StorageDriver } from '../drivers'

describe('storage drivers', () => {
  let tempRoot: string
  const previousDriverEnv = process.env.ATTACHMENTS_STORAGE_DRIVER
  const previousModulesEnv = process.env.ATTACHMENTS_STORAGE_PROVIDER_MODULES
  const previousPartitionEnv = process.env.ATTACHMENTS_PARTITION_TEST_PART_ROOT
  const previousMemoryPrefix = process.env.ATTACHMENTS_STORAGE_MEMORY_PREFIX

  beforeEach(async () => {
    resetStorageDriverFactoryForTests()
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'om-attachments-'))
    process.env.ATTACHMENTS_PARTITION_TEST_PART_ROOT = tempRoot
    delete process.env.ATTACHMENTS_STORAGE_DRIVER
    delete process.env.ATTACHMENTS_STORAGE_PROVIDER_MODULES
    delete process.env.ATTACHMENTS_STORAGE_MEMORY_PREFIX
  })

  afterEach(async () => {
    resetStorageDriverFactoryForTests()
    if (previousDriverEnv === undefined) delete process.env.ATTACHMENTS_STORAGE_DRIVER
    else process.env.ATTACHMENTS_STORAGE_DRIVER = previousDriverEnv
    if (previousModulesEnv === undefined) delete process.env.ATTACHMENTS_STORAGE_PROVIDER_MODULES
    else process.env.ATTACHMENTS_STORAGE_PROVIDER_MODULES = previousModulesEnv
    if (previousPartitionEnv === undefined) delete process.env.ATTACHMENTS_PARTITION_TEST_PART_ROOT
    else process.env.ATTACHMENTS_PARTITION_TEST_PART_ROOT = previousPartitionEnv
    if (previousMemoryPrefix === undefined) delete process.env.ATTACHMENTS_STORAGE_MEMORY_PREFIX
    else process.env.ATTACHMENTS_STORAGE_MEMORY_PREFIX = previousMemoryPrefix
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('defaults to local driver via env', () => {
    expect(resolveDefaultStorageDriverKey()).toBe('local')
    process.env.ATTACHMENTS_STORAGE_DRIVER = 'custom'
    expect(resolveDefaultStorageDriverKey()).toBe('custom')
  })

  it('maps ATTACHMENTS_STORAGE_<DRIVER>_* env into config', () => {
    expect(toStorageDriverEnvFragment('google_drive')).toBe('GOOGLE_DRIVE')
    const config = readStorageDriverConfigFromEnv('google_drive', {
      ATTACHMENTS_STORAGE_GOOGLE_DRIVE_FOLDER_ID: 'folder-1',
      ATTACHMENTS_STORAGE_GOOGLE_DRIVE_CLIENT_EMAIL: 'a@b.c',
      UNRELATED: 'x',
    })
    expect(config).toEqual({
      folderId: 'folder-1',
      clientEmail: 'a@b.c',
    })
  })

  it('round-trips store/read/delete on local driver', async () => {
    const driver = getStorageDriverFactory().resolve('local')
    const stored = await driver.store({
      partitionCode: 'test_part',
      orgId: 'org-1',
      tenantId: 'tenant-1',
      fileName: 'hello.txt',
      buffer: Buffer.from('hello-world'),
    })
    expect(stored.storagePath).toContain('org_org-1')
    expect(stored.storagePath).toContain('tenant_tenant-1')

    const read = await driver.read('test_part', stored.storagePath)
    expect(read.buffer.toString('utf8')).toBe('hello-world')

    const local = await driver.toLocalPath('test_part', stored.storagePath)
    expect(local.filePath).toContain(tempRoot)
    await local.cleanup()

    await driver.delete('test_part', stored.storagePath)
    await expect(driver.read('test_part', stored.storagePath)).rejects.toBeTruthy()
  })

  it('loads provider modules from ATTACHMENTS_STORAGE_PROVIDER_MODULES without register()', async () => {
    const fixturePath = path.resolve(__dirname, '../drivers/__fixtures__/memoryProvider.fixture.cjs')
    const factory = new StorageDriverFactory({
      ATTACHMENTS_STORAGE_PROVIDER_MODULES: fixturePath,
      ATTACHMENTS_STORAGE_DRIVER: 'memory',
      ATTACHMENTS_STORAGE_MEMORY_PREFIX: 'envprefix',
    })

    expect(factory.listRegisteredKeys()).toContain('memory')
    const driver = factory.resolveDefault()
    expect(driver.key).toBe('memory')

    const stored = await driver.store({
      partitionCode: 'test_part',
      orgId: null,
      tenantId: null,
      fileName: 'a.bin',
      buffer: Buffer.from([1, 2, 3]),
    })
    expect(stored.storagePath).toBe('envprefix/a.bin')
    const read = await driver.read('test_part', stored.storagePath)
    expect(Buffer.from(read.buffer)).toEqual(Buffer.from([1, 2, 3]))
  })

  it('falls back to local for unknown drivers and supports register() escape hatch', async () => {
    const factory = getStorageDriverFactory()
    expect(factory.resolve('missing').key).toBe('local')

    const memory = new Map<string, Buffer>()
    const custom: StorageDriver = {
      key: 'memory-manual',
      async store(payload) {
        const storagePath = `mem/${payload.fileName}`
        memory.set(storagePath, payload.buffer)
        return { storagePath }
      },
      async read(_partitionCode, storagePath) {
        const buffer = memory.get(storagePath)
        if (!buffer) throw new Error('missing')
        return { buffer }
      },
      async delete(_partitionCode, storagePath) {
        memory.delete(storagePath)
      },
      async toLocalPath() {
        throw new Error('not used')
      },
    }
    factory.register('memory-manual', () => custom)
    const driver = factory.resolve('memory-manual')
    const stored = await driver.store({
      partitionCode: 'test_part',
      orgId: null,
      tenantId: null,
      fileName: 'a.bin',
      buffer: Buffer.from([1, 2, 3]),
    })
    const read = await driver.read('test_part', stored.storagePath)
    expect(Buffer.from(read.buffer)).toEqual(Buffer.from([1, 2, 3]))
  })

  it('rejects writes on legacyPublic driver', async () => {
    const driver = getStorageDriverFactory().resolve('legacyPublic')
    await expect(
      driver.store({
        partitionCode: 'test_part',
        orgId: null,
        tenantId: null,
        fileName: 'x.txt',
        buffer: Buffer.from('x'),
      }),
    ).rejects.toThrow(/read-only/)
  })
})
