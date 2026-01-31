// lib/load-env.js
// Load .env from parent directory before Next.js starts
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

try {
  const envPath = resolve(__dirname, '../../.env')
  const envFile = readFileSync(envPath, 'utf-8')
  const envLines = envFile.split('\n')
  
  envLines.forEach(line => {
    const trimmedLine = line.trim()
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) return
    
    const equalIndex = trimmedLine.indexOf('=')
    if (equalIndex === -1) return
    
    const key = trimmedLine.substring(0, equalIndex).trim()
    const value = trimmedLine.substring(equalIndex + 1).trim()
    
    // Remove quotes if present
    const cleanValue = value.replace(/^["']|["']$/g, '')
    
    // Set in process.env (allows override via system env)
    if (!process.env[key]) {
      process.env[key] = cleanValue
    }
  })
  
  console.log('✅ Loaded .env from parent directory')
  if (process.env.AZURE_AD_CLIENT_ID) {
    console.log('✅ AZURE_AD_CLIENT_ID:', process.env.AZURE_AD_CLIENT_ID.substring(0, 8) + '...')
  }
} catch (error) {
  console.warn('⚠️  Could not load .env from parent directory:', error.message)
}
