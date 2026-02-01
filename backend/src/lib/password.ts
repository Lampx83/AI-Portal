import crypto from "crypto"

const SALT_LEN = 16
const KEY_LEN = 64
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 }

/**
 * Hash password với scrypt (có sẵn trong Node).
 * Định dạng lưu: "scrypt$salt_hex$key_hex"
 */
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(SALT_LEN)
  const key = crypto.scryptSync(plain, salt, KEY_LEN, SCRYPT_OPTIONS)
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`
}

/**
 * So sánh mật khẩu với hash đã lưu (timing-safe).
 */
export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored || !stored.startsWith("scrypt$")) return false
  const parts = stored.split("$")
  if (parts.length !== 3) return false
  const salt = Buffer.from(parts[1], "hex")
  const keyStored = Buffer.from(parts[2], "hex")
  const key = crypto.scryptSync(plain, salt, KEY_LEN, SCRYPT_OPTIONS)
  return crypto.timingSafeEqual(keyStored, key)
}
