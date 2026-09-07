import { Readable } from 'stream'
import { GoogleDriveStorageDriver } from '../lib/driver'
import type { DriveClient } from '../lib/client'

jest.mock('../lib/client', () => {
  const actual = jest.requireActual('../lib/client')
  return {
    ...actual,
    createGoogleDriveClient: jest.fn(),
  }
})

const { createGoogleDriveClient } = jest.requireMock('../lib/client') as {
  createGoogleDriveClient: jest.Mock
}

describe('GoogleDriveStorageDriver', () => {
  const folderIds = new Map<string, string>()
  let filesCreate: jest.Mock
  let filesList: jest.Mock
  let filesGet: jest.Mock
  let filesDelete: jest.Mock

  beforeEach(() => {
    folderIds.clear()
    folderIds.set('root::productsMedia', 'folder-partition')
    folderIds.set('folder-partition::org_o1', 'folder-org')
    folderIds.set('folder-org::tenant_t1', 'folder-tenant')

    filesCreate = jest.fn(async ({ requestBody }: { requestBody: { name: string; mimeType?: string; parents?: string[] } }) => {
      if (requestBody.mimeType === 'application/vnd.google-apps.folder') {
        const parent = requestBody.parents?.[0] ?? 'root'
        const id = `folder-${requestBody.name}`
        folderIds.set(`${parent}::${requestBody.name}`, id)
        return { data: { id } }
      }
      return { data: { id: 'file-1', name: requestBody.name } }
    })

    filesList = jest.fn(async ({ q }: { q: string }) => {
      const parentMatch = /'([^']+)' in parents/.exec(q)
      const nameMatch = /name = '([^']+)'/.exec(q)
      const parent = parentMatch?.[1]
      const name = nameMatch?.[1]
      if (!parent || !name) return { data: { files: [] } }

      if (q.includes("mimeType = 'application/vnd.google-apps.folder'")) {
        const id = folderIds.get(`${parent}::${name}`)
        return { data: { files: id ? [{ id, name }] : [] } }
      }

      if (parent === 'folder-tenant' && name.startsWith('')) {
        return { data: { files: [{ id: 'file-1', name, mimeType: 'text/plain' }] } }
      }
      return { data: { files: [] } }
    })

    filesGet = jest.fn(async () => ({ data: Buffer.from('hello-drive') }))
    filesDelete = jest.fn(async () => ({ data: {} }))

    const client: DriveClient = {
      config: {
        rootFolderId: 'root',
        supportsAllDrives: true,
      },
      supportsAllDrives: true,
      drive: {
        files: {
          create: filesCreate,
          list: filesList,
          get: filesGet,
          delete: filesDelete,
        },
      } as never,
    }
    createGoogleDriveClient.mockResolvedValue(client)
  })

  it('stores under partition/org/tenant and keeps OM-relative storagePath', async () => {
    const driver = new GoogleDriveStorageDriver({
      rootFolderId: 'root',
      credentialsJson: '{}',
      supportsAllDrives: true,
    })

    const stored = await driver.store({
      partitionCode: 'productsMedia',
      orgId: 'o1',
      tenantId: 't1',
      fileName: 'note.txt',
      buffer: Buffer.from('hello-drive'),
    })

    expect(stored.storagePath).toMatch(/^org_o1\/tenant_t1\/\d+_[a-f0-9]+_note\.txt$/)
    expect(filesCreate).toHaveBeenCalled()
    const uploadCall = filesCreate.mock.calls.find(
      (call: Array<{ media?: { body?: Readable } }>) => Boolean(call[0]?.media?.body),
    )
    expect(uploadCall?.[0].requestBody.parents).toEqual(['folder-tenant'])
    expect(uploadCall?.[0].requestBody.name).toBe(stored.storagePath.split('/').pop())
    expect(uploadCall?.[0].requestBody.appProperties).toBeUndefined()
  })

  it('reads and deletes via mirrored folder path', async () => {
    const driver = new GoogleDriveStorageDriver({
      rootFolderId: 'root',
      credentialsJson: '{}',
      supportsAllDrives: true,
    })

    const storagePath = 'org_o1/tenant_t1/123_abcd_note.txt'
    const read = await driver.read('productsMedia', storagePath)
    expect(read.buffer.toString('utf8')).toBe('hello-drive')

    await driver.delete('productsMedia', storagePath)
    expect(filesDelete).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'file-1' }),
    )
  })
})
