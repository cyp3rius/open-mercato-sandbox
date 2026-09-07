/**
 * Copy to `provider-google_drive.ts` and fill in the values below.
 *
 *   cp config/provider-google_drive.example.ts config/provider-google_drive.ts
 *
 * Then set only:
 *
 *   ATTACHMENTS_STORAGE_DRIVER=google_drive
 *
 * Optional: `import { env } from './env'` for individual secret fields.
 */
export default {
  /** Google Drive folder ID (share this folder with the service account as Editor). */
  rootFolderId: 'REPLACE_WITH_DRIVE_FOLDER_ID',

  supportsAllDrives: true,

  // Optional Shared Drive ID when the folder lives on a Team Drive:
  // sharedDriveId: 'REPLACE_WITH_SHARED_DRIVE_ID',

  /** Service account key (paste the downloaded JSON object here). */
  credentials: {
    type: 'service_account',
    project_id: 'your-gcp-project',
    private_key_id: '…',
    private_key: '-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n',
    client_email: 'open-mercato-storage@your-gcp-project.iam.gserviceaccount.com',
    client_id: '…',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/…',
  },
}
