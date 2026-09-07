# Local provider configuration

With `ATTACHMENTS_STORAGE_DRIVER=google_drive`, Open Mercato auto-loads
`config/provider-google_drive.ts` (also `.js` / `.json`).

```bash
cp config/provider-google_drive.example.ts config/provider-google_drive.ts
# paste rootFolderId + service-account object into `credentials`
```

`.env` only needs:

```bash
ATTACHMENTS_STORAGE_DRIVER=google_drive
```

Optional: `import { env } from './env'` inside the `.ts` file for individual fields.

See `packages/storage-google-drive/README.md`.
