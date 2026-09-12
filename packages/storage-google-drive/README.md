# Google Drive storage provider

Env-configured attachments backend that mirrors Open Mercato's local folder layout on Google Drive.

## Drive layout

Local (per partition root):

```text
storage/attachments/{partitionCode}/org_{orgId}/tenant_{tenantId}/{timestamp}_{uuid}_{file}
```

Google Drive (under `rootFolderId`):

```text
{rootFolderId}/
  {partitionCode}/
    org_{orgId}/   # or org_shared
      tenant_{tenantId}/   # or tenant_shared
        {timestamp}_{uuid}_{file}
```

DB `storagePath` stays partition-relative (same as local): `org_…/tenant_…/{file}`.

---

## Full setup guide

### 1. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or select an existing one): **Select a project → New project**.

### 2. Enable Google Drive API

1. **APIs & Services → Library**.
2. Search for **Google Drive API** → **Enable**.

### 3. Create a service account

1. **APIs & Services → Credentials**.
2. **Create credentials → Service account**.
3. Name e.g. `open-mercato-storage` → **Create and continue** → **Done**.
4. Open the account → **Keys → Add key → Create new key → JSON**.
5. Keep the downloaded JSON for the next steps (do not commit it).

### 4. Choose the destination folder on Google Drive

1. In [Google Drive](https://drive.google.com/) create (or pick) a folder, e.g. `Open Mercato Attachments`.
2. **Share** it with the service account `client_email` as **Editor**.
3. Copy the folder ID from the URL:

```text
https://drive.google.com/drive/folders/THIS_IS_THE_FOLDER_ID
```

#### Shared Drives

If the folder is on a Shared Drive, add the service account as a member (Content manager+) and set `sharedDriveId` in the config JSON.

### 5. Create `config/provider-google_drive.ts`

With `ATTACHMENTS_STORAGE_DRIVER=google_drive`, Mercato auto-loads this file — **no extra env paths**.

```bash
cp apps/mercato/config/provider-google_drive.example.ts \
   apps/mercato/config/provider-google_drive.ts
```

Put **everything** in that one file (folder id + service account as a JS object):

```ts
export default {
  rootFolderId: 'THIS_IS_THE_FOLDER_ID',
  supportsAllDrives: true,
  credentials: {
    type: 'service_account',
    project_id: '…',
    private_key: '-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n',
    client_email: 'open-mercato-storage@….iam.gserviceaccount.com',
    // …rest of the downloaded SA JSON
  },
}
```

Optional: `import { env } from './env'` for individual fields instead of hardcoding.

JSON still works (`provider-google_drive.json`). **Lookup prefers `.ts` over `.json`.**

**Lookup order** (first existing wins):

1. `config/provider-google_drive.ts` (also `.js` / `.json`)
2. `mercato/config/provider-google_drive.*`
3. `apps/mercato/config/provider-google_drive.*`

### 6. Wire Open Mercato

Module is already enabled in `apps/mercato/src/modules.ts`.

`.env` only needs:

```bash
ATTACHMENTS_STORAGE_DRIVER=google_drive
```

Advanced (usually unnecessary): `ATTACHMENTS_STORAGE_GOOGLE_DRIVE_CONFIG_FILE` for a non-standard path; other `ATTACHMENTS_STORAGE_GOOGLE_DRIVE_*` keys are fallbacks when the config file omits a field. Sidecar `provider-google_drive.credentials.json` / `credentialsFile` remain supported but are optional.



### 7. Verify

```bash
yarn mercato storage_google_drive verify
yarn mercato storage_google_drive verify --list
yarn mercato storage_google_drive verify --ensurePartition=productsMedia
```

Then upload an attachment in the UI and confirm on Drive:

```text
{rootFolderId}/productsMedia/org_…/tenant_…/{timestamp}_{uuid}_{filename}
```

### 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `rootFolderId` / credentials errors | Missing `config/provider-google_drive.json` or wrong cwd | Create the file; run app from `apps/mercato` or set `CONFIG_FILE` to an absolute path |
| 404 / insufficient permissions | Folder not shared with `client_email` | Share folder as Editor with the SA email |
| Still writing locally | Driver not active | Set `ATTACHMENTS_STORAGE_DRIVER=google_drive` and restart |
| Shared Drive failures | Missing membership / ID | Add SA to Shared Drive; set `sharedDriveId` |

### Security checklist

- Real files under `apps/mercato/config/provider-*.json` are gitignored (only `*.example.json` is tracked).
- Never commit service account keys.
- Restrict who can edit the root Drive folder.

---

## CLI reference

```bash
yarn mercato storage_google_drive verify
yarn mercato storage_google_drive verify --list
yarn mercato storage_google_drive verify --ensurePartition=productsMedia
```
