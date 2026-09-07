const store = new Map()

const storageDriverDefinition = {
  key: 'memory',
  create(config) {
    const prefix =
      typeof config.prefix === 'string' && config.prefix.trim().length > 0 ? config.prefix.trim() : 'mem'
    return {
      key: 'memory',
      async store(payload) {
        const storagePath = `${prefix}/${payload.fileName}`
        store.set(storagePath, Buffer.from(payload.buffer))
        return { storagePath }
      },
      async read(_partitionCode, storagePath) {
        const buffer = store.get(storagePath)
        if (!buffer) throw new Error('missing')
        return { buffer }
      },
      async delete(_partitionCode, storagePath) {
        store.delete(storagePath)
      },
      async toLocalPath() {
        throw new Error('memory driver has no local path')
      },
    }
  },
}

module.exports = { storageDriverDefinition }
