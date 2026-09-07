import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import {
  buildRelativeStoragePath,
  resolveDriveFolderSegments,
  resolveOrgSegment,
  resolveTenantSegment,
  resolveUploadFolderSegments,
  sanitizeStorageRelativePath,
} from '../lib/paths'
import { parseGoogleDriveStorageConfig } from '../lib/config'
import {
  defaultGoogleDriveConfigFileCandidates,
  readGoogleDriveProviderFile,
  resolveGoogleDriveConfigFilePath,
} from '../lib/configFile'

describe('google drive path mirroring', () => {
  it('mirrors local org/tenant segments under partition folder', () => {
    expect(resolveOrgSegment('abc')).toBe('org_abc')
    expect(resolveOrgSegment(null)).toBe('org_shared')
    expect(resolveTenantSegment('t1')).toBe('tenant_t1')
    expect(resolveTenantSegment('')).toBe('tenant_shared')

    expect(
      resolveUploadFolderSegments({
        partitionCode: 'productsMedia',
        orgId: 'o1',
        tenantId: 't1',
      }),
    ).toEqual(['productsMedia', 'org_o1', 'tenant_t1'])

    const storagePath = buildRelativeStoragePath({
      orgId: 'o1',
      tenantId: 't1',
      storedName: '123_abcd_file.pdf',
    })
    expect(storagePath).toBe('org_o1/tenant_t1/123_abcd_file.pdf')

    expect(resolveDriveFolderSegments('productsMedia', storagePath)).toEqual({
      folderSegments: ['productsMedia', 'org_o1', 'tenant_t1'],
      fileName: '123_abcd_file.pdf',
    })
  })

  it('sanitizes traversal in storage paths', () => {
    expect(sanitizeStorageRelativePath('../org_x/tenant_y/a.txt')).toBe('org_x/tenant_y/a.txt')
  })
})

describe('google drive config', () => {
  it('requires root folder and credentials', () => {
    expect(() => parseGoogleDriveStorageConfig({}, { cwd: os.tmpdir() })).toThrow(/rootFolderId/)
    expect(() =>
      parseGoogleDriveStorageConfig(
        {
          rootFolderId: 'folder-1',
        },
        { cwd: os.tmpdir() },
      ),
    ).toThrow(/credentials/)
  })

  it('accepts folderId alias and credentials file', () => {
    const parsed = parseGoogleDriveStorageConfig(
      {
        folderId: 'root-123',
        credentialsFile: '/tmp/sa.json',
        supportsAllDrives: 'false',
      },
      { cwd: os.tmpdir() },
    )
    expect(parsed.rootFolderId).toBe('root-123')
    expect(parsed.credentialsFile).toBe('/tmp/sa.json')
    expect(parsed.supportsAllDrives).toBe(false)
  })

  it('loads provider JSON from config/provider-google_drive.json', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'om-gdrive-config-'))
    const configDir = path.join(root, 'config')
    await fs.mkdir(configDir)
    const filePath = path.join(configDir, 'provider-google_drive.json')
    await fs.writeFile(
      filePath,
      JSON.stringify({
        rootFolderId: 'folder-from-file',
        supportsAllDrives: false,
        credentials: {
          type: 'service_account',
          client_email: 'sa@example.iam.gserviceaccount.com',
          private_key: 'dummy',
        },
      }),
    )

    expect(resolveGoogleDriveConfigFilePath({ cwd: root })).toBe(filePath)
    expect(defaultGoogleDriveConfigFileCandidates(root)).toContain(filePath)

    const parsed = parseGoogleDriveStorageConfig({}, { cwd: root })
    expect(parsed.rootFolderId).toBe('folder-from-file')
    expect(parsed.supportsAllDrives).toBe(false)
    expect(parsed.configFilePath).toBe(filePath)
    expect(JSON.parse(parsed.credentialsJson || '{}').client_email).toBe(
      'sa@example.iam.gserviceaccount.com',
    )

    await fs.rm(root, { recursive: true, force: true })
  })

  it('prefers provider-google_drive.js over .json and supports module exports', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'om-gdrive-js-'))
    const configDir = path.join(root, 'config')
    await fs.mkdir(configDir)
    await fs.writeFile(
      path.join(configDir, 'provider-google_drive.json'),
      JSON.stringify({ rootFolderId: 'from-json', credentialsFile: '/tmp/sa.json' }),
    )
    const jsPath = path.join(configDir, 'provider-google_drive.js')
    await fs.writeFile(
      jsPath,
      `module.exports = {
        rootFolderId: 'from-js',
        credentials: { type: 'service_account', client_email: 'js@example.iam.gserviceaccount.com', private_key: 'x' }
      }`,
    )

    expect(resolveGoogleDriveConfigFilePath({ cwd: root })).toBe(jsPath)
    const parsed = parseGoogleDriveStorageConfig({}, { cwd: root })
    expect(parsed.rootFolderId).toBe('from-js')
    expect(JSON.parse(parsed.credentialsJson || '{}').client_email).toBe(
      'js@example.iam.gserviceaccount.com',
    )

    await fs.rm(root, { recursive: true, force: true })
  })

  it('auto-loads sidecar provider-google_drive.credentials.json', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'om-gdrive-sidecar-'))
    const configDir = path.join(root, 'config')
    await fs.mkdir(configDir)
    await fs.writeFile(
      path.join(configDir, 'provider-google_drive.json'),
      JSON.stringify({ rootFolderId: 'folder-sidecar' }),
    )
    await fs.writeFile(
      path.join(configDir, 'provider-google_drive.credentials.json'),
      JSON.stringify({
        type: 'service_account',
        client_email: 'sidecar@example.iam.gserviceaccount.com',
        private_key: 'dummy',
      }),
    )

    const parsed = parseGoogleDriveStorageConfig({}, { cwd: root })
    expect(parsed.rootFolderId).toBe('folder-sidecar')
    expect(parsed.credentialsFile).toBe(
      path.join(configDir, 'provider-google_drive.credentials.json'),
    )

    await fs.rm(root, { recursive: true, force: true })
  })
})
