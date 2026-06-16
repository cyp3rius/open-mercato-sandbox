/**
 * PM2 — RS Moto CRM (Open Mercato)
 *
 * Prerequisites on server:
 *   1. cp apps/mercato/.env.production apps/mercato/.env
 *   2. yarn install && yarn build && yarn db:migrate
 *   3. pm2 start ecosystem.config.cjs
 *
 * Commands:
 *   pm2 logs rsmoto-crm
 *   pm2 reload rsmoto-crm
 *   pm2 save && pm2 startup   # persist across reboot
 */
const path = require('path')
const fs = require('fs')
const dotenv = require('dotenv')

const rootDir = __dirname
const appDir = path.join(rootDir, 'apps', 'mercato')
const mercatoBin = path.join(rootDir, 'node_modules', '@open-mercato', 'cli', 'bin', 'mercato')
const envFile = path.join(appDir, '.env')
const logsDir = path.join(rootDir, 'logs', 'pm2')

if (!fs.existsSync(mercatoBin)) {
  console.warn(`[pm2] mercato CLI not found at ${mercatoBin} — run yarn install first`)
}

if (!fs.existsSync(envFile)) {
  console.warn(`[pm2] missing ${envFile} — copy .env.production to .env before start`)
}

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const fileEnv = dotenv.config({ path: envFile }).parsed ?? {}

module.exports = {
  apps: [
    {
      name: 'rsmoto-crm',
      cwd: appDir,
      script: mercatoBin,
      args: 'server start',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1500M',
      kill_timeout: 15000,
      listen_timeout: 30000,
      merge_logs: true,
      time: true,
      env: {
        ...fileEnv,
        NODE_ENV: 'production',
        PORT: fileEnv.PORT || '3000',
      },
      error_file: path.join(logsDir, 'rsmoto-crm-error.log'),
      out_file: path.join(logsDir, 'rsmoto-crm-out.log'),
    },
  ],
}
