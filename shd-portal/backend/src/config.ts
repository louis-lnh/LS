import 'dotenv/config'

export type BackendConfig = {
  port: number
  databaseUrl: string
  adminApiToken: string | null
  corsOrigin: string
  nodeEnv: string
}

function optionalEnv(name: string) {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function requiredEnv(name: string) {
  const value = optionalEnv(name)
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

export function loadConfig(): BackendConfig {
  return {
    port: Number(process.env.PORT || 4201),
    databaseUrl: requiredEnv('DATABASE_URL'),
    adminApiToken: optionalEnv('SHD_ADMIN_API_TOKEN'),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    nodeEnv: process.env.NODE_ENV || 'development',
  }
}
