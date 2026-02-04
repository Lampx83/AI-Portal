// lib/load-env.mjs
// Load .env from parent directory before Next.js starts (optional; Docker/CI may not have .env)
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

;(function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../../.env')
    if (!existsSync(envPath)) return
    const envFile = readFileSync(envPath, 'utf-8')
    const envLines = envFile.split('\n')

    envLines.forEach(line => {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) return

      const equalIndex = trimmedLine.indexOf('=')
      if (equalIndex === -1) return

      const key = trimmedLine.substring(0, equalIndex).trim()
      const value = trimmedLine.substring(equalIndex + 1).trim()
      const cleanValue = value.replace(/^["']|["']$/g, '')

      if (!process.env[key]) {
        process.env[key] = cleanValue
      }
    })
  } catch (error) {
    console.warn('⚠️  Could not load .env from parent directory:', error.message)
  }
})()
